// Copyright (C) Moondance Labs Ltd.
// This file is part of Tanssi.

// Tanssi is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Tanssi is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Tanssi.  If not, see <http://www.gnu.org/licenses/>

use frame_support::traits::OnInitialize;
use pallet_external_validators::traits::ActiveEraInfo;
use pallet_external_validators::traits::EraIndex;
use pallet_external_validators::traits::EraIndexProvider;
use pallet_external_validators::traits::ExternalIndexProvider;
use pallet_external_validators::traits::InvulnerablesProvider;
use {
    crate as external_validator_slashes,
    core::cell::RefCell,
    frame_support::{
        parameter_types,
        traits::{ConstU128, ConstU16, ConstU32, ConstU64, Get},
        weights::constants::RocksDbWeight,
    },
    frame_system as system,
    snowbridge_outbound_queue_primitives::{SendError, SendMessageFeeProvider},
    sp_core::H256,
    sp_runtime::{
        testing::UintAuthorityId,
        traits::{BlakeTwo256, ConvertInto, IdentityLookup},
        BuildStorage,
    },
    sp_staking::SessionIndex,
};

type Block = frame_system::mocking::MockBlock<Test>;

// Configure a mock runtime to test the pallet.
frame_support::construct_runtime!(
    pub enum Test
    {
        System: frame_system,
        Session: pallet_session,
        Historical: pallet_session::historical,
        ExternalValidatorSlashes: external_validator_slashes,
        Timestamp: pallet_timestamp,
    }
);

impl pallet_timestamp::Config for Test {
    type Moment = u64;
    type OnTimestampSet = ();
    type MinimumPeriod = ConstU64<5>;
    type WeightInfo = ();
}

impl system::Config for Test {
    type BaseCallFilter = frame_support::traits::Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = RocksDbWeight;
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type Nonce = u64;
    type Block = Block;
    type Hash = H256;
    type Hashing = BlakeTwo256;
    type AccountId = u64;
    type Lookup = IdentityLookup<Self::AccountId>;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = ConstU64<250>;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = ();
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = ConstU16<42>;
    type OnSetCode = ();
    type MaxConsumers = frame_support::traits::ConstU32<16>;
    type RuntimeTask = ();
    type SingleBlockMigrations = ();
    type MultiBlockMigrator = ();
    type PreInherents = ();
    type PostInherents = ();
    type PostTransactions = ();
    type ExtensionsWeightInfo = ();
}

parameter_types! {
    pub static Validators: Option<Vec<u64>> = Some(vec![
        1,
        2,
        3,
    ]);
}

pub struct TestSessionManager;
impl pallet_session::SessionManager<u64> for TestSessionManager {
    fn new_session(_new_index: SessionIndex) -> Option<Vec<u64>> {
        Validators::get()
    }
    fn end_session(_: SessionIndex) {}
    fn start_session(_: SessionIndex) {}
}

impl pallet_session::historical::SessionManager<u64, ()> for TestSessionManager {
    fn new_session(_new_index: SessionIndex) -> Option<Vec<(u64, ())>> {
        Validators::mutate(|l| {
            l.take()
                .map(|validators| validators.iter().map(|v| (*v, ())).collect())
        })
    }
    fn end_session(_: SessionIndex) {}
    fn start_session(_: SessionIndex) {}
}

parameter_types! {
    pub const Period: u64 = 1;
    pub const Offset: u64 = 0;
}

pub struct MockEraIndexProvider;

thread_local! {
    pub static ERA_INDEX: RefCell<EraIndex> = const { RefCell::new(0) };
    pub static DEFER_PERIOD: RefCell<EraIndex> = const { RefCell::new(2) };
    pub static SENT_ETHEREUM_MESSAGE_NONCE: RefCell<u64> = const { RefCell::new(0) };
    pub static MOCK_REPORT_OFFENCE_SHOULD_FAIL: RefCell<bool> = const { RefCell::new(false) };
    pub static MOCK_REPORT_OFFENCE_CALLED: RefCell<bool> = const { RefCell::new(false) };
    pub static LAST_SENT_SLASHES: RefCell<Vec<crate::SlashData<AccountId>>> = RefCell::new(Vec::new());
}

impl MockEraIndexProvider {
    pub fn with_era(era_index: EraIndex) {
        ERA_INDEX.with(|r| *r.borrow_mut() = era_index);
    }
}

impl EraIndexProvider for MockEraIndexProvider {
    fn active_era() -> ActiveEraInfo {
        ActiveEraInfo {
            index: ERA_INDEX.with(|q| *q.borrow()),
            start: None,
        }
    }
    fn era_to_session_start(era_index: EraIndex) -> Option<SessionIndex> {
        let active_era = Self::active_era().index;
        if era_index > active_era || era_index < active_era.saturating_sub(BondingDuration::get()) {
            None
        } else {
            // Else we assume eras start at the same time as sessions
            Some(era_index)
        }
    }
}

impl pallet_session::Config for Test {
    type SessionManager = pallet_session::historical::NoteHistoricalRoot<Test, TestSessionManager>;
    type Keys = SessionKeys;
    type ShouldEndSession = pallet_session::PeriodicSessions<Period, Offset>;
    type SessionHandler = TestSessionHandler;
    type RuntimeEvent = RuntimeEvent;
    type ValidatorId = <Self as frame_system::Config>::AccountId;
    type ValidatorIdOf = ConvertInto;
    type NextSessionRotation = pallet_session::PeriodicSessions<Period, Offset>;
    type WeightInfo = ();
}

sp_runtime::impl_opaque_keys! {
    pub struct SessionKeys {
        pub foo: sp_runtime::testing::UintAuthorityId,
    }
}

use sp_runtime::RuntimeAppPublic;
type AccountId = u64;
pub struct TestSessionHandler;
impl pallet_session::SessionHandler<AccountId> for TestSessionHandler {
    const KEY_TYPE_IDS: &'static [sp_runtime::KeyTypeId] = &[UintAuthorityId::ID];

    fn on_genesis_session<Ks: sp_runtime::traits::OpaqueKeys>(_validators: &[(AccountId, Ks)]) {}

    fn on_new_session<Ks: sp_runtime::traits::OpaqueKeys>(
        _: bool,
        _: &[(AccountId, Ks)],
        _: &[(AccountId, Ks)],
    ) {
    }
    fn on_disabled(_: u32) {}
}

pub struct MockInvulnerableProvider;
impl InvulnerablesProvider<u64> for MockInvulnerableProvider {
    fn invulnerables() -> Vec<u64> {
        vec![1, 2]
    }
}

pub struct DeferPeriodGetter;
impl Get<EraIndex> for DeferPeriodGetter {
    fn get() -> EraIndex {
        DEFER_PERIOD.with(|q| (*q.borrow()))
    }
}

impl DeferPeriodGetter {
    pub fn with_defer_period(defer_period: EraIndex) {
        DEFER_PERIOD.with(|r| *r.borrow_mut() = defer_period);
    }
}

pub struct MockOkOutboundQueue;
impl MockOkOutboundQueue {
    pub fn last_sent_slashes() -> Vec<crate::SlashData<AccountId>> {
        LAST_SENT_SLASHES.with(|r| r.borrow().clone())
    }
}
impl crate::SendMessage<AccountId> for MockOkOutboundQueue {
    type Ticket = ();
    type Message = ();
    fn build(slashes: &Vec<crate::SlashData<AccountId>>, _: u32) -> Option<Self::Ticket> {
        LAST_SENT_SLASHES.with(|r| *r.borrow_mut() = slashes.clone());
        Some(())
    }
    fn validate(_: Self::Ticket) -> Result<Self::Ticket, SendError> {
        Ok(())
    }
    fn deliver(_: Self::Ticket) -> Result<H256, SendError> {
        Ok(H256::zero())
    }
}

impl SendMessageFeeProvider for MockOkOutboundQueue {
    type Balance = u128;

    fn local_fee() -> Self::Balance {
        1
    }
}

pub struct TimestampProvider;
impl ExternalIndexProvider for TimestampProvider {
    fn get_external_index() -> u64 {
        Timestamp::get()
    }
}

parameter_types! {
    pub const BondingDuration: u32 = 5u32;
}

impl external_validator_slashes::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type ValidatorId = <Self as frame_system::Config>::AccountId;
    type ValidatorIdOf = IdentityValidator;
    type SlashDeferDuration = DeferPeriodGetter;
    type BondingDuration = BondingDuration;
    type SlashId = u32;
    type EraIndexProvider = MockEraIndexProvider;
    type InvulnerablesProvider = MockInvulnerableProvider;
    type ExternalIndexProvider = TimestampProvider;
    type MaxSlashWad = ConstU128<50_000_000_000_000_000>;
    type QueuedSlashesProcessedPerBlock = ConstU32<20>;
    type WeightInfo = ();
    type SendMessage = MockOkOutboundQueue;
}

pub struct FullIdentificationOf;
impl sp_runtime::traits::Convert<AccountId, Option<()>> for FullIdentificationOf {
    fn convert(_: AccountId) -> Option<()> {
        Some(())
    }
}

impl pallet_session::historical::Config for Test {
    type FullIdentification = ();
    type FullIdentificationOf = FullIdentificationOf;
}
// Build genesis storage according to the mock runtime.
pub fn new_test_ext() -> sp_io::TestExternalities {
    system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap()
        .into()
}

pub struct IdentityValidator;
impl sp_runtime::traits::Convert<u64, Option<u64>> for IdentityValidator {
    fn convert(a: u64) -> Option<u64> {
        Some(a)
    }
}

// --- Mock infrastructure for testing EquivocationReportWrapper ---

use sp_staking::offence::{Offence, OffenceError, ReportOffence};

/// A mock inner ReportOffence that can be configured to succeed or fail.
pub struct MockInnerReporter;

impl MockInnerReporter {
    pub fn set_should_fail(fail: bool) {
        MOCK_REPORT_OFFENCE_SHOULD_FAIL.with(|r| *r.borrow_mut() = fail);
    }
    pub fn was_called() -> bool {
        MOCK_REPORT_OFFENCE_CALLED.with(|r| *r.borrow())
    }
    pub fn reset() {
        MOCK_REPORT_OFFENCE_SHOULD_FAIL.with(|r| *r.borrow_mut() = false);
        MOCK_REPORT_OFFENCE_CALLED.with(|r| *r.borrow_mut() = false);
    }
}

impl<R, Id, O: Offence<Id>> ReportOffence<R, Id, O> for MockInnerReporter {
    fn report_offence(_reporters: Vec<R>, _offence: O) -> Result<(), OffenceError> {
        MOCK_REPORT_OFFENCE_CALLED.with(|r| *r.borrow_mut() = true);
        if MOCK_REPORT_OFFENCE_SHOULD_FAIL.with(|r| *r.borrow()) {
            Err(OffenceError::DuplicateReport)
        } else {
            Ok(())
        }
    }
    fn is_known_offence(_offenders: &[Id], _time_slot: &O::TimeSlot) -> bool {
        false
    }
}

/// A minimal mock Offence for testing the wrapper.
pub struct MockOffence {
    pub session_index: SessionIndex,
    pub offenders: Vec<(u64, ())>,
}

impl Offence<(u64, ())> for MockOffence {
    const ID: sp_staking::offence::Kind = *b"mock:offence0000";
    type TimeSlot = u128;

    fn offenders(&self) -> Vec<(u64, ())> {
        self.offenders.clone()
    }
    fn session_index(&self) -> SessionIndex {
        self.session_index
    }
    fn validator_set_count(&self) -> u32 {
        3
    }
    fn time_slot(&self) -> Self::TimeSlot {
        self.session_index as u128
    }
    fn slash_fraction(&self, _offenders_count: u32) -> sp_runtime::Perbill {
        sp_runtime::Perbill::from_percent(50)
    }
}

/// Type alias for the wrapper using the mock reporter with BabeEquivocation kind.
pub type MockBabeWrapper =
    crate::EquivocationReportWrapper<Test, MockInnerReporter, crate::BabeEquivocation>;

/// Type alias for the wrapper using the mock reporter with GrandpaEquivocation kind.
pub type MockGrandpaWrapper =
    crate::EquivocationReportWrapper<Test, MockInnerReporter, crate::GrandpaEquivocation>;

pub fn run_block() {
    run_to_block(System::block_number() + 1);
}

pub const INIT_TIMESTAMP: u64 = 30_000;
pub const BLOCK_TIME: u64 = 1000;

// Polkadot SDK 2503 has a builtin function to do this. See https://github.com/paritytech/polkadot-sdk/blob/6d647465b3d3ab2ed8839c6a3fa3d456b545b011/prdoc/stable2503/pr_7109.prdoc#L5
pub fn run_to_block(n: u64) {
    let old_block_number = System::block_number();

    for x in old_block_number..n {
        System::reset_events();
        System::set_block_number(x + 1);
        System::on_initialize(System::block_number());
        ExternalValidatorSlashes::on_initialize(System::block_number());
        Timestamp::set_timestamp(System::block_number() * BLOCK_TIME + INIT_TIMESTAMP);
    }
}
