// This is free and unencumbered software released into the public domain.
//
// Anyone is free to copy, modify, publish, use, compile, sell, or
// distribute this software, either in source code form or as a compiled
// binary, for any purpose, commercial or non-commercial, and by any
// means.
//
// In jurisdictions that recognize copyright laws, the author or authors
// of this software dedicate any and all copyright interest in the
// software to the public domain. We make this dedication for the benefit
// of the public at large and to the detriment of our heirs and
// successors. We intend this dedication to be an overt act of
// relinquishment in perpetuity of all present and future rights to this
// software under copyright law.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
// IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
// OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
// ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.
//
// For more information, please refer to <http://unlicense.org>

mod runtime_params;

use super::{
    deposit, AccountId, Babe, Balance, Balances, BeefyMmrLeaf, Block, BlockNumber,
    EthereumBeaconClient, EvmChainId, ExternalValidators, ExternalValidatorsRewards, Hash,
    Historical, ImOnline, MessageQueue, Nonce, Offences, OriginCaller, OutboundCommitmentStore,
    OutboundQueueV2, PalletInfo, Preimage, Runtime, RuntimeCall, RuntimeEvent, RuntimeFreezeReason,
    RuntimeHoldReason, RuntimeOrigin, RuntimeTask, Session, SessionKeys, Signature, System,
    Timestamp, EXISTENTIAL_DEPOSIT, SLOT_DURATION, STORAGE_BYTE_FEE, SUPPLY_FACTOR, UNIT, VERSION,
};
use codec::{Decode, Encode};
use datahaven_runtime_common::{
    gas::WEIGHT_PER_GAS,
    time::{EpochDurationInBlocks, DAYS, MILLISECS_PER_BLOCK},
};
use dhp_bridge::EigenLayerMessageProcessor;
use frame_support::{
    derive_impl,
    pallet_prelude::TransactionPriority,
    parameter_types,
    traits::{
        fungible::{Balanced, Credit, HoldConsideration, Inspect},
        ConstU128, ConstU32, ConstU64, ConstU8, EqualPrivilegeOnly, FindAuthor,
        KeyOwnerProofSystem, LinearStoragePrice, OnUnbalanced, VariantCountOf,
    },
    weights::{
        constants::{RocksDbWeight, WEIGHT_REF_TIME_PER_SECOND},
        IdentityFee, RuntimeDbWeight, Weight,
    },
};
use frame_system::{
    limits::{BlockLength, BlockWeights},
    unique, EnsureRoot, EnsureRootWithSuccess,
};
use pallet_ethereum::PostLogContent;
use pallet_evm::{
    EVMFungibleAdapter, EnsureAddressNever, EnsureAddressRoot, FeeCalculator,
    FrameSystemAccountProvider, IdentityAddressMapping,
    OnChargeEVMTransaction as OnChargeEVMTransactionT,
};
use pallet_grandpa::AuthorityId as GrandpaId;
use pallet_im_online::sr25519::AuthorityId as ImOnlineId;
use pallet_transaction_payment::{
    ConstFeeMultiplier, FungibleAdapter, Multiplier, Pallet as TransactionPayment,
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
    traits::{
        Convert, ConvertInto, IdentityLookup, Keccak256, One, OpaqueKeys, UniqueSaturatedInto,
    },
    FixedPointNumber, Perbill,
};
use sp_staking::{EraIndex, SessionIndex};
use sp_std::{
    convert::{From, Into},
    prelude::*,
};
use sp_version::RuntimeVersion;
use xcm::latest::NetworkId;
use xcm::prelude::*;

#[cfg(feature = "runtime-benchmarks")]
use bridge_hub_common::AggregateMessageOrigin;

const EVM_CHAIN_ID: u64 = 1288;
const SS58_FORMAT: u16 = EVM_CHAIN_ID as u16;

// TODO: We need to define what do we want here as max PoV size
pub const MAX_POV_SIZE: u64 = 5 * 1024 * 1024;

// Todo: import all currency constants from moonbeam
pub const WEIGHT_FEE: Balance = 50_000 / 4;

pub const MAXIMUM_BLOCK_WEIGHT: Weight = Weight::from_parts(WEIGHT_REF_TIME_PER_SECOND, u64::MAX)
    .saturating_mul(2)
    .set_proof_size(MAX_POV_SIZE);

const NORMAL_DISPATCH_RATIO: Perbill = Perbill::from_percent(75);

//╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
//║                                             COMMON PARAMETERS                                                 ║
//╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

parameter_types! {
    pub const MaxAuthorities: u32 = 32;
    pub const BondingDuration: EraIndex = polkadot_runtime_common::prod_or_fast!(28, 3);
    pub const SessionsPerEra: SessionIndex = polkadot_runtime_common::prod_or_fast!(6, 1);
    pub const AuthorRewardPoints: u32 = 20;
}

//╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
//║                                      SYSTEM AND CONSENSUS PALLETS                                             ║
//╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

parameter_types! {
    pub const BlockHashCount: BlockNumber = 2400;
    pub const Version: RuntimeVersion = VERSION;

    /// We allow for 2 seconds of compute with a 6 second average block time.
    pub RuntimeBlockWeights: BlockWeights = BlockWeights::with_sensible_defaults(
        Weight::from_parts(2u64 * WEIGHT_REF_TIME_PER_SECOND, u64::MAX),
        NORMAL_DISPATCH_RATIO,
    );
    pub RuntimeBlockLength: BlockLength = BlockLength::max_with_normal_ratio(5 * 1024 * 1024, NORMAL_DISPATCH_RATIO);
    pub const SS58Prefix: u16 = SS58_FORMAT;
}

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
    type WeightInfo = ();
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
    type WeightInfo = ();
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
    type ExistentialDeposit = ConstU128<EXISTENTIAL_DEPOSIT>;
    type AccountStore = System;
    type WeightInfo = pallet_balances::weights::SubstrateWeight<Runtime>;
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
    // TODO set to External Validators Slashs Pallet once it's added to the runtime
    type OnOffenceHandler = ();
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
    type WeightInfo = ();
}

parameter_types! {
    pub const EquivocationReportPeriodInEpochs: u64 = 168;
    pub const EquivocationReportPeriodInBlocks: u64 =
        EquivocationReportPeriodInEpochs::get() * (EpochDurationInBlocks::get() as u64);
    pub const MaxSetIdSessionEntries: u32 = BondingDuration::get() * SessionsPerEra::get();
}

impl pallet_grandpa::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;

    type WeightInfo = ();
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
    pub FeeMultiplier: Multiplier = Multiplier::one();
}

impl pallet_transaction_payment::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type OnChargeTransaction = FungibleAdapter<Balances, ()>;
    type OperationalFeeMultiplier = ConstU8<5>;
    type WeightToFee = IdentityFee<Balance>;
    type LengthToFee = IdentityFee<Balance>;
    type FeeMultiplierUpdate = ConstFeeMultiplier<FeeMultiplier>;
    type WeightInfo = ();
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
    type EquivocationReportSystem = ();
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
    type WeightInfo = ();
    type BlockHashProvider = pallet_mmr::DefaultBlockHashProvider<Runtime>;
    #[cfg(feature = "runtime-benchmarks")]
    type BenchmarkHelper = ();
}

impl pallet_beefy_mmr::Config for Runtime {
    type LeafVersion = LeafVersion;
    type BeefyAuthorityToMerkleLeaf = pallet_beefy_mmr::BeefyEcdsaToEthereum;
    type LeafExtra = LeafExtraData;
    type BeefyDataProvider = LeafExtraDataProvider;
    type WeightInfo = ();
}

//╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
//║                                    POLKADOT SDK UTILITY PALLETS                                               ║
//╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

impl pallet_utility::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type PalletsOrigin = OriginCaller;
    type WeightInfo = ();
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
    type WeightInfo = ();
}

parameter_types! {
    pub const PreimageBaseDeposit: Balance = 5 * UNIT * SUPPLY_FACTOR ;
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
    type WeightInfo = ();
}

parameter_types! {
    pub const MaxSubAccounts: u32 = 100;
    pub const MaxAdditionalFields: u32 = 100;
    pub const MaxRegistrars: u32 = 20;
    pub const PendingUsernameExpiration: u32 = 7 * DAYS;
    pub const MaxSuffixLength: u32 = 7;
    pub const MaxUsernameLength: u32 = 32;
}

type IdentityForceOrigin = EnsureRoot<AccountId>;
type IdentityRegistrarOrigin = EnsureRoot<AccountId>;
// TODO: Add governance origin when available
// type IdentityForceOrigin =
// 	EitherOfDiverse<EnsureRoot<AccountId>, governance::custom_origins::GeneralAdmin>;
// type IdentityRegistrarOrigin =
// 	EitherOfDiverse<EnsureRoot<AccountId>, governance::custom_origins::GeneralAdmin>;

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
    type Slashed = ();
    // TODO: Slashed funds should be sent to the treasury (when added to the runtime)
    // type Slashed = Treasury;
    type ForceOrigin = IdentityForceOrigin;
    type RegistrarOrigin = IdentityRegistrarOrigin;
    type OffchainSignature = Signature;
    type SigningPublicKey = <Signature as sp_runtime::traits::Verify>::Signer;
    type UsernameAuthorityOrigin = EnsureRoot<AccountId>;
    type PendingUsernameExpiration = PendingUsernameExpiration;
    type MaxSuffixLength = MaxSuffixLength;
    type MaxUsernameLength = MaxUsernameLength;
    type WeightInfo = ();
    type UsernameDeposit = ();
    type UsernameGracePeriod = ();
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
    type WeightInfo = ();
}

impl pallet_parameters::Config for Runtime {
    type AdminOrigin = EnsureRoot<AccountId>;
    type RuntimeEvent = RuntimeEvent;
    type RuntimeParameters = RuntimeParameters;
    type WeightInfo = ();
}

impl pallet_sudo::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type WeightInfo = pallet_sudo::weights::SubstrateWeight<Runtime>;
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
    type MessageProcessor = OutboundQueueV2;
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
    type WeightInfo = ();
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

parameter_types! {
    pub BlockGasLimit: U256
        = U256::from(NORMAL_DISPATCH_RATIO * MAXIMUM_BLOCK_WEIGHT.ref_time() / WEIGHT_PER_GAS);
    // pub PrecompilesValue: TemplatePrecompiles<Runtime> = TemplatePrecompiles::<_>::new();
    pub WeightPerGas: Weight = Weight::from_parts(WEIGHT_PER_GAS, 0);
    pub SuicideQuickClearLimit: u32 = 0;
    pub GasLimitPovSizeRatio: u32 = 16;
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
    type PrecompilesType = ();
    type PrecompilesValue = ();
    type ChainId = EvmChainId;
    type BlockGasLimit = BlockGasLimit;
    type Runner = pallet_evm::runner::stack::Runner<Self>;
    type OnChargeTransaction = OnChargeEVMTransaction<()>;
    type OnCreate = ();
    type FindAuthor = FindAuthorAdapter<Self>;
    type GasLimitPovSizeRatio = GasLimitPovSizeRatio;
    type GasLimitStorageGrowthRatio = ();
    type Timestamp = Timestamp;
    type WeightInfo = ();
}

impl pallet_evm_chain_id::Config for Runtime {}

//╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
//║                                          SNOWBRIDGE PALLETS                                                   ║
//╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

// --- Snowbridge Config Constants & Parameter Types ---
parameter_types! {
    // TODO: Update with real genesis hash once testnet is deployed
    pub const TestnetGenesisHash: [u8; 32] = [2u8; 32];
    pub UniversalLocation: InteriorLocation = [
        GlobalConsensus(ByGenesis(TestnetGenesisHash::get()))
    ].into();
    pub InboundDeliveryCost: BalanceOf<Runtime> = 0;
    pub RootLocation: Location = Location::here();
    pub Parameters: PricingParameters<u128> = PricingParameters {
        exchange_rate: FixedU128::from_rational(1, 400),
        fee_per_gas: gwei(20),
        rewards: Rewards { local: UNIT, remote: meth(1) },
        multiplier: FixedU128::from_rational(1, 1),
    };
    pub EthereumLocation: Location = Location::new(1, EthereumNetwork::get());
    // TODO: Update this account once the treasury pallet is added
    // For now, using a hardcoded account that can properly receive and hold fees
    // This prevents fees from being burned and allows for proper accounting
    pub TreasuryAccountId: AccountId = AccountId::from(
        hex_literal::hex!("1234567890123456789012345678901234567890")
    );
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
    type TreasuryAccount = TreasuryAccountId;
    type DefaultPricingParameters = Parameters;
    type InboundDeliveryCost = InboundDeliveryCost;
    type WeightInfo = ();
    type UniversalLocation = UniversalLocation;
    type EthereumLocation = EthereumLocation;
    #[cfg(feature = "runtime-benchmarks")]
    type Helper = ();
}

// Implement the Snowbridge System v2 config trait
impl snowbridge_pallet_system_v2::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type OutboundQueue = OutboundQueueV2;
    type FrontendOrigin = EnsureRootWithSuccess<AccountId, RootLocation>;
    type GovernanceOrigin = EnsureRootWithSuccess<AccountId, RootLocation>;
    type WeightInfo = ();
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
            version: [0, 0, 0, 0], // 0x00000000
            epoch: 0,
        },
        altair: Fork {
            version: [1, 0, 0, 0], // 0x01000000
            epoch: 0,
        },
        bellatrix: Fork {
            version: [2, 0, 0, 0], // 0x02000000
            epoch: 0,
        },
        capella: Fork {
            version: [3, 0, 0, 0], // 0x03000000
            epoch: 0,
        },
        deneb: Fork {
            version: [4, 0, 0, 0], // 0x04000000
            epoch: 0,
        },
        electra: Fork {
            version: [5, 0, 0, 0], // 0x05000000
            epoch: 0,
        },
    };
}

// Holesky: https://github.com/eth-clients/holesky
// Fork versions: https://github.com/eth-clients/holesky/blob/main/metadata/config.yaml
#[cfg(not(any(
    feature = "std",
    feature = "fast-runtime",
    feature = "runtime-benchmarks",
    test
)))]
parameter_types! {
    pub const ChainForkVersions: ForkVersions = ForkVersions {
        genesis: Fork {
            version: hex_literal::hex!("01017000"), // 0x01017000
            epoch: 0,
        },
        altair: Fork {
            version: hex_literal::hex!("02017000"), // 0x02017000
            epoch: 0,
        },
        bellatrix: Fork {
            version: hex_literal::hex!("03017000"), // 0x03017000
            epoch: 0,
        },
        capella: Fork {
            version: hex_literal::hex!("04017000"), // 0x04017000
            epoch: 256,
        },
        deneb: Fork {
            version: hex_literal::hex!("05017000"), // 0x05017000
            epoch: 29696,
        },
        electra: Fork {
            version: hex_literal::hex!("06017000"), // 0x06017000
            epoch: 115968,
        },
    };
}

impl snowbridge_pallet_ethereum_client::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type ForkVersions = ChainForkVersions;
    type FreeHeadersInterval = ();
    type WeightInfo = ();
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
    type MessageProcessor = EigenLayerMessageProcessor<Runtime>;
    type RewardKind = ();
    type DefaultRewardKind = DefaultRewardKind;
    type RewardPayment = DummyRewardPayment;
    type WeightInfo = ();
    #[cfg(feature = "runtime-benchmarks")]
    type Helper = Runtime;
}

parameter_types! {
    /// Network and location for the Ethereum chain.
    /// Using the Sepolia Ethereum testnet, with chain ID 11155111.
    /// <https://chainlist.org/chain/11155111>
    /// <https://ethereum.org/en/developers/docs/apis/json-rpc/#net_version>
    pub EthereumNetwork: NetworkId = NetworkId::Ethereum { chain_id: 11155111 };
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
    type WeightInfo = ();
    type Verifier = EthereumBeaconClient;
    type GatewayAddress = runtime_params::dynamic_params::runtime_config::EthereumGatewayAddress;
    type RewardKind = ();
    type DefaultRewardKind = DefaultRewardKind;
    type RewardPayment = DummyRewardPayment;
    type EthereumNetwork = EthereumNetwork;
    type ConvertAssetId = ();
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
    use crate::{EthereumBeaconClient, Runtime};
    use snowbridge_beacon_primitives::BeaconHeader;
    use snowbridge_pallet_inbound_queue_v2::BenchmarkHelper as InboundQueueBenchmarkHelperV2;
    use sp_core::H256;
    use xcm::opaque::latest::Location;

    impl<T: snowbridge_pallet_inbound_queue_v2::Config> InboundQueueBenchmarkHelperV2<T> for Runtime {
        fn initialize_storage(beacon_header: BeaconHeader, block_roots_root: H256) {
            EthereumBeaconClient::store_finalized_header(beacon_header, block_roots_root).unwrap();
        }
    }

    impl snowbridge_pallet_system::BenchmarkHelper<RuntimeOrigin> for () {
        fn make_xcm_origin(_location: Location) -> RuntimeOrigin {
            RuntimeOrigin::root()
        }
    }

    impl snowbridge_pallet_system_v2::BenchmarkHelper<RuntimeOrigin> for () {
        fn make_xcm_origin(_location: Location) -> RuntimeOrigin {
            RuntimeOrigin::root()
        }
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
    type OnEraStart = ExternalValidatorsRewards;
    type OnEraEnd = ExternalValidatorsRewards;
    type WeightInfo = ();
    #[cfg(feature = "runtime-benchmarks")]
    type Currency = Balances;
}

pub struct GetWhitelistedValidators;
impl Get<Vec<AccountId>> for GetWhitelistedValidators {
    fn get() -> Vec<AccountId> {
        pallet_external_validators::WhitelistedValidatorsActiveEra::<Runtime>::get().into()
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
        let selector = runtime_params::dynamic_params::runtime_config::RewardsUpdateSelector::get();

        let mut calldata = Vec::new();
        calldata.extend_from_slice(&selector);
        calldata.extend_from_slice(rewards_utils.rewards_merkle_root.as_bytes());

        let command = Command::CallContract {
            target: runtime_params::dynamic_params::runtime_config::RewardsRegistryAddress::get(),
            calldata,
            gas: 100_0000, // TODO: Determine appropriate gas value after testing
            value: 0,
        };
        let message = OutboundMessage {
            origin: runtime_params::dynamic_params::runtime_config::RewardsOrigin::get(),
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
        OutboundQueueV2::validate(&message)
    }
    fn deliver(message: Self::Ticket) -> Result<H256, SendError> {
        OutboundQueueV2::deliver(message)
    }
}

impl pallet_external_validators_rewards::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type EraIndexProvider = ExternalValidators;
    type HistoryDepth = ConstU32<64>;
    type BackingPoints = ConstU32<20>;
    type DisputeStatementPoints = ConstU32<20>;
    type EraInflationProvider = ConstU128<0>;
    type ExternalIndexProvider = ExternalValidators;
    type GetWhitelistedValidators = GetWhitelistedValidators;
    type Hashing = Keccak256;
    type Currency = Balances;
    type RewardsEthereumSovereignAccount = TreasuryAccountId;
    type WeightInfo = ();
    type SendMessage = RewardsSendAdapter;
    type HandleInflation = ();
    #[cfg(feature = "runtime-benchmarks")]
    type BenchmarkHelper = ();
}

parameter_types! {
    /// The Ethereum sovereign account derived from its XCM location
    /// This is a hardcoded value for performance, computed from:
    /// Location::new(1, [GlobalConsensus(NetworkId::Ethereum { chain_id: 11155111 })])
    /// using GlobalConsensusConvertsFor<UniversalLocation, AccountId>
    pub EthereumSovereignAccount: AccountId = AccountId::from(
        hex_literal::hex!("23e598fa2f50bba6885988e5077200c6d0c5f5cf")
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

impl pallet_datahaven_native_transfer::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type EthereumSovereignAccount = EthereumSovereignAccount;
    type OutboundQueue = OutboundQueueV2;
    type NativeTokenId = DataHavenTokenId;
    type FeeRecipient = TreasuryAccountId;
    type PauseOrigin = EnsureRoot<AccountId>;
    type WeightInfo = pallet_datahaven_native_transfer::weights::SubstrateWeight<Runtime>;
}

#[cfg(test)]
mod tests {
    use super::*;
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
    fn test_ethereum_sovereign_account_uniqueness() {
        // Verify different chain IDs produce different sovereign accounts
        let mainnet_location =
            Location::new(1, [GlobalConsensus(NetworkId::Ethereum { chain_id: 1 })]);
        let mainnet_account =
            GlobalConsensusConvertsFor::<UniversalLocation, AccountId>::convert_location(
                &mainnet_location,
            )
            .expect("Mainnet location conversion should succeed");

        assert_ne!(
            mainnet_account,
            EthereumSovereignAccount::get(),
            "Different chain IDs must produce different sovereign accounts"
        );
    }
}
