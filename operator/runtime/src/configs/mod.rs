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

use crate::EvmChainId;
use crate::Timestamp;
use crate::{Historical, ValidatorSet};

// Local module imports
use crate::{
    AccountId, Babe, Balance, Balances, BeefyMmrLeaf, Block, BlockNumber, BucketNfts, Hash, Hashing,
    Nfts, Nonce, PalletInfo, PaymentStreams,
    ProofsDealer, Providers, Runtime, RuntimeCall, RuntimeEvent, RuntimeFreezeReason,
    RuntimeHoldReason, RuntimeOrigin, RuntimeTask, Session, SessionKeys, Signature, System, WeightToFee,
    DAYS,
    EXISTENTIAL_DEPOSIT, HOURS, MINUTES, SLOT_DURATION, UNIT, VERSION,
};
// Substrate and Polkadot dependencies
use codec::{Decode, Encode};
use datahaven_runtime_common::gas::WEIGHT_PER_GAS;
use datahaven_runtime_common::time::{EpochDurationInBlocks, MILLISECS_PER_BLOCK};
use frame_support::{
    derive_impl, parameter_types,
    traits::{
        fungible::{Balanced, Credit, Inspect},
        ConstU128, ConstU32, ConstU64, ConstU8, FindAuthor, KeyOwnerProofSystem, OnUnbalanced,
        VariantCountOf,
    },
    weights::{
        constants::{RocksDbWeight, WEIGHT_REF_TIME_PER_SECOND},
        IdentityFee, Weight,
    },
};
use frame_system::limits::{BlockLength, BlockWeights};
use frame_system::EnsureRoot;
use pallet_ethereum::PostLogContent;
use pallet_evm::{
    EVMFungibleAdapter, EnsureAddressNever, EnsureAddressRoot, FeeCalculator,
    FrameSystemAccountProvider, IdentityAddressMapping,
    OnChargeEVMTransaction as OnChargeEVMTransactionT,
};
use pallet_transaction_payment::{
    ConstFeeMultiplier, FungibleAdapter, Multiplier, Pallet as TransactionPayment,
};
use polkadot_primitives::Moment;
use polkadot_runtime_common::prod_or_fast;
use snowbridge_beacon_primitives::{Fork, ForkVersions};
use sp_consensus_beefy::mmr::BeefyDataProvider;
use sp_consensus_beefy::{ecdsa_crypto::AuthorityId as BeefyId, mmr::MmrLeafVersion};
use sp_core::{crypto::KeyTypeId, H160, H256, U256};
use sp_runtime::{
    traits::{AccountIdLookup, BlakeTwo256, ConvertInto, Keccak256, One, OpaqueKeys, UniqueSaturatedInto},
    FixedPointNumber, Perbill,
};
use sp_runtime::traits::Convert;
use num_bigint::BigUint;
use sp_runtime::traits::ConvertBack;
use sp_staking::{EraIndex, SessionIndex};
use sp_std::{
    convert::{From, Into},
    prelude::*,
};
use sp_version::RuntimeVersion;
use frame_system::pallet_prelude::BlockNumberFor;
use pallet_nfts::PalletFeatures;
use frame_support::traits::AsEnsureOriginWithArg;
use frame_system::EnsureSigned;
use sp_runtime::traits::Verify;
use runtime_params::RuntimeParameters;
use sp_core::Get;
use sp_runtime::traits::Zero;
use frame_support::pallet_prelude::DispatchClass;
use core::marker::PhantomData;
use sp_core::Hasher;
use sp_trie::{LayoutV1, TrieConfiguration, TrieLayout};
use shp_file_metadata::{ChunkId, FileMetadata};
use shp_treasury_funding::{
    LinearThenPowerOfTwoTreasuryCutCalculator, LinearThenPowerOfTwoTreasuryCutCalculatorConfig,
};
use shp_forest_verifier::ForestVerifier;
use shp_file_key_verifier::FileKeyVerifier;
use shp_data_price_updater::{MostlyStablePriceIndexUpdater, MostlyStablePriceIndexUpdaterConfig};
use sp_runtime::SaturatedConversion;

pub type StorageProofsMerkleTrieLayout = LayoutV1<BlakeTwo256>;

/// Type representing the storage data units in StorageHub.
pub type StorageDataUnit = u64;

// TODO: remove this and replace with pallet treasury
pub struct TreasuryAccount;
impl Get<AccountId> for TreasuryAccount {
    fn get() -> AccountId {
        AccountId::from([0; 32])
    }
}

// TODO: We need to define what do we want here as max PoV size
pub const MAX_POV_SIZE: u64 = 5 * 1024 * 1024;

// Todo: import all currency constants from moonbeam
pub const WEIGHT_FEE: Balance = 50_000 / 4;

pub const MAXIMUM_BLOCK_WEIGHT: Weight = Weight::from_parts(WEIGHT_REF_TIME_PER_SECOND, u64::MAX)
    .saturating_mul(2)
    .set_proof_size(MAX_POV_SIZE as u64);

const NORMAL_DISPATCH_RATIO: Perbill = Perbill::from_percent(75);

parameter_types! {
    pub const BlockHashCount: BlockNumber = 2400;
    pub const Version: RuntimeVersion = VERSION;

    /// We allow for 2 seconds of compute with a 6 second average block time.
    pub RuntimeBlockWeights: BlockWeights = BlockWeights::with_sensible_defaults(
        Weight::from_parts(2u64 * WEIGHT_REF_TIME_PER_SECOND, u64::MAX),
        NORMAL_DISPATCH_RATIO,
    );
    pub RuntimeBlockLength: BlockLength = BlockLength::max_with_normal_ratio(5 * 1024 * 1024, NORMAL_DISPATCH_RATIO);
    pub const SS58Prefix: u8 = 42;
    pub const MaxAuthorities: u32 = 32;
    pub const SetKeysCooldownBlocks: BlockNumber = 5 * MINUTES;
    pub const NodesSize: u32 = 32;
    pub const RootHistorySize: u32 = 30;
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
    type Lookup = AccountIdLookup<AccountId, ()>;
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

parameter_types! {
    pub const ExpectedBlockTime: Moment = MILLISECS_PER_BLOCK;
}

// 1 in 4 blocks (on average, not counting collisions) will be primary babe blocks.
pub const PRIMARY_PROBABILITY: (u64, u64) = (1, 4);
/// The BABE epoch configuration at genesis.
pub const BABE_GENESIS_EPOCH_CONFIG: sp_consensus_babe::BabeEpochConfiguration =
    sp_consensus_babe::BabeEpochConfiguration {
        c: PRIMARY_PROBABILITY,
        allowed_slots: sp_consensus_babe::AllowedSlots::PrimaryAndSecondaryVRFSlots,
    };

impl pallet_babe::Config for Runtime {
    type EpochDuration = EpochDurationInBlocks;
    type ExpectedBlockTime = ExpectedBlockTime;
    type EpochChangeTrigger = pallet_babe::ExternalTrigger;
    type DisabledValidators = Session;
    type WeightInfo = ();
    type MaxAuthorities = MaxAuthorities;
    type MaxNominators = ConstU32<0>;

    type KeyOwnerProof = sp_session::MembershipProof;

    // TODO! specify as pallet_babe::EquivocationReportSystem<Self, Offences, Historical, ReportLongevity>;
    // when pallet_autorship and pallet_offences are added
    type EquivocationReportSystem = ();
}

parameter_types! {
    pub const BondingDuration: EraIndex = polkadot_runtime_common::prod_or_fast!(28, 3);
    pub const SessionsPerEra: SessionIndex = polkadot_runtime_common::prod_or_fast!(6, 1);
    pub const MaxSetIdSessionEntries: u32 = BondingDuration::get() * SessionsPerEra::get();
}

impl pallet_grandpa::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;

    type WeightInfo = ();
    type MaxAuthorities = MaxAuthorities;
    type MaxNominators = ConstU32<0>;
    type MaxSetIdSessionEntries = MaxSetIdSessionEntries;

    type KeyOwnerProof = sp_session::MembershipProof;
    type EquivocationReportSystem = ();
}

impl pallet_session::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type ValidatorId = AccountId;
    type ValidatorIdOf = ConvertInto;
    type ShouldEndSession = Babe;
    type NextSessionRotation = Babe;
    type SessionManager = ValidatorSet;
    type SessionHandler = <SessionKeys as OpaqueKeys>::KeyTypeIdProviders;
    type Keys = SessionKeys;
    type WeightInfo = pallet_session::weights::SubstrateWeight<Runtime>;
}

impl pallet_session::historical::Config for Runtime {
    type FullIdentification = AccountId;
    type FullIdentificationOf = ConvertInto;
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
    type RuntimeFreezeReason = RuntimeHoldReason;
}

impl pallet_validator_set::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type AddRemoveOrigin = EnsureRoot<AccountId>;
    type MaxAuthorities = MaxAuthorities;
    type SetKeysCooldownBlocks = SetKeysCooldownBlocks;
    type WeightInfo = pallet_validator_set::weights::SubstrateWeight<Runtime>;
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
}

impl pallet_sudo::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type WeightInfo = pallet_sudo::weights::SubstrateWeight<Runtime>;
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
            extra: H256::zero(),
        }
    }
}

impl pallet_beefy_mmr::Config for Runtime {
    type LeafVersion = LeafVersion;
    type BeefyAuthorityToMerkleLeaf = pallet_beefy_mmr::BeefyEcdsaToEthereum;
    type LeafExtra = LeafExtraData;
    type BeefyDataProvider = LeafExtraDataProvider;
    type WeightInfo = ();
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

// Frontier

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
            <Runtime as frame_system::Config>::DbWeight::get().reads(1),
        )
    }
}

pub struct FindAuthorAdapter;
impl FindAuthor<H160> for FindAuthorAdapter {
    fn find_author<'a, I>(digests: I) -> Option<H160>
    where
        I: 'a + IntoIterator<Item = (sp_runtime::ConsensusEngineId, &'a [u8])>,
    {
        if let Some(author) = Babe::find_author(digests) {
            return Some(H160::from_slice(&author.encode()[0..20]));
        }
        None
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
    type FindAuthor = FindAuthorAdapter;
    type GasLimitPovSizeRatio = GasLimitPovSizeRatio;
    type GasLimitStorageGrowthRatio = ();
    type Timestamp = Timestamp;
    type WeightInfo = ();
}

impl pallet_evm_chain_id::Config for Runtime {}

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

// Storage Hub

/****** NFTs pallet ******/
parameter_types! {
    pub const CollectionDeposit: Balance = 100 * UNIT;
    pub const ItemDeposit: Balance = 1 * UNIT;
    pub const MetadataDepositBase: Balance = 10 * UNIT;
    pub const MetadataDepositPerByte: Balance = 1 * UNIT;
    pub const ApprovalsLimit: u32 = 20;
    pub const ItemAttributesApprovalsLimit: u32 = 20;
    pub const MaxTips: u32 = 10;
    pub const MaxDeadlineDuration: BlockNumber = 12 * 30 * DAYS;
    pub const MaxAttributesPerCall: u32 = 10;
    pub Features: PalletFeatures = PalletFeatures::all_enabled();
}

impl pallet_nfts::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type CollectionId = u32;
    type ItemId = u32;
    type Currency = Balances;
    type CreateOrigin = AsEnsureOriginWithArg<EnsureSigned<AccountId>>;
    type ForceOrigin = frame_system::EnsureRoot<AccountId>;
    type CollectionDeposit = CollectionDeposit;
    type ItemDeposit = ItemDeposit;
    type MetadataDepositBase = MetadataDepositBase;
    type AttributeDepositBase = MetadataDepositBase;
    type DepositPerByte = MetadataDepositPerByte;
    type StringLimit = ConstU32<256>;
    type KeyLimit = ConstU32<64>;
    type ValueLimit = ConstU32<256>;
    type ApprovalsLimit = ApprovalsLimit;
    type ItemAttributesApprovalsLimit = ItemAttributesApprovalsLimit;
    type MaxTips = MaxTips;
    type MaxDeadlineDuration = MaxDeadlineDuration;
    type MaxAttributesPerCall = MaxAttributesPerCall;
    type Features = Features;
    type OffchainSignature = Signature;
    type OffchainPublic = <Signature as Verify>::Signer;
    type WeightInfo = pallet_nfts::weights::SubstrateWeight<Runtime>;
    #[cfg(feature = "runtime-benchmarks")]
    type Helper = ();
    type Locker = ();
}
/****** ****** ****** ******/

/****** Parameters pallet ******/
impl pallet_parameters::Config for Runtime {
    type AdminOrigin = EnsureRoot<AccountId>;
    type RuntimeEvent = RuntimeEvent;
    type RuntimeParameters = RuntimeParameters;
    type WeightInfo = ();
}
/****** ****** ****** ******/

/****** Relay Randomness pallet ******/
impl pallet_randomness::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type BabeDataGetter = BabeDataGetter;
    type BabeBlockGetter = BlockNumberGetter;
    type WeightInfo = ();
    type BabeDataGetterBlockNumber = BlockNumber;

}

/// Only callable after `set_validation_data` is called which forms this proof the same way
// fn relay_chain_state_proof() -> RelayChainStateProof {
//     let relay_storage_root = cumulus_pallet_parachain_system::ValidationData::<Runtime>::get()
//         .expect("set in `set_validation_data`")
//         .relay_parent_storage_root;
//     let relay_chain_state = cumulus_pallet_parachain_system::RelayStateProof::<Runtime>::get()
//         .expect("set in `set_validation_data`");
//     RelayChainStateProof::new(ParachainInfo::get(), relay_storage_root, relay_chain_state)
//         .expect("Invalid relay chain state proof, already constructed in `set_validation_data`")
// }

pub struct BabeDataGetter;
impl pallet_randomness::GetBabeData<u64, Hash> for BabeDataGetter {
    fn get_epoch_index() -> u64 {
        todo!("implement `get_epoch_index`");
    }
    fn get_epoch_randomness() -> Hash {
        todo!("implement `get_epoch_randomness`");
    }
    fn get_parent_randomness() -> Hash {
        todo!("implement `get_parent_randomness`");
    }
}

pub struct BlockNumberGetter {}
impl sp_runtime::traits::BlockNumberProvider for BlockNumberGetter {
    type BlockNumber = BlockNumber;

    fn current_block_number() -> Self::BlockNumber {
        frame_system::Pallet::<Runtime>::block_number()
    }
}


/****** ****** ****** ******/

/****** Storage Providers pallet ******/
parameter_types! {
    pub const SpMinDeposit: Balance = 100 * UNIT;
    pub const BucketDeposit: Balance = 100 * UNIT;
    pub const BspSignUpLockPeriod: BlockNumber = 90 * DAYS; // ~3 months
    pub const MaxBlocksForRandomness: BlockNumber = prod_or_fast!(2 * HOURS, 2 * MINUTES);
    // TODO: If the next line is uncommented (which should be eventually, replacing the line above), compilation breaks (most likely because of mismatched dependency issues)
    // pub const MaxBlocksForRandomness: BlockNumber = prod_or_fast!(2 * runtime_constants::time::EPOCH_DURATION_IN_SLOTS, 2 * MINUTES);
}

impl pallet_storage_providers::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = pallet_storage_providers::weights::SubstrateWeight<Runtime>;
    type ProvidersRandomness = pallet_randomness::RandomnessFromOneEpochAgo<Runtime>;
    type PaymentStreams = PaymentStreams;
    type ProofDealer = ProofsDealer;
    type FileMetadataManager = FileMetadata<
        { shp_constants::H_LENGTH },
        { shp_constants::FILE_CHUNK_SIZE },
        { shp_constants::FILE_SIZE_TO_CHALLENGES },
    >;
    type NativeBalance = Balances;
    type CrRandomness = MockCrRandomness;
    type RuntimeHoldReason = RuntimeHoldReason;
    type StorageDataUnit = StorageDataUnit;
    type StorageDataUnitAndBalanceConvert = StorageDataUnitAndBalanceConverter;
    type SpCount = u32;
    type BucketCount = u128;
    type MerklePatriciaRoot = Hash;
    type MerkleTrieHashing = Hashing;
    type ProviderId = Hash;
    type ProviderIdHashing = Hashing;
    type ValuePropId = Hash;
    type ValuePropIdHashing = Hashing;
    type ReadAccessGroupId = <Self as pallet_nfts::Config>::CollectionId;
    type ProvidersProofSubmitters = ProofsDealer;
    type ReputationWeightType = u32;
    type StorageHubTickGetter = ProofsDealer;
    type Treasury = TreasuryAccount;
    type SpMinDeposit = SpMinDeposit;
    type SpMinCapacity = ConstU64<2>;
    type DepositPerData = ConstU128<2>;
    type MaxFileSize = ConstU64<{ u64::MAX }>;
    type MaxMultiAddressSize = ConstU32<100>;
    type MaxMultiAddressAmount = ConstU32<5>;
    type MaxProtocols = ConstU32<100>;
    type BucketDeposit = BucketDeposit;
    type BucketNameLimit = ConstU32<100>;
    type MaxBlocksForRandomness = MaxBlocksForRandomness;
    type MinBlocksBetweenCapacityChanges = ConstU32<10>;
    type DefaultMerkleRoot = DefaultMerkleRoot<StorageProofsMerkleTrieLayout>;
    type SlashAmountPerMaxFileSize =
        runtime_params::dynamic_params::runtime_config::SlashAmountPerMaxFileSize;
    type StartingReputationWeight = ConstU32<1>;
    type BspSignUpLockPeriod = BspSignUpLockPeriod;
    type MaxCommitmentSize = ConstU32<1000>;
    type ZeroSizeBucketFixedRate =
        runtime_params::dynamic_params::runtime_config::ZeroSizeBucketFixedRate;
    type ProviderTopUpTtl = runtime_params::dynamic_params::runtime_config::ProviderTopUpTtl;
    type MaxExpiredItemsInBlock = ConstU32<100>;
    #[cfg(feature = "runtime-benchmarks")]
    type BenchmarkHelpers = ProvidersBenchmarkHelpers;
}

pub struct StorageDataUnitAndBalanceConverter;
impl Convert<StorageDataUnit, Balance> for StorageDataUnitAndBalanceConverter {
    fn convert(data_unit: StorageDataUnit) -> Balance {
        data_unit.saturated_into()
    }
}
impl ConvertBack<StorageDataUnit, Balance> for StorageDataUnitAndBalanceConverter {
    fn convert_back(balance: Balance) -> StorageDataUnit {
        balance.saturated_into()
    }
}

pub type HasherOutT<T> = <<T as TrieLayout>::Hash as Hasher>::Out;
pub struct DefaultMerkleRoot<T>(PhantomData<T>);
impl<T: TrieConfiguration> Get<HasherOutT<T>> for DefaultMerkleRoot<T> {
    fn get() -> HasherOutT<T> {
        sp_trie::empty_trie_root::<T>()
    }
}

// Benchmark helpers for the Providers pallet
#[cfg(feature = "runtime-benchmarks")]
pub struct ProvidersBenchmarkHelpers;
#[cfg(feature = "runtime-benchmarks")]
impl pallet_storage_providers::benchmarking::BenchmarkHelpers<Runtime>
    for ProvidersBenchmarkHelpers
{
    type ProviderId = <Runtime as pallet_storage_providers::Config>::ProviderId;
    fn set_accrued_failed_proofs(provider_id: Self::ProviderId, value: u32) {
        pallet_proofs_dealer::SlashableProviders::<Runtime>::insert(provider_id, value);
    }

    fn get_accrued_failed_proofs(provider_id: Self::ProviderId) -> u32 {
        pallet_proofs_dealer::SlashableProviders::<Runtime>::get(provider_id).unwrap_or(0)
    }
}
/****** ****** ****** ******/

/****** Payment Streams pallet ******/
parameter_types! {
    pub const PaymentStreamHoldReason: RuntimeHoldReason = RuntimeHoldReason::PaymentStreams(pallet_payment_streams::HoldReason::PaymentStreamDeposit);
    pub const UserWithoutFundsCooldown: BlockNumber = 100;
}

impl pallet_payment_streams::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = pallet_payment_streams::weights::SubstrateWeight<Runtime>;
    type NativeBalance = Balances;
    type ProvidersPallet = Providers;
    type RuntimeHoldReason = RuntimeHoldReason;
    type UserWithoutFundsCooldown = UserWithoutFundsCooldown; // Amount of blocks that a user will have to wait before being able to clear the out of funds flag
    type NewStreamDeposit = ConstU32<10>; // Amount of blocks that the deposit of a new stream should be able to pay for
    type Units = StorageDataUnit; // Storage unit
    type BlockNumberToBalance = BlockNumberToBalance;
    type ProvidersProofSubmitters = ProofsDealer;
    type TreasuryCutCalculator = LinearThenPowerOfTwoTreasuryCutCalculator<Runtime, Perbill>;
    type TreasuryAccount = TreasuryAccount;
    type MaxUsersToCharge = ConstU32<10>;
    type BaseDeposit = ConstU128<10>;
}

// Converter from the BlockNumber type to the Balance type for math
pub struct BlockNumberToBalance;

impl Convert<BlockNumber, Balance> for BlockNumberToBalance {
    fn convert(block_number: BlockNumber) -> Balance {
        block_number.into() // In this converter we assume that the block number type is smaller in size than the balance type
    }
}

impl LinearThenPowerOfTwoTreasuryCutCalculatorConfig<Perbill> for Runtime {
    type Balance = Balance;
    type ProvidedUnit = StorageDataUnit;
    type IdealUtilisationRate =
        runtime_params::dynamic_params::runtime_config::IdealUtilisationRate;
    type DecayRate = runtime_params::dynamic_params::runtime_config::DecayRate;
    type MinimumCut = runtime_params::dynamic_params::runtime_config::MinimumTreasuryCut;
    type MaximumCut = runtime_params::dynamic_params::runtime_config::MaximumTreasuryCut;
}
/****** ****** ****** ******/

/****** Proofs Dealer pallet ******/
const RANDOM_CHALLENGES_PER_BLOCK: u32 = 10;
const MAX_CUSTOM_CHALLENGES_PER_BLOCK: u32 = 10;
const TOTAL_MAX_CHALLENGES_PER_BLOCK: u32 =
    RANDOM_CHALLENGES_PER_BLOCK + MAX_CUSTOM_CHALLENGES_PER_BLOCK;

parameter_types! {
    pub const RandomChallengesPerBlock: u32 = RANDOM_CHALLENGES_PER_BLOCK;
    pub const MaxCustomChallengesPerBlock: u32 = MAX_CUSTOM_CHALLENGES_PER_BLOCK;
    pub const TotalMaxChallengesPerBlock: u32 = TOTAL_MAX_CHALLENGES_PER_BLOCK;
    pub const TargetTicksStorageOfSubmitters: u32 = 3;
    pub const ChallengeHistoryLength: BlockNumber = 100;
    pub const ChallengesQueueLength: u32 = 100;
    pub const ChallengesFee: Balance = 1 * UNIT;
    pub const ChallengeTicksTolerance: u32 = 50;
}

impl pallet_proofs_dealer::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = pallet_proofs_dealer::weights::SubstrateWeight<Runtime>;
    type ProvidersPallet = Providers;
    type NativeBalance = Balances;
    type MerkleTrieHash = Hash;
    type MerkleTrieHashing = BlakeTwo256;
    type ForestVerifier = ForestVerifier<StorageProofsMerkleTrieLayout, { BlakeTwo256::LENGTH }>;
    type KeyVerifier = FileKeyVerifier<
        StorageProofsMerkleTrieLayout,
        { shp_constants::H_LENGTH },
        { shp_constants::FILE_CHUNK_SIZE },
        { shp_constants::FILE_SIZE_TO_CHALLENGES },
    >;
    type StakeToBlockNumber = SaturatingBalanceToBlockNumber;
    #[cfg(feature = "runtime-benchmarks")]
    type RandomChallengesPerBlock = ConstU32<0>;
    #[cfg(not(feature = "runtime-benchmarks"))]
    type RandomChallengesPerBlock = RandomChallengesPerBlock;
    #[cfg(feature = "runtime-benchmarks")]
    type MaxCustomChallengesPerBlock = TotalMaxChallengesPerBlock;
    #[cfg(not(feature = "runtime-benchmarks"))]
    type MaxCustomChallengesPerBlock = MaxCustomChallengesPerBlock;
    type MaxSubmittersPerTick = MaxSubmittersPerTick;
    type TargetTicksStorageOfSubmitters = TargetTicksStorageOfSubmitters;
    type ChallengeHistoryLength = ChallengeHistoryLength;
    type ChallengesQueueLength = ChallengesQueueLength;
    type CheckpointChallengePeriod =
        runtime_params::dynamic_params::runtime_config::CheckpointChallengePeriod;
    type ChallengesFee = ChallengesFee;
    type Treasury = TreasuryAccount;
    // TODO: Once the client logic to keep track of CR randomness deadlines and execute their submissions is implemented
    // AND after the chain has been live for enough time to have enough providers to avoid the commit-reveal randomness being
    // gameable, the randomness provider should be CrRandomness
    type RandomnessProvider = pallet_randomness::ParentBlockRandomness<Runtime>;
    type StakeToChallengePeriod =
        runtime_params::dynamic_params::runtime_config::StakeToChallengePeriod;
    type MinChallengePeriod = runtime_params::dynamic_params::runtime_config::MinChallengePeriod;
    type ChallengeTicksTolerance = ChallengeTicksTolerance;
    type BlockFullnessPeriod = ChallengeTicksTolerance; // We purposely set this to `ChallengeTicksTolerance` so that spamming of the chain is evaluated for the same blocks as the tolerance BSPs are given.
    type BlockFullnessHeadroom = BlockFullnessHeadroom;
    type MinNotFullBlocksRatio = MinNotFullBlocksRatio;
    type MaxSlashableProvidersPerTick = MaxSlashableProvidersPerTick;
}

// Converter from the Balance type to the BlockNumber type for math.
// It performs a saturated conversion, so that the result is always a valid BlockNumber.
pub struct SaturatingBalanceToBlockNumber;
impl Convert<Balance, BlockNumberFor<Runtime>> for SaturatingBalanceToBlockNumber {
    fn convert(block_number: Balance) -> BlockNumberFor<Runtime> {
        block_number.saturated_into()
    }
}

pub struct MaxSubmittersPerTick;
impl Get<u32> for MaxSubmittersPerTick {
    fn get() -> u32 {
        let block_weights = <Runtime as frame_system::Config>::BlockWeights::get();

        // Not being able to get the `max_total` weight for the Normal dispatch class is considered
        // a critical bug. So we set it to be zero, essentially allowing zero submitters per tick.
        // This value can be read from the constants of a node, but with the current configuration, this is:
        //
        // max_total: {
        //   ref_time: 1,500,000,000,000
        //   proof_size: 3,932,160
        // }
        let max_weight_for_class = block_weights
            .get(DispatchClass::Normal)
            .max_total
            .unwrap_or(Zero::zero());

        // Get the minimum weight a `submit_proof` extrinsic can have.
        // This would be the case where the proof is just made up of a single file key proof, that is a
        // response to all the random challenges. And there are no checkpoint challenges.
        // With the current benchmarking, this is:
        //
        // TODO: UPDATE THIS WITH THE FINAL BENCHMARKING
        // min_weight_for_submit_proof: {
        //   ref_time: 2,980,252,675
        //   proof_size: 16,056
        // }
        let min_weight_for_submit_proof =
            <pallet_proofs_dealer::weights::SubstrateWeight<Runtime> as pallet_proofs_dealer::weights::WeightInfo>::submit_proof_no_checkpoint_challenges_key_proofs(1);

        // Calculate the maximum number of submit proofs that is possible to have in a block/tick.
        // With the current values, this would be:
        //
        // TODO: UPDATE THIS WITH THE FINAL BENCHMARKING
        // 244 proof submissions per block (limited by `proof_size`)
        let max_proof_submissions_per_tick = max_weight_for_class
            .checked_div_per_component(&min_weight_for_submit_proof)
            .unwrap_or(0);

        // Saturating u64 to u32 should be enough.
        max_proof_submissions_per_tick.saturated_into()
    }
}

pub struct BlockFullnessHeadroom;
impl Get<Weight> for BlockFullnessHeadroom {
    fn get() -> Weight {
        // The block headroom is set to be the maximum benchmarked weight that a `submit_proof` extrinsic can have.
        // That is, when the proof includes two file key proofs for every single random challenge, and for the maximum
        // number of checkpoint challenges as well.
        <pallet_proofs_dealer::weights::SubstrateWeight<Runtime> as pallet_proofs_dealer::weights::WeightInfo>::submit_proof_with_checkpoint_challenges_key_proofs(TOTAL_MAX_CHALLENGES_PER_BLOCK * 2)
    }
}

pub struct MinNotFullBlocksRatio;
impl Get<Perbill> for MinNotFullBlocksRatio {
    fn get() -> Perbill {
        // This means that we tolerate at most 50% of misbehaving collators.
        Perbill::from_percent(50)
    }
}

pub struct MaxSlashableProvidersPerTick;
impl Get<u32> for MaxSlashableProvidersPerTick {
    fn get() -> u32 {
        // With the maximum number of slashable providers per tick being `N`, the absolute maximum
        // weight that the `on_poll` hook can have, with the current benchmarking, is:
        //
        // TODO: UPDATE THIS WITH THE FINAL BENCHMARKING
        // new_challenges_round_weight: {
        //   ref_time: 576,000,000 + N * 551,601,146
        //   proof_size: 8,523 + N * 3,158
        // }
        // new_checkpoint_challenge_round_max_weight: {
        //   ref_time: 587,205,208 + ChallengesQueueLength * 225,083 = 610,554,678
        //   proof_size: 4,787
        // }
        // check_spamming_condition_weight: {
        //   ref_time: 313,000,000
        //   proof_size: 6,012
        // }
        //
        // For `N` = 1000, this would be:
        // max_on_poll_weight: {
        //   ref_time: 313,000,000 + 610,554,678 + 576,000,000 + N * 551,601,146 ≈ 553,100,700,678
        //   proof_size: 6,012 + 4,787 + 8,523 + N * 3,158 ≈ 3,177,322
        // }
        //
        // Consider that the maximum block weight is:
        // maxBlock: {
        //   ref_time: 2,000,000,000,000
        //   proof_size: 5,242,880
        // }
        //
        // This `on_poll` hook would consume roughly 1/4 of the block `ref_time` and 3/5 of the block `proof_size`.
        // This is naturally a lot. But it would be a very unlikely scenario.
        //
        // This would be the case where all `N` Providers have synchronised their challenge periods
        // and have the same deadline, plus, all of them missed their proof submissions.
        // The normal scenario would be that NONE (or just a small number) of the Providers have
        // missed their proof submissions.
        let max_slashable_providers_per_tick = 1000;
        max_slashable_providers_per_tick
    }
}
/****** ****** ****** ******/

/****** File System pallet ******/
type ThresholdType = u32;
pub type ReplicationTargetType = u32;

parameter_types! {
    pub const BaseStorageRequestCreationDeposit: Balance = 1 * UNIT;
    pub const FileDeletionRequestCreationDeposit: Balance = 1 * UNIT;
    pub const FileSystemStorageRequestCreationHoldReason: RuntimeHoldReason = RuntimeHoldReason::FileSystem(pallet_file_system::HoldReason::StorageRequestCreationHold);
    pub const FileSystemFileDeletionRequestHoldReason: RuntimeHoldReason = RuntimeHoldReason::FileSystem(pallet_file_system::HoldReason::FileDeletionRequestHold);
}

impl pallet_file_system::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = pallet_file_system::weights::SubstrateWeight<Runtime>;
    type Providers = Providers;
    type ProofDealer = ProofsDealer;
    type PaymentStreams = PaymentStreams;
    // TODO: Replace the mocked CR randomness with the actual one when it's ready
    // type CrRandomness = CrRandomness;
    type CrRandomness = MockCrRandomness;
    type UpdateStoragePrice = MostlyStablePriceIndexUpdater<Runtime>;
    type UserSolvency = PaymentStreams;
    type Fingerprint = Hash;
    type ReplicationTargetType = ReplicationTargetType;
    type ThresholdType = ThresholdType;
    type ThresholdTypeToTickNumber = ThresholdTypeToBlockNumberConverter;
    type HashToThresholdType = HashToThresholdTypeConverter;
    type MerkleHashToRandomnessOutput = MerkleHashToRandomnessOutputConverter;
    type ChunkIdToMerkleHash = ChunkIdToMerkleHashConverter;
    type Currency = Balances;
    type RuntimeHoldReason = RuntimeHoldReason;
    type Nfts = Nfts;
    type CollectionInspector = BucketNfts;
    type BspStopStoringFilePenalty =
        runtime_params::dynamic_params::runtime_config::BspStopStoringFilePenalty;
    type TreasuryAccount = TreasuryAccount;
    type MaxBatchConfirmStorageRequests = ConstU32<10>;
    type MaxFilePathSize = ConstU32<512u32>;
    type MaxPeerIdSize = ConstU32<100>;
    type MaxNumberOfPeerIds = ConstU32<5>;
    type MaxDataServerMultiAddresses = ConstU32<10>;
    type MaxExpiredItemsInTick = ConstU32<100>;
    type StorageRequestTtl = runtime_params::dynamic_params::runtime_config::StorageRequestTtl;
    type MoveBucketRequestTtl = ConstU32<40u32>;
    type MaxUserPendingDeletionRequests = ConstU32<10u32>;
    type MaxUserPendingMoveBucketRequests = ConstU32<10u32>;
    type MinWaitForStopStoring =
        runtime_params::dynamic_params::runtime_config::MinWaitForStopStoring;
    type BaseStorageRequestCreationDeposit = BaseStorageRequestCreationDeposit;
    type UpfrontTicksToPay = runtime_params::dynamic_params::runtime_config::UpfrontTicksToPay;
    type WeightToFee = WeightToFee;
    type ReplicationTargetToBalance = ReplicationTargetToBalance;
    type TickNumberToBalance = TickNumberToBalance;
    type StorageDataUnitToBalance = StorageDataUnitToBalance;
    type FileDeletionRequestDeposit = FileDeletionRequestCreationDeposit;
    type BasicReplicationTarget =
        runtime_params::dynamic_params::runtime_config::BasicReplicationTarget;
    type StandardReplicationTarget =
        runtime_params::dynamic_params::runtime_config::StandardReplicationTarget;
    type HighSecurityReplicationTarget =
        runtime_params::dynamic_params::runtime_config::HighSecurityReplicationTarget;
    type SuperHighSecurityReplicationTarget =
        runtime_params::dynamic_params::runtime_config::SuperHighSecurityReplicationTarget;
    type UltraHighSecurityReplicationTarget =
        runtime_params::dynamic_params::runtime_config::UltraHighSecurityReplicationTarget;
    type MaxReplicationTarget =
        runtime_params::dynamic_params::runtime_config::MaxReplicationTarget;
    type TickRangeToMaximumThreshold =
        runtime_params::dynamic_params::runtime_config::TickRangeToMaximumThreshold;
}

impl MostlyStablePriceIndexUpdaterConfig for Runtime {
    type Price = Balance;
    type StorageDataUnit = StorageDataUnit;
    type LowerThreshold =
        runtime_params::dynamic_params::runtime_config::SystemUtilisationLowerThresholdPercentage;
    type UpperThreshold =
        runtime_params::dynamic_params::runtime_config::SystemUtilisationUpperThresholdPercentage;
    type MostlyStablePrice = runtime_params::dynamic_params::runtime_config::MostlyStablePrice;
    type MaxPrice = runtime_params::dynamic_params::runtime_config::MaxPrice;
    type MinPrice = runtime_params::dynamic_params::runtime_config::MinPrice;
    type UpperExponentFactor = runtime_params::dynamic_params::runtime_config::UpperExponentFactor;
    type LowerExponentFactor = runtime_params::dynamic_params::runtime_config::LowerExponentFactor;
}

// Converter from the ThresholdType to the BlockNumber type and vice versa.
// It performs a saturated conversion, so that the result is always a valid BlockNumber.
pub struct ThresholdTypeToBlockNumberConverter;

impl Convert<ThresholdType, BlockNumberFor<Runtime>> for ThresholdTypeToBlockNumberConverter {
    fn convert(threshold: ThresholdType) -> BlockNumberFor<Runtime> {
        threshold.saturated_into()
    }
}

impl ConvertBack<ThresholdType, BlockNumberFor<Runtime>> for ThresholdTypeToBlockNumberConverter {
    fn convert_back(block_number: BlockNumberFor<Runtime>) -> ThresholdType {
        block_number.into()
    }
}

/// Converter from the [`Hash`] type to the [`ThresholdType`].
pub struct HashToThresholdTypeConverter;
impl Convert<<Runtime as frame_system::Config>::Hash, ThresholdType>
    for HashToThresholdTypeConverter
{
    fn convert(hash: <Runtime as frame_system::Config>::Hash) -> ThresholdType {
        // Get the hash as bytes
        let hash_bytes = hash.as_ref();

        // Get the 4 least significant bytes of the hash and interpret them as an u32
        let truncated_hash_bytes: [u8; 4] =
            hash_bytes[28..].try_into().expect("Hash is 32 bytes; qed");

        ThresholdType::from_be_bytes(truncated_hash_bytes)
    }
}

// Converter from the MerkleHash (H256) type to the RandomnessOutput (H256) type.
pub struct MerkleHashToRandomnessOutputConverter;

impl Convert<H256, H256> for MerkleHashToRandomnessOutputConverter {
    fn convert(hash: H256) -> H256 {
        hash
    }
}

// Converter from the ChunkId type to the MerkleHash (H256) type.
pub struct ChunkIdToMerkleHashConverter;

impl Convert<ChunkId, H256> for ChunkIdToMerkleHashConverter {
    fn convert(chunk_id: ChunkId) -> H256 {
        let chunk_id_biguint = BigUint::from(chunk_id.as_u64());
        let mut bytes = chunk_id_biguint.to_bytes_be();

        // Ensure the byte slice is exactly 32 bytes long by padding with leading zeros
        if bytes.len() < 32 {
            let mut padded_bytes = vec![0u8; 32 - bytes.len()];
            padded_bytes.extend(bytes);
            bytes = padded_bytes;
        }

        H256::from_slice(&bytes)
    }
}

// Converter from the ReplicationTargetType type to the Balance type.
pub struct ReplicationTargetToBalance;
impl Convert<ReplicationTargetType, Balance> for ReplicationTargetToBalance {
    fn convert(replication_target: ReplicationTargetType) -> Balance {
        replication_target.into()
    }
}

// Converter from the TickNumber type to the Balance type.
pub type TickNumber = BlockNumber;
pub struct TickNumberToBalance;
impl Convert<TickNumber, Balance> for TickNumberToBalance {
    fn convert(tick_number: TickNumber) -> Balance {
        tick_number.into()
    }
}

// Converter from the StorageDataUnit type to the Balance type.
pub struct StorageDataUnitToBalance;
impl Convert<StorageDataUnit, Balance> for StorageDataUnitToBalance {
    fn convert(storage_data_unit: StorageDataUnit) -> Balance {
        storage_data_unit.into()
    }
}
/****** ****** ****** ******/

/****** Bucket NFTs pallet ******/
impl pallet_bucket_nfts::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = pallet_bucket_nfts::weights::SubstrateWeight<Runtime>;
    type Buckets = Providers;
    #[cfg(feature = "runtime-benchmarks")]
    type Helper = ();
}
/****** ****** ****** ******/

/****** Commit-Reveal Randomness pallet ******/
pub struct MockCrRandomness;
impl shp_traits::CommitRevealRandomnessInterface for MockCrRandomness {
    type ProviderId = Hash;

    fn initialise_randomness_cycle(
        _who: &Self::ProviderId,
    ) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }

    fn stop_randomness_cycle(_who: &Self::ProviderId) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
}
/****** ****** ****** ******/
