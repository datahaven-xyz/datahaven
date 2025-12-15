// Copyright 2025 DataHaven
// This file is part of DataHaven.

// DataHaven is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// DataHaven is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with DataHaven.  If not, see <http://www.gnu.org/licenses/>.

pub mod governance;
pub mod runtime_params;
mod storagehub;

use super::{
    currency::*,
    precompiles::{DataHavenPrecompiles, PrecompileName},
    AccountId, Babe, Balance, Balances, BeefyMmrLeaf, Block, BlockNumber, EthereumBeaconClient,
    EthereumOutboundQueueV2, EvmChainId, ExistentialDeposit, ExternalValidators,
    ExternalValidatorsRewards, ExternalValidatorsSlashes, Hash, Historical, ImOnline, MessageQueue,
    MultiBlockMigrations, Nonce, Offences, OriginCaller, OutboundCommitmentStore, PalletInfo,
    Preimage, Referenda, Runtime, RuntimeCall, RuntimeEvent, RuntimeFreezeReason,
    RuntimeHoldReason, RuntimeOrigin, RuntimeTask, SafeMode, Scheduler, Session, SessionKeys,
    Signature, System, Timestamp, Treasury, TxPause, BLOCK_HASH_COUNT, EXTRINSIC_BASE_WEIGHT,
    MAXIMUM_BLOCK_WEIGHT, NORMAL_BLOCK_WEIGHT, NORMAL_DISPATCH_RATIO, SLOT_DURATION, VERSION,
};
use codec::{Decode, Encode, MaxEncodedLen};
use scale_info::TypeInfo;
use sp_runtime::{traits::AccountIdConversion, RuntimeDebug};

/// A description of our proxy types.
/// Proxy types are used to restrict the calls that can be made by a proxy account.
#[derive(
    Copy,
    Clone,
    Eq,
    PartialEq,
    Ord,
    PartialOrd,
    Encode,
    Decode,
    RuntimeDebug,
    MaxEncodedLen,
    TypeInfo,
)]
pub enum ProxyType {
    /// Allow any call to be made by the proxy account
    Any = 0,
    /// Allow only calls that do not transfer funds or modify balances
    NonTransfer = 1,
    /// Allow only governance-related calls (Treasury, Preimage, Scheduler, etc.)
    Governance = 2,
    /// Allow only staking and validator-related calls
    Staking = 3,
    /// Allow only calls that cancel proxy announcements and reject announcements
    CancelProxy = 4,
    /// Allow only Balances calls (transfers, set_balance, force_transfer, etc.)
    Balances = 5,
    /// Allow only identity judgement calls
    IdentityJudgement = 6,
    /// Allow only calls to the Sudo pallet - useful for multisig -> sudo proxy chains
    SudoOnly = 7,
}

impl Default for ProxyType {
    fn default() -> Self {
        Self::Any
    }
}
use datahaven_runtime_common::{
    deal_with_fees::{
        DealWithEthereumBaseFees, DealWithEthereumPriorityFees, DealWithSubstrateFeesAndTip,
    },
    gas::WEIGHT_PER_GAS,
    migrations::{
        FailedMigrationHandler, MigrationCursorMaxLen, MigrationIdentifierMaxLen,
        MigrationStatusHandler,
    },
    safe_mode::{
        ReleaseDelayNone, RuntimeCallFilter, SafeModeDuration, SafeModeEnterDeposit,
        SafeModeExtendDeposit, TxPauseWhitelistedCalls,
    },
    time::{EpochDurationInBlocks, SessionsPerEra, DAYS, MILLISECS_PER_BLOCK},
};
use dhp_bridge::{EigenLayerMessageProcessor, NativeTokenTransferMessageProcessor};
use frame_support::{
    derive_impl,
    dispatch::DispatchClass,
    pallet_prelude::TransactionPriority,
    parameter_types,
    traits::{
        fungible::{Balanced, Credit, HoldConsideration, Inspect},
        tokens::{PayFromAccount, UnityAssetBalanceConversion},
        ConstU128, ConstU32, ConstU64, ConstU8, Contains, EitherOfDiverse, EqualPrivilegeOnly,
        FindAuthor, KeyOwnerProofSystem, LinearStoragePrice, OnUnbalanced, VariantCountOf,
    },
    weights::{constants::RocksDbWeight, IdentityFee, RuntimeDbWeight, Weight},
    PalletId,
};
use frame_system::{limits::BlockLength, unique, EnsureRoot, EnsureRootWithSuccess};
use governance::councils::*;
use pallet_ethereum::PostLogContent;
use pallet_evm::{
    EVMFungibleAdapter, EnsureAddressNever, EnsureAddressRoot, FeeCalculator,
    FrameSystemAccountProvider, IdentityAddressMapping,
    OnChargeEVMTransaction as OnChargeEVMTransactionT,
};
use pallet_grandpa::AuthorityId as GrandpaId;
use pallet_im_online::sr25519::AuthorityId as ImOnlineId;
use pallet_transaction_payment::{
    FungibleAdapter, Multiplier, Pallet as TransactionPayment, TargetedFeeAdjustment,
};
use polkadot_primitives::Moment;
use runtime_params::RuntimeParameters;
use snowbridge_beacon_primitives::{Fork, ForkVersions};
use snowbridge_core::{gwei, meth, AgentIdOf, PricingParameters, Rewards, TokenId};
use snowbridge_inbound_queue_primitives::RewardLedger;
use snowbridge_outbound_queue_primitives::{
    v1::{Fee, Message, SendMessage},
    v2::{Command, ConstantGasMeter, Message as OutboundMessage, SendMessage as SendMessageV2},
    SendError, SendMessageFeeProvider,
};
use snowbridge_pallet_outbound_queue_v2::OnNewCommitment;
use snowbridge_pallet_system::BalanceOf;
use sp_consensus_beefy::{
    ecdsa_crypto::AuthorityId as BeefyId,
    mmr::{BeefyDataProvider, MmrLeafVersion},
};
use sp_core::{crypto::KeyTypeId, Get, H160, H256, U256};
use sp_runtime::FixedU128;
use sp_runtime::{
    traits::{Convert, ConvertInto, IdentityLookup, Keccak256, OpaqueKeys, UniqueSaturatedInto},
    FixedPointNumber, Perbill, Perquintill,
};
use sp_staking::EraIndex;
use sp_std::{
    convert::{From, Into},
    prelude::*,
};
use sp_version::RuntimeVersion;
use xcm::latest::NetworkId;
use xcm::prelude::*;

#[cfg(feature = "runtime-benchmarks")]
use bridge_hub_common::AggregateMessageOrigin;
#[cfg(feature = "runtime-benchmarks")]
use datahaven_runtime_common::benchmarking::BenchmarkHelper;

pub(crate) use crate::weights as mainnet_weights;

const EVM_CHAIN_ID: u64 = 55930;
const SS58_FORMAT: u16 = EVM_CHAIN_ID as u16;

//╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
//║                                             COMMON PARAMETERS                                                 ║
//╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

parameter_types! {
    pub const MaxAuthorities: u32 = 32;
    pub const BondingDuration: EraIndex = polkadot_runtime_common::prod_or_fast!(28, 3);
    pub const AuthorRewardPoints: u32 = 20;
}

//╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
//║                                      SYSTEM AND CONSENSUS PALLETS                                             ║
//╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

pub struct BlockWeights;
impl Get<frame_system::limits::BlockWeights> for BlockWeights {
    fn get() -> frame_system::limits::BlockWeights {
        frame_system::limits::BlockWeights::builder()
            .for_class(DispatchClass::Normal, |weights| {
                weights.base_extrinsic = EXTRINSIC_BASE_WEIGHT;
                weights.max_total = NORMAL_BLOCK_WEIGHT.into();
            })
            .for_class(DispatchClass::Operational, |weights| {
                weights.max_total = MAXIMUM_BLOCK_WEIGHT.into();
                weights.reserved = (MAXIMUM_BLOCK_WEIGHT - NORMAL_BLOCK_WEIGHT).into();
            })
            .avg_block_initialization(Perbill::from_percent(10))
            .build()
            .expect("Provided BlockWeight definitions are valid, qed")
    }
}

parameter_types! {
    pub const BlockHashCount: BlockNumber = BLOCK_HASH_COUNT;
    pub const Version: RuntimeVersion = VERSION;

    pub RuntimeBlockWeights: frame_system::limits::BlockWeights = BlockWeights::get();
    /// We allow for 5 MB blocks.
    pub RuntimeBlockLength: BlockLength = BlockLength::max_with_normal_ratio(5 * 1024 * 1024, NORMAL_DISPATCH_RATIO);
    pub const SS58Prefix: u16 = SS58_FORMAT;
}

parameter_types! {
    pub MaxServiceWeight: Weight = NORMAL_DISPATCH_RATIO * RuntimeBlockWeights::get().max_block;
}

/// Normal Call Filter
pub struct NormalCallFilter;
impl Contains<RuntimeCall> for NormalCallFilter {
    fn contains(c: &RuntimeCall) -> bool {
        match c {
            RuntimeCall::Proxy(method) => match method {
                pallet_proxy::Call::proxy { real, .. } => {
                    !pallet_evm::AccountCodes::<Runtime>::contains_key(H160::from(*real))
                }
                _ => true,
            },
            // Filtering the EVM prevents possible re-entrancy from the precompiles which could
            // lead to unexpected scenarios.
            // See https://github.com/PureStake/sr-moonbeam/issues/30
            // Note: It is also assumed that EVM calls are only allowed through `Origin::Root` so
            // this can be seen as an additional security
            RuntimeCall::EVM(_) => false,
            _ => true,
        }
    }
}

/// Calls that can bypass the safe-mode pallet.
/// These calls are essential for emergency governance, system maintenance, and basic operation.
pub struct SafeModeWhitelistedCalls;
impl Contains<RuntimeCall> for SafeModeWhitelistedCalls {
    fn contains(call: &RuntimeCall) -> bool {
        match call {
            // Core system calls
            RuntimeCall::System(_) => true,
            RuntimeCall::Timestamp(_) => true,
            RuntimeCall::Randomness(_) => true,
            // Safe mode management
            RuntimeCall::SafeMode(_) => true,
            // Transaction pause management
            RuntimeCall::TxPause(_) => true,
            // Emergency admin access (testnet/dev only)
            RuntimeCall::Sudo(_) => true,
            // Governance infrastructure - critical for emergency responses
            RuntimeCall::Whitelist(_) => true,
            RuntimeCall::Preimage(_) => true,
            RuntimeCall::Scheduler(_) => true,
            RuntimeCall::ConvictionVoting(_) => true,
            RuntimeCall::Referenda(_) => true,
            RuntimeCall::TechnicalCommittee(_) => true,
            RuntimeCall::TreasuryCouncil(_) => true,
            _ => false,
        }
    }
}

pub type MainnetRuntimeCallFilter =
    RuntimeCallFilter<RuntimeCall, NormalCallFilter, SafeMode, TxPause>;

/// The default types are being injected by [`derive_impl`](`frame_support::derive_impl`) from
/// [`SoloChainDefaultConfig`](`struct@frame_system::config_preludes::SolochainDefaultConfig`),
/// but overridden as needed.
#[derive_impl(frame_system::config_preludes::SolochainDefaultConfig)]
impl frame_system::Config for Runtime {
    /// The block type for the runtime.
    type Block = Block;
    /// Block & extrinsics weights: base values and limits.
    type BlockWeights = RuntimeBlockWeights;
    /// The maximum length of a block (in bytes).
    type BlockLength = RuntimeBlockLength;
    /// The identifier used to distinguish between accounts.
    type AccountId = AccountId;
    /// The lookup mechanism to get account ID from whatever is passed in dispatchers.
    type Lookup = IdentityLookup<AccountId>;
    /// The type for storing how many extrinsics an account has signed.
    type Nonce = Nonce;
    /// The type for hashing blocks and tries.
    type Hash = Hash;
    /// Maximum number of block number to block hash mappings to keep (oldest pruned first).
    type BlockHashCount = BlockHashCount;
    /// The weight of database operations that the runtime can invoke.
    type DbWeight = RocksDbWeight;
    /// Version of the runtime.
    type Version = Version;
    /// The data to be stored in an account.
    type AccountData = pallet_balances::AccountData<Balance>;
    /// This is used as an identifier of the chain. 42 is the generic substrate prefix.
    type SS58Prefix = SS58Prefix;
    type MaxConsumers = frame_support::traits::ConstU32<16>;
    type SystemWeightInfo = mainnet_weights::frame_system::WeightInfo<Runtime>;
    type MultiBlockMigrator = MultiBlockMigrations;
    /// Use the combined call filter to apply Normal, SafeMode, and TxPause restrictions
    type BaseCallFilter = MainnetRuntimeCallFilter;
}

// 1 in 4 blocks (on average, not counting collisions) will be primary babe blocks.
pub const PRIMARY_PROBABILITY: (u64, u64) = (1, 4);
/// The BABE epoch configuration at genesis.
pub const BABE_GENESIS_EPOCH_CONFIG: sp_consensus_babe::BabeEpochConfiguration =
    sp_consensus_babe::BabeEpochConfiguration {
        c: PRIMARY_PROBABILITY,
        allowed_slots: sp_consensus_babe::AllowedSlots::PrimaryAndSecondaryVRFSlots,
    };

parameter_types! {
    pub const ExpectedBlockTime: Moment = MILLISECS_PER_BLOCK;
    pub ReportLongevity: u64 =
        BondingDuration::get() as u64 * SessionsPerEra::get() as u64 * (EpochDurationInBlocks::get() as u64);
}

impl pallet_babe::Config for Runtime {
    type EpochDuration = EpochDurationInBlocks;
    type ExpectedBlockTime = ExpectedBlockTime;
    type EpochChangeTrigger = pallet_babe::ExternalTrigger;
    type DisabledValidators = Session;
    type WeightInfo = mainnet_weights::pallet_babe::WeightInfo<Runtime>;
    type MaxAuthorities = MaxAuthorities;
    type MaxNominators = ConstU32<0>;

    type KeyOwnerProof =
        <Historical as KeyOwnerProofSystem<(KeyTypeId, pallet_babe::AuthorityId)>>::Proof;

    type EquivocationReportSystem =
        pallet_babe::EquivocationReportSystem<Self, Offences, Historical, ReportLongevity>;
}

impl pallet_timestamp::Config for Runtime {
    /// A timestamp: milliseconds since the unix epoch.
    type Moment = u64;
    type OnTimestampSet = Babe;
    type MinimumPeriod = ConstU64<{ SLOT_DURATION / 2 }>;
    type WeightInfo = mainnet_weights::pallet_timestamp::WeightInfo<Runtime>;
}

impl pallet_balances::Config for Runtime {
    type MaxLocks = ConstU32<50>;
    type MaxReserves = ();
    type ReserveIdentifier = [u8; 8];
    /// The type for recording an account's balance.
    type Balance = Balance;
    /// The ubiquitous event type.
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = System;
    type WeightInfo = mainnet_weights::pallet_balances::WeightInfo<Runtime>;
    type FreezeIdentifier = RuntimeFreezeReason;
    type MaxFreezes = VariantCountOf<RuntimeFreezeReason>;
    type RuntimeHoldReason = RuntimeHoldReason;
    type RuntimeFreezeReason = RuntimeFreezeReason;
    type DoneSlashHandler = ();
}

pub struct RewardsPoints;

impl pallet_authorship::EventHandler<AccountId, BlockNumber> for RewardsPoints {
    fn note_author(author: AccountId) {
        let whitelisted_validators =
            pallet_external_validators::WhitelistedValidatorsActiveEra::<Runtime>::get();
        // Do not reward whitelisted validators
        if !whitelisted_validators.contains(&author) {
            ExternalValidatorsRewards::reward_by_ids(vec![(author, AuthorRewardPoints::get())])
        }
    }
}

impl pallet_authorship::Config for Runtime {
    type FindAuthor = pallet_session::FindAccountFromAuthorIndex<Self, Babe>;
    type EventHandler = (RewardsPoints, ImOnline);
}

impl pallet_offences::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type IdentificationTuple = pallet_session::historical::IdentificationTuple<Self>;
    type OnOffenceHandler = ExternalValidatorsSlashes;
}

pub struct FullIdentificationOf;
impl Convert<AccountId, Option<()>> for FullIdentificationOf {
    fn convert(_: AccountId) -> Option<()> {
        Some(())
    }
}

impl pallet_session::historical::Config for Runtime {
    type FullIdentification = ();
    type FullIdentificationOf = FullIdentificationOf;
}

impl pallet_session::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type ValidatorId = AccountId;
    type ValidatorIdOf = ConvertInto;
    type ShouldEndSession = Babe;
    type NextSessionRotation = Babe;
    type SessionManager = pallet_session::historical::NoteHistoricalRoot<Self, ExternalValidators>;
    type SessionHandler = <SessionKeys as OpaqueKeys>::KeyTypeIdProviders;
    type Keys = SessionKeys;
    type WeightInfo = pallet_session::weights::SubstrateWeight<Runtime>;
}

parameter_types! {
    pub const ImOnlineUnsignedPriority: TransactionPriority = TransactionPriority::MAX;
}

impl pallet_im_online::Config for Runtime {
    type AuthorityId = ImOnlineId;
    type MaxKeys = MaxAuthorities;
    type MaxPeerInHeartbeats = ConstU32<0>; // Not used any more
    type RuntimeEvent = RuntimeEvent;
    type ValidatorSet = Historical;
    type NextSessionRotation = Babe;
    type ReportUnresponsiveness = Offences;
    type UnsignedPriority = ImOnlineUnsignedPriority;
    type WeightInfo = crate::weights::pallet_im_online::WeightInfo<Runtime>;
}

parameter_types! {
    pub const EquivocationReportPeriodInEpochs: u64 = 168;
    pub const EquivocationReportPeriodInBlocks: u64 =
        EquivocationReportPeriodInEpochs::get() * (EpochDurationInBlocks::get() as u64);
        pub const MaxSetIdSessionEntries: u32 = BondingDuration::get() * SessionsPerEra::get();
}

impl pallet_grandpa::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;

    type WeightInfo = mainnet_weights::pallet_grandpa::WeightInfo<Runtime>;
    type MaxAuthorities = MaxAuthorities;
    type MaxNominators = ConstU32<0>;
    type MaxSetIdSessionEntries = MaxSetIdSessionEntries;

    type KeyOwnerProof = <Historical as KeyOwnerProofSystem<(KeyTypeId, GrandpaId)>>::Proof;
    type EquivocationReportSystem = pallet_grandpa::EquivocationReportSystem<
        Self,
        Offences,
        Historical,
        EquivocationReportPeriodInBlocks,
    >;
}

parameter_types! {
    /// The portion of the `NORMAL_DISPATCH_RATIO` that we adjust the fees with. Blocks filled less
    /// than this will decrease the weight and more will increase.
    pub const TargetBlockFullness: Perquintill = Perquintill::from_percent(35);
    /// The adjustment variable of the runtime. Higher values will cause `TargetBlockFullness` to
    /// change the fees more rapidly. This fast multiplier responds by doubling/halving in
    /// approximately one hour at extreme block congestion levels.
    pub AdjustmentVariable: Multiplier = Multiplier::saturating_from_rational(4, 1_000);
    /// Minimum amount of the multiplier. This value cannot be too low. A test case should ensure
    /// that combined with `AdjustmentVariable`, we can recover from the minimum.
    /// See `multiplier_can_grow_from_zero` in integration_tests.rs.
    pub MinimumMultiplier: Multiplier = Multiplier::from(1u128);
    /// Maximum multiplier. We pick a value that is expensive but not impossibly so; it should act
    /// as a safety net.
    pub MaximumMultiplier: Multiplier = Multiplier::from(100_000u128);
}

/// SlowAdjustingFeeUpdate implements a dynamic fee adjustment mechanism similar to Ethereum's EIP-1559.
/// It adjusts transaction fees based on network congestion to prevent DoS attacks.
/// This version uses a higher minimum multiplier for more conservative fee adjustments.
///
/// The algorithm works as follows:
/// diff = (previous_block_weight - target) / maximum_block_weight
/// next_multiplier = prev_multiplier * (1 + (v * diff) + ((v * diff)^2 / 2))
/// assert(next_multiplier > min)
///     where: v is AdjustmentVariable
///            target is TargetBlockFullness
///            min is MinimumMultiplier
pub type SlowAdjustingFeeUpdate<R> = TargetedFeeAdjustment<
    R,
    TargetBlockFullness,
    AdjustmentVariable,
    MinimumMultiplier,
    MaximumMultiplier,
>;

impl pallet_transaction_payment::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type OnChargeTransaction = FungibleAdapter<
        Balances,
        DealWithSubstrateFeesAndTip<
            Runtime,
            runtime_params::dynamic_params::runtime_config::FeesTreasuryProportion,
        >,
    >;
    type OperationalFeeMultiplier = ConstU8<5>;
    #[cfg(not(feature = "runtime-benchmarks"))]
    type WeightToFee = IdentityFee<Balance>;
    #[cfg(feature = "runtime-benchmarks")]
    type WeightToFee = benchmark_helpers::BenchmarkWeightToFee;
    #[cfg(not(feature = "runtime-benchmarks"))]
    type LengthToFee = IdentityFee<Balance>;
    #[cfg(feature = "runtime-benchmarks")]
    type LengthToFee = benchmark_helpers::BenchmarkWeightToFee;
    type FeeMultiplierUpdate = SlowAdjustingFeeUpdate<Runtime>;
    type WeightInfo = mainnet_weights::pallet_transaction_payment::WeightInfo<Runtime>;
}

parameter_types! {
    pub const BeefySetIdSessionEntries: u32 = BondingDuration::get() * SessionsPerEra::get();
}

impl pallet_beefy::Config for Runtime {
    type BeefyId = BeefyId;
    type MaxAuthorities = ConstU32<32>;
    type MaxNominators = ConstU32<0>;
    type MaxSetIdSessionEntries = BeefySetIdSessionEntries;
    type OnNewValidatorSet = BeefyMmrLeaf;
    type AncestryHelper = BeefyMmrLeaf;
    type WeightInfo = ();
    type KeyOwnerProof = <Historical as KeyOwnerProofSystem<(KeyTypeId, BeefyId)>>::Proof;
    type EquivocationReportSystem =
        pallet_beefy::EquivocationReportSystem<Self, Offences, Historical, ReportLongevity>;
}

parameter_types! {
    pub LeafVersion: MmrLeafVersion = MmrLeafVersion::new(0, 0);
}

#[derive(Debug, PartialEq, Eq, Clone, Encode, Decode)]
pub struct LeafExtraData {
    extra: H256,
}

pub struct LeafExtraDataProvider;
impl BeefyDataProvider<LeafExtraData> for LeafExtraDataProvider {
    fn extra_data() -> LeafExtraData {
        LeafExtraData {
            extra: OutboundCommitmentStore::get_latest_commitment().unwrap_or_default(),
        }
    }
}

impl pallet_mmr::Config for Runtime {
    const INDEXING_PREFIX: &'static [u8] = pallet_mmr::primitives::INDEXING_PREFIX;
    type Hashing = Keccak256;
    type LeafData = pallet_beefy_mmr::Pallet<Runtime>;
    type OnNewRoot = pallet_beefy_mmr::DepositBeefyDigest<Runtime>;
    type WeightInfo = mainnet_weights::pallet_mmr::WeightInfo<Runtime>;
    type BlockHashProvider = pallet_mmr::DefaultBlockHashProvider<Runtime>;
    #[cfg(feature = "runtime-benchmarks")]
    type BenchmarkHelper = ();
}

impl pallet_beefy_mmr::Config for Runtime {
    type LeafVersion = LeafVersion;
    type BeefyAuthorityToMerkleLeaf = pallet_beefy_mmr::BeefyEcdsaToEthereum;
    type LeafExtra = LeafExtraData;
    type BeefyDataProvider = LeafExtraDataProvider;
    type WeightInfo = mainnet_weights::pallet_beefy_mmr::WeightInfo<Runtime>;
}

//╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
//║                                    POLKADOT SDK UTILITY PALLETS                                               ║
//╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

impl pallet_utility::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type PalletsOrigin = OriginCaller;
    type WeightInfo = mainnet_weights::pallet_utility::WeightInfo<Runtime>;
}

parameter_types! {
    pub MaximumSchedulerWeight: Weight = NORMAL_DISPATCH_RATIO * RuntimeBlockWeights::get().max_block;
    pub const NoPreimagePostponement: Option<u32> = Some(10);
}

impl pallet_scheduler::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeOrigin = RuntimeOrigin;
    type PalletsOrigin = OriginCaller;
    type RuntimeCall = RuntimeCall;
    type MaximumWeight = MaximumSchedulerWeight;
    type ScheduleOrigin = EnsureRoot<AccountId>;
    type MaxScheduledPerBlock = ConstU32<50>;
    type OriginPrivilegeCmp = EqualPrivilegeOnly;
    type Preimages = Preimage;
    type WeightInfo = mainnet_weights::pallet_scheduler::WeightInfo<Runtime>;
}

parameter_types! {
    pub const PreimageBaseDeposit: Balance = 5 * HAVE * SUPPLY_FACTOR ;
    pub const PreimageByteDeposit: Balance = STORAGE_BYTE_FEE;
    pub const PreimageHoldReason: RuntimeHoldReason =
        RuntimeHoldReason::Preimage(pallet_preimage::HoldReason::Preimage);
}

impl pallet_preimage::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type ManagerOrigin = EnsureRoot<AccountId>;
    type Consideration = HoldConsideration<
        AccountId,
        Balances,
        PreimageHoldReason,
        LinearStoragePrice<PreimageBaseDeposit, PreimageByteDeposit, Balance>,
    >;
    type WeightInfo = mainnet_weights::pallet_preimage::WeightInfo<Runtime>;
}

parameter_types! {
    pub const MaxSubAccounts: u32 = 100;
    pub const MaxAdditionalFields: u32 = 100;
    pub const MaxRegistrars: u32 = 20;
    pub const PendingUsernameExpiration: u32 = 7 * DAYS;
    pub const MaxSuffixLength: u32 = 7;
    pub const MaxUsernameLength: u32 = 32;
}

type IdentityForceOrigin =
    EitherOfDiverse<EnsureRoot<AccountId>, governance::custom_origins::GeneralAdmin>;
type IdentityRegistrarOrigin =
    EitherOfDiverse<EnsureRoot<AccountId>, governance::custom_origins::GeneralAdmin>;

impl pallet_identity::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    // Add one item in storage and take 258 bytes
    type BasicDeposit = ConstU128<{ deposit(1, 258) }>;
    // Does not add any item to the storage but takes 1 bytes
    type ByteDeposit = ConstU128<{ deposit(0, 1) }>;
    // Add one item in storage and take 53 bytes
    type SubAccountDeposit = ConstU128<{ deposit(1, 53) }>;
    type MaxSubAccounts = MaxSubAccounts;
    type IdentityInformation = pallet_identity::legacy::IdentityInfo<MaxAdditionalFields>;
    type MaxRegistrars = MaxRegistrars;
    type Slashed = Treasury;
    type ForceOrigin = IdentityForceOrigin;
    type RegistrarOrigin = IdentityRegistrarOrigin;
    type OffchainSignature = Signature;
    type SigningPublicKey = <Signature as sp_runtime::traits::Verify>::Signer;
    type UsernameAuthorityOrigin = EnsureRoot<AccountId>;
    type PendingUsernameExpiration = PendingUsernameExpiration;
    type MaxSuffixLength = MaxSuffixLength;
    type MaxUsernameLength = MaxUsernameLength;
    type WeightInfo = pallet_identity::weights::SubstrateWeight<Runtime>;
    type UsernameDeposit = ();
    type UsernameGracePeriod = ();

    // TODO: Re-enable after upgrade to Polkadot SDK stable2412-8
    // see https://github.com/paritytech/polkadot-sdk/releases/tag/polkadot-stable2412-8
    // #[cfg(feature = "runtime-benchmarks")]
    // fn benchmark_helper(message: &[u8]) -> (Vec<u8>, Vec<u8>) {
    //     let public = sp_io::crypto::ecdsa_generate(0.into(), None);
    //     let eth_signer: Self::SigningPublicKey = public.into();
    //     let hash_msg = sp_io::hashing::keccak_256(message);
    //     let signature = Self::OffchainSignature::new(
    //         sp_io::crypto::ecdsa_sign_prehashed(0.into(), &public, &hash_msg).unwrap(),
    //     );

    //     (eth_signer.encode(), signature.encode())
    // }
}

parameter_types! {
    // One storage item; key size is 32 + 20; value is size 4+4+16+20 bytes = 44 bytes.
    pub const DepositBase: Balance = deposit(1, 96);
    // Additional storage item size of 20 bytes.
    pub const DepositFactor: Balance = deposit(0, 20);
    pub const MaxSignatories: u32 = 100;
}

impl pallet_multisig::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type Currency = Balances;
    type DepositBase = DepositBase;
    type DepositFactor = DepositFactor;
    type MaxSignatories = MaxSignatories;
    type WeightInfo = mainnet_weights::pallet_multisig::WeightInfo<Runtime>;
}

parameter_types! {
    // One storage item; key size 32 (AccountId), value overhead ~8 bytes (Vec metadata)
    pub const ProxyDepositBase: Balance = deposit(1, 8);
    // Additional storage item size of 21 bytes (20 bytes AccountId + 1 byte sizeof(ProxyType)).
    pub const ProxyDepositFactor: Balance = deposit(0, 21);
    pub const MaxProxies: u16 = 32;
    // One storage item; key size 32 (AccountId), value overhead ~8 bytes (BoundedVec metadata)
    pub const AnnouncementDepositBase: Balance = deposit(1, 8);
    // Additional storage item size of 56 bytes:
    // - 20 bytes AccountId
    // - 32 bytes Hasher (Blake2256)
    // - 4 bytes BlockNumber (u32)
    pub const AnnouncementDepositFactor: Balance = deposit(0, 56);
    pub const MaxPending: u16 = 32;
}

// Implement the proxy filter logic specific to the mainnet runtime
impl frame_support::traits::InstanceFilter<RuntimeCall> for ProxyType {
    fn filter(&self, c: &RuntimeCall) -> bool {
        match self {
            ProxyType::Any => true,
            ProxyType::NonTransfer => match c {
                RuntimeCall::Identity(
                    pallet_identity::Call::add_sub { .. } | pallet_identity::Call::set_subs { .. },
                ) => false,
                call => {
                    matches!(
                        call,
                        RuntimeCall::System(..)
                            | RuntimeCall::Timestamp(..)
                            | RuntimeCall::Identity(..)
                            | RuntimeCall::Utility(..)
                            | RuntimeCall::Proxy(..)
                            | RuntimeCall::Referenda(..)
                            | RuntimeCall::Preimage(..)
                            | RuntimeCall::ConvictionVoting(..)
                            | RuntimeCall::TreasuryCouncil(..)
                            | RuntimeCall::TechnicalCommittee(..)
                    )
                }
            },
            ProxyType::Governance => {
                matches!(
                    c,
                    RuntimeCall::Referenda(..)
                        | RuntimeCall::Preimage(..)
                        | RuntimeCall::ConvictionVoting(..)
                        | RuntimeCall::TreasuryCouncil(..)
                        | RuntimeCall::TechnicalCommittee(..)
                        | RuntimeCall::Utility(..)
                )
            }
            ProxyType::Staking => {
                // Todo: Add additional staking calls when available
                matches!(c, RuntimeCall::Utility(..))
            }
            ProxyType::CancelProxy => {
                matches!(
                    c,
                    RuntimeCall::Proxy(pallet_proxy::Call::reject_announcement { .. })
                )
            }
            ProxyType::Balances => {
                matches!(c, RuntimeCall::Balances(..) | RuntimeCall::Utility(..))
            }
            ProxyType::IdentityJudgement => {
                matches!(
                    c,
                    RuntimeCall::Identity(pallet_identity::Call::provide_judgement { .. })
                        | RuntimeCall::Utility(..)
                )
            }
            ProxyType::SudoOnly => {
                matches!(c, RuntimeCall::Sudo(..))
            }
        }
    }

    fn is_superset(&self, o: &Self) -> bool {
        match (self, o) {
            (x, y) if x == y => true,
            (ProxyType::Any, _) => true,
            (_, ProxyType::Any) => false,
            _ => false,
        }
    }
}

/// Helper function to identify governance precompiles (copied from Moonbeam)
fn is_governance_precompile(precompile_name: &PrecompileName) -> bool {
    matches!(
        precompile_name,
        PrecompileName::ConvictionVotingPrecompile
            | PrecompileName::TechnicalCommitteeInstance
            | PrecompileName::TreasuryCouncilInstance
            | PrecompileName::PreimagePrecompile
            | PrecompileName::ReferendaPrecompile
    )
}

impl pallet_evm_precompile_proxy::EvmProxyCallFilter for ProxyType {
    fn is_evm_proxy_call_allowed(
        &self,
        call: &pallet_evm_precompile_proxy::EvmSubCall,
        recipient_has_code: bool,
        gas: u64,
    ) -> precompile_utils::EvmResult<bool> {
        Ok(match self {
            ProxyType::Any => {
                match PrecompileName::from_address(call.to.0) {
                    Some(ref precompile) if is_governance_precompile(precompile) => true,
                    Some(_) => false, // All other precompiles are forbidden
                    None => {
                        // Allow simple EOA transfers only
                        !recipient_has_code
                            && !precompile_utils::precompile_set::is_precompile_or_fail::<Runtime>(
                                call.to.0, gas,
                            )?
                    }
                }
            }
            ProxyType::NonTransfer => {
                call.value == sp_core::U256::zero()
                    && match PrecompileName::from_address(call.to.0) {
                        Some(ref precompile) if is_governance_precompile(precompile) => true,
                        _ => false,
                    }
            }
            ProxyType::Governance => {
                call.value == sp_core::U256::zero()
                    && matches!(
                        PrecompileName::from_address(call.to.0),
                        Some(ref precompile) if is_governance_precompile(precompile)
                    )
            }
            ProxyType::Staking => false,
            ProxyType::CancelProxy => false,
            ProxyType::Balances => {
                // Allow only "simple" accounts as recipient (no code nor precompile)
                !recipient_has_code
                    && !precompile_utils::precompile_set::is_precompile_or_fail::<Runtime>(
                        call.to.0, gas,
                    )?
            }
            ProxyType::IdentityJudgement => false,
            ProxyType::SudoOnly => false,
        })
    }
}

impl pallet_proxy::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type Currency = Balances;
    type ProxyType = ProxyType;
    type ProxyDepositBase = ProxyDepositBase;
    type ProxyDepositFactor = ProxyDepositFactor;
    type MaxProxies = MaxProxies;
    type WeightInfo = mainnet_weights::pallet_proxy::WeightInfo<Runtime>;
    type MaxPending = MaxPending;
    type CallHasher = sp_runtime::traits::BlakeTwo256;
    type AnnouncementDepositBase = AnnouncementDepositBase;
    type AnnouncementDepositFactor = AnnouncementDepositFactor;
}

impl pallet_parameters::Config for Runtime {
    type AdminOrigin = EnsureRoot<AccountId>;
    type RuntimeEvent = RuntimeEvent;
    type RuntimeParameters = RuntimeParameters;
    type WeightInfo = mainnet_weights::pallet_parameters::WeightInfo<Runtime>;
}

impl pallet_migrations::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    #[cfg(not(feature = "runtime-benchmarks"))]
    type Migrations = datahaven_runtime_common::migrations::MultiBlockMigrationList;
    #[cfg(feature = "runtime-benchmarks")]
    type Migrations = datahaven_runtime_common::migrations::MultiBlockMigrationList;
    type CursorMaxLen = MigrationCursorMaxLen;
    type IdentifierMaxLen = MigrationIdentifierMaxLen;
    type MigrationStatusHandler = MigrationStatusHandler;
    type FailedMigrationHandler = FailedMigrationHandler<SafeMode>;
    type MaxServiceWeight = MaxServiceWeight;
    type WeightInfo = mainnet_weights::pallet_migrations::WeightInfo<Runtime>;
}

impl pallet_sudo::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type WeightInfo = mainnet_weights::pallet_sudo::WeightInfo<Runtime>;
}

parameter_types! {
    /// Amount of weight that can be spent per block to service messages.
    ///
    /// # WARNING
    ///
    /// This is not a good value for para-chains since the `Scheduler` already uses up to 80% block weight.
    pub MessageQueueServiceWeight: Weight = Perbill::from_percent(20) * RuntimeBlockWeights::get().max_block;
    pub const MessageQueueHeapSize: u32 = 32 * 1024;
    pub const MessageQueueMaxStale: u32 = 96;
}

impl pallet_message_queue::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    #[cfg(not(feature = "runtime-benchmarks"))]
    type MessageProcessor = EthereumOutboundQueueV2;
    #[cfg(feature = "runtime-benchmarks")]
    type MessageProcessor =
        pallet_message_queue::mock_helpers::NoopMessageProcessor<AggregateMessageOrigin>;
    type Size = u32;
    type QueueChangeHandler = ();
    type QueuePausedQuery = ();
    type HeapSize = MessageQueueHeapSize;
    type MaxStale = MessageQueueMaxStale;
    type ServiceWeight = MessageQueueServiceWeight;
    type IdleMaxServiceWeight = MessageQueueServiceWeight;
    type WeightInfo = mainnet_weights::pallet_message_queue::WeightInfo<Runtime>;
}

parameter_types! {
    pub const TreasuryId: PalletId = PalletId(*b"pc/trsry");
    pub TreasuryAccount: AccountId = Treasury::account_id();
    pub const MaxSpendBalance: crate::Balance = crate::Balance::max_value();

    /// PalletId for the External Validator Rewards account.
    /// This account receives minted inflation tokens before they are bridged to Ethereum
    /// for distribution to validators via EigenLayer.
    ///
    /// Governance/Sudo can transfer funds using: pallet_balances::force_transfer
    pub const ExternalValidatorRewardsId: PalletId = PalletId(*b"dh/evrew");
    pub ExternalValidatorRewardsAccount: AccountId = ExternalValidatorRewardsId::get().into_account_truncating();
}

type RootOrTreasuryCouncilOrigin = EitherOfDiverse<
    EnsureRoot<AccountId>,
    pallet_collective::EnsureProportionMoreThan<AccountId, TreasuryCouncilInstance, 1, 2>,
>;

impl pallet_treasury::Config for Runtime {
    type PalletId = TreasuryId;
    type Currency = Balances;
    type RejectOrigin = RootOrTreasuryCouncilOrigin;
    type RuntimeEvent = RuntimeEvent;
    type SpendPeriod = ConstU32<{ 6 * DAYS }>;
    type Burn = ();
    type BurnDestination = ();
    type MaxApprovals = ConstU32<100>;
    type WeightInfo = mainnet_weights::pallet_treasury::WeightInfo<Runtime>;
    type SpendFunds = ();
    type SpendOrigin =
        frame_system::EnsureWithSuccess<RootOrTreasuryCouncilOrigin, AccountId, MaxSpendBalance>;
    type AssetKind = ();
    type Beneficiary = AccountId;
    type BeneficiaryLookup = IdentityLookup<AccountId>;
    type Paymaster = PayFromAccount<Balances, TreasuryAccount>;
    type BalanceConverter = UnityAssetBalanceConversion;
    type PayoutPeriod = ConstU32<{ 30 * DAYS }>;
    #[cfg(feature = "runtime-benchmarks")]
    type BenchmarkHelper = BenchmarkHelper;
    type BlockNumberProvider = System;
}

//╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
//║                                        FRONTIER (EVM) PALLETS                                                 ║
//╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

parameter_types! {
    pub const PostBlockAndTxnHashes: PostLogContent = PostLogContent::BlockAndTxnHashes;
}

impl pallet_ethereum::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type StateRoot = pallet_ethereum::IntermediateStateRoot<Self::Version>;
    type PostLogContent = PostBlockAndTxnHashes;
    type ExtraDataLength = ConstU32<30>;
}

// Ported from Moonbeam, please check for reference: https://github.com/moonbeam-foundation/moonbeam/pull/1765
pub struct TransactionPaymentAsGasPrice;
impl FeeCalculator for TransactionPaymentAsGasPrice {
    fn min_gas_price() -> (U256, Weight) {
        // note: transaction-payment differs from EIP-1559 in that its tip and length fees are not
        //       scaled by the multiplier, which means its multiplier will be overstated when
        //       applied to an ethereum transaction
        // note: transaction-payment uses both a congestion modifier (next_fee_multiplier, which is
        //       updated once per block in on_finalize) and a 'WeightToFee' implementation. Our
        //       runtime implements this as a 'ConstantModifier', so we can get away with a simple
        //       multiplication here.
        let min_gas_price: u128 = TransactionPayment::<Runtime>::next_fee_multiplier()
            .saturating_mul_int((WEIGHT_FEE).saturating_mul(WEIGHT_PER_GAS as u128));
        (
            min_gas_price.into(),
            <<Runtime as frame_system::Config>::DbWeight as Get<RuntimeDbWeight>>::get().reads(1),
        )
    }
}

pub struct FindAuthorAdapter<T>(core::marker::PhantomData<T>);
impl<T> FindAuthor<H160> for FindAuthorAdapter<T>
where
    T: frame_system::Config + pallet_session::Config,
    <T as pallet_session::Config>::ValidatorId: Into<H160>,
{
    fn find_author<'a, I>(digests: I) -> Option<H160>
    where
        I: 'a + IntoIterator<Item = (sp_runtime::ConsensusEngineId, &'a [u8])>,
    {
        pallet_session::FindAccountFromAuthorIndex::<T, Babe>::find_author(digests)
            .map(|author| author.into())
    }
}

datahaven_runtime_common::impl_on_charge_evm_transaction!();

pub type Precompiles = DataHavenPrecompiles<Runtime>;

parameter_types! {
    pub BlockGasLimit: U256
        = U256::from(NORMAL_DISPATCH_RATIO * MAXIMUM_BLOCK_WEIGHT.ref_time() / WEIGHT_PER_GAS);
    pub PrecompilesValue: Precompiles = DataHavenPrecompiles::<Runtime>::new();
    pub WeightPerGas: Weight = Weight::from_parts(WEIGHT_PER_GAS, 0);
    pub SuicideQuickClearLimit: u32 = 0;
    /// The amount of gas per pov. Set to 0 because DataHaven is a solo chain and we don't
    /// account for POV (Proof-of-Validity) size constraints like parachains do.
    /// We should re-check `xcm_config::Erc20XcmBridgeTransferGasLimit` when changing this value
    pub const GasLimitPovSizeRatio: u64 = 0;
    /// The amount of gas per storage (in bytes): BLOCK_GAS_LIMIT / BLOCK_STORAGE_LIMIT
    /// (60_000_000 / 160 kb)
    pub GasLimitStorageGrowthRatio: u64 = 366;
}

impl pallet_evm::Config for Runtime {
    type AccountProvider = FrameSystemAccountProvider<Runtime>;
    type FeeCalculator = TransactionPaymentAsGasPrice;
    type GasWeightMapping = pallet_evm::FixedGasWeightMapping<Self>;
    type WeightPerGas = WeightPerGas;
    type BlockHashMapping = pallet_ethereum::EthereumBlockHashMapping<Self>;
    type CallOrigin = EnsureAddressRoot<AccountId>;
    type WithdrawOrigin = EnsureAddressNever<AccountId>;
    type AddressMapping = IdentityAddressMapping;
    type Currency = Balances;
    type RuntimeEvent = RuntimeEvent;
    type PrecompilesType = Precompiles;
    type PrecompilesValue = PrecompilesValue;
    type ChainId = EvmChainId;
    type BlockGasLimit = BlockGasLimit;
    type Runner = pallet_evm::runner::stack::Runner<Self>;
    type OnChargeTransaction = OnChargeEVMTransaction<
        DealWithEthereumBaseFees<
            Runtime,
            runtime_params::dynamic_params::runtime_config::FeesTreasuryProportion,
        >,
        DealWithEthereumPriorityFees<Runtime>,
    >;
    type OnCreate = ();
    type FindAuthor = FindAuthorAdapter<Self>;
    type GasLimitPovSizeRatio = GasLimitPovSizeRatio;
    type GasLimitStorageGrowthRatio = GasLimitStorageGrowthRatio;
    type Timestamp = Timestamp;
    type WeightInfo = mainnet_weights::pallet_evm::WeightInfo<Runtime>;
}

impl pallet_evm_chain_id::Config for Runtime {}

//╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
//║                                          SNOWBRIDGE PALLETS                                                   ║
//╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

// --- Snowbridge Config Constants & Parameter Types ---
parameter_types! {
    // Ethereum mainnet genesis hash
    pub const MainnetGenesisHash: [u8; 32] = hex_literal::hex!("d4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3");
    pub UniversalLocation: InteriorLocation = [
        GlobalConsensus(ByGenesis(MainnetGenesisHash::get()))
    ].into();
    pub InboundDeliveryCost: BalanceOf<Runtime> = 0;
    pub RootLocation: Location = Location::here();
    pub Parameters: PricingParameters<u128> = PricingParameters {
        exchange_rate: FixedU128::from_rational(1, 400),
        fee_per_gas: gwei(20),
        rewards: Rewards { local: HAVE, remote: meth(1) },
        multiplier: FixedU128::from_rational(1, 1),
    };
    pub EthereumLocation: Location = Location::new(1, EthereumNetwork::get());
}

pub struct DoNothingOutboundQueue;
impl SendMessage for DoNothingOutboundQueue {
    type Ticket = ();

    fn validate(
        _: &Message,
    ) -> Result<(Self::Ticket, Fee<<Self as SendMessageFeeProvider>::Balance>), SendError> {
        Ok(((), Fee::from((0, 0))))
    }

    fn deliver(_: Self::Ticket) -> Result<H256, snowbridge_outbound_queue_primitives::SendError> {
        Ok(H256::zero())
    }
}

impl SendMessageFeeProvider for DoNothingOutboundQueue {
    type Balance = u128;

    fn local_fee() -> Self::Balance {
        1
    }
}

// Implement the Snowbridge System V1 config trait
impl snowbridge_pallet_system::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type OutboundQueue = DoNothingOutboundQueue;
    type SiblingOrigin = EnsureRootWithSuccess<AccountId, RootLocation>;
    type AgentIdOf = AgentIdOf;
    type Token = Balances;
    type TreasuryAccount = TreasuryAccount;
    type DefaultPricingParameters = Parameters;
    type InboundDeliveryCost = InboundDeliveryCost;
    type UniversalLocation = UniversalLocation;
    type EthereumLocation = EthereumLocation;
    type WeightInfo = mainnet_weights::snowbridge_pallet_system::WeightInfo<Runtime>;
    #[cfg(feature = "runtime-benchmarks")]
    type Helper = ();
}

// Implement the Snowbridge System v2 config trait
impl snowbridge_pallet_system_v2::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type OutboundQueue = EthereumOutboundQueueV2;
    type FrontendOrigin = EnsureRootWithSuccess<AccountId, RootLocation>;
    type GovernanceOrigin = EnsureRootWithSuccess<AccountId, RootLocation>;
    type WeightInfo = mainnet_weights::snowbridge_pallet_system_v2::WeightInfo<Runtime>;
    #[cfg(feature = "runtime-benchmarks")]
    type Helper = ();
}

// For tests, benchmarks and fast-runtime configurations we use the mocked fork versions
#[cfg(any(
    feature = "std",
    feature = "fast-runtime",
    feature = "runtime-benchmarks",
    test
))]
parameter_types! {
    pub const ChainForkVersions: ForkVersions = ForkVersions {
        genesis: Fork {
            version: hex_literal::hex!("10000038"),
            epoch: 0,
        },
        altair: Fork {
            version: hex_literal::hex!("20000038"),
            epoch: 0,
        },
        bellatrix: Fork {
            version: hex_literal::hex!("30000038"),
            epoch: 0,
        },
        capella: Fork {
            version: hex_literal::hex!("40000038"),
            epoch: 0,
        },
        deneb: Fork {
            version: hex_literal::hex!("50000038"),
            epoch: 0,
        },
        electra: Fork {
            version: hex_literal::hex!("60000038"),
            epoch: 0,
        },
        fulu: Fork {
            version: hex_literal::hex!("70000038"),
            epoch: 0,
        },
    };
}

// Ethereum mainnet fork versions
// Source: https://github.com/ethereum/consensus-specs/blob/dev/configs/mainnet.yaml
#[cfg(not(any(
    feature = "std",
    feature = "fast-runtime",
    feature = "runtime-benchmarks",
    test
)))]
parameter_types! {
    pub const ChainForkVersions: ForkVersions = ForkVersions {
        genesis: Fork {
            version: hex_literal::hex!("00000000"), // 0x00000000
            epoch: 0,
        },
        altair: Fork {
            version: hex_literal::hex!("01000000"), // 0x01000000
            epoch: 74240,
        },
        bellatrix: Fork {
            version: hex_literal::hex!("02000000"), // 0x02000000
            epoch: 144896,
        },
        capella: Fork {
            version: hex_literal::hex!("03000000"), // 0x03000000
            epoch: 194048,
        },
        deneb: Fork {
            version: hex_literal::hex!("04000000"), // 0x04000000
            epoch: 269568,
        },
        electra: Fork {
            version: hex_literal::hex!("05000000"), // 0x05000000
            epoch: 364032,
        },
        fulu: Fork {
            version: hex_literal::hex!("06000000"), // 0x06000000
            epoch: 411392, // Fusaka upgrade on December 3, 2025
        },
    };
}

parameter_types! {
    pub const FreeHeadersInterval: u32 = 32; // 1 epoch = 6.4 minutes
}

impl snowbridge_pallet_ethereum_client::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type ForkVersions = ChainForkVersions;
    type FreeHeadersInterval = FreeHeadersInterval;
    type WeightInfo = mainnet_weights::snowbridge_pallet_ethereum_client::WeightInfo<Runtime>;
}

// No-op message processor for benchmarks
// TODO: Adding this as fixture from upstream pallet has an incompatible
// payload type. See if EigenLayerMessageProcessor has non trivial
// compute or has storage read/writes that we may want to compute
// as part of the weight
#[cfg(feature = "runtime-benchmarks")]
pub struct NoOpMessageProcessor;

#[cfg(feature = "runtime-benchmarks")]
impl snowbridge_inbound_queue_primitives::v2::MessageProcessor<AccountId> for NoOpMessageProcessor {
    fn can_process_message(
        _who: &AccountId,
        _message: &snowbridge_inbound_queue_primitives::v2::Message,
    ) -> bool {
        true
    }

    fn process_message(
        _who: AccountId,
        _message: snowbridge_inbound_queue_primitives::v2::Message,
    ) -> Result<[u8; 32], sp_runtime::DispatchError> {
        Ok([0u8; 32])
    }
}

parameter_types! {
    pub DefaultRewardKind: () = ();
}

// Dummy RewardPayment implementation
pub struct DummyRewardPayment;
impl RewardLedger<AccountId, (), u128> for DummyRewardPayment {
    fn register_reward(_who: &AccountId, _reward: (), _amount: u128) {
        // Empty implementation for dummy struct
    }
}

impl snowbridge_pallet_inbound_queue_v2::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Verifier = EthereumBeaconClient;
    type GatewayAddress = runtime_params::dynamic_params::runtime_config::EthereumGatewayAddress;
    #[cfg(not(feature = "runtime-benchmarks"))]
    type MessageProcessor = (
        EigenLayerMessageProcessor<Runtime>,
        NativeTokenTransferMessageProcessor<Runtime>,
    );
    #[cfg(feature = "runtime-benchmarks")]
    type MessageProcessor = NoOpMessageProcessor;
    type RewardKind = ();
    type DefaultRewardKind = DefaultRewardKind;
    type RewardPayment = DummyRewardPayment;
    type WeightInfo = mainnet_weights::snowbridge_pallet_inbound_queue_v2::WeightInfo<Runtime>;
    #[cfg(feature = "runtime-benchmarks")]
    type Helper = Runtime;
}

parameter_types! {
    /// Network and location for the Ethereum chain.
    /// Using the Ethereum mainnet, with chain ID 1.
    /// <https://chainlist.org/chain/1>
    /// <https://ethereum.org/en/developers/docs/apis/json-rpc/#net_version>
    pub EthereumNetwork: NetworkId = NetworkId::Ethereum { chain_id: 1 };
}

pub struct CommitmentHandler;
impl OnNewCommitment for CommitmentHandler {
    fn on_new_commitment(commitment: H256) {
        OutboundCommitmentStore::store_commitment(commitment);
    }
}

impl snowbridge_pallet_outbound_queue_v2::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Hashing = Keccak256;
    type MessageQueue = MessageQueue;
    type GasMeter = ConstantGasMeter;
    type Balance = Balance;
    type MaxMessagePayloadSize = ConstU32<2048>;
    type MaxMessagesPerBlock = ConstU32<32>;
    type OnNewCommitment = CommitmentHandler;
    type WeightToFee = IdentityFee<Balance>;
    type Verifier = EthereumBeaconClient;
    type GatewayAddress = runtime_params::dynamic_params::runtime_config::EthereumGatewayAddress;
    type RewardKind = ();
    type DefaultRewardKind = DefaultRewardKind;
    type RewardPayment = DummyRewardPayment;
    type EthereumNetwork = EthereumNetwork;
    type ConvertAssetId = ();
    type WeightInfo = mainnet_weights::snowbridge_pallet_outbound_queue_v2::WeightInfo<Runtime>;
    #[cfg(feature = "runtime-benchmarks")]
    type Helper = Runtime;
}

//╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
//║                                        STORAGEHUB PALLETS                                                     ║
//╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

//╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
//║                                    DATAHAVEN-SPECIFIC PALLETS                                                 ║
//╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

#[cfg(feature = "runtime-benchmarks")]
pub mod benchmark_helpers {
    use crate::RuntimeOrigin;
    use crate::{Balance, EthereumBeaconClient, Runtime};
    use frame_support::weights::{Weight, WeightToFee};
    use snowbridge_beacon_primitives::BeaconHeader;
    use snowbridge_pallet_inbound_queue_v2::BenchmarkHelper as InboundQueueBenchmarkHelperV2;
    use snowbridge_pallet_outbound_queue_v2::BenchmarkHelper as OutboundQueueBenchmarkHelperV2;
    use sp_core::{H160, H256};

    impl<T: snowbridge_pallet_inbound_queue_v2::Config> InboundQueueBenchmarkHelperV2<T> for Runtime {
        fn initialize_storage(beacon_header: BeaconHeader, block_roots_root: H256) {
            // Set the gateway address to match the one used in the fixture
            use super::runtime_params::dynamic_params;
            use super::RuntimeParameters;
            use frame_support::assert_ok;
            use hex_literal::hex;

            // Gateway address from the fixture: 0xb1185ede04202fe62d38f5db72f71e38ff3e8305
            let gateway_address = H160::from(hex!("b1185ede04202fe62d38f5db72f71e38ff3e8305"));

            // Set the parameter using the pallet_parameters extrinsic
            assert_ok!(pallet_parameters::Pallet::<Runtime>::set_parameter(
                RuntimeOrigin::root(),
                RuntimeParameters::RuntimeConfig(
                    dynamic_params::runtime_config::Parameters::EthereumGatewayAddress(
                        dynamic_params::runtime_config::EthereumGatewayAddress,
                        Some(gateway_address),
                    )
                )
            ));

            EthereumBeaconClient::store_finalized_header(beacon_header, block_roots_root).unwrap();
        }
    }

    impl<T: snowbridge_pallet_outbound_queue_v2::Config> OutboundQueueBenchmarkHelperV2<T> for Runtime {
        fn initialize_storage(beacon_header: BeaconHeader, block_roots_root: H256) {
            // Set the gateway address to match the one used in the fixture
            use super::runtime_params::dynamic_params;
            use super::RuntimeParameters;
            use frame_support::assert_ok;
            use hex_literal::hex;

            // Gateway address from the fixture: 0xb1185ede04202fe62d38f5db72f71e38ff3e8305
            let gateway_address = H160::from(hex!("b1185ede04202fe62d38f5db72f71e38ff3e8305"));

            // Set the parameter using the pallet_parameters extrinsic
            assert_ok!(pallet_parameters::Pallet::<Runtime>::set_parameter(
                RuntimeOrigin::root(),
                RuntimeParameters::RuntimeConfig(
                    dynamic_params::runtime_config::Parameters::EthereumGatewayAddress(
                        dynamic_params::runtime_config::EthereumGatewayAddress,
                        Some(gateway_address),
                    )
                )
            ));
            EthereumBeaconClient::store_finalized_header(beacon_header, block_roots_root).unwrap();
        }
    }

    /// Benchmark helper for transaction payment that provides minimal fees
    pub struct BenchmarkWeightToFee;

    impl WeightToFee for BenchmarkWeightToFee {
        type Balance = Balance;

        fn weight_to_fee(weight: &Weight) -> Self::Balance {
            // Divide weight by 10,000,000 to get minimal fees
            // This ensures fees are small enough to work with minimal funding
            weight.ref_time().saturating_div(10_000_000).max(1).into()
        }
    }
}

// BenchmarkHelper implementations for Snowbridge pallets
// These need to be outside the benchmark_helpers module so they can be found by the compiler
#[cfg(feature = "runtime-benchmarks")]
impl snowbridge_pallet_system::BenchmarkHelper<RuntimeOrigin> for () {
    fn make_xcm_origin(_location: xcm::opaque::latest::Location) -> RuntimeOrigin {
        RuntimeOrigin::root()
    }
}

#[cfg(feature = "runtime-benchmarks")]
impl snowbridge_pallet_system_v2::BenchmarkHelper<RuntimeOrigin> for () {
    fn make_xcm_origin(_location: xcm::opaque::latest::Location) -> RuntimeOrigin {
        RuntimeOrigin::root()
    }
}

impl pallet_outbound_commitment_store::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
}

parameter_types! {
    pub const MaxWhitelistedValidators: u32 = 100;
    pub const MaxExternalValidators: u32 = 100;
}

impl pallet_external_validators::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type UpdateOrigin = EnsureRoot<AccountId>;
    type HistoryDepth = ConstU32<84>;
    type MaxWhitelistedValidators = MaxWhitelistedValidators;
    type MaxExternalValidators = MaxExternalValidators;
    type ValidatorId = AccountId;
    type ValidatorIdOf = ConvertInto;
    type ValidatorRegistration = Session;
    type UnixTime = Timestamp;
    type SessionsPerEra = SessionsPerEra;
    type OnEraStart = (ExternalValidatorsSlashes, ExternalValidatorsRewards);
    type OnEraEnd = ExternalValidatorsRewards;
    type AuthorizedOrigin =
        runtime_params::dynamic_params::runtime_config::DatahavenServiceManagerAddress;
    type WeightInfo = mainnet_weights::pallet_external_validators::WeightInfo<Runtime>;
    #[cfg(feature = "runtime-benchmarks")]
    type Currency = Balances;
}

pub struct GetWhitelistedValidators;
impl Get<Vec<AccountId>> for GetWhitelistedValidators {
    fn get() -> Vec<AccountId> {
        pallet_external_validators::WhitelistedValidatorsActiveEra::<Runtime>::get().into()
    }
}

/// Type alias for the era inflation provider using common runtime implementation.
///
/// Calculates per-era inflation based on:
/// - Total token issuance (from Balances pallet)
/// - Annual inflation rate (from InflationTargetedAnnualRate dynamic parameter)
/// - Era duration calculated from SessionsPerEra, EpochDurationInBlocks, and MILLISECS_PER_BLOCK
pub type ExternalRewardsEraInflationProvider =
    datahaven_runtime_common::inflation::ExternalRewardsEraInflationProvider<
        Balances,
        runtime_params::dynamic_params::runtime_config::InflationTargetedAnnualRate,
        SessionsPerEra,
        EpochDurationInBlocks,
        ConstU64<MILLISECS_PER_BLOCK>,
    >;

/// Wrapper struct for the inflation handler using common runtime implementation.
///
/// Handles minting of inflation tokens by:
/// 1. Splitting total inflation between rewards and treasury based on InflationTreasuryProportion
/// 2. Minting rewards portion to the rewards account
/// 3. Minting treasury portion to the treasury account
pub struct ExternalRewardsInflationHandler;

impl pallet_external_validators_rewards::types::HandleInflation<AccountId>
    for ExternalRewardsInflationHandler
{
    fn mint_inflation(who: &AccountId, amount: u128) -> sp_runtime::DispatchResult {
        datahaven_runtime_common::inflation::ExternalRewardsInflationHandler::<
            Balances,
            runtime_params::dynamic_params::runtime_config::InflationTreasuryProportion,
            TreasuryAccount,
        >::mint_inflation(who, amount)
    }
}

// Stub SendMessage implementation for rewards pallet
pub struct RewardsSendAdapter;
impl pallet_external_validators_rewards::types::SendMessage for RewardsSendAdapter {
    type Message = OutboundMessage;
    type Ticket = OutboundMessage;
    fn build(
        rewards_utils: &pallet_external_validators_rewards::types::EraRewardsUtils,
    ) -> Option<Self::Message> {
        let rewards_registry_address =
            runtime_params::dynamic_params::runtime_config::RewardsRegistryAddress::get();

        // Skip sending message if RewardsRegistryAddress is zero (invalid)
        if rewards_registry_address == H160::zero() {
            log::warn!(
                target: "rewards_send_adapter",
                "Skipping rewards message: RewardsRegistryAddress is zero"
            );
            return None;
        }

        let selector = runtime_params::dynamic_params::runtime_config::RewardsUpdateSelector::get();

        let mut calldata = Vec::new();
        calldata.extend_from_slice(&selector);
        calldata.extend_from_slice(rewards_utils.rewards_merkle_root.as_bytes());

        let command = Command::CallContract {
            target: rewards_registry_address,
            calldata,
            gas: 1_000_000, // TODO: Determine appropriate gas value after testing
            value: 0,
        };
        let message = OutboundMessage {
            origin: runtime_params::dynamic_params::runtime_config::RewardsAgentOrigin::get(),
            // TODO: Determine appropriate id value
            id: unique(rewards_utils.rewards_merkle_root).into(),
            fee: 0,
            commands: match vec![command].try_into() {
                Ok(cmds) => cmds,
                Err(_) => {
                    log::error!(
                        target: "rewards_send_adapter",
                        "Failed to convert commands: too many commands"
                    );
                    return None;
                }
            },
        };
        Some(message)
    }

    fn validate(message: Self::Message) -> Result<Self::Ticket, SendError> {
        EthereumOutboundQueueV2::validate(&message)
    }
    fn deliver(message: Self::Ticket) -> Result<H256, SendError> {
        EthereumOutboundQueueV2::deliver(message)
    }
}

impl pallet_external_validators_rewards::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type EraIndexProvider = ExternalValidators;
    type HistoryDepth = ConstU32<64>;

    // NOT USED: DataHaven is a solochain with BABE+GRANDPA consensus, not a parachain.
    // Backing and dispute points are only relevant for parachain validation.
    // These are set to 0 to make it explicit they're unused.
    type BackingPoints = ConstU32<0>;
    type DisputeStatementPoints = ConstU32<0>;

    type EraInflationProvider = ExternalRewardsEraInflationProvider;
    type ExternalIndexProvider = ExternalValidators;
    type GetWhitelistedValidators = GetWhitelistedValidators;
    type Hashing = Keccak256;
    type Currency = Balances;
    type RewardsEthereumSovereignAccount = ExternalValidatorRewardsAccount;
    type SendMessage = RewardsSendAdapter;
    type HandleInflation = ExternalRewardsInflationHandler;
    type WeightInfo = mainnet_weights::pallet_external_validators_rewards::WeightInfo<Runtime>;
    #[cfg(feature = "runtime-benchmarks")]
    type BenchmarkHelper = ();
}

parameter_types! {
    /// The Ethereum sovereign account derived from its XCM location
    /// This is a hardcoded value for performance, computed from:
    /// Location::new(1, [GlobalConsensus(NetworkId::Ethereum { chain_id: 1 })])
    /// using GlobalConsensusConvertsFor<UniversalLocation, AccountId>
    pub EthereumSovereignAccount: AccountId = AccountId::from(
        hex_literal::hex!("96b408b1afc686e3dd90cbe39725d2ce9ef4edd3")
    );
}

/// Implementation of Get<Option<TokenId>> for DataHaven native transfer pallet
pub struct DataHavenTokenId;
impl Get<Option<TokenId>> for DataHavenTokenId {
    fn get() -> Option<TokenId> {
        let native_location = Location::here();

        let reanchored = crate::SnowbridgeSystemV2::reanchor(native_location).ok()?;
        <crate::SnowbridgeSystemV2 as sp_runtime::traits::MaybeEquivalence<TokenId, Location>>::convert_back(&reanchored)
    }
}

/// Mock implementation for benchmarks
#[cfg(feature = "runtime-benchmarks")]
pub struct MockNativeTokenId;
#[cfg(feature = "runtime-benchmarks")]
impl Get<Option<TokenId>> for MockNativeTokenId {
    fn get() -> Option<TokenId> {
        // For benchmarks, always return a valid token ID
        // This represents a pre-registered native token
        Some(TokenId::from([1u8; 32]))
    }
}

impl pallet_datahaven_native_transfer::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type EthereumSovereignAccount = EthereumSovereignAccount;
    type OutboundQueue = EthereumOutboundQueueV2;
    #[cfg(feature = "runtime-benchmarks")]
    type NativeTokenId = MockNativeTokenId;
    #[cfg(not(feature = "runtime-benchmarks"))]
    type NativeTokenId = DataHavenTokenId;
    type FeeRecipient = TreasuryAccount;
    type PauseOrigin = EnsureRoot<AccountId>;
    type WeightInfo = mainnet_weights::pallet_datahaven_native_transfer::WeightInfo<Runtime>;
}

//╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
//║                                          SAFE MODE & TX PAUSE PALLETS                                           ║
//╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

impl pallet_safe_mode::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type RuntimeHoldReason = RuntimeHoldReason;
    type WhitelistedCalls = SafeModeWhitelistedCalls;
    type EnterDuration = SafeModeDuration;
    type ExtendDuration = SafeModeDuration;
    type EnterDepositAmount = SafeModeEnterDeposit;
    type ExtendDepositAmount = SafeModeExtendDeposit;
    type ForceEnterOrigin = EnsureRootWithSuccess<AccountId, SafeModeDuration>;
    type ForceExtendOrigin = EnsureRootWithSuccess<AccountId, SafeModeDuration>;
    type ForceExitOrigin = EnsureRoot<AccountId>;
    type ForceDepositOrigin = EnsureRoot<AccountId>;
    type ReleaseDelay = ReleaseDelayNone;
    type Notify = ();
    type WeightInfo = mainnet_weights::pallet_safe_mode::WeightInfo<Runtime>;
}

impl pallet_tx_pause::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type PauseOrigin = EnsureRoot<AccountId>;
    type UnpauseOrigin = EnsureRoot<AccountId>;
    type WhitelistedCalls = TxPauseWhitelistedCalls<Runtime>;
    type MaxNameLen = ConstU32<256>;
    type WeightInfo = mainnet_weights::pallet_tx_pause::WeightInfo<Runtime>;
}

// Stub SendMessage implementation for slash pallet
pub struct SlashesSendAdapter;
impl pallet_external_validator_slashes::SendMessage<AccountId> for SlashesSendAdapter {
    type Message = OutboundMessage;
    type Ticket = OutboundMessage;
    fn build(
        _slashes_utils: &pallet_external_validator_slashes::SlashDataUtils<AccountId>,
    ) -> Option<Self::Message> {
        let calldata = Vec::new();

        let command = Command::CallContract {
            target:
                runtime_params::dynamic_params::runtime_config::DatahavenServiceManagerAddress::get(
                ),
            calldata,
            gas: 1_000_000, // TODO: Determine appropriate gas value after testing
            value: 0,
        };
        let message = OutboundMessage {
            origin: runtime_params::dynamic_params::runtime_config::RewardsAgentOrigin::get(), // TODO: get the slash agent address
            // TODO: Determine appropriate id value
            id: unique(1).into(),
            fee: 0,
            commands: match vec![command].try_into() {
                Ok(cmds) => cmds,
                Err(_) => {
                    log::error!(
                        target: "slashes_send_adapter",
                        "Failed to convert commands: too many commands"
                    );
                    return None;
                }
            },
        };
        Some(message)
    }

    fn validate(message: Self::Message) -> Result<Self::Ticket, SendError> {
        EthereumOutboundQueueV2::validate(&message)
    }
    fn deliver(message: Self::Ticket) -> Result<H256, SendError> {
        EthereumOutboundQueueV2::deliver(message)
    }
}

impl pallet_external_validator_slashes::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type ValidatorId = AccountId;
    type ValidatorIdOf = ConvertInto;
    type SlashDeferDuration = SlashDeferDuration;
    type BondingDuration = BondingDuration;
    type SlashId = u32;
    type EraIndexProvider = ExternalValidators;
    type InvulnerablesProvider = ExternalValidators;
    type ExternalIndexProvider = ExternalValidators;
    type QueuedSlashesProcessedPerBlock = ConstU32<10>;
    type WeightInfo = mainnet_weights::pallet_external_validator_slashes::WeightInfo<Runtime>;
    type SendMessage = SlashesSendAdapter;
}

parameter_types! {
    pub const SlashDeferDuration: EraIndex = polkadot_runtime_common::prod_or_fast!(0, 0);
}

#[cfg(test)]
mod tests {
    use super::*;
    use dhp_bridge::{
        InboundCommand, Message as BridgeMessage, Payload as BridgePayload, EL_MESSAGE_ID,
    };
    use frame_support::assert_ok;
    use snowbridge_inbound_queue_primitives::v2::{
        EthereumAsset, Message as SnowbridgeMessage, MessageProcessor, Payload as SnowPayload,
    };
    use sp_core::H160;
    use sp_io::TestExternalities;
    use xcm_builder::GlobalConsensusConvertsFor;
    use xcm_executor::traits::ConvertLocation;

    #[test]
    fn test_ethereum_sovereign_account_computation() {
        // Verify that the hardcoded Ethereum sovereign account matches the computed value
        let computed_account =
            GlobalConsensusConvertsFor::<UniversalLocation, AccountId>::convert_location(
                &EthereumLocation::get(),
            )
            .expect("Ethereum location conversion should succeed");

        assert_eq!(
            computed_account,
            EthereumSovereignAccount::get(),
            "Computed account must match hardcoded value"
        );
    }

    #[test]
    fn test_rewards_send_adapter_with_zero_address() {
        use pallet_external_validators_rewards::types::{EraRewardsUtils, SendMessage};

        TestExternalities::default().execute_with(|| {
            // Create test rewards utils
            let rewards_utils = EraRewardsUtils {
                rewards_merkle_root: H256::random(),
                leaves: vec![H256::random()],
                leaf_index: Some(1),
                total_points: 1000,
            };

            // By default, RewardsRegistryAddress is zero (H160::repeat_byte(0x0))
            // So the adapter should return None
            let message = RewardsSendAdapter::build(&rewards_utils);
            assert!(
                message.is_none(),
                "Should return None when RewardsRegistryAddress is zero"
            );
        });
    }

    #[test]
    fn test_rewards_send_adapter_with_valid_address() {
        use pallet_external_validators_rewards::types::{EraRewardsUtils, SendMessage};

        TestExternalities::default().execute_with(|| {
            // Set a valid (non-zero) rewards registry address
            let valid_address = H160::from_low_u64_be(0x1234567890abcdef);
            assert_ok!(pallet_parameters::Pallet::<Runtime>::set_parameter(
                RuntimeOrigin::root(),
                RuntimeParameters::RuntimeConfig(
                    runtime_params::dynamic_params::runtime_config::Parameters::RewardsRegistryAddress(
                        runtime_params::dynamic_params::runtime_config::RewardsRegistryAddress,
                        Some(valid_address),
                    ),
                ),
            ));

            // Create test rewards utils
            let rewards_utils = EraRewardsUtils {
                rewards_merkle_root: H256::random(),
                leaves: vec![H256::random()],
                leaf_index: Some(1),
                total_points: 1000,
            };

            // Now the adapter should return a valid message
            let message = RewardsSendAdapter::build(&rewards_utils);
            assert!(
                message.is_some(),
                "Should return Some(message) when RewardsRegistryAddress is non-zero"
            );

            // Verify the message contains the correct target address
            if let Some(msg) = message {
                // Check that the first command has the correct target
                let command = &msg.commands[0];
                match command {
                    Command::CallContract { target, .. } => {
                        assert_eq!(
                            *target, valid_address,
                            "Message should target the configured address"
                        );
                    }
                    _ => panic!("Expected CallContract command"),
                }
            }
        });
    }

    fn build_snowbridge_message(origin: H160) -> SnowbridgeMessage {
        // Minimal valid EigenLayer payload carrying an empty validator set
        let bridge_payload = BridgePayload::<Runtime> {
            message_id: EL_MESSAGE_ID,
            message: BridgeMessage::V1(InboundCommand::ReceiveValidators {
                validators: Vec::new(),
                external_index: 0,
            }),
        };

        let payload_bytes = bridge_payload.encode();

        SnowbridgeMessage {
            gateway: H160::zero(),
            nonce: 0,
            origin,
            assets: Vec::<EthereumAsset>::new(),
            xcm: SnowPayload::Raw(payload_bytes),
            claimer: None,
            value: 0,
            execution_fee: 0,
            relayer_fee: 0,
        }
    }

    #[test]
    fn test_eigenlayer_message_processor_rejects_wrong_origin() {
        use sp_runtime::DispatchError;

        TestExternalities::default().execute_with(|| {
            // Configure an authorized origin address in runtime parameters
            let authorized_origin = H160::from_low_u64_be(0x1234);
            assert_ok!(pallet_parameters::Pallet::<Runtime>::set_parameter(
                RuntimeOrigin::root(),
                RuntimeParameters::RuntimeConfig(
                    runtime_params::dynamic_params::runtime_config::Parameters::DatahavenServiceManagerAddress(
                        runtime_params::dynamic_params::runtime_config::DatahavenServiceManagerAddress,
                        Some(authorized_origin),
                    ),
                ),
            ));

            // Build a message with a different (unauthorized) origin
            let wrong_origin = H160::from_low_u64_be(0x9999);
            let snow_msg = build_snowbridge_message(wrong_origin);

            let relayer: AccountId = Default::default();
            let result =
                dhp_bridge::EigenLayerMessageProcessor::<Runtime>::process_message(relayer, snow_msg);

            assert!(matches!(
                result,
                Err(DispatchError::Other("unauthorized validator-set origin"))
            ));
        });
    }

    #[test]
    fn test_eigenlayer_message_processor_accepts_authorized_origin() {
        TestExternalities::default().execute_with(|| {
            // Configure the authorized origin to match the ServiceManager address
            let authorized_origin = H160::from_low_u64_be(0x1234);
            assert_ok!(pallet_parameters::Pallet::<Runtime>::set_parameter(
                RuntimeOrigin::root(),
                RuntimeParameters::RuntimeConfig(
                    runtime_params::dynamic_params::runtime_config::Parameters::DatahavenServiceManagerAddress(
                        runtime_params::dynamic_params::runtime_config::DatahavenServiceManagerAddress,
                        Some(authorized_origin),
                    ),
                ),
            ));

            let snow_msg = build_snowbridge_message(authorized_origin);
            let relayer: AccountId = Default::default();

            let result =
                dhp_bridge::EigenLayerMessageProcessor::<Runtime>::process_message(relayer, snow_msg);

            assert!(result.is_ok(), "Message from authorized origin should be accepted");
        });
    }
}
