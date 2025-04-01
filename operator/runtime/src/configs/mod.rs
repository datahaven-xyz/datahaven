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

use crate::EvmChainId;
use crate::Timestamp;
use crate::{Historical, SessionKeys, ValidatorSet};

// Local module imports
use super::{
    deposit, AccountId, Babe, Balance, Balances, BeefyMmrLeaf, Block, BlockNumber, Hash, Nonce,
    PalletInfo, Runtime, RuntimeCall, RuntimeEvent, RuntimeFreezeReason, RuntimeHoldReason,
    RuntimeOrigin, RuntimeTask, Session, System, EXISTENTIAL_DEPOSIT, SLOT_DURATION, VERSION,
};
// Substrate and Polkadot dependencies
use codec::{Decode, Encode};
use datahaven_runtime_common::gas::WEIGHT_PER_GAS;
use datahaven_runtime_common::time::{EpochDurationInBlocks, MILLISECS_PER_BLOCK, MINUTES};
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
use snowbridge_beacon_primitives::{Fork, ForkVersions};
use sp_consensus_beefy::mmr::BeefyDataProvider;
use sp_consensus_beefy::{ecdsa_crypto::AuthorityId as BeefyId, mmr::MmrLeafVersion};
use sp_core::{crypto::KeyTypeId, H160, H256, U256};
use sp_runtime::{
    traits::{AccountIdLookup, ConvertInto, Keccak256, One, OpaqueKeys, UniqueSaturatedInto},
    FixedPointNumber, Perbill,
};
use sp_staking::{EraIndex, SessionIndex};
use sp_std::{
    convert::{From, Into},
    prelude::*,
};
use sp_version::RuntimeVersion;

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
