#![cfg_attr(not(feature = "std"), no_std)]
// `construct_runtime!` does a lot of recursion and requires us to increase the limit to 256.
#![recursion_limit = "256"]

extern crate alloc;
#[cfg(feature = "std")]
include!(concat!(env!("OUT_DIR"), "/wasm_binary.rs"));

pub mod apis;
#[cfg(feature = "runtime-benchmarks")]
mod benchmarks;
pub mod configs;

use alloc::{borrow::Cow, vec::Vec};
use sp_runtime::{generic, impl_opaque_keys};
#[cfg(feature = "std")]
use sp_version::NativeVersion;
use sp_version::RuntimeVersion;

pub use frame_system::Call as SystemCall;
pub use pallet_balances::Call as BalancesCall;
pub use pallet_timestamp::Call as TimestampCall;
use sp_core::H160;
#[cfg(any(feature = "std", test))]
pub use sp_runtime::BuildStorage;

pub use datahaven_runtime_common::{
    AccountId, Address, Balance, BlockNumber, Hash, Header, Nonce, Signature,
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
    spec_name: Cow::Borrowed("datahaven-mainnet-runtime"),
    impl_name: Cow::Borrowed("datahaven-mainnet-runtime"),
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
    system_version: 1,
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

// Provide a common factor between runtimes based on a supply of 10_000_000 tokens.
pub const SUPPLY_FACTOR: Balance = 1;

// Unit = the base number of indivisible units for balances
pub const UNIT: Balance = 1_000_000_000_000;
pub const MILLI_UNIT: Balance = 1_000_000_000;
pub const MICRO_UNIT: Balance = 1_000_000;

pub const STORAGE_BYTE_FEE: Balance = 100 * MICRO_UNIT * SUPPLY_FACTOR;

/// Existential deposit.
pub const EXISTENTIAL_DEPOSIT: Balance = MILLI_UNIT;

pub const fn deposit(items: u32, bytes: u32) -> Balance {
    items as Balance * UNIT * SUPPLY_FACTOR + (bytes as Balance) * STORAGE_BYTE_FEE
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

    #[runtime::pallet_index(7)]
    pub type ValidatorSet = pallet_validator_set;

    #[runtime::pallet_index(8)]
    pub type Session = pallet_session;

    #[runtime::pallet_index(9)]
    pub type ImOnline = pallet_im_online;

    #[runtime::pallet_index(10)]
    pub type Grandpa = pallet_grandpa;

    #[runtime::pallet_index(11)]
    pub type TransactionPayment = pallet_transaction_payment;

    #[runtime::pallet_index(20)]
    pub type Utility = pallet_utility;

    #[runtime::pallet_index(21)]
    pub type Scheduler = pallet_scheduler;

    #[runtime::pallet_index(22)]
    pub type Preimage = pallet_preimage;

    #[runtime::pallet_index(23)]
    pub type Identity = pallet_identity;

    #[runtime::pallet_index(24)]
    pub type Multisig = pallet_multisig;

    // Frontier
    #[runtime::pallet_index(30)]
    pub type Ethereum = pallet_ethereum;

    #[runtime::pallet_index(31)]
    pub type Evm = pallet_evm;

    #[runtime::pallet_index(32)]
    pub type EvmChainId = pallet_evm_chain_id;

    // ETH Bridge
    #[runtime::pallet_index(200)]
    pub type Beefy = pallet_beefy;

    #[runtime::pallet_index(201)]
    pub type Mmr = pallet_mmr;

    #[runtime::pallet_index(202)]
    pub type BeefyMmrLeaf = pallet_beefy_mmr;

    #[runtime::pallet_index(203)]
    pub type EthereumBeaconClient = snowbridge_pallet_ethereum_client;

    // Sudo
    #[runtime::pallet_index(255)]
    pub type Sudo = pallet_sudo;
}
