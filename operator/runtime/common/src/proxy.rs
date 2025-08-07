//! Custom proxy types for DataHaven runtimes

use codec::{Decode, Encode, MaxEncodedLen};
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;

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

// The actual InstanceFilter implementation is provided by each runtime
// since they have different RuntimeCall enums
