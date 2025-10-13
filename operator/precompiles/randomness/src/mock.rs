// Copyright 2019-2025 PureStake Inc.
// This file is part of Moonbeam.

// Moonbeam is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Moonbeam is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Moonbeam.  If not, see <http://www.gnu.org/licenses/>.

//! A minimal precompile runtime including the pallet-randomness pallet
use super::*;
use frame_support::{construct_runtime, parameter_types, traits::Everything, weights::Weight};
use pallet_evm::{EnsureAddressNever, EnsureAddressRoot, FrameSystemAccountProvider};
use precompile_utils::{precompile_set::*, testing::MockAccount};
use session_keys_primitives::VrfId;
use sp_core::H256;
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup},
    BuildStorage, Perbill,
};
use sp_std::convert::{TryFrom, TryInto};

pub type AccountId = MockAccount;
pub type Balance = u128;

type Block = frame_system::mocking::MockBlockU32<Runtime>;

// Configure a mock runtime to test the pallet.
construct_runtime!(
    pub enum Runtime	{
        System: frame_system,
        Balances: pallet_balances,
        AuthorMapping: pallet_author_mapping,
        Evm: pallet_evm,
        Timestamp: pallet_timestamp,
        Randomness: pallet_randomness,
    }
);

parameter_types! {
    pub const BlockHashCount: u32 = 250;
    pub const MaximumBlockWeight: Weight = Weight::from_parts(1024, 1);
    pub const MaximumBlockLength: u32 = 2 * 1024;
    pub const AvailableBlockRatio: Perbill = Perbill::one();
    pub const SS58Prefix: u8 = 42;
}
impl frame_system::Config for Runtime {
    type BaseCallFilter = Everything;
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeTask = RuntimeTask;
    type Nonce = u64;
    type Block = Block;
    type RuntimeCall = RuntimeCall;
    type Hash = H256;
    type Hashing = BlakeTwo256;
    type AccountId = AccountId;
    type Lookup = IdentityLookup<Self::AccountId>;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = BlockHashCount;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = pallet_balances::AccountData<Balance>;
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type BlockWeights = ();
    type BlockLength = ();
    type SS58Prefix = SS58Prefix;
    type OnSetCode = ();
    type MaxConsumers = frame_support::traits::ConstU32<16>;
    type SingleBlockMigrations = ();
    type MultiBlockMigrator = ();
    type PreInherents = ();
    type PostInherents = ();
    type PostTransactions = ();
    type ExtensionsWeightInfo = ();
}

parameter_types! {
    pub const ExistentialDeposit: u128 = 0;
}
impl pallet_balances::Config for Runtime {
    type MaxReserves = ();
    type ReserveIdentifier = [u8; 4];
    type MaxLocks = ();
    type Balance = Balance;
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = System;
    type WeightInfo = ();
    type RuntimeHoldReason = ();
    type FreezeIdentifier = ();
    type MaxFreezes = ();
    type RuntimeFreezeReason = ();
    type DoneSlashHandler = ();
}

pub type TestPrecompiles<R> = PrecompileSetBuilder<
    R,
    (
        PrecompileAt<
            AddressU64<1>,
            RandomnessPrecompile<R>,
            (SubcallWithMaxNesting<1>, CallableByContract),
        >,
        RevertPrecompile<AddressU64<2>>,
    ),
>;

pub type PCall = RandomnessPrecompileCall<Runtime>;

parameter_types! {
    pub PrecompilesValue: TestPrecompiles<Runtime> = TestPrecompiles::new();
    pub const WeightPerGas: Weight = Weight::from_parts(1, 0);
    pub const SuicideQuickClearLimit: u32 = 0;
}

impl pallet_evm::Config for Runtime {
    type FeeCalculator = ();
    type GasWeightMapping = pallet_evm::FixedGasWeightMapping<Self>;
    type WeightPerGas = WeightPerGas;
    type CallOrigin = EnsureAddressRoot<AccountId>;
    type WithdrawOrigin = EnsureAddressNever<AccountId>;
    type AddressMapping = AccountId;
    type Currency = Balances;
    type RuntimeEvent = RuntimeEvent;
    type Runner = pallet_evm::runner::stack::Runner<Self>;
    type PrecompilesType = TestPrecompiles<Runtime>;
    type PrecompilesValue = PrecompilesValue;
    type ChainId = ();
    type OnChargeTransaction = ();
    type BlockGasLimit = ();
    type BlockHashMapping = pallet_evm::SubstrateBlockHashMapping<Self>;
    type FindAuthor = ();
    type OnCreate = ();
    type GasLimitPovSizeRatio = ();
    type GasLimitStorageGrowthRatio = ();
    type Timestamp = Timestamp;
    type WeightInfo = pallet_evm::weights::SubstrateWeight<Runtime>;
    type AccountProvider = FrameSystemAccountProvider<Runtime>;
    type CreateOriginFilter = ();
    type CreateInnerOriginFilter = ();
}

parameter_types! {
    pub const MinimumPeriod: u64 = 5;
}
impl pallet_timestamp::Config for Runtime {
    type Moment = u64;
    type OnTimestampSet = ();
    type MinimumPeriod = MinimumPeriod;
    type WeightInfo = ();
}

parameter_types! {
    pub const DepositAmount: Balance = 100;
}
impl pallet_author_mapping::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type DepositCurrency = Balances;
    type DepositAmount = DepositAmount;
    type Keys = VrfId;
    type WeightInfo = ();
}

pub struct BabeDataGetter;
impl pallet_randomness::GetBabeData<u64, Option<H256>> for BabeDataGetter {
    fn get_epoch_index() -> u64 {
        1u64
    }
    fn get_epoch_randomness() -> Option<H256> {
        None
    }
}

parameter_types! {
    pub const Deposit: u128 = 10;
    pub const MaxRandomWords: u8 = 1;
    pub const MinBlockDelay: u32 = 2;
    pub const MaxBlockDelay: u32 = 20;
}
impl pallet_randomness::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type AddressMapping = AccountId;
    type Currency = Balances;
    type BabeDataGetter = BabeDataGetter;
    type VrfKeyLookup = AuthorMapping;
    type Deposit = Deposit;
    type MaxRandomWords = MaxRandomWords;
    type MinBlockDelay = MinBlockDelay;
    type MaxBlockDelay = MaxBlockDelay;
    type BlockExpirationDelay = MaxBlockDelay;
    type EpochExpirationDelay = MaxBlockDelay;
    type WeightInfo = pallet_randomness::weights::SubstrateWeight<Runtime>;
}

/// Externality builder for pallet randomness mock runtime
pub(crate) struct ExtBuilder {
    /// Balance amounts per AccountId
    balances: Vec<(AccountId, Balance)>,
    /// AuthorId -> AccountId mappings
    mappings: Vec<(u64, AccountId)>,
}

impl Default for ExtBuilder {
    fn default() -> ExtBuilder {
        ExtBuilder {
            balances: Vec::new(),
            mappings: Vec::new(),
        }
    }
}

impl ExtBuilder {
    #[allow(dead_code)]
    pub(crate) fn with_balances(mut self, balances: Vec<(AccountId, Balance)>) -> Self {
        self.balances = balances;
        self
    }

    #[allow(dead_code)]
    pub(crate) fn with_mappings(mut self, mappings: Vec<(u64, AccountId)>) -> Self {
        self.mappings = mappings;
        self
    }

    #[allow(dead_code)]
    pub(crate) fn build(self) -> sp_io::TestExternalities {
        let mut t = frame_system::GenesisConfig::<Runtime>::default()
            .build_storage()
            .expect("Frame system builds valid default genesis config");

        pallet_balances::GenesisConfig::<Runtime> {
            balances: self.balances,
            dev_accounts: Default::default(),
        }
        .assimilate_storage(&mut t)
        .expect("Pallet balances storage can be assimilated");

        pallet_author_mapping::GenesisConfig::<Runtime> {
            mappings: self.mappings,
        }
        .assimilate_storage(&mut t)
        .expect("Pallet author mapping's storage can be assimilated");

        let mut ext = sp_io::TestExternalities::new(t);
        ext.execute_with(|| System::set_block_number(1));
        ext
    }
}

pub(crate) fn events() -> Vec<RuntimeEvent> {
    System::events()
        .into_iter()
        .map(|r| r.event)
        .collect::<Vec<_>>()
}

/// Panics if an event is not found in the system log of events
#[macro_export]
macro_rules! assert_event_emitted {
    ($event:expr) => {
        match &$event {
            e => {
                assert!(
                    crate::mock::events().iter().find(|x| *x == e).is_some(),
                    "Event {:?} was not found in events: \n {:#?}",
                    e,
                    crate::mock::events()
                );
            }
        }
    };
}
