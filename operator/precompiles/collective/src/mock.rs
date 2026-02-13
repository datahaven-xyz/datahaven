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

//! Test utilities
use super::*;
use frame_support::traits::tokens::{PayFromAccount, UnityAssetBalanceConversion};
use frame_support::{
    construct_runtime, parameter_types,
    traits::{ConstU128, Everything, MapSuccess, OnFinalize, OnInitialize},
    PalletId,
};
use frame_system::{pallet_prelude::BlockNumberFor, EnsureRoot};
use pallet_evm::{
    EnsureAddressNever, EnsureAddressRoot, FrameSystemAccountProvider, SubstrateBlockHashMapping,
};
use precompile_utils::{
    precompile_set::*,
    testing::{Bob, Charlie, MockAccount},
};
use sp_core::{H256, U256};
use sp_io;
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup, Replace},
    BuildStorage, Permill,
};

#[cfg(feature = "runtime-benchmarks")]
use pallet_treasury::ArgumentsFactory;

pub type AccountId = MockAccount;
pub type Balance = u128;
pub type BlockNumber = BlockNumberFor<Runtime>;

type Block = frame_system::mocking::MockBlockU32<Runtime>;

// Configure a mock runtime to test the pallet.
construct_runtime!(
    pub enum Runtime	{
        System: frame_system,
        Balances: pallet_balances,
        Evm: pallet_evm,
        Timestamp: pallet_timestamp,
        Treasury: pallet_treasury,
        CouncilCollective:
            pallet_collective::<Instance1>,
    }
);

parameter_types! {
    pub const BlockHashCount: u32 = 250;
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
    type ReserveIdentifier = ();
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

pub type Precompiles<R> = PrecompileSetBuilder<
    R,
    (PrecompileAt<AddressU64<1>, CollectivePrecompile<R, pallet_collective::Instance1>>,),
>;

pub type PCall = CollectivePrecompileCall<Runtime, pallet_collective::Instance1>;

/// Block storage limit in bytes. Set to 40 KB.
const BLOCK_STORAGE_LIMIT: u64 = 40 * 1024;

parameter_types! {
    pub BlockGasLimit: U256 = U256::from(u64::MAX);
    pub PrecompilesValue: Precompiles<Runtime> = Precompiles::new();
    pub const WeightPerGas: Weight = Weight::from_parts(1, 0);
    pub const GasLimitPovSizeRatio: u64 = 0;
    pub GasLimitStorageGrowthRatio : u64 = {
        let block_gas_limit = BlockGasLimit::get().min(u64::MAX.into()).low_u64();
        block_gas_limit.saturating_div(BLOCK_STORAGE_LIMIT)
    };
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
    type PrecompilesType = Precompiles<Self>;
    type PrecompilesValue = PrecompilesValue;
    type ChainId = ();
    type OnChargeTransaction = ();
    type BlockGasLimit = BlockGasLimit;
    type BlockHashMapping = SubstrateBlockHashMapping<Self>;
    type FindAuthor = ();
    type OnCreate = ();
    type GasLimitPovSizeRatio = GasLimitPovSizeRatio;
    type GasLimitStorageGrowthRatio = GasLimitStorageGrowthRatio;
    type Timestamp = Timestamp;
    type WeightInfo = pallet_evm::weights::SubstrateWeight<Runtime>;
    type AccountProvider = FrameSystemAccountProvider<Runtime>;
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
    pub const LaunchPeriod: BlockNumber = 10;
    pub const VotingPeriod: BlockNumber = 10;
    pub const VoteLockingPeriod: BlockNumber = 10;
    pub const FastTrackVotingPeriod: BlockNumber = 5;
    pub const EnactmentPeriod: BlockNumber = 10;
    pub const CooloffPeriod: BlockNumber = 10;
    pub const MinimumDeposit: Balance = 10;
    pub const MaxVotes: u32 = 10;
    pub const MaxProposals: u32 = 10;
    pub const PreimageByteDeposit: Balance = 10;
    pub const InstantAllowed: bool = false;
}

parameter_types! {
    pub const ProposalBond: Permill = Permill::from_percent(5);
    pub const TreasuryId: PalletId = PalletId(*b"pc/trsry");
    pub TreasuryAccount: AccountId = Treasury::account_id();
}

#[cfg(feature = "runtime-benchmarks")]
pub struct BenchmarkHelper;
#[cfg(feature = "runtime-benchmarks")]
impl ArgumentsFactory<(), AccountId> for BenchmarkHelper {
    fn create_asset_kind(_seed: u32) -> () {
        ()
    }

    fn create_beneficiary(seed: [u8; 32]) -> AccountId {
        AccountId::from(H160::from(H256::from(seed)))
    }
}

impl pallet_treasury::Config for Runtime {
    type PalletId = TreasuryId;
    type Currency = Balances;
    type RejectOrigin = frame_support::traits::NeverEnsureOrigin<Balance>;
    type RuntimeEvent = RuntimeEvent;
    // If spending proposal rejected, transfer proposer bond to treasury
    type SpendPeriod = ConstU32<1>;
    type Burn = ();
    type BurnDestination = ();
    type MaxApprovals = ConstU32<100>;
    type WeightInfo = pallet_treasury::weights::SubstrateWeight<Runtime>;
    type SpendFunds = ();
    type SpendOrigin = MapSuccess<
        pallet_collective::EnsureProportionMoreThan<AccountId, pallet_collective::Instance1, 1, 2>,
        Replace<ConstU128<1000>>,
    >;
    type AssetKind = ();
    type Beneficiary = AccountId;
    type BeneficiaryLookup = IdentityLookup<AccountId>;
    type Paymaster = PayFromAccount<Balances, TreasuryAccount>;
    type BalanceConverter = UnityAssetBalanceConversion;
    type PayoutPeriod = ConstU32<0>;
    #[cfg(feature = "runtime-benchmarks")]
    type BenchmarkHelper = BenchmarkHelper;
    type BlockNumberProvider = System;
}

parameter_types! {
    pub MaxProposalWeight: Weight = Weight::from_parts(1_000_000_000, 1_000_000_000);
}

impl pallet_collective::Config<pallet_collective::Instance1> for Runtime {
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeEvent = RuntimeEvent;
    type Proposal = RuntimeCall;
    /// The maximum amount of time (in blocks) for council members to vote on motions.
    /// Motions may end in fewer blocks if enough votes are cast to determine the result.
    type MotionDuration = ConstU32<2>;
    /// The maximum number of Proposlas that can be open in the council at once.
    type MaxProposals = ConstU32<100>;
    /// The maximum number of council members.
    type MaxMembers = ConstU32<100>;
    type DefaultVote = pallet_collective::MoreThanMajorityThenPrimeDefaultVote;
    type WeightInfo = pallet_collective::weights::SubstrateWeight<Runtime>;
    type SetMembersOrigin = frame_system::EnsureRoot<AccountId>;
    type MaxProposalWeight = MaxProposalWeight;
    type KillOrigin = EnsureRoot<AccountId>;
    type DisapproveOrigin = EnsureRoot<AccountId>;
    type Consideration = ();
}

/// Build test externalities, prepopulated with data for testing democracy precompiles
pub(crate) struct ExtBuilder {
    /// Endowed accounts with balances
    balances: Vec<(AccountId, Balance)>,
    /// Collective members
    collective: Vec<AccountId>,
}

impl Default for ExtBuilder {
    fn default() -> ExtBuilder {
        ExtBuilder {
            balances: vec![],
            collective: vec![Bob.into(), Charlie.into()],
        }
    }
}

impl ExtBuilder {
    /// Fund some accounts before starting the test
    #[allow(unused)]
    pub(crate) fn with_balances(mut self, balances: Vec<(AccountId, Balance)>) -> Self {
        self.balances = balances;
        self
    }

    /// Set members of the collective
    #[allow(unused)]
    pub(crate) fn with_collective(mut self, collective: Vec<AccountId>) -> Self {
        self.collective = collective;
        self
    }

    /// Build the test externalities for use in tests
    #[allow(unused)]
    pub(crate) fn build(self) -> sp_io::TestExternalities {
        let mut t = frame_system::GenesisConfig::<Runtime>::default()
            .build_storage()
            .expect("Frame system builds valid default genesis config");

        pallet_balances::GenesisConfig::<Runtime> {
            balances: self.balances.clone(),
            dev_accounts: Default::default(),
        }
        .assimilate_storage(&mut t)
        .expect("Pallet balances storage can be assimilated");

        pallet_collective::GenesisConfig::<Runtime, pallet_collective::Instance1> {
            members: self.collective.clone(),
            phantom: Default::default(),
        }
        .assimilate_storage(&mut t)
        .expect("Pallet collective storage can be assimilated");

        let mut ext = sp_io::TestExternalities::new(t);
        ext.execute_with(|| {
            System::set_block_number(1);
        });
        ext
    }
}

#[allow(unused)]
pub(crate) fn roll_to(n: BlockNumber) {
    // We skip timestamp's on_finalize because it requires that the timestamp inherent be set
    // We may be able to simulate this by poking its storage directly, but I don't see any value
    // added from doing that.
    while System::block_number() < n {
        Treasury::on_finalize(System::block_number());
        // Times tamp::on_finalize(System::block_number());
        Evm::on_finalize(System::block_number());
        Balances::on_finalize(System::block_number());
        System::on_finalize(System::block_number());

        System::set_block_number(System::block_number() + 1);

        System::on_initialize(System::block_number());
        Balances::on_initialize(System::block_number());
        Evm::on_initialize(System::block_number());
        Timestamp::on_initialize(System::block_number());
        Treasury::on_initialize(System::block_number());
    }
}

pub(crate) fn events() -> Vec<RuntimeEvent> {
    System::events()
        .into_iter()
        .map(|r| r.event)
        .collect::<Vec<_>>()
}

#[macro_export]
macro_rules! assert_tail_eq {
    ($tail:expr, $arr:expr) => {
        if $tail.len() != 0 {
            // 0-length always passes

            if $tail.len() > $arr.len() {
                similar_asserts::assert_eq!($tail, $arr); // will fail
            }

            let len_diff = $arr.len() - $tail.len();
            similar_asserts::assert_eq!($tail, $arr[len_diff..]);
        }
    };
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
