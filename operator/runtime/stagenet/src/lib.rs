#![cfg_attr(not(feature = "std"), no_std)]
// `construct_runtime!` does a lot of recursion and requires us to increase the limit to 512.
#![recursion_limit = "512"]

extern crate alloc;
#[cfg(feature = "std")]
include!(concat!(env!("OUT_DIR"), "/wasm_binary.rs"));

#[cfg(feature = "runtime-benchmarks")]
mod benchmarks;
pub mod configs;
pub mod precompiles;
pub mod weights;

// Re-export governance for tests
pub use configs::governance;
pub use configs::Precompiles;

use alloc::{borrow::Cow, vec::Vec};
use codec::Encode;
use fp_rpc::TransactionStatus;
use frame_support::{
    genesis_builder_helper::{build_state, get_preset},
    pallet_prelude::{TransactionValidity, TransactionValidityError},
    parameter_types,
    traits::{Contains, KeyOwnerProofSystem, OnFinalize},
    weights::{constants::WEIGHT_REF_TIME_PER_SECOND, Weight},
};
pub use frame_system::Call as SystemCall;
pub use pallet_balances::Call as BalancesCall;
use pallet_ethereum::{Call::transact, Transaction as EthereumTransaction};
use pallet_evm::{Account as EVMAccount, FeeCalculator, GasWeightMapping, Runner};
use pallet_external_validators::traits::EraIndex;
use pallet_file_system::types::StorageRequestMetadata;
use pallet_file_system_runtime_api::*;
use pallet_grandpa::{fg_primitives, AuthorityId as GrandpaId};
use pallet_payment_streams_runtime_api::*;
use pallet_proofs_dealer::types::{
    CustomChallenge, KeyFor, ProviderIdFor as ProofsDealerProviderIdFor, RandomnessOutputFor,
};
use pallet_proofs_dealer_runtime_api::*;
use pallet_storage_providers::types::{
    BackupStorageProvider, BackupStorageProviderId, BucketId, MainStorageProviderId,
    Multiaddresses, ProviderIdFor, StorageDataUnit, StorageProviderId, ValuePropositionWithId,
};
use pallet_storage_providers_runtime_api::*;
pub use pallet_timestamp::Call as TimestampCall;
use shp_file_metadata::ChunkId;
use smallvec::smallvec;
use snowbridge_core::AgentId;
use snowbridge_merkle_tree::MerkleProof;
use sp_api::impl_runtime_apis;
use sp_consensus_beefy::{
    ecdsa_crypto::{AuthorityId as BeefyId, Signature as BeefySignature},
    AncestryHelper,
};
use sp_core::{Get, OpaqueMetadata, H160, H256, U256};
#[cfg(any(feature = "std", test))]
pub use sp_runtime::BuildStorage;
use sp_runtime::{
    generic, impl_opaque_keys,
    traits::{Block as BlockT, DispatchInfoOf, Dispatchable, PostDispatchInfoOf},
    transaction_validity::{InvalidTransaction, TransactionSource},
    ApplyExtrinsicResult, Perbill, Permill,
};
use sp_std::collections::btree_map::BTreeMap;
#[cfg(feature = "std")]
use sp_version::NativeVersion;
use sp_version::RuntimeVersion;
use xcm::VersionedLocation;

// Need by storage hub
use frame_support::weights::{
    constants::ExtrinsicBaseWeight, WeightToFeeCoefficient, WeightToFeeCoefficients,
    WeightToFeePolynomial,
};

pub use datahaven_runtime_common::{
    gas::WEIGHT_PER_GAS, time::EpochDurationInBlocks, time::*, AccountId, Address, Balance,
    BlockNumber, Hash, Header, Nonce, Signature,
};

pub mod genesis_config_presets;

/// Opaque types. These are used by the CLI to instantiate machinery that don't need to know
/// the specifics of the runtime. They can then be made to be agnostic over specific formats
/// of data like extrinsics, allowing for them to continue syncing the network through upgrades
/// to even the core data structures.
pub mod opaque {
    use super::*;
    use sp_runtime::{
        generic,
        traits::{BlakeTwo256, Hash as HashT},
    };

    pub use sp_runtime::OpaqueExtrinsic as UncheckedExtrinsic;

    /// Opaque block header type.
    pub type Header = generic::Header<BlockNumber, BlakeTwo256>;
    /// Opaque block type.
    pub type Block = generic::Block<Header, UncheckedExtrinsic>;
    /// Opaque block identifier type.
    pub type BlockId = generic::BlockId<Block>;
    /// Opaque block hash type.
    pub type Hash = <BlakeTwo256 as HashT>::Output;
}

impl_opaque_keys! {
    pub struct SessionKeys {
        pub babe: Babe,
        pub grandpa: Grandpa,
        pub im_online: ImOnline,
        pub beefy: Beefy,
    }
}

// To learn more about runtime versioning, see:
// https://docs.substrate.io/main-docs/build/upgrade#runtime-versioning
#[sp_version::runtime_version]
pub const VERSION: RuntimeVersion = RuntimeVersion {
    spec_name: Cow::Borrowed("datahaven-stagenet"),
    impl_name: Cow::Borrowed("datahaven-stagenet"),
    authoring_version: 1,
    // The version of the runtime specification. A full node will not attempt to use its native
    //   runtime in substitute for the on-chain Wasm runtime unless all of `spec_name`,
    //   `spec_version`, and `authoring_version` are the same between Wasm and native.
    // This value is set to 200 to notify Polkadot-JS App (https://polkadot.js.org/apps) to use
    //   the compatible custom types.
    spec_version: 200,
    impl_version: 1,
    apis: RUNTIME_API_VERSIONS,
    transaction_version: 1,
    system_version: 1,
};

pub const BLOCK_HASH_COUNT: BlockNumber = 2400;
/// HAVE, the native token, uses 18 decimals of precision.
pub mod currency {
    use super::Balance;

    // Provide a common factor between runtimes based on a supply of 10_000_000 tokens.
    pub const SUPPLY_FACTOR: Balance = 1;

    pub const WEI: Balance = 1;
    pub const KILOWEI: Balance = 1_000;
    pub const MEGAWEI: Balance = 1_000_000;
    pub const GIGAWEI: Balance = 1_000_000_000;
    pub const MICROHAVE: Balance = 1_000_000_000_000;
    pub const MILLIHAVE: Balance = 1_000_000_000_000_000;
    pub const HAVE: Balance = 1_000_000_000_000_000_000;
    pub const KILOHAVE: Balance = 1_000_000_000_000_000_000_000;

    pub const TRANSACTION_BYTE_FEE: Balance = 1 * GIGAWEI * SUPPLY_FACTOR;
    pub const STORAGE_BYTE_FEE: Balance = 100 * MICROHAVE * SUPPLY_FACTOR;
    pub const WEIGHT_FEE: Balance = 50 * KILOWEI * SUPPLY_FACTOR / 4;

    pub const fn deposit(items: u32, bytes: u32) -> Balance {
        items as Balance * 1 * HAVE * SUPPLY_FACTOR + (bytes as Balance) * STORAGE_BYTE_FEE
    }
}

pub const MAX_POV_SIZE: u32 = 5 * 1024 * 1024;

/// Maximum weight per block
pub const MAXIMUM_BLOCK_WEIGHT: Weight = Weight::from_parts(
    WEIGHT_REF_TIME_PER_SECOND.saturating_mul(2),
    MAX_POV_SIZE as u64,
);

const NORMAL_DISPATCH_RATIO: Perbill = Perbill::from_percent(75);
pub const NORMAL_BLOCK_WEIGHT: Weight = MAXIMUM_BLOCK_WEIGHT.saturating_mul(3).saturating_div(4);
// Here we assume Ethereum's base fee of 21000 gas and convert to weight, but we
// subtract roughly the cost of a balance transfer from it (about 1/3 the cost)
// and some cost to account for per-byte-fee.
// TODO: we should use benchmarking's overhead feature to measure this
pub const EXTRINSIC_BASE_WEIGHT: Weight = Weight::from_parts(10000 * WEIGHT_PER_GAS, 0);

// Existential deposit.
#[cfg(not(feature = "runtime-benchmarks"))]
parameter_types! {
    pub const ExistentialDeposit: Balance = 0;
}
#[cfg(feature = "runtime-benchmarks")]
parameter_types! {
    // TODO: Change ED to 1 after upgrade to Polkadot SDK stable2503
    // cfr. https://github.com/paritytech/polkadot-sdk/pull/7379
    pub const ExistentialDeposit: Balance = 100;
}

/// The version information used to identify this runtime when compiled natively.
#[cfg(feature = "std")]
pub fn native_version() -> NativeVersion {
    NativeVersion {
        runtime_version: VERSION,
        can_author_with: Default::default(),
    }
}

/// Block type as expected by this runtime.
pub type Block = generic::Block<Header, UncheckedExtrinsic>;

/// The SignedExtension to the basic transaction logic.
pub type SignedExtra = (
    frame_system::CheckNonZeroSender<Runtime>,
    frame_system::CheckSpecVersion<Runtime>,
    frame_system::CheckTxVersion<Runtime>,
    frame_system::CheckGenesis<Runtime>,
    frame_system::CheckEra<Runtime>,
    frame_system::CheckNonce<Runtime>,
    frame_system::CheckWeight<Runtime>,
    pallet_transaction_payment::ChargeTransactionPayment<Runtime>,
    frame_metadata_hash_extension::CheckMetadataHash<Runtime>,
);

/// Unchecked extrinsic type as expected by this runtime.
pub type UncheckedExtrinsic =
    fp_self_contained::UncheckedExtrinsic<Address, RuntimeCall, Signature, SignedExtra>;

pub type CheckedExtrinsic =
    fp_self_contained::CheckedExtrinsic<AccountId, RuntimeCall, SignedExtra, H160>;

/// The payload being signed in transactions.
pub type SignedPayload = generic::SignedPayload<RuntimeCall, SignedExtra>;

/// All migrations of the runtime, aside from the ones declared in the pallets.
///
/// This can be a tuple of types, each implementing `OnRuntimeUpgrade`.
#[allow(unused_parens)]
type Migrations = ();

/// Executive: handles dispatch to the various modules.
pub type Executive = frame_executive::Executive<
    Runtime,
    Block,
    frame_system::ChainContext<Runtime>,
    Runtime,
    AllPalletsWithSystem,
    Migrations,
>;

impl<C> frame_system::offchain::CreateTransactionBase<C> for Runtime
where
    RuntimeCall: From<C>,
{
    type Extrinsic = UncheckedExtrinsic;
    type RuntimeCall = RuntimeCall;
}

impl<C> frame_system::offchain::CreateInherent<C> for Runtime
where
    RuntimeCall: From<C>,
{
    fn create_inherent(call: RuntimeCall) -> UncheckedExtrinsic {
        UncheckedExtrinsic::new_bare(call)
    }
}

/// Handles converting a weight scalar to a fee value, based on the scale and granularity of the
/// node's balance type.
///
/// This should typically create a mapping between the following ranges:
///   - `[0, MAXIMUM_BLOCK_WEIGHT]`
///   - `[Balance::min, Balance::max]`
///
/// Yet, it can be used for any other sort of change to weight-fee. Some examples being:
///   - Setting it to `0` will essentially disable the weight fee.
///   - Setting it to `1` will cause the literal `#[weight = x]` values to be charged.
pub struct WeightToFee;
impl WeightToFeePolynomial for WeightToFee {
    type Balance = Balance;
    fn polynomial() -> WeightToFeeCoefficients<Self::Balance> {
        // in Rococo, extrinsic base weight (smallest non-zero weight) is mapped to 1 MILLIHAVE:
        // in our template, we map to 1/10 of that, or 1/10 MILLIHAVE
        let p = currency::MILLIHAVE / 10;
        let q = 100 * Balance::from(ExtrinsicBaseWeight::get().ref_time());
        smallvec![WeightToFeeCoefficient {
            degree: 1,
            negative: false,
            coeff_frac: Perbill::from_rational(p % q, q),
            coeff_integer: p / q,
        }]
    }
}

// Create the runtime by composing the FRAME pallets that were previously configured.
#[frame_support::runtime]
mod runtime {
    #[runtime::runtime]
    #[runtime::derive(
        RuntimeCall,
        RuntimeEvent,
        RuntimeError,
        RuntimeOrigin,
        RuntimeFreezeReason,
        RuntimeHoldReason,
        RuntimeSlashReason,
        RuntimeLockId,
        RuntimeTask
    )]
    pub struct Runtime;

    // ╔══════════════════ System and Consensus Pallets ═════════════════╗
    #[runtime::pallet_index(0)]
    pub type System = frame_system;

    // Babe must be before session.
    #[runtime::pallet_index(1)]
    pub type Babe = pallet_babe;

    #[runtime::pallet_index(2)]
    pub type Timestamp = pallet_timestamp;

    #[runtime::pallet_index(3)]
    pub type Balances = pallet_balances;

    // Consensus support.
    // Authorship must be before session in order to note author in the correct session and era.
    #[runtime::pallet_index(4)]
    pub type Authorship = pallet_authorship;

    #[runtime::pallet_index(5)]
    pub type Offences = pallet_offences;

    #[runtime::pallet_index(6)]
    pub type Historical = pallet_session::historical;

    // External Validators must be before Session.
    #[runtime::pallet_index(7)]
    pub type ExternalValidators = pallet_external_validators;

    #[runtime::pallet_index(8)]
    pub type Session = pallet_session;

    #[runtime::pallet_index(9)]
    pub type ImOnline = pallet_im_online;

    #[runtime::pallet_index(10)]
    pub type Grandpa = pallet_grandpa;

    #[runtime::pallet_index(11)]
    pub type TransactionPayment = pallet_transaction_payment;

    #[runtime::pallet_index(12)]
    pub type Beefy = pallet_beefy;

    #[runtime::pallet_index(13)]
    pub type Mmr = pallet_mmr;

    #[runtime::pallet_index(14)]
    pub type BeefyMmrLeaf = pallet_beefy_mmr;
    // ╚═════════════════ System and Consensus Pallets ══════════════════╝

    // ╔═════════════════ Polkadot SDK Utility Pallets ══════════════════╗
    #[runtime::pallet_index(30)]
    pub type Utility = pallet_utility;

    #[runtime::pallet_index(31)]
    pub type Scheduler = pallet_scheduler;

    #[runtime::pallet_index(32)]
    pub type Preimage = pallet_preimage;

    #[runtime::pallet_index(33)]
    pub type Identity = pallet_identity;

    #[runtime::pallet_index(34)]
    pub type Multisig = pallet_multisig;

    #[runtime::pallet_index(35)]
    pub type Parameters = pallet_parameters;

    #[runtime::pallet_index(36)]
    pub type Sudo = pallet_sudo;

    #[runtime::pallet_index(37)]
    pub type Treasury = pallet_treasury;

    #[runtime::pallet_index(38)]
    pub type Proxy = pallet_proxy;

    #[runtime::pallet_index(39)]
    pub type MultiBlockMigrations = pallet_migrations;

    #[runtime::pallet_index(103)]
    pub type SafeMode = pallet_safe_mode;

    #[runtime::pallet_index(104)]
    pub type TxPause = pallet_tx_pause;
    // ╚═════════════════ Polkadot SDK Utility Pallets ══════════════════╝

    // ╔═════════════════════════ Governance Pallets ════════════════════╗
    #[runtime::pallet_index(40)]
    pub type TechnicalCommittee = pallet_collective<Instance1>;

    #[runtime::pallet_index(41)]
    pub type TreasuryCouncil = pallet_collective<Instance2>;

    #[runtime::pallet_index(42)]
    pub type ConvictionVoting = pallet_conviction_voting;

    #[runtime::pallet_index(43)]
    pub type Referenda = pallet_referenda;

    #[runtime::pallet_index(44)]
    pub type Whitelist = pallet_whitelist;

    #[runtime::pallet_index(45)]
    pub type Origins = governance::custom_origins;
    // ╚═════════════════════════ Governance Pallets ════════════════════╝

    // ╔════════════════════ Frontier (EVM) Pallets ═════════════════════╗
    #[runtime::pallet_index(50)]
    pub type Ethereum = pallet_ethereum;

    #[runtime::pallet_index(51)]
    pub type EVM = pallet_evm;

    #[runtime::pallet_index(52)]
    pub type EvmChainId = pallet_evm_chain_id;
    // ╚════════════════════ Frontier (EVM) Pallets ═════════════════════╝

    // ╔══════════════════════ Snowbridge Pallets ═══════════════════════╗
    #[runtime::pallet_index(60)]
    pub type EthereumBeaconClient = snowbridge_pallet_ethereum_client;

    #[runtime::pallet_index(61)]
    pub type EthereumInboundQueueV2 = snowbridge_pallet_inbound_queue_v2;

    #[runtime::pallet_index(62)]
    pub type EthereumOutboundQueueV2 = snowbridge_pallet_outbound_queue_v2;

    #[runtime::pallet_index(63)]
    pub type SnowbridgeSystem = snowbridge_pallet_system;

    #[runtime::pallet_index(64)]
    pub type SnowbridgeSystemV2 = snowbridge_pallet_system_v2;
    // ╚══════════════════════ Snowbridge Pallets ═══════════════════════╝

    // ╔════════════ Polkadot SDK Utility Pallets - Block 2 ═════════════╗
    // The Message Queue pallet has to be after the Snowbridge Outbound
    // Queue V2 pallet since the former processes messages in its
    // `on_initialize` hook and the latter clears up messages in
    // its `on_initialize` hook, so otherwise messages will be cleared
    // up before they are processed.
    #[runtime::pallet_index(70)]
    pub type MessageQueue = pallet_message_queue;
    // ╚════════════ Polkadot SDK Utility Pallets - Block 2 ═════════════╝

    // ╔══════════════════════ StorageHub Pallets ═══════════════════════╗
    // Start with index 80
    #[runtime::pallet_index(80)]
    pub type Providers = pallet_storage_providers;

    #[runtime::pallet_index(81)]
    pub type FileSystem = pallet_file_system;

    #[runtime::pallet_index(82)]
    pub type ProofsDealer = pallet_proofs_dealer;

    #[runtime::pallet_index(83)]
    pub type Randomness = pallet_randomness;

    #[runtime::pallet_index(84)]
    pub type PaymentStreams = pallet_payment_streams;

    #[runtime::pallet_index(85)]
    pub type BucketNfts = pallet_bucket_nfts;

    #[runtime::pallet_index(90)]
    pub type Nfts = pallet_nfts;
    // ╚══════════════════════ StorageHub Pallets ═══════════════════════╝

    // ╔═══════════════════ DataHaven-specific Pallets ══════════════════╗
    // Start with index 100
    #[runtime::pallet_index(100)]
    pub type OutboundCommitmentStore = pallet_outbound_commitment_store;

    #[runtime::pallet_index(101)]
    pub type ExternalValidatorsRewards = pallet_external_validators_rewards;

    #[runtime::pallet_index(102)]
    pub type DataHavenNativeTransfer = pallet_datahaven_native_transfer;
    // ╚═══════════════════ DataHaven-specific Pallets ══════════════════╝
}

/// MMR helper types.
mod mmr {
    use super::Runtime;
    pub use pallet_mmr::primitives::*;

    pub type Leaf = <<Runtime as pallet_mmr::Config>::LeafData as LeafDataProvider>::LeafData;
    pub type Hashing = <Runtime as pallet_mmr::Config>::Hashing;
    pub type Hash = <Hashing as sp_runtime::traits::Hash>::Output;
}

#[derive(Clone)]
pub struct TransactionConverter;

impl fp_self_contained::SelfContainedCall for RuntimeCall {
    type SignedInfo = H160;

    fn is_self_contained(&self) -> bool {
        match self {
            RuntimeCall::Ethereum(call) => call.is_self_contained(),
            _ => false,
        }
    }

    fn check_self_contained(&self) -> Option<Result<Self::SignedInfo, TransactionValidityError>> {
        match self {
            RuntimeCall::Ethereum(call) => call.check_self_contained(),
            _ => None,
        }
    }

    fn validate_self_contained(
        &self,
        signed_info: &Self::SignedInfo,
        dispatch_info: &DispatchInfoOf<RuntimeCall>,
        len: usize,
    ) -> Option<TransactionValidity> {
        match self {
            RuntimeCall::Ethereum(call) => {
                call.validate_self_contained(signed_info, dispatch_info, len)
            }
            _ => None,
        }
    }

    fn pre_dispatch_self_contained(
        &self,
        info: &Self::SignedInfo,
        dispatch_info: &DispatchInfoOf<RuntimeCall>,
        len: usize,
    ) -> Option<Result<(), TransactionValidityError>> {
        match self {
            RuntimeCall::Ethereum(call) => {
                call.pre_dispatch_self_contained(info, dispatch_info, len)
            }
            _ => None,
        }
    }

    fn apply_self_contained(
        self,
        info: Self::SignedInfo,
    ) -> Option<sp_runtime::DispatchResultWithInfo<PostDispatchInfoOf<Self>>> {
        match self {
            call @ RuntimeCall::Ethereum(pallet_ethereum::Call::transact { .. }) => {
                Some(call.dispatch(RuntimeOrigin::from(
                    pallet_ethereum::RawOrigin::EthereumTransaction(info),
                )))
            }
            _ => None,
        }
    }
}

impl fp_rpc::ConvertTransaction<UncheckedExtrinsic> for TransactionConverter {
    fn convert_transaction(&self, transaction: pallet_ethereum::Transaction) -> UncheckedExtrinsic {
        UncheckedExtrinsic::new_bare(
            pallet_ethereum::Call::<Runtime>::transact { transaction }.into(),
        )
    }
}

impl_runtime_apis! {
    impl sp_api::Core<Block> for Runtime {
        fn version() -> RuntimeVersion {
            VERSION
        }

        fn execute_block(block: Block) {
            Executive::execute_block(block);
        }

        fn initialize_block(header: &<Block as BlockT>::Header) -> sp_runtime::ExtrinsicInclusionMode {
            Executive::initialize_block(header)
        }
    }

    impl sp_api::Metadata<Block> for Runtime {
        fn metadata() -> OpaqueMetadata {
            OpaqueMetadata::new(Runtime::metadata().into())
        }

        fn metadata_at_version(version: u32) -> Option<OpaqueMetadata> {
            Runtime::metadata_at_version(version)
        }

        fn metadata_versions() -> Vec<u32> {
            Runtime::metadata_versions()
        }
    }

    impl sp_block_builder::BlockBuilder<Block> for Runtime {
        fn apply_extrinsic(extrinsic: <Block as BlockT>::Extrinsic) -> ApplyExtrinsicResult {
            Executive::apply_extrinsic(extrinsic)
        }

        fn finalize_block() -> <Block as BlockT>::Header {
            Executive::finalize_block()
        }

        fn inherent_extrinsics(data: sp_inherents::InherentData) -> Vec<<Block as BlockT>::Extrinsic> {
            data.create_extrinsics()
        }

        fn check_inherents(
            block: Block,
            data: sp_inherents::InherentData,
        ) -> sp_inherents::CheckInherentsResult {
            data.check_extrinsics(&block)
        }
    }

    impl sp_transaction_pool::runtime_api::TaggedTransactionQueue<Block> for Runtime {
        fn validate_transaction(
            source: TransactionSource,
            tx: <Block as BlockT>::Extrinsic,
            block_hash: <Block as BlockT>::Hash,
        ) -> TransactionValidity {
            // Filtered calls should not enter the tx pool as they'll fail if inserted.
            // If this call is not allowed, we return early.
            if !<Runtime as frame_system::Config>::BaseCallFilter::contains(&tx.0.function) {
                return InvalidTransaction::Call.into();
            }
            Executive::validate_transaction(source, tx, block_hash)
        }
    }

    impl sp_offchain::OffchainWorkerApi<Block> for Runtime {
        fn offchain_worker(header: &<Block as BlockT>::Header) {
            Executive::offchain_worker(header)
        }
    }

    impl sp_session::SessionKeys<Block> for Runtime {
        fn generate_session_keys(seed: Option<Vec<u8>>) -> Vec<u8> {
            SessionKeys::generate(seed)
        }

        fn decode_session_keys(
            encoded: Vec<u8>,
        ) -> Option<Vec<(Vec<u8>, sp_core::crypto::KeyTypeId)>> {
            SessionKeys::decode_into_raw_public_keys(&encoded)
        }
    }

    impl sp_consensus_babe::BabeApi<Block> for Runtime {
        fn configuration() -> sp_consensus_babe::BabeConfiguration {
            let epoch_config = Babe::epoch_config().unwrap_or(crate::configs::BABE_GENESIS_EPOCH_CONFIG);
            sp_consensus_babe::BabeConfiguration {
                slot_duration: Babe::slot_duration(),
                epoch_length: EpochDurationInBlocks::get().into(),
                c: epoch_config.c,
                authorities: Babe::authorities().to_vec(),
                randomness: Babe::randomness(),
                allowed_slots: epoch_config.allowed_slots,
            }
        }

        fn current_epoch_start() -> sp_consensus_babe::Slot {
            Babe::current_epoch_start()
        }

        fn current_epoch() -> sp_consensus_babe::Epoch {
            Babe::current_epoch()
        }

        fn next_epoch() -> sp_consensus_babe::Epoch {
            Babe::next_epoch()
        }

        fn generate_key_ownership_proof(
            _slot: sp_consensus_babe::Slot,
            authority_id: sp_consensus_babe::AuthorityId,
        ) -> Option<sp_consensus_babe::OpaqueKeyOwnershipProof> {
            use codec::Encode;

            Historical::prove((sp_consensus_babe::KEY_TYPE, authority_id))
                .map(|p| p.encode())
                .map(sp_consensus_babe::OpaqueKeyOwnershipProof::new)
        }

        fn submit_report_equivocation_unsigned_extrinsic(
            equivocation_proof: sp_consensus_babe::EquivocationProof<<Block as BlockT>::Header>,
            key_owner_proof: sp_consensus_babe::OpaqueKeyOwnershipProof,
        ) -> Option<()> {
            let key_owner_proof = key_owner_proof.decode()?;

            Babe::submit_unsigned_equivocation_report(
                equivocation_proof,
                key_owner_proof,
            )
        }
    }

    impl sp_consensus_grandpa::GrandpaApi<Block> for Runtime {
        fn grandpa_authorities() -> Vec<(GrandpaId, u64)> {
            Grandpa::grandpa_authorities()
        }

        fn current_set_id() -> fg_primitives::SetId {
            Grandpa::current_set_id()
        }

        fn submit_report_equivocation_unsigned_extrinsic(
            equivocation_proof: fg_primitives::EquivocationProof<
                <Block as BlockT>::Hash,
                sp_runtime::traits::NumberFor<Block>,
            >,
            key_owner_proof: fg_primitives::OpaqueKeyOwnershipProof,
        ) -> Option<()> {
            let key_owner_proof = key_owner_proof.decode()?;

            Grandpa::submit_unsigned_equivocation_report(
                equivocation_proof,
                key_owner_proof,
            )
        }

        fn generate_key_ownership_proof(
            _set_id: fg_primitives::SetId,
            authority_id: fg_primitives::AuthorityId,
        ) -> Option<fg_primitives::OpaqueKeyOwnershipProof> {

            Historical::prove((fg_primitives::KEY_TYPE, authority_id))
                .map(|p| p.encode())
                .map(fg_primitives::OpaqueKeyOwnershipProof::new)
        }
    }

    #[api_version(2)]
    impl mmr::MmrApi<Block, mmr::Hash, BlockNumber> for Runtime {
        fn mmr_root() -> Result<mmr::Hash, mmr::Error> {
            Ok(pallet_mmr::RootHash::<Runtime>::get())
        }

        fn mmr_leaf_count() -> Result<mmr::LeafIndex, mmr::Error> {
            Ok(pallet_mmr::NumberOfLeaves::<Runtime>::get())
        }

        fn generate_proof(
            block_numbers: Vec<BlockNumber>,
            best_known_block_number: Option<BlockNumber>,
        ) -> Result<(Vec<mmr::EncodableOpaqueLeaf>, mmr::LeafProof<mmr::Hash>), mmr::Error> {
            Mmr::generate_proof(block_numbers, best_known_block_number).map(
                |(leaves, proof)| {
                    (
                        leaves
                            .into_iter()
                            .map(|leaf| mmr::EncodableOpaqueLeaf::from_leaf(&leaf))
                            .collect(),
                        proof,
                    )
                },
            )
        }

        fn verify_proof(leaves: Vec<mmr::EncodableOpaqueLeaf>, proof: mmr::LeafProof<mmr::Hash>)
            -> Result<(), mmr::Error>
        {
            let leaves = leaves.into_iter().map(|leaf|
                leaf.into_opaque_leaf()
                .try_decode()
                .ok_or(mmr::Error::Verify)).collect::<Result<Vec<mmr::Leaf>, mmr::Error>>()?;
            Mmr::verify_leaves(leaves, proof)
        }

        fn verify_proof_stateless(
            root: mmr::Hash,
            leaves: Vec<mmr::EncodableOpaqueLeaf>,
            proof: mmr::LeafProof<mmr::Hash>
        ) -> Result<(), mmr::Error> {
            let nodes = leaves.into_iter().map(|leaf|mmr::DataOrHash::Data(leaf.into_opaque_leaf())).collect();
            pallet_mmr::verify_leaves_proof::<mmr::Hashing, _>(root, nodes, proof)
        }
    }

    impl pallet_beefy_mmr::BeefyMmrApi<Block, Hash> for RuntimeApi {
        fn authority_set_proof() -> sp_consensus_beefy::mmr::BeefyAuthoritySet<Hash> {
            BeefyMmrLeaf::authority_set_proof()
        }

        fn next_authority_set_proof() -> sp_consensus_beefy::mmr::BeefyNextAuthoritySet<Hash> {
            BeefyMmrLeaf::next_authority_set_proof()
        }
    }

    #[api_version(5)]
    impl sp_consensus_beefy::BeefyApi<Block, BeefyId> for Runtime {
        fn beefy_genesis() -> Option<BlockNumber> {
            pallet_beefy::GenesisBlock::<Runtime>::get()
        }

        fn validator_set() -> Option<sp_consensus_beefy::ValidatorSet<BeefyId>> {
            Beefy::validator_set()
        }

        fn submit_report_double_voting_unsigned_extrinsic(
            equivocation_proof: sp_consensus_beefy::DoubleVotingProof<
                BlockNumber,
                BeefyId,
                BeefySignature,
            >,
            key_owner_proof: sp_consensus_beefy::OpaqueKeyOwnershipProof,
        ) -> Option<()> {
            let key_owner_proof = key_owner_proof.decode()?;

            Beefy::submit_unsigned_double_voting_report(
                equivocation_proof,
                key_owner_proof,
            )
        }

        fn submit_report_fork_voting_unsigned_extrinsic(
            equivocation_proof:
                sp_consensus_beefy::ForkVotingProof<
                    <Block as BlockT>::Header,
                    BeefyId,
                    sp_runtime::OpaqueValue
                >,
            key_owner_proof: sp_consensus_beefy::OpaqueKeyOwnershipProof,
        ) -> Option<()> {
            Beefy::submit_unsigned_fork_voting_report(
                equivocation_proof.try_into()?,
                key_owner_proof.decode()?,
            )
        }

        fn submit_report_future_block_voting_unsigned_extrinsic(
            equivocation_proof: sp_consensus_beefy::FutureBlockVotingProof<BlockNumber, BeefyId>,
            key_owner_proof: sp_consensus_beefy::OpaqueKeyOwnershipProof,
        ) -> Option<()> {
            Beefy::submit_unsigned_future_block_voting_report(
                equivocation_proof,
                key_owner_proof.decode()?,
            )
        }

        fn generate_key_ownership_proof(
            _set_id: sp_consensus_beefy::ValidatorSetId,
            authority_id: BeefyId,
        ) -> Option<sp_consensus_beefy::OpaqueKeyOwnershipProof> {
            Historical::prove((sp_consensus_beefy::KEY_TYPE, authority_id))
                .map(|p| p.encode())
                .map(sp_consensus_beefy::OpaqueKeyOwnershipProof::new)
        }

        fn generate_ancestry_proof(
            prev_block_number: BlockNumber,
            best_known_block_number: Option<BlockNumber>,
        ) -> Option<sp_runtime::OpaqueValue> {
            use codec::Encode;

            BeefyMmrLeaf::generate_proof(prev_block_number, best_known_block_number)
                .map(|p| p.encode())
                .map(sp_runtime::OpaqueValue::new)
        }
    }

    impl frame_system_rpc_runtime_api::AccountNonceApi<Block, AccountId, Nonce> for Runtime {
        fn account_nonce(account: AccountId) -> Nonce {
            System::account_nonce(account)
        }
    }

    impl pallet_transaction_payment_rpc_runtime_api::TransactionPaymentApi<Block, Balance> for Runtime {
        fn query_info(
            uxt: <Block as BlockT>::Extrinsic,
            len: u32,
        ) -> pallet_transaction_payment_rpc_runtime_api::RuntimeDispatchInfo<Balance> {
            TransactionPayment::query_info(uxt, len)
        }
        fn query_fee_details(
            uxt: <Block as BlockT>::Extrinsic,
            len: u32,
        ) -> pallet_transaction_payment::FeeDetails<Balance> {
            TransactionPayment::query_fee_details(uxt, len)
        }
        fn query_weight_to_fee(weight: Weight) -> Balance {
            TransactionPayment::weight_to_fee(weight)
        }
        fn query_length_to_fee(length: u32) -> Balance {
            TransactionPayment::length_to_fee(length)
        }
    }

    impl pallet_transaction_payment_rpc_runtime_api::TransactionPaymentCallApi<Block, Balance, RuntimeCall>
        for Runtime
    {
        fn query_call_info(
            call: RuntimeCall,
            len: u32,
        ) -> pallet_transaction_payment::RuntimeDispatchInfo<Balance> {
            TransactionPayment::query_call_info(call, len)
        }
        fn query_call_fee_details(
            call: RuntimeCall,
            len: u32,
        ) -> pallet_transaction_payment::FeeDetails<Balance> {
            TransactionPayment::query_call_fee_details(call, len)
        }
        fn query_weight_to_fee(weight: Weight) -> Balance {
            TransactionPayment::weight_to_fee(weight)
        }
        fn query_length_to_fee(length: u32) -> Balance {
            TransactionPayment::length_to_fee(length)
        }
    }

    impl snowbridge_outbound_queue_v2_runtime_api::OutboundQueueV2Api<Block, Balance> for Runtime {
        fn prove_message(leaf_index: u64) -> Option<snowbridge_merkle_tree::MerkleProof> {
            snowbridge_pallet_outbound_queue_v2::api::prove_message::<Runtime>(leaf_index)
        }
    }

    impl snowbridge_system_v2_runtime_api::ControlV2Api<Block> for Runtime {
        fn agent_id(location: VersionedLocation) -> Option<AgentId> {
            snowbridge_pallet_system_v2::api::agent_id::<Runtime>(location)
        }
    }

    impl pallet_external_validators_rewards_runtime_api::ExternalValidatorsRewardsApi<Block, AccountId, EraIndex> for Runtime
        where
        EraIndex: codec::Codec,
    {
        fn generate_rewards_merkle_proof(account_id: AccountId, era_index: EraIndex) -> Option<MerkleProof> {
            ExternalValidatorsRewards::generate_rewards_merkle_proof(account_id, era_index)
        }

        fn verify_rewards_merkle_proof(merkle_proof: MerkleProof) -> bool {
            ExternalValidatorsRewards::verify_rewards_merkle_proof(merkle_proof)
        }
    }

    #[cfg(feature = "runtime-benchmarks")]
    impl frame_benchmarking::Benchmark<Block> for Runtime {
        fn benchmark_metadata(extra: bool) -> (
            Vec<frame_benchmarking::BenchmarkList>,
            Vec<frame_support::traits::StorageInfo>,
        ) {
            use frame_benchmarking::{Benchmarking, BenchmarkList};
            use frame_support::traits::StorageInfoTrait;
            use frame_system_benchmarking::Pallet as SystemBench;

            let mut list = Vec::<BenchmarkList>::new();
            list_benchmarks!(list, extra);

            let storage_info = AllPalletsWithSystem::storage_info();

            (list, storage_info)
        }

        #[expect(non_local_definitions)]
        fn dispatch_benchmark(
            config: frame_benchmarking::BenchmarkConfig
        ) -> Result<Vec<frame_benchmarking::BenchmarkBatch>, alloc::string::String> {
            use frame_benchmarking::{baseline, Benchmarking, BenchmarkBatch};
            use sp_storage::TrackedStorageKey;
            use frame_system_benchmarking::Pallet as SystemBench;

            impl frame_system_benchmarking::Config for Runtime {}
            impl baseline::Config for Runtime {}

            use frame_support::traits::WhitelistedStorageKeys;
            let whitelist: Vec<TrackedStorageKey> = AllPalletsWithSystem::whitelisted_storage_keys();

            let mut batches = Vec::<BenchmarkBatch>::new();
            let params = (&config, &whitelist);
            add_benchmarks!(params, batches);

            Ok(batches)
        }
    }

    #[cfg(feature = "try-runtime")]
    impl frame_try_runtime::TryRuntime<Block> for Runtime {
        fn on_runtime_upgrade(checks: frame_try_runtime::UpgradeCheckSelect) -> (Weight, Weight) {
            // NOTE: intentional unwrap: we don't want to propagate the error backwards, and want to
            // have a backtrace here. If any of the pre/post migration checks fail, we shall stop
            // right here and right now.
            let weight = Executive::try_runtime_upgrade(checks).unwrap();
            (weight, crate::configs::RuntimeBlockWeights::get().max_block)
        }

        fn execute_block(
            block: Block,
            state_root_check: bool,
            signature_check: bool,
            select: frame_try_runtime::TryStateSelect
        ) -> Weight {
            // NOTE: intentional unwrap: we don't want to propagate the error backwards, and want to
            // have a backtrace here.
            Executive::try_execute_block(block, state_root_check, signature_check, select).expect("execute-block failed")
        }
    }

    impl sp_genesis_builder::GenesisBuilder<Block> for Runtime {
        fn build_state(config: Vec<u8>) -> sp_genesis_builder::Result {
            build_state::<RuntimeGenesisConfig>(config)
        }

        fn get_preset(id: &Option<sp_genesis_builder::PresetId>) -> Option<Vec<u8>> {
            get_preset::<RuntimeGenesisConfig>(id, crate::genesis_config_presets::get_preset)
        }

        fn preset_names() -> Vec<sp_genesis_builder::PresetId> {
            crate::genesis_config_presets::preset_names()
        }
    }

    impl fp_rpc::EthereumRuntimeRPCApi<Block> for Runtime {
        fn chain_id() -> u64 {
            <Runtime as pallet_evm::Config>::ChainId::get()
        }

        fn account_basic(address: H160) -> EVMAccount {
            let (account, _) = pallet_evm::Pallet::<Runtime>::account_basic(&address);
            account
        }

        fn gas_price() -> U256 {
            let (gas_price, _) = <Runtime as pallet_evm::Config>::FeeCalculator::min_gas_price();
            gas_price
        }

        fn account_code_at(address: H160) -> Vec<u8> {
            pallet_evm::AccountCodes::<Runtime>::get(address)
        }

        fn author() -> H160 {
            <pallet_evm::Pallet<Runtime>>::find_author()
        }

        fn storage_at(address: H160, index: U256) -> H256 {
            let tmp = index.to_big_endian();
            pallet_evm::AccountStorages::<Runtime>::get(address, H256::from_slice(&tmp[..]))
        }

        fn call(
            from: H160,
            to: H160,
            data: Vec<u8>,
            value: U256,
            gas_limit: U256,
            max_fee_per_gas: Option<U256>,
            max_priority_fee_per_gas: Option<U256>,
            nonce: Option<U256>,
            estimate: bool,
            access_list: Option<Vec<(H160, Vec<H256>)>>,
        ) -> Result<pallet_evm::CallInfo, sp_runtime::DispatchError> {
            let config = if estimate {
                let mut config = <Runtime as pallet_evm::Config>::config().clone();
                config.estimate = true;
                Some(config)
            } else {
                None
            };
            let is_transactional = false;
            let validate = true;

            // Estimated encoded transaction size must be based on the heaviest transaction
            // type (EIP1559Transaction) to be compatible with all transaction types.
            let mut estimated_transaction_len = data.len() +
                // pallet ethereum index: 1
                // transact call index: 1
                // Transaction enum variant: 1
                // chain_id 8 bytes
                // nonce: 32
                // max_priority_fee_per_gas: 32
                // max_fee_per_gas: 32
                // gas_limit: 32
                // action: 21 (enum varianrt + call address)
                // value: 32
                // access_list: 1 (empty vec size)
                // 65 bytes signature
                258;

            if access_list.is_some() {
                estimated_transaction_len += access_list.encoded_size();
            }

            let gas_limit = gas_limit.min(u64::MAX.into()).low_u64();
            let without_base_extrinsic_weight = true;

            let (weight_limit, proof_size_base_cost) =
                match <Runtime as pallet_evm::Config>::GasWeightMapping::gas_to_weight(
                    gas_limit,
                    without_base_extrinsic_weight
                ) {
                    weight_limit if weight_limit.proof_size() > 0 => {
                        (Some(weight_limit), Some(estimated_transaction_len as u64))
                    }
                    _ => (None, None),
                };

            <Runtime as pallet_evm::Config>::Runner::call(
                from,
                to,
                data,
                value,
                gas_limit,
                max_fee_per_gas,
                max_priority_fee_per_gas,
                nonce,
                access_list.unwrap_or_default(),
                is_transactional,
                validate,
                weight_limit,
                proof_size_base_cost,
                config.as_ref().unwrap_or(<Runtime as pallet_evm::Config>::config()),
            ).map_err(|err| err.error.into())
        }

        fn create(
            from: H160,
            data: Vec<u8>,
            value: U256,
            gas_limit: U256,
            max_fee_per_gas: Option<U256>,
            max_priority_fee_per_gas: Option<U256>,
            nonce: Option<U256>,
            estimate: bool,
            access_list: Option<Vec<(H160, Vec<H256>)>>,
        ) -> Result<pallet_evm::CreateInfo, sp_runtime::DispatchError> {
            let config = if estimate {
                let mut config = <Runtime as pallet_evm::Config>::config().clone();
                config.estimate = true;
                Some(config)
            } else {
                None
            };
            let is_transactional = false;
            let validate = true;

            let gas_limit = if gas_limit > U256::from(u64::MAX) {
                u64::MAX
            } else {
                gas_limit.low_u64()
            };

            let (weight_limit, proof_size_base_cost) = (None, None);

            #[allow(clippy::or_fun_call)]
            <Runtime as pallet_evm::Config>::Runner::create(
                from,
                data,
                value,
                gas_limit,
                max_fee_per_gas,
                max_priority_fee_per_gas,
                nonce,
                access_list.unwrap_or_default(),
                is_transactional,
                validate,
                weight_limit,
                proof_size_base_cost,
                config.as_ref().unwrap_or(<Runtime as pallet_evm::Config>::config()),
            ).map_err(|err| err.error.into())
        }

        fn current_transaction_statuses() -> Option<Vec<TransactionStatus>> {
            pallet_ethereum::CurrentTransactionStatuses::<Runtime>::get()
        }

        fn current_block() -> Option<pallet_ethereum::Block> {
            pallet_ethereum::CurrentBlock::<Runtime>::get()
        }

        fn current_receipts() -> Option<Vec<pallet_ethereum::Receipt>> {
            pallet_ethereum::CurrentReceipts::<Runtime>::get()
        }

        fn current_all() -> (
            Option<pallet_ethereum::Block>,
            Option<Vec<pallet_ethereum::Receipt>>,
            Option<Vec<TransactionStatus>>,
        ) {
            (
                pallet_ethereum::CurrentBlock::<Runtime>::get(),
                pallet_ethereum::CurrentReceipts::<Runtime>::get(),
                pallet_ethereum::CurrentTransactionStatuses::<Runtime>::get()
            )
        }

        fn extrinsic_filter(
            xts: Vec<<Block as BlockT>::Extrinsic>,
        ) -> Vec<EthereumTransaction> {
            xts.into_iter().filter_map(|xt| match xt.0.function {
                RuntimeCall::Ethereum(transact { transaction }) => Some(transaction),
                _ => None
            }).collect::<Vec<EthereumTransaction>>()
        }

        fn elasticity() -> Option<Permill> {
            None
        }

        fn gas_limit_multiplier_support() {}

        fn pending_block(
            xts: Vec<<Block as BlockT>::Extrinsic>,
        ) -> (Option<pallet_ethereum::Block>, Option<Vec<TransactionStatus>>) {
            for ext in xts.into_iter() {
                let _ = Executive::apply_extrinsic(ext);
            }

            Ethereum::on_finalize(System::block_number() + 1);

            (
                pallet_ethereum::CurrentBlock::<Runtime>::get(),
                pallet_ethereum::CurrentTransactionStatuses::<Runtime>::get()
            )
        }

        fn initialize_pending_block(header: &<Block as BlockT>::Header) {
            Executive::initialize_block(header);
        }
    }

    impl fp_rpc::ConvertTransactionRuntimeApi<Block> for Runtime {
        fn convert_transaction(transaction: EthereumTransaction) -> <Block as BlockT>::Extrinsic {
            UncheckedExtrinsic::new_bare(
                pallet_ethereum::Call::<Runtime>::transact { transaction }.into(),
            )
        }
    }

    //╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
    //║                                        STORAGEHUB APIS                                                        ║
    //╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝


    impl pallet_file_system_runtime_api::FileSystemApi<Block, AccountId, BackupStorageProviderId<Runtime>, MainStorageProviderId<Runtime>, H256, BlockNumber, ChunkId, BucketId<Runtime>, StorageRequestMetadata<Runtime>, BucketId<Runtime>, StorageDataUnit<Runtime>, H256> for Runtime {
        fn is_storage_request_open_to_volunteers(file_key: H256) -> Result<bool, IsStorageRequestOpenToVolunteersError> {
            FileSystem::is_storage_request_open_to_volunteers(file_key)
        }

        fn query_earliest_file_volunteer_tick(bsp_id: BackupStorageProviderId<Runtime>, file_key: H256) -> Result<BlockNumber, QueryFileEarliestVolunteerTickError> {
            FileSystem::query_earliest_file_volunteer_tick(bsp_id, file_key)
        }

        fn query_bsp_confirm_chunks_to_prove_for_file(bsp_id: BackupStorageProviderId<Runtime>, file_key: H256) -> Result<Vec<ChunkId>, QueryBspConfirmChunksToProveForFileError> {
            FileSystem::query_bsp_confirm_chunks_to_prove_for_file(bsp_id, file_key)
        }

        fn query_msp_confirm_chunks_to_prove_for_file(msp_id: MainStorageProviderId<Runtime>, file_key: H256) -> Result<Vec<ChunkId>, QueryMspConfirmChunksToProveForFileError> {
            FileSystem::query_msp_confirm_chunks_to_prove_for_file(msp_id, file_key)
        }

        fn query_bsps_volunteered_for_file(file_key: H256) -> Result<Vec<BackupStorageProviderId<Runtime>>, QueryBspsVolunteeredForFileError> {
            FileSystem::query_bsps_volunteered_for_file(file_key)
        }

        fn decode_generic_apply_delta_event_info(encoded_event_info: Vec<u8>) -> Result<BucketId<Runtime>, GenericApplyDeltaEventInfoError> {
            FileSystem::decode_generic_apply_delta_event_info(encoded_event_info)
        }

        fn storage_requests_by_msp(msp_id: MainStorageProviderId<Runtime>) -> BTreeMap<H256, StorageRequestMetadata<Runtime>> {
            FileSystem::storage_requests_by_msp(msp_id)
        }

        fn pending_storage_requests_by_msp(msp_id: MainStorageProviderId<Runtime>) -> BTreeMap<H256, StorageRequestMetadata<Runtime>> {
            FileSystem::pending_storage_requests_by_msp(msp_id)
        }
        fn query_incomplete_storage_request_metadata(file_key: H256) -> Result<pallet_file_system_runtime_api::IncompleteStorageRequestMetadataResponse<AccountId, BucketId<Runtime>, StorageDataUnit<Runtime>, H256, BackupStorageProviderId<Runtime>>, QueryIncompleteStorageRequestMetadataError> {
            FileSystem::query_incomplete_storage_request_metadata(file_key)
        }
    }

    impl pallet_payment_streams_runtime_api::PaymentStreamsApi<Block, ProviderIdFor<Runtime>, Balance, AccountId> for Runtime {
        fn get_users_with_debt_over_threshold(provider_id: &ProviderIdFor<Runtime>, threshold: Balance) -> Result<Vec<AccountId>, GetUsersWithDebtOverThresholdError> {
            PaymentStreams::get_users_with_debt_over_threshold(provider_id, threshold)
        }
        fn get_users_of_payment_streams_of_provider(provider_id: &ProviderIdFor<Runtime>) -> Vec<AccountId> {
            PaymentStreams::get_users_of_payment_streams_of_provider(provider_id)
        }
        fn get_providers_with_payment_streams_with_user(user_account: &AccountId) -> Vec<ProviderIdFor<Runtime>> {
            PaymentStreams::get_providers_with_payment_streams_with_user(user_account)
        }
    }

    impl pallet_proofs_dealer_runtime_api::ProofsDealerApi<Block, ProofsDealerProviderIdFor<Runtime>, BlockNumber, KeyFor<Runtime>, RandomnessOutputFor<Runtime>, CustomChallenge<Runtime>> for Runtime {
        fn get_last_tick_provider_submitted_proof(provider_id: &ProofsDealerProviderIdFor<Runtime>) -> Result<BlockNumber, GetProofSubmissionRecordError> {
            ProofsDealer::get_last_tick_provider_submitted_proof(provider_id)
        }

        fn get_next_tick_to_submit_proof_for(provider_id: &ProofsDealerProviderIdFor<Runtime>) -> Result<BlockNumber, GetProofSubmissionRecordError> {
            ProofsDealer::get_next_tick_to_submit_proof_for(provider_id)
        }

        fn get_last_checkpoint_challenge_tick() -> BlockNumber {
            ProofsDealer::get_last_checkpoint_challenge_tick()
        }

        fn get_checkpoint_challenges(
            tick: BlockNumber
        ) -> Result<Vec<CustomChallenge<Runtime>>, GetCheckpointChallengesError> {
            ProofsDealer::get_checkpoint_challenges(tick)
        }

        fn get_challenge_seed(tick: BlockNumber) -> Result<RandomnessOutputFor<Runtime>, GetChallengeSeedError> {
            ProofsDealer::get_challenge_seed(tick)
        }

        fn get_challenge_period(provider_id: &ProofsDealerProviderIdFor<Runtime>) -> Result<BlockNumber, GetChallengePeriodError> {
            ProofsDealer::get_challenge_period(provider_id)
        }

        fn get_checkpoint_challenge_period() -> BlockNumber {
            ProofsDealer::get_checkpoint_challenge_period()
        }

        fn get_challenges_from_seed(seed: &RandomnessOutputFor<Runtime>, provider_id: &ProofsDealerProviderIdFor<Runtime>, count: u32) -> Vec<KeyFor<Runtime>> {
            ProofsDealer::get_challenges_from_seed(seed, provider_id, count)
        }

        fn get_forest_challenges_from_seed(seed: &RandomnessOutputFor<Runtime>, provider_id: &ProofsDealerProviderIdFor<Runtime>) -> Vec<KeyFor<Runtime>> {
            ProofsDealer::get_forest_challenges_from_seed(seed, provider_id)
        }

        fn get_current_tick() -> BlockNumber {
            ProofsDealer::get_current_tick()
        }

        fn get_next_deadline_tick(provider_id: &ProofsDealerProviderIdFor<Runtime>) -> Result<BlockNumber, GetNextDeadlineTickError> {
            ProofsDealer::get_next_deadline_tick(provider_id)
        }
    }


    impl pallet_storage_providers_runtime_api::StorageProvidersApi<Block, BlockNumber, BackupStorageProviderId<Runtime>, BackupStorageProvider<Runtime>, MainStorageProviderId<Runtime>, AccountId, ProviderIdFor<Runtime>, StorageProviderId<Runtime>, StorageDataUnit<Runtime>, Balance, BucketId<Runtime>, Multiaddresses<Runtime>, ValuePropositionWithId<Runtime>> for Runtime {
        fn get_bsp_info(bsp_id: &BackupStorageProviderId<Runtime>) -> Result<BackupStorageProvider<Runtime>, GetBspInfoError> {
            Providers::get_bsp_info(bsp_id)
        }

        fn get_storage_provider_id(who: &AccountId) -> Option<StorageProviderId<Runtime>> {
            Providers::get_storage_provider_id(who)
        }

        fn query_msp_id_of_bucket_id(bucket_id: &BucketId<Runtime>) -> Result<Option<ProviderIdFor<Runtime>>, QueryMspIdOfBucketIdError> {
            Providers::query_msp_id_of_bucket_id(bucket_id)
        }

        fn query_provider_multiaddresses(provider_id: &ProviderIdFor<Runtime>) -> Result<Multiaddresses<Runtime>, QueryProviderMultiaddressesError> {
            Providers::query_provider_multiaddresses(provider_id)
        }

        fn query_storage_provider_capacity(provider_id: &ProviderIdFor<Runtime>) -> Result<StorageDataUnit<Runtime>, QueryStorageProviderCapacityError> {
            Providers::query_storage_provider_capacity(provider_id)
        }

        fn query_available_storage_capacity(provider_id: &ProviderIdFor<Runtime>) -> Result<StorageDataUnit<Runtime>, QueryAvailableStorageCapacityError> {
            Providers::query_available_storage_capacity(provider_id)
        }

        fn query_earliest_change_capacity_block(provider_id: &BackupStorageProviderId<Runtime>) -> Result<BlockNumber, QueryEarliestChangeCapacityBlockError> {
            Providers::query_earliest_change_capacity_block(provider_id)
        }

        fn get_worst_case_scenario_slashable_amount(provider_id: ProviderIdFor<Runtime>) -> Option<Balance> {
            Providers::get_worst_case_scenario_slashable_amount(&provider_id).ok()
        }

        fn get_slash_amount_per_max_file_size() -> Balance {
            Providers::get_slash_amount_per_max_file_size()
        }

        fn query_value_propositions_for_msp(msp_id: &MainStorageProviderId<Runtime>) -> Vec<ValuePropositionWithId<Runtime>> {
            Providers::query_value_propositions_for_msp(msp_id)
        }

        fn get_bsp_stake(bsp_id: &BackupStorageProviderId<Runtime>) -> Result<Balance, GetStakeError> {
            Providers::get_bsp_stake(bsp_id)
        }

        fn can_delete_provider(provider_id: &ProviderIdFor<Runtime>) -> bool {
            Providers::can_delete_provider(provider_id)
        }

        fn query_buckets_for_msp(msp_id: &MainStorageProviderId<Runtime>) -> Result<Vec<BucketId<Runtime>>, QueryBucketsForMspError> {
            Providers::query_buckets_for_msp(msp_id)
        }

        fn query_buckets_of_user_stored_by_msp(msp_id: &ProviderIdFor<Runtime>, user: &AccountId) -> Result<sp_runtime::Vec<BucketId<Runtime>>, QueryBucketsOfUserStoredByMspError> {
            Ok(sp_runtime::Vec::from_iter(Providers::query_buckets_of_user_stored_by_msp(msp_id, user)?))
        }
    }

}

// Shorthand for a Get field of a pallet Config.
#[macro_export]
macro_rules! get {
    ($pallet:ident, $name:ident, $type:ty) => {
        <<$crate::Runtime as $pallet::Config>::$name as $crate::Get<$type>>::get()
    };
}

#[cfg(test)]
mod tests {
    use crate::configs::ProxyType;
    use codec::Decode;
    use datahaven_runtime_common::gas::BLOCK_STORAGE_LIMIT;

    use super::{
        configs::{BlockGasLimit, WeightPerGas},
        currency::*,
        *,
    };

    #[test]
    fn currency_constants_are_correct() {
        assert_eq!(SUPPLY_FACTOR, 1);

        // txn fees
        assert_eq!(TRANSACTION_BYTE_FEE, Balance::from(1 * GIGAWEI));
        assert_eq!(
            get!(pallet_transaction_payment, OperationalFeeMultiplier, u8),
            5_u8
        );
        assert_eq!(STORAGE_BYTE_FEE, Balance::from(100 * MICROHAVE));

        // pallet_identity deposits
        assert_eq!(
            get!(pallet_identity, BasicDeposit, u128),
            Balance::from(1 * HAVE + 25800 * MICROHAVE)
        );
        assert_eq!(
            get!(pallet_identity, ByteDeposit, u128),
            Balance::from(100 * MICROHAVE)
        );
        assert_eq!(
            get!(pallet_identity, SubAccountDeposit, u128),
            Balance::from(1 * HAVE + 5300 * MICROHAVE)
        );

        // Proxy deposits
        assert_eq!(
            get!(pallet_proxy, ProxyDepositBase, u128),
            Balance::from(1 * HAVE + 800 * MICROHAVE)
        );
        assert_eq!(
            get!(pallet_proxy, ProxyDepositFactor, u128),
            Balance::from(2100 * MICROHAVE)
        );
        assert_eq!(
            get!(pallet_proxy, AnnouncementDepositBase, u128),
            Balance::from(1 * HAVE + 800 * MICROHAVE)
        );
        assert_eq!(
            get!(pallet_proxy, AnnouncementDepositFactor, u128),
            Balance::from(5600 * MICROHAVE)
        );
    }

    #[test]
    fn test_proxy_type_can_be_decoded_from_valid_values() {
        let test_cases = vec![
            // (input, expected)
            (0u8, ProxyType::Any),
            (1, ProxyType::NonTransfer),
            (2, ProxyType::Governance),
            (3, ProxyType::Staking),
            (4, ProxyType::CancelProxy),
            (5, ProxyType::Balances),
            (6, ProxyType::IdentityJudgement),
            (7, ProxyType::SudoOnly),
        ];

        for (input, expected) in test_cases {
            let actual = ProxyType::decode(&mut input.to_le_bytes().as_slice());
            assert_eq!(
                Ok(expected),
                actual,
                "failed decoding ProxyType for value '{}'",
                input
            );
        }
    }

    #[test]
    fn configured_base_extrinsic_weight_is_evm_compatible() {
        let min_ethereum_transaction_weight = WeightPerGas::get() * 21_000;
        let base_extrinsic = <Runtime as frame_system::Config>::BlockWeights::get()
            .get(frame_support::dispatch::DispatchClass::Normal)
            .base_extrinsic;
        assert!(base_extrinsic.ref_time() <= min_ethereum_transaction_weight.ref_time());
    }

    #[test]
    fn test_storage_growth_ratio_is_correct() {
        let expected_storage_growth_ratio = BlockGasLimit::get()
            .low_u64()
            .saturating_div(BLOCK_STORAGE_LIMIT);
        let actual_storage_growth_ratio: u64 =
            <Runtime as pallet_evm::Config>::GasLimitStorageGrowthRatio::get();
        assert_eq!(
            expected_storage_growth_ratio, actual_storage_growth_ratio,
            "Storage growth ratio is not correct"
        );
    }
}
