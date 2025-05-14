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
    frame_support::{
        parameter_types,
        traits::{ConstU32, ConstU64},
    },
    pallet_balances::AccountData,
    snowbridge_core::{
        outbound::{SendError, SendMessageFeeProvider},
        TokenId,
    },
    sp_core::H256,
    sp_runtime::{
        traits::{BlakeTwo256, IdentityLookup, Keccak256, MaybeEquivalence},
        BuildStorage,
    },
    xcm::prelude::*,
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
impl tp_bridge::DeliverMessage for MockOkOutboundQueue {
    type Ticket = ();

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
impl tp_traits::ExternalIndexProvider for TimestampProvider {
    fn get_external_index() -> u64 {
        Timestamp::get()
    }
}

pub struct MockTokenIdConvert;
impl MaybeEquivalence<TokenId, Location> for MockTokenIdConvert {
    fn convert(_id: &TokenId) -> Option<Location> {
        Some(Location::parent())
    }
    fn convert_back(loc: &Location) -> Option<TokenId> {
        if *loc == Location::here() {
            Some(H256::repeat_byte(0x01))
        } else {
            None
        }
    }
}

parameter_types! {
    pub const RewardsEthereumSovereignAccount: u64
        = 0xffffffffffffffff;
    pub RewardTokenLocation: Location = Location::here();
    pub EraInflationProvider: u128 = Mock::mock().era_inflation.unwrap_or(42);
}

impl pallet_external_validators_rewards::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type EraIndexProvider = Mock;
    type HistoryDepth = ConstU32<10>;
    type BackingPoints = ConstU32<20>;
    type DisputeStatementPoints = ConstU32<20>;
    type EraInflationProvider = EraInflationProvider;
    type ExternalIndexProvider = TimestampProvider;
    type GetWhitelistedValidators = ();
    type Hashing = Keccak256;
    type ValidateMessage = ();
    type OutboundQueue = MockOkOutboundQueue;
    type Currency = Balances;
    type RewardsEthereumSovereignAccount = RewardsEthereumSovereignAccount;
    type TokenLocationReanchored = Mock;
    type TokenIdFromLocation = MockTokenIdConvert;
    type WeightInfo = ();
    #[cfg(feature = "runtime-benchmarks")]
    type BenchmarkHelper = ();
}

// Pallet to provide some mock data, used to test
#[frame_support::pallet]
pub mod mock_data {
    use {
        frame_support::pallet_prelude::*,
        tp_traits::{ActiveEraInfo, EraIndex, EraIndexProvider},
        xcm::latest::prelude::*,
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

    #[pallet::storage]
    pub(super) type TokenLocation<T: Config> = StorageValue<_, Location, ValueQuery>;

    impl<T: Config> Pallet<T> {
        pub fn mock() -> Mocks {
            Mock::<T>::get()
        }
        pub fn token_loc() -> Location {
            TokenLocation::<T>::get()
        }
        pub fn mutate<F, R>(f: F) -> R
        where
            F: FnOnce(&mut Mocks) -> R,
        {
            Mock::<T>::mutate(f)
        }

        pub fn set_location(location: Location) {
            TokenLocation::<T>::set(location)
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

    impl<T: Config> Get<Location> for Pallet<T> {
        fn get() -> Location {
            Self::token_loc()
        }
    }
}

pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();

    let balances = vec![(1, 100), (2, 100), (3, 100), (4, 100), (5, 100)];
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
