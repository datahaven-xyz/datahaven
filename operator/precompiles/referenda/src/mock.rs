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
use frame_support::weights::constants::WEIGHT_REF_TIME_PER_SECOND;
use frame_support::{
    construct_runtime, parameter_types,
    traits::{ConstU32, EqualPrivilegeOnly, Everything, SortedMembers, VoteTally},
    weights::Weight,
};
use frame_system::{EnsureRoot, EnsureSigned, EnsureSignedBy, RawOrigin};
use pallet_evm::{EnsureAddressNever, EnsureAddressRoot, FrameSystemAccountProvider};
use pallet_referenda::{Curve, Track, TrackInfo};
use parity_scale_codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use precompile_utils::{precompile_set::*, testing::*};
use scale_info::TypeInfo;
use sp_core::H256;
use sp_runtime::str_array as s;
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup},
    BuildStorage, Perbill,
};
use sp_std::convert::{TryFrom, TryInto};
use std::borrow::Cow;

pub type AccountId = MockAccount;
pub type Balance = u128;

type Block = frame_system::mocking::MockBlockU32<Runtime>;

// Configure a mock runtime to test the pallet.
construct_runtime!(
    pub enum Runtime
    {
        System: frame_system,
        Balances: pallet_balances,
        Evm: pallet_evm,
        Timestamp: pallet_timestamp,
        Preimage: pallet_preimage,
        Scheduler: pallet_scheduler,
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
    pub GasLimitPovSizeRatio: u64 = {
        let block_gas_limit = BlockGasLimit::get().min(u64::MAX.into()).low_u64();
        block_gas_limit.saturating_div(MAX_POV_SIZE)
    };
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
    type BlockHashMapping = pallet_evm::SubstrateBlockHashMapping<Self>;
    type FindAuthor = ();
    type OnCreate = ();
    type GasLimitPovSizeRatio = GasLimitPovSizeRatio;
    type GasLimitStorageGrowthRatio = GasLimitStorageGrowthRatio;
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

impl pallet_preimage::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = ();
    type Currency = Balances;
    type ManagerOrigin = EnsureRoot<AccountId>;
    type Consideration = ();
}
impl pallet_scheduler::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeOrigin = RuntimeOrigin;
    type PalletsOrigin = OriginCaller;
    type RuntimeCall = RuntimeCall;
    type MaximumWeight = MaximumBlockWeight;
    type ScheduleOrigin = EnsureRoot<AccountId>;
    type MaxScheduledPerBlock = ConstU32<100>;
    type WeightInfo = ();
    type OriginPrivilegeCmp = EqualPrivilegeOnly;
    type Preimages = Preimage;
    type BlockNumberProvider = System;
}

parameter_types! {
    pub static AlarmInterval: u32 = 1;
}
pub struct OneToFive;
impl SortedMembers<AccountId> for OneToFive {
    fn sorted_members() -> Vec<AccountId> {
        vec![
            Alice.into(),
            Bob.into(),
            Charlie.into(),
            David.into(),
            Zero.into(),
        ]
    }
    #[cfg(feature = "runtime-benchmarks")]
    fn add(_m: &AccountId) {}
}

pub struct TestTracksInfo;
impl TracksInfo<u128, u32> for TestTracksInfo {
    type Id = u8;
    type RuntimeOrigin = <RuntimeOrigin as OriginTrait>::PalletsOrigin;
    fn tracks() -> impl Iterator<Item = Cow<'static, Track<Self::Id, Balance, u32>>> {
        static DATA: [Track<u8, u128, u32>; 2] = [
            Track {
                id: 0u8,
                info: TrackInfo {
                    name: s("root"),
                    max_deciding: 1,
                    decision_deposit: 10,
                    prepare_period: 4,
                    decision_period: 4,
                    confirm_period: 2,
                    min_enactment_period: 4,
                    min_approval: Curve::LinearDecreasing {
                        length: Perbill::from_percent(100),
                        floor: Perbill::from_percent(50),
                        ceil: Perbill::from_percent(100),
                    },
                    min_support: Curve::LinearDecreasing {
                        length: Perbill::from_percent(100),
                        floor: Perbill::from_percent(0),
                        ceil: Perbill::from_percent(100),
                    },
                },
            },
            Track {
                id: 1u8,
                info: TrackInfo {
                    name: s("none"),
                    max_deciding: 3,
                    decision_deposit: 1,
                    prepare_period: 2,
                    decision_period: 2,
                    confirm_period: 1,
                    min_enactment_period: 2,
                    min_approval: Curve::LinearDecreasing {
                        length: Perbill::from_percent(100),
                        floor: Perbill::from_percent(95),
                        ceil: Perbill::from_percent(100),
                    },
                    min_support: Curve::LinearDecreasing {
                        length: Perbill::from_percent(100),
                        floor: Perbill::from_percent(90),
                        ceil: Perbill::from_percent(100),
                    },
                },
            },
        ];
        DATA.iter().map(Cow::Borrowed)
    }
    fn track_for(id: &Self::RuntimeOrigin) -> Result<Self::Id, ()> {
        if let Ok(system_origin) = frame_system::RawOrigin::try_from(id.clone()) {
            match system_origin {
                frame_system::RawOrigin::Root => Ok(0),
                frame_system::RawOrigin::None => Ok(1),
                _ => Err(()),
            }
        } else {
            Err(())
        }
    }
}

#[derive(
    Encode, Debug, Decode, TypeInfo, Eq, PartialEq, Clone, MaxEncodedLen, DecodeWithMemTracking,
)]
pub struct Tally {
    pub ayes: u32,
    pub nays: u32,
}

impl<Class> VoteTally<u32, Class> for Tally {
    fn new(_: Class) -> Self {
        Self { ayes: 0, nays: 0 }
    }

    fn ayes(&self, _: Class) -> u32 {
        self.ayes
    }

    fn support(&self, _: Class) -> Perbill {
        Perbill::from_percent(self.ayes)
    }

    fn approval(&self, _: Class) -> Perbill {
        if self.ayes + self.nays > 0 {
            Perbill::from_rational(self.ayes, self.ayes + self.nays)
        } else {
            Perbill::zero()
        }
    }

    #[cfg(feature = "runtime-benchmarks")]
    fn unanimity(_: Class) -> Self {
        Self { ayes: 100, nays: 0 }
    }

    #[cfg(feature = "runtime-benchmarks")]
    fn rejection(_: Class) -> Self {
        Self { ayes: 0, nays: 100 }
    }

    #[cfg(feature = "runtime-benchmarks")]
    fn from_requirements(support: Perbill, approval: Perbill, _: Class) -> Self {
        let ayes = support.mul_ceil(100u32);
        let nays = ((ayes as u64) * 1_000_000_000u64 / approval.deconstruct() as u64) as u32 - ayes;
        Self { ayes, nays }
    }

    #[cfg(feature = "runtime-benchmarks")]
    fn setup(_: Class, _: Perbill) {}
}
parameter_types! {
    pub const SubmissionDeposit: u128 = 15;
}
impl pallet_referenda::Config for Runtime {
    type WeightInfo = ();
    type RuntimeCall = RuntimeCall;
    type RuntimeEvent = RuntimeEvent;
    type Scheduler = Scheduler;
    type Currency = pallet_balances::Pallet<Self>;
    type SubmitOrigin = EnsureSigned<AccountId>;
    type CancelOrigin = EnsureSignedBy<OneToFive, AccountId>;
    type KillOrigin = EnsureRoot<AccountId>;
    type Slash = ();
    type Votes = u32;
    type Tally = Tally;
    type SubmissionDeposit = SubmissionDeposit;
    type MaxQueued = ConstU32<3>;
    type UndecidingTimeout = ConstU32<20>;
    type AlarmInterval = AlarmInterval;
    type Tracks = TestTracksInfo;
    type Preimages = Preimage;
    type BlockNumberProvider = System;
}

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

/// Externality builder for pallet referenda mock runtime
pub(crate) struct ExtBuilder {
    /// Balance amounts per AccountId
    balances: Vec<(AccountId, Balance)>,
}

impl Default for ExtBuilder {
    fn default() -> ExtBuilder {
        ExtBuilder {
            balances: Vec::new(),
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
