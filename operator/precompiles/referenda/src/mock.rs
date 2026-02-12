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

//! A minimal precompile runtime including the pallet-referenda

use super::*;

use frame_support::pallet_prelude::*;
use frame_support::traits::VoteTally;
use frame_support::{
    construct_runtime, parameter_types,
    traits::{EqualPrivilegeOnly, Everything, Get},
    weights::{constants::WEIGHT_REF_TIME_PER_SECOND, Weight},
};
use frame_system::RawOrigin;
use pallet_evm::{
    EnsureAddressNever, EnsureAddressRoot, FrameSystemAccountProvider, SubstrateBlockHashMapping,
};
use pallet_referenda::{Curve, TrackInfo, TracksInfo};
use precompile_utils::{precompile_set::*, testing::MockAccount};
use sp_core::{H256, U256};
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup},
    BuildStorage, Perbill,
};
use std::{str::FromStr, vec::Vec};

pub type AccountId = MockAccount;
pub type Balance = u128;

pub struct GovOrigin;
impl FromStr for GovOrigin {
    type Err = ();
    fn from_str(_s: &str) -> Result<Self, Self::Err> {
        Err(())
    }
}

impl From<GovOrigin> for OriginCaller {
    fn from(_o: GovOrigin) -> OriginCaller {
        OriginCaller::system(RawOrigin::Root)
    }
}

type Block = frame_system::mocking::MockBlockU32<Runtime>;

construct_runtime!(
    pub enum Runtime {
        System: frame_system,
        Balances: pallet_balances,
        Evm: pallet_evm,
        Timestamp: pallet_timestamp,
        Scheduler: pallet_scheduler,
        Preimage: pallet_preimage,
        Referenda: pallet_referenda,
    }
);

parameter_types! {
    pub const BlockHashCount: u32 = 250;
    pub const MaximumBlockWeight: Weight = Weight::from_parts(
        WEIGHT_REF_TIME_PER_SECOND.saturating_mul(2),
        MAX_POV_SIZE as u64,
    );
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
    pub const ExistentialDeposit: u128 = 1;
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
        PrecompileAt<AddressU64<1>, ReferendaPrecompile<R, GovOrigin>>,
        RevertPrecompile<AddressU64<2>>,
    ),
>;

pub type PCall = ReferendaPrecompileCall<Runtime, GovOrigin>;

const MAX_POV_SIZE: u64 = 5 * 1024 * 1024;
/// Block storage limit in bytes. Set to 40 KB.
const BLOCK_STORAGE_LIMIT: u64 = 40 * 1024;

parameter_types! {
    pub BlockGasLimit: U256 = U256::from(u64::MAX);
    pub PrecompilesValue: TestPrecompiles<Runtime> = TestPrecompiles::new();
    pub const WeightPerGas: Weight = Weight::from_parts(1, 0);
    pub const GasLimitPovSizeRatio: u64 = 0;
    pub GasLimitStorageGrowthRatio: u64 = {
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
    type PrecompilesType = TestPrecompiles<Runtime>;
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
    // Use a more realistic weight similar to production runtimes
    // MaximumSchedulerWeight should be NORMAL_DISPATCH_RATIO * MaximumBlockWeight
    // In production: 0.75 * (2 * WEIGHT_REF_TIME_PER_SECOND)
    pub MaximumSchedulerWeight: Weight = Weight::from_parts(
        WEIGHT_REF_TIME_PER_SECOND.saturating_mul(2).saturating_mul(75) / 100,
        MAX_POV_SIZE as u64,
    );
    pub const MaxScheduledPerBlock: u32 = 50;
}

impl pallet_scheduler::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeOrigin = RuntimeOrigin;
    type PalletsOrigin = OriginCaller;
    type RuntimeCall = RuntimeCall;
    type MaximumWeight = MaximumSchedulerWeight;
    type ScheduleOrigin = frame_system::EnsureRoot<AccountId>;
    type MaxScheduledPerBlock = MaxScheduledPerBlock;
    type WeightInfo = ();
    type OriginPrivilegeCmp = EqualPrivilegeOnly;
    type Preimages = Preimage;
}

// Preimage configuration
parameter_types! {
    pub const PreimageMaxSize: u32 = 2 * 1024 * 1024; // 2 MB
    pub const PreimageBaseDeposit: Balance = 1;
    pub const PreimageByteDeposit: Balance = 1;
}

impl pallet_preimage::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = ();
    type Currency = Balances;
    type ManagerOrigin = frame_system::EnsureRoot<AccountId>;
    type Consideration = ();
}

// Track configuration for referenda
parameter_types! {
    pub const SubmissionDeposit: Balance = 15;
    pub const MaxQueued: u32 = 100;
    pub const UndecidingTimeout: u32 = 20;
}

pub struct TestTracksInfo;

// Simple tally implementation for testing
#[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct Tally {
    pub ayes: u128,
    pub nays: u128,
}

impl<Class> VoteTally<u128, Class> for Tally {
    fn new(_: Class) -> Self {
        Self { ayes: 0, nays: 0 }
    }

    fn ayes(&self, _: Class) -> u128 {
        self.ayes
    }

    fn approval(&self, _: Class) -> Perbill {
        Perbill::from_rational(self.ayes, self.ayes + self.nays)
    }

    fn support(&self, _: Class) -> Perbill {
        Perbill::from_rational(self.ayes, self.ayes + self.nays)
    }
}

impl Get<Vec<(u8, TrackInfo<Balance, u32>)>> for TestTracksInfo {
    fn get() -> Vec<(u8, TrackInfo<Balance, u32>)> {
        vec![
            (
                0,
                TrackInfo {
                    name: "root",
                    max_deciding: 1,
                    decision_deposit: 10,
                    prepare_period: 2,
                    decision_period: 8,
                    confirm_period: 1,
                    min_enactment_period: 1,
                    min_approval: Curve::LinearDecreasing {
                        length: Perbill::from_percent(100),
                        floor: Perbill::from_percent(50),
                        ceil: Perbill::from_percent(100),
                    },
                    min_support: Curve::LinearDecreasing {
                        length: Perbill::from_percent(100),
                        floor: Perbill::from_percent(0),
                        ceil: Perbill::from_percent(50),
                    },
                },
            ),
            (
                1,
                TrackInfo {
                    name: "none",
                    max_deciding: 1,
                    decision_deposit: 10,
                    prepare_period: 2,
                    decision_period: 8,
                    confirm_period: 1,
                    min_enactment_period: 1,
                    min_approval: Curve::LinearDecreasing {
                        length: Perbill::from_percent(100),
                        floor: Perbill::from_percent(50),
                        ceil: Perbill::from_percent(100),
                    },
                    min_support: Curve::LinearDecreasing {
                        length: Perbill::from_percent(100),
                        floor: Perbill::from_percent(0),
                        ceil: Perbill::from_percent(50),
                    },
                },
            ),
        ]
    }
}

impl TracksInfo<Balance, u32> for TestTracksInfo {
    type Id = u8;
    type RuntimeOrigin = OriginCaller;

    fn tracks() -> &'static [(Self::Id, TrackInfo<Balance, u32>)] {
        static TRACKS: &[(u8, TrackInfo<Balance, u32>)] = &[
            (
                0,
                TrackInfo {
                    name: "root",
                    max_deciding: 1,
                    decision_deposit: 10,
                    prepare_period: 2,
                    decision_period: 8,
                    confirm_period: 1,
                    min_enactment_period: 1,
                    min_approval: Curve::LinearDecreasing {
                        length: Perbill::from_percent(100),
                        floor: Perbill::from_percent(50),
                        ceil: Perbill::from_percent(100),
                    },
                    min_support: Curve::LinearDecreasing {
                        length: Perbill::from_percent(100),
                        floor: Perbill::from_percent(0),
                        ceil: Perbill::from_percent(50),
                    },
                },
            ),
            (
                1,
                TrackInfo {
                    name: "none",
                    max_deciding: 1,
                    decision_deposit: 10,
                    prepare_period: 2,
                    decision_period: 8,
                    confirm_period: 1,
                    min_enactment_period: 1,
                    min_approval: Curve::LinearDecreasing {
                        length: Perbill::from_percent(100),
                        floor: Perbill::from_percent(50),
                        ceil: Perbill::from_percent(100),
                    },
                    min_support: Curve::LinearDecreasing {
                        length: Perbill::from_percent(100),
                        floor: Perbill::from_percent(0),
                        ceil: Perbill::from_percent(50),
                    },
                },
            ),
        ];
        TRACKS
    }

    fn track_for(origin: &Self::RuntimeOrigin) -> Result<Self::Id, ()> {
        match origin {
            OriginCaller::system(frame_system::RawOrigin::Root) => Ok(0),
            _ => Err(()),
        }
    }
}

impl pallet_referenda::Config for Runtime {
    type WeightInfo = ();
    type RuntimeCall = RuntimeCall;
    type RuntimeEvent = RuntimeEvent;
    type Scheduler = Scheduler;
    type Currency = Balances;
    type SubmitOrigin = frame_system::EnsureSigned<AccountId>;
    type CancelOrigin = frame_system::EnsureSigned<AccountId>;
    type KillOrigin = frame_system::EnsureSigned<AccountId>;
    type Slash = ();
    type Votes = u128;
    type Tally = Tally;
    type SubmissionDeposit = SubmissionDeposit;
    type MaxQueued = MaxQueued;
    type UndecidingTimeout = UndecidingTimeout;
    type AlarmInterval = ();
    type Tracks = TestTracksInfo;
    type Preimages = Preimage;
}

pub(crate) struct ExtBuilder {
    // endowed accounts with balances
    balances: Vec<(AccountId, Balance)>,
}

impl Default for ExtBuilder {
    fn default() -> ExtBuilder {
        ExtBuilder { balances: vec![] }
    }
}

impl ExtBuilder {
    pub(crate) fn with_balances(mut self, balances: Vec<(AccountId, Balance)>) -> Self {
        self.balances = balances;
        self
    }

    pub(crate) fn build(self) -> sp_io::TestExternalities {
        let mut t = frame_system::GenesisConfig::<Runtime>::default()
            .build_storage()
            .expect("Frame system builds valid default genesis config");

        pallet_balances::GenesisConfig::<Runtime> {
            balances: self.balances,
        }
        .assimilate_storage(&mut t)
        .expect("Pallet balances storage can be assimilated");

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
