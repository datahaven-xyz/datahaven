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
    crate as pallet_external_validators_rewards,
    crate::types::HandleInflation,
    frame_support::{
        parameter_types,
        traits::{fungible::Mutate, ConstU32, ConstU64},
    },
    pallet_balances::AccountData,
    pallet_external_validators::traits::ExternalIndexProvider,
    snowbridge_outbound_queue_primitives::{SendError, SendMessageFeeProvider},
    sp_core::H256,
    sp_runtime::{
        traits::{BlakeTwo256, IdentityLookup, Keccak256},
        BuildStorage, DispatchError,
    },
};

type Block = frame_system::mocking::MockBlock<Test>;

// Configure a mock runtime to test the pallet.
frame_support::construct_runtime!(
    pub enum Test
    {
        System: frame_system,
        ExternalValidatorsRewards: pallet_external_validators_rewards,
        // Session: pallet_session,
        Balances: pallet_balances,
        Timestamp: pallet_timestamp,
        Mock: mock_data,
    }
);

parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub const SS58Prefix: u8 = 42;
}

impl frame_system::Config for Test {
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
    type AccountData = AccountData<u128>;
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
    type Balance = u128;
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

impl mock_data::Config for Test {}

pub struct MockOkOutboundQueue;
impl crate::types::SendMessage for MockOkOutboundQueue {
    type Ticket = ();
    type Message = ();
    fn build(_: &crate::types::EraRewardsUtils) -> Option<Self::Ticket> {
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
    pub const RewardsEthereumSovereignAccount: u64
        = 0xffffffffffffffff;
    pub const TreasuryAccount: u64 = 999;
    pub const InflationTreasuryProportion: sp_runtime::Perbill = sp_runtime::Perbill::from_percent(20);
    pub EraInflationProvider: u128 = Mock::mock().era_inflation.unwrap_or(42);
    // Inflation scaling parameters for tests
    // Assuming 6 second block time and 1 hour era = 600 blocks per era
    pub const ExpectedBlocksPerEra: u32 = 600;
    pub const MinInflationPercent: u32 = 20; // 20% minimum even with 0 blocks
    pub const MaxInflationPercent: u32 = 100; // 100% maximum
    // Reward split parameters: 60% block authoring, 30% liveness, 10% base
    pub const BlockAuthoringWeight: sp_runtime::Perbill = sp_runtime::Perbill::from_percent(60);
    pub const LivenessWeight: sp_runtime::Perbill = sp_runtime::Perbill::from_percent(30);
    // Soft cap: validators can earn up to 120% of fair share
    pub const FairShareCap: sp_runtime::Perbill = sp_runtime::Perbill::from_percent(20);
}

pub struct MockValidatorSet;
impl frame_support::traits::ValidatorSet<u64> for MockValidatorSet {
    type ValidatorId = u64;
    type ValidatorIdOf = sp_runtime::traits::ConvertInto;

    fn session_index() -> sp_staking::SessionIndex {
        0
    }

    fn validators() -> Vec<Self::ValidatorId> {
        // Return empty vec for now - tests will populate via reward_by_ids
        vec![]
    }
}

pub struct MockIsOnline;
impl frame_support::traits::Contains<u64> for MockIsOnline {
    fn contains(_: &u64) -> bool {
        // For tests, assume all validators are online
        true
    }
}

impl pallet_external_validators_rewards::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type EraIndexProvider = mock_data::Pallet<Test>;
    type HistoryDepth = ConstU32<10>;
    type BackingPoints = ConstU32<20>;
    type DisputeStatementPoints = ConstU32<20>;
    type EraInflationProvider = EraInflationProvider;
    type ExternalIndexProvider = TimestampProvider;
    type GetWhitelistedValidators = ();
    type ValidatorSet = MockValidatorSet;
    type LivenessCheck = MockIsOnline;
    type SlashingCheck = (); // No slashes in tests
    type AuthorBaseRewardPoints = ConstU32<20>;
    type BlockAuthoringWeight = BlockAuthoringWeight;
    type LivenessWeight = LivenessWeight;
    type FairShareCap = FairShareCap;
    type ExpectedBlocksPerEra = ExpectedBlocksPerEra;
    type MinInflationPercent = MinInflationPercent;
    type MaxInflationPercent = MaxInflationPercent;
    type Hashing = Keccak256;
    type SendMessage = MockOkOutboundQueue;
    type HandleInflation = InflationMinter;
    type Currency = Balances;
    type RewardsEthereumSovereignAccount = RewardsEthereumSovereignAccount;
    type WeightInfo = ();
    #[cfg(feature = "runtime-benchmarks")]
    type BenchmarkHelper = ();
}

pub struct InflationMinter;
impl HandleInflation<u64> for InflationMinter {
    fn mint_inflation(rewards_account: &u64, total_amount: u128) -> sp_runtime::DispatchResult {
        use sp_runtime::traits::Zero;

        if total_amount.is_zero() {
            log::error!(target: "ext_validators_rewards", "No rewards to distribute");
            return Err(DispatchError::Other("No rewards to distribute"));
        }

        // Get treasury allocation proportion
        let treasury_proportion = InflationTreasuryProportion::get();

        // Calculate amounts
        let treasury_amount = treasury_proportion.mul_floor(total_amount);
        let rewards_amount = total_amount.saturating_sub(treasury_amount);

        // Mint rewards to the rewards account
        if !rewards_amount.is_zero() {
            <Test as pallet_external_validators_rewards::Config>::Currency::mint_into(
                rewards_account,
                rewards_amount,
            )
            .map(|_| ())
            .map_err(|_| DispatchError::Other("Failed to mint rewards inflation"))?;
        }

        // Mint treasury portion if non-zero
        if !treasury_amount.is_zero() {
            let treasury_account = TreasuryAccount::get();
            <Test as pallet_external_validators_rewards::Config>::Currency::mint_into(
                &treasury_account,
                treasury_amount,
            )
            .map(|_| ())
            .map_err(|_| DispatchError::Other("Failed to mint treasury inflation"))?;
        }

        Ok(())
    }
}

// Pallet to provide some mock data, used to test
#[frame_support::pallet]
pub mod mock_data {
    use {
        frame_support::pallet_prelude::*,
        pallet_external_validators::traits::{ActiveEraInfo, EraIndex, EraIndexProvider},
    };

    #[derive(Clone, Default, Encode, Decode, sp_core::RuntimeDebug, scale_info::TypeInfo)]
    pub struct Mocks {
        pub active_era: Option<ActiveEraInfo>,
        pub era_inflation: Option<u128>,
    }

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

    impl<T: Config> EraIndexProvider for Pallet<T> {
        fn active_era() -> ActiveEraInfo {
            Self::mock()
                .active_era
                .expect("active_era should be set in test")
                .clone()
        }

        fn era_to_session_start(_era_index: EraIndex) -> Option<u32> {
            unimplemented!()
        }
    }
}

pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();

    let balances = vec![
        (1, 100),
        (2, 100),
        (3, 100),
        (4, 100),
        (5, 100),
        (TreasuryAccount::get(), ExistentialDeposit::get().into()), // Treasury needs existential deposit
        (
            RewardsEthereumSovereignAccount::get(),
            ExistentialDeposit::get().into(),
        ), // Rewards account needs existential deposit
    ];
    pallet_balances::GenesisConfig::<Test> { balances }
        .assimilate_storage(&mut t)
        .unwrap();

    let ext: sp_io::TestExternalities = t.into();

    ext
}

pub const INIT_TIMESTAMP: u64 = 30_000;
pub const BLOCK_TIME: u64 = 1000;

pub fn run_to_block(n: u64) {
    let old_block_number = System::block_number();

    for x in old_block_number..n {
        System::reset_events();
        System::set_block_number(x + 1);
        Timestamp::set_timestamp(System::block_number() * BLOCK_TIME + INIT_TIMESTAMP);
    }
}
