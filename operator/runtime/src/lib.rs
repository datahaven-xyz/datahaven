#![cfg_attr(not(feature = "std"), no_std)]

// `frame_support::runtime` does a lot of recursion and requires us to increase the limit to 256.
#![recursion_limit = "256"]

#[cfg(feature = "std")]
include!(concat!(env!("OUT_DIR"), "/wasm_binary.rs"));

pub mod apis;
#[cfg(feature = "runtime-benchmarks")]
mod benchmarks;
pub mod configs;

extern crate alloc;
use alloc::vec::Vec;
use smallvec::smallvec;
use sp_runtime::{
    create_runtime_str, generic, impl_opaque_keys,
    traits::{BlakeTwo256, IdentifyAccount, Verify},
    MultiAddress,
};
use sp_std::prelude::*;
use frame_support::weights::{WeightToFeeCoefficient, WeightToFeeCoefficients,
    WeightToFeePolynomial,
};
use frame_support::weights::constants::ExtrinsicBaseWeight;
use sp_runtime::Perbill;

#[cfg(feature = "std")]
use sp_version::NativeVersion;
use sp_version::RuntimeVersion;

use fp_account::EthereumSignature;
pub use frame_system::Call as SystemCall;
pub use pallet_balances::Call as BalancesCall;
pub use pallet_timestamp::Call as TimestampCall;
#[cfg(any(feature = "std", test))]
pub use sp_runtime::BuildStorage;
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
        pub beefy: Beefy,
    }
}

// To learn more about runtime versioning, see:
// https://docs.substrate.io/main-docs/build/upgrade#runtime-versioning
#[sp_version::runtime_version]
pub const VERSION: RuntimeVersion = RuntimeVersion {
    spec_name: create_runtime_str!("datahaven-runtime"),
    impl_name: create_runtime_str!("datahaven-runtime"),
    authoring_version: 1,
    // The version of the runtime specification. A full node will not attempt to use its native
    //   runtime in substitute for the on-chain Wasm runtime unless all of `spec_name`,
    //   `spec_version`, and `authoring_version` are the same between Wasm and native.
    // This value is set to 100 to notify Polkadot-JS App (https://polkadot.js.org/apps) to use
    //   the compatible custom types.
    spec_version: 100,
    impl_version: 1,
    apis: apis::RUNTIME_API_VERSIONS,
    transaction_version: 1,
    state_version: 1,
};

mod block_times {
    /// This determines the average expected block time that we are targeting. Blocks will be
    /// produced at a minimum duration defined by `SLOT_DURATION`. `SLOT_DURATION` is picked up by
    /// `pallet_timestamp` which is in turn picked up by `pallet_babe` to implement `fn
    /// slot_duration()`.
    ///
    /// Change this to adjust the block time.
    pub const MILLI_SECS_PER_BLOCK: u64 = 6000;

    // NOTE: Currently it is not possible to change the slot duration after the chain has started.
    // Attempting to do so will brick block production.
    pub const SLOT_DURATION: u64 = MILLI_SECS_PER_BLOCK;
}
pub use block_times::*;

// Time is measured by number of blocks.
pub const MINUTES: BlockNumber = 60_000 / (MILLI_SECS_PER_BLOCK as BlockNumber);
pub const HOURS: BlockNumber = MINUTES * 60;
pub const DAYS: BlockNumber = HOURS * 24;

pub const BLOCK_HASH_COUNT: BlockNumber = 2400;

// Unit = the base number of indivisible units for balances
pub const UNIT: Balance = 1_000_000_000_000;
pub const CENTS: Balance = UNIT / 100;
pub const MILLIUNIT: Balance = 1_000_000_000;
pub const MICROUNIT: Balance = 1_000_000;
pub const NANOUNIT: Balance = 1_000;
pub const PICOUNIT: Balance = 1;

/// Existential deposit.
pub const EXISTENTIAL_DEPOSIT: Balance = MILLIUNIT;

/// The version information used to identify this runtime when compiled natively.
#[cfg(feature = "std")]
pub fn native_version() -> NativeVersion {
    NativeVersion {
        runtime_version: VERSION,
        can_author_with: Default::default(),
    }
}

/// Alias to 512-bit hash when used in the context of a transaction signature on the chain.
pub type Signature = EthereumSignature;

/// Some way of identifying an account on the chain. We intentionally make it equivalent
/// to the public key of our transaction signing scheme.
pub type AccountId = <<Signature as Verify>::Signer as IdentifyAccount>::AccountId;

/// Balance of an account.
pub type Balance = u128;

/// Index of a transaction in the chain.
pub type Nonce = u32;

/// A hash of some data used by the chain.
pub type Hash = sp_core::H256;

/// The hashing algorithm used.
pub type Hashing = BlakeTwo256;

/// An index to a block.
pub type BlockNumber = u32;

/// The address format for describing accounts.
pub type Address = MultiAddress<AccountId, ()>;

/// Block header type as expected by this runtime.
pub type Header = generic::Header<BlockNumber, BlakeTwo256>;

/// Block type as expected by this runtime.
pub type Block = generic::Block<Header, UncheckedExtrinsic>;

/// A Block signed with a Justification
pub type SignedBlock = generic::SignedBlock<Block>;

/// BlockId type as expected by this runtime.
pub type BlockId = generic::BlockId<Block>;

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
    generic::UncheckedExtrinsic<Address, RuntimeCall, Signature, SignedExtra>;

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
        // in Rococo, extrinsic base weight (smallest non-zero weight) is mapped to 1 MILLIUNIT:
        // in our template, we map to 1/10 of that, or 1/10 MILLIUNIT
        let p = MILLIUNIT / 10;
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
#[cfg(not(feature = "storage-hub"))]
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

    #[runtime::pallet_index(0)]
    pub type System = frame_system;

    #[runtime::pallet_index(1)]
    pub type Timestamp = pallet_timestamp;

    #[runtime::pallet_index(2)]
    pub type Balances = pallet_balances;

    #[runtime::pallet_index(3)]
    pub type Babe = pallet_babe;

    // TODO! Add the following palllets to the runtime:
    // Authorship must be before session in order to note author in the correct session and era.
    // pub type Authorship = pallet_authorship;
    // pub type Offences = pallet_offences;
    #[runtime::pallet_index(4)]
    pub type Historical = pallet_session::historical;

    #[runtime::pallet_index(5)]
    pub type ValidatorSet = pallet_validator_set;

    #[runtime::pallet_index(6)]
    pub type Session = pallet_session;

    #[runtime::pallet_index(7)]
    pub type Grandpa = pallet_grandpa;

    #[runtime::pallet_index(8)]
    pub type TransactionPayment = pallet_transaction_payment;

    #[runtime::pallet_index(9)]
    pub type Sudo = pallet_sudo;

    #[runtime::pallet_index(10)]
    pub type Beefy = pallet_beefy;

    #[runtime::pallet_index(11)]
    pub type BeefyMmrLeaf = pallet_beefy_mmr;

    #[runtime::pallet_index(12)]
    pub type Mmr = pallet_mmr;

    #[runtime::pallet_index(13)]
    pub type EthereumBeaconClient = snowbridge_pallet_ethereum_client;

    #[runtime::pallet_index(31)]
    pub type Ethereum = pallet_ethereum;

    #[runtime::pallet_index(32)]
    pub type Evm = pallet_evm;

    #[runtime::pallet_index(33)]
    pub type EvmChainId = pallet_evm_chain_id;
}


#[frame_support::runtime]
#[cfg(feature = "storage-hub")]
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

    #[runtime::pallet_index(0)]
    pub type System = frame_system;

    #[runtime::pallet_index(1)]
    pub type Timestamp = pallet_timestamp;

    #[runtime::pallet_index(2)]
    pub type Balances = pallet_balances;

    #[runtime::pallet_index(3)]
    pub type Babe = pallet_babe;

    // TODO! Add the following palllets to the runtime:
    // Authorship must be before session in order to note author in the correct session and era.
    // pub type Authorship = pallet_authorship;
    // pub type Offences = pallet_offences;
    #[runtime::pallet_index(4)]
    pub type Historical = pallet_session::historical;

    #[runtime::pallet_index(5)]
    pub type ValidatorSet = pallet_validator_set;

    #[runtime::pallet_index(6)]
    pub type Session = pallet_session;

    #[runtime::pallet_index(7)]
    pub type Grandpa = pallet_grandpa;

    #[runtime::pallet_index(8)]
    pub type TransactionPayment = pallet_transaction_payment;

    #[runtime::pallet_index(9)]
    pub type Sudo = pallet_sudo;

    #[runtime::pallet_index(10)]
    pub type Beefy = pallet_beefy;

    #[runtime::pallet_index(11)]
    pub type BeefyMmrLeaf = pallet_beefy_mmr;

    #[runtime::pallet_index(12)]
    pub type Mmr = pallet_mmr;

    #[runtime::pallet_index(13)]
    pub type EthereumBeaconClient = snowbridge_pallet_ethereum_client;

    #[runtime::pallet_index(31)]
    pub type Ethereum = pallet_ethereum;

    #[runtime::pallet_index(32)]
    pub type Evm = pallet_evm;

    #[runtime::pallet_index(33)]
    pub type EvmChainId = pallet_evm_chain_id;

    // Storage Hub
    #[runtime::pallet_index(40)]
    pub type Providers = pallet_storage_providers;
    #[runtime::pallet_index(41)]
    pub type FileSystem = pallet_file_system;
    #[runtime::pallet_index(42)]
    pub type ProofsDealer = pallet_proofs_dealer;
    #[runtime::pallet_index(43)]
    pub type Randomness = pallet_randomness;
    #[runtime::pallet_index(44)]
    pub type PaymentStreams = pallet_payment_streams;
    #[runtime::pallet_index(45)]
    pub type BucketNfts = pallet_bucket_nfts;
    #[runtime::pallet_index(50)]
    pub type Nfts = pallet_nfts;
    #[runtime::pallet_index(51)]
    pub type Parameters = pallet_parameters;
}