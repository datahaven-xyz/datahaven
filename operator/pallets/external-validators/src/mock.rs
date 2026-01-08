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

use {
    super::*,
    crate as pallet_external_validators,
    frame_support::{
        assert_ok, ord_parameter_types, parameter_types,
        traits::{
            fungible::Mutate, ConstU32, ConstU64, OnFinalize, OnInitialize, ValidatorRegistration,
        },
    },
    frame_system::{self as system, EnsureSignedBy},
    pallet_balances::AccountData,
    sp_core::{H160, H256},
    sp_runtime::{
        testing::UintAuthorityId,
        traits::{BlakeTwo256, ConvertInto, IdentityLookup, OpaqueKeys},
        BuildStorage, RuntimeAppPublic,
    },
};

type Block = frame_system::mocking::MockBlock<Test>;

// Configure a mock runtime to test the pallet.
frame_support::construct_runtime!(
    pub enum Test
    {
        System: frame_system,
        ExternalValidators: pallet_external_validators,
        Session: pallet_session,
        Balances: pallet_balances,
        Timestamp: pallet_timestamp,
        Mock: mock_data,
    }
);

parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub const SS58Prefix: u8 = 42;
    // Dummy authorized origin used only for tests.
    pub static MockAuthorizedOrigin: H160 = H160::repeat_byte(0x0);
}

impl system::Config for Test {
    type BaseCallFilter = frame_support::traits::Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type Hash = H256;
    type Hashing = BlakeTwo256;
    type AccountId = u64;
    type Lookup = IdentityLookup<Self::AccountId>;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = BlockHashCount;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = AccountData<u64>;
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = SS58Prefix;
    type OnSetCode = ();
    type MaxConsumers = frame_support::traits::ConstU32<16>;
    type Nonce = u64;
    type Block = Block;
    type RuntimeTask = ();
    type SingleBlockMigrations = ();
    type MultiBlockMigrator = ();
    type PreInherents = ();
    type PostInherents = ();
    type PostTransactions = ();
    type ExtensionsWeightInfo = ();
}

parameter_types! {
    pub const ExistentialDeposit: u64 = 5;
    pub const MaxReserves: u32 = 50;
}

impl pallet_balances::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = ();
    type Balance = u64;
    type DustRemoval = ();
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = System;
    type ReserveIdentifier = [u8; 8];
    type RuntimeHoldReason = ();
    type RuntimeFreezeReason = ();
    type FreezeIdentifier = ();
    type MaxLocks = ();
    type MaxReserves = MaxReserves;
    type MaxFreezes = ConstU32<0>;
    type DoneSlashHandler = ();
}

impl pallet_timestamp::Config for Test {
    type Moment = u64;
    type OnTimestampSet = ();
    type MinimumPeriod = ConstU64<5>;
    type WeightInfo = ();
}

ord_parameter_types! {
    pub const RootAccount: u64 = 777;
}

pub struct IsRegistered;
impl ValidatorRegistration<u64> for IsRegistered {
    fn is_registered(id: &u64) -> bool {
        *id != 42u64
    }
}

parameter_types! {
    pub const SessionsPerEra: SessionIndex = 6;
}

impl Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type UpdateOrigin = EnsureSignedBy<RootAccount, u64>;
    type HistoryDepth = ConstU32<84>;
    type MaxWhitelistedValidators = ConstU32<20>;
    type MaxExternalValidators = ConstU32<20>;
    type ValidatorId = <Self as frame_system::Config>::AccountId;
    type ValidatorIdOf = ConvertInto;
    type ValidatorRegistration = IsRegistered;
    type UnixTime = Timestamp;
    type SessionsPerEra = SessionsPerEra;
    type OnEraStart = Mock;
    type OnEraEnd = Mock;
    type AuthorizedOrigin = MockAuthorizedOrigin;
    type WeightInfo = ();
    #[cfg(feature = "runtime-benchmarks")]
    type Currency = Balances;
}

sp_runtime::impl_opaque_keys! {
    pub struct MockSessionKeys {
        // a key for aura authoring
        pub aura: UintAuthorityId,
    }
}

impl From<UintAuthorityId> for MockSessionKeys {
    fn from(aura: sp_runtime::testing::UintAuthorityId) -> Self {
        Self { aura }
    }
}

parameter_types! {
    pub static SessionHandlerCollators: Vec<u64> = Vec::new();
    pub static SessionChangeBlock: u64 = 0;
}

pub struct TestSessionHandler;
impl pallet_session::SessionHandler<u64> for TestSessionHandler {
    const KEY_TYPE_IDS: &'static [sp_runtime::KeyTypeId] = &[UintAuthorityId::ID];
    fn on_genesis_session<Ks: OpaqueKeys>(keys: &[(u64, Ks)]) {
        SessionHandlerCollators::set(keys.iter().map(|(a, _)| *a).collect::<Vec<_>>())
    }
    fn on_new_session<Ks: OpaqueKeys>(_: bool, keys: &[(u64, Ks)], _: &[(u64, Ks)]) {
        SessionChangeBlock::set(System::block_number());
        SessionHandlerCollators::set(keys.iter().map(|(a, _)| *a).collect::<Vec<_>>())
    }
    fn on_before_session_ending() {}
    fn on_disabled(_: u32) {}
}

parameter_types! {
    pub const Offset: u64 = 0;
    pub const Period: u64 = 5;
}

impl pallet_session::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type ValidatorId = <Self as frame_system::Config>::AccountId;
    // we don't have stash and controller, thus we don't need the convert as well.
    type ValidatorIdOf = ConvertInto;
    type ShouldEndSession = pallet_session::PeriodicSessions<Period, Offset>;
    type NextSessionRotation = pallet_session::PeriodicSessions<Period, Offset>;
    type SessionManager = ExternalValidators;
    type SessionHandler = TestSessionHandler;
    type Keys = MockSessionKeys;
    type WeightInfo = ();
}

// Pallet to provide some mock data, used to test
#[frame_support::pallet]
pub mod mock_data {
    use {crate::mock::Mocks, frame_support::pallet_prelude::*};

    #[pallet::config]
    pub trait Config: frame_system::Config {}

    #[pallet::call]
    impl<T: Config> Pallet<T> {}

    #[pallet::pallet]
    #[pallet::without_storage_info]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    pub(super) type Mock<T: Config> = StorageValue<_, Mocks, ValueQuery>;

    impl<T: Config> Pallet<T> {
        pub fn mock() -> Mocks {
            Mock::<T>::get()
        }
        pub fn mutate<F, R>(f: F) -> R
        where
            F: FnOnce(&mut Mocks) -> R,
        {
            Mock::<T>::mutate(f)
        }
    }
}

#[derive(Clone, Encode, Decode, PartialEq, sp_core::RuntimeDebug, scale_info::TypeInfo)]
pub enum HookCall {
    OnEraStart {
        era: u32,
        session: u32,
        external_index: u64,
    },
    OnEraEnd {
        era: u32,
    },
}

impl mock_data::Config for Test {}

#[derive(
    Clone, Default, Encode, Decode, PartialEq, sp_core::RuntimeDebug, scale_info::TypeInfo,
)]
pub struct Mocks {
    pub called_hooks: Vec<HookCall>,
}

// We use the mock_data pallet to test hooks: we store a list of all the calls, and then check that
// no eras are skipped.
impl<T> OnEraStart for mock_data::Pallet<T> {
    fn on_era_start(era_index: EraIndex, session_start: u32, external_idx: u64) {
        Mock::mutate(|m| {
            m.called_hooks.push(HookCall::OnEraStart {
                era: era_index,
                session: session_start,
                external_index: external_idx,
            });
        });
    }
}

impl<T> OnEraEnd for mock_data::Pallet<T> {
    fn on_era_end(era_index: EraIndex) {
        Mock::mutate(|m| {
            m.called_hooks.push(HookCall::OnEraEnd { era: era_index });
        });
    }
}

pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();
    let whitelisted_validators = vec![1, 2];

    let balances = vec![(1, 100), (2, 100), (3, 100), (4, 100), (5, 100)];
    let keys = balances
        .iter()
        .map(|&(i, _)| {
            (
                i,
                i,
                MockSessionKeys {
                    aura: UintAuthorityId(i),
                },
            )
        })
        .collect::<Vec<_>>();
    let session = pallet_session::GenesisConfig::<Test> {
        keys,
        ..Default::default()
    };
    pallet_balances::GenesisConfig::<Test> { balances }
        .assimilate_storage(&mut t)
        .unwrap();
    pallet_external_validators::GenesisConfig::<Test> {
        skip_external_validators: false,
        whitelisted_validators,
        ..Default::default()
    }
    .assimilate_storage(&mut t)
    .unwrap();
    session.assimilate_storage(&mut t).unwrap();

    let mut ext: sp_io::TestExternalities = t.into();

    // Initialize accounts and keys for external validators
    ext.execute_with(|| {
        initialize_validators(vec![50, 51]);
    });

    ext
}

fn initialize_validators(validators: Vec<u64>) {
    for x in validators {
        assert_ok!(Balances::mint_into(&x, 10_000_000_000));
        assert_ok!(Session::set_keys(
            RuntimeOrigin::signed(x),
            MockSessionKeys::from(UintAuthorityId(x)),
            vec![]
        ));
    }
}

pub const INIT_TIMESTAMP: u64 = 30_000;
pub const BLOCK_TIME: u64 = 1000;

pub fn run_to_session(n: u32) {
    let block_number = Period::get() * u64::from(n);
    run_to_block(block_number + 1);
}

pub fn run_to_block(n: u64) {
    let old_block_number = System::block_number();

    for x in old_block_number..n {
        ExternalValidators::on_finalize(System::block_number());
        Session::on_finalize(System::block_number());

        System::reset_events();
        System::set_block_number(x + 1);
        Timestamp::set_timestamp(System::block_number() * BLOCK_TIME + INIT_TIMESTAMP);

        ExternalValidators::on_initialize(System::block_number());
        Session::on_initialize(System::block_number());
    }
}

pub fn last_event() -> RuntimeEvent {
    System::events().pop().expect("Event expected").event
}
