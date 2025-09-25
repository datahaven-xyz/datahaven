// Copyright 2019-2025 DataHaven Inc.
// This file is part of DataHaven.

// Moonbeam is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// DataHaven is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Moonbeam.  If not, see <http://www.gnu.org/licenses/>.

//! Safe Mode and Tx Pause shared types, constants, and utilities

use crate::time::{DAYS, HOURS};
use frame_support::{
    parameter_types,
    traits::{Contains, Get, InsideBoth},
    BoundedVec,
};
use polkadot_primitives::BlockNumber;
use sp_std::marker::PhantomData;

/// Maximum length for pallet and call names in safe mode and tx pause configurations
/// Based on analysis of current runtime metadata, longest names are around 30 characters
/// (e.g., "snowbridge_pallet_outbound_queue_v2", "ExternalValidatorsRewards")
/// Setting to 64 to provide headroom for future pallets
pub const MAX_NAME_LEN: u32 = 64;

// Safe Mode Constants
parameter_types! {
    /// Default duration for safe mode activation (1 day)
    pub const SafeModeDuration: BlockNumber = DAYS;

    /// Release delay for safe mode (1 hour) - time before forced release takes effect
    pub const SafeModeReleaseDelay: BlockNumber = HOURS;

    /// Deposit required for entering safe mode (mainnet: high deposit, testnet: lower)
    /// This is a base amount that will be network-specific (1000 HAVE)
    pub const SafeModeBaseDeposit: crate::Balance = 1000 * 1_000_000_000_000_000_000;

    /// Maximum name length for safe mode whitelisted calls
    pub const SafeModeMaxNameLen: u32 = MAX_NAME_LEN;
}

// Tx Pause Constants
parameter_types! {
    /// Maximum name length for tx pause call names
    pub const TxPauseMaxNameLen: u32 = MAX_NAME_LEN;
}

// Shared max blocks used for force enter/extend origins.
parameter_types! {
    /// Default maximum number of blocks used as Success for EnsureRootWithSuccess
    /// in `ForceEnterOrigin` and `ForceExtendOrigin`.
    pub const SafeModeForceMaxBlocks: polkadot_primitives::BlockNumber = 7 * DAYS;
}

/// Composite call filter that combines SafeMode and TxPause filters with existing filters
pub struct SafeModeTxPauseFilter<SafeModeFilter, TxPauseFilter>(
    PhantomData<(SafeModeFilter, TxPauseFilter)>,
);

impl<Call, SafeModeFilter, TxPauseFilter> Contains<Call>
    for SafeModeTxPauseFilter<SafeModeFilter, TxPauseFilter>
where
    SafeModeFilter: Contains<Call>,
    TxPauseFilter: Contains<Call>,
{
    fn contains(call: &Call) -> bool {
        SafeModeFilter::contains(call) && TxPauseFilter::contains(call)
    }
}

/// Alias for the combined safe mode and tx pause filter
pub type RuntimeCallFilter<SafeModeFilter, TxPauseFilter> =
    SafeModeTxPauseFilter<SafeModeFilter, TxPauseFilter>;

/// Helper type for combining with existing call filters
pub type CombinedCallFilter<NormalFilter, SafeModeFilter, TxPauseFilter> =
    InsideBoth<NormalFilter, RuntimeCallFilter<SafeModeFilter, TxPauseFilter>>;

/// Generic TxPause whitelist adapter that implements Contains over call names.
///
/// List is expected to return a Vec<(pallet_name_bytes, call_name_bytes)> and MaxLen
/// bounds the encoded name sizes.
pub struct TxPauseWhitelist<List, MaxLen>(PhantomData<(List, MaxLen)>);

impl<List, MaxLen> Contains<(BoundedVec<u8, MaxLen>, BoundedVec<u8, MaxLen>)>
    for TxPauseWhitelist<List, MaxLen>
where
    List: Get<sp_std::vec::Vec<(sp_std::vec::Vec<u8>, sp_std::vec::Vec<u8>)>>,
    MaxLen: Get<u32>,
{
    fn contains(call_name: &(BoundedVec<u8, MaxLen>, BoundedVec<u8, MaxLen>)) -> bool {
        let (pallet, call) = call_name;
        let list = List::get();
        list.iter().any(|(p_bytes, c_bytes)| {
            p_bytes.as_slice() == pallet.as_slice() && c_bytes.as_slice() == call.as_slice()
        })
    }
}

/// Network-specific safe mode configuration trait
pub trait SafeModeConfig {
    /// The deposit required for entering safe mode
    fn enter_deposit() -> crate::Balance;

    /// The deposit required for extending safe mode
    fn extend_deposit() -> crate::Balance;

    /// Whether permissionless safe mode entry is allowed
    fn allow_permissionless_entry() -> bool;

    /// Whether permissionless safe mode extension is allowed  
    fn allow_permissionless_extend() -> bool;
}

/// Mainnet safe mode configuration - high security, restricted access
pub struct MainnetSafeModeConfig;

impl SafeModeConfig for MainnetSafeModeConfig {
    fn enter_deposit() -> crate::Balance {
        10000 * 1_000_000_000_000_000_000 // High deposit for mainnet (10,000 HAVE)
    }

    fn extend_deposit() -> crate::Balance {
        5000 * 1_000_000_000_000_000_000 // 5,000 HAVE
    }

    fn allow_permissionless_entry() -> bool {
        false // Only governance can enter safe mode on mainnet
    }

    fn allow_permissionless_extend() -> bool {
        false // Only governance can extend safe mode on mainnet
    }
}

/// Stagenet safe mode configuration - moderate security
pub struct StagenetSafeModeConfig;

impl SafeModeConfig for StagenetSafeModeConfig {
    fn enter_deposit() -> crate::Balance {
        1000 * 1_000_000_000_000_000_000 // Lower deposit for stagenet (1,000 HAVE)
    }

    fn extend_deposit() -> crate::Balance {
        500 * 1_000_000_000_000_000_000 // 500 HAVE
    }

    fn allow_permissionless_entry() -> bool {
        true // Allow permissionless entry with deposit
    }

    fn allow_permissionless_extend() -> bool {
        true // Allow permissionless extension with deposit
    }
}

/// Testnet safe mode configuration - low security, easy testing
pub struct TestnetSafeModeConfig;

impl SafeModeConfig for TestnetSafeModeConfig {
    fn enter_deposit() -> crate::Balance {
        100 * 1_000_000_000_000_000_000 // Very low deposit for testnet (100 HAVE)
    }

    fn extend_deposit() -> crate::Balance {
        50 * 1_000_000_000_000_000_000 // 50 HAVE
    }

    fn allow_permissionless_entry() -> bool {
        true // Easy testing
    }

    fn allow_permissionless_extend() -> bool {
        true // Easy testing
    }
}

/// Utility macro to build RuntimeCallNameOf tuples for whitelisting
#[macro_export]
macro_rules! runtime_call_name {
    ($runtime:ty, $pallet:ident, $call:ident) => {
        <$runtime as pallet_safe_mode::Config>::RuntimeCallNameOf::from((
            stringify!($pallet).as_bytes().to_vec().try_into().unwrap(),
            stringify!($call).as_bytes().to_vec().try_into().unwrap(),
        ))
    };
}

/// Helper function to create bounded call name vectors
pub fn bounded_call_name(
    pallet_name: &str,
    call_name: &str,
) -> Result<
    (
        frame_support::BoundedVec<u8, frame_support::traits::ConstU32<MAX_NAME_LEN>>,
        frame_support::BoundedVec<u8, frame_support::traits::ConstU32<MAX_NAME_LEN>>,
    ),
    &'static str,
> {
    use frame_support::{traits::ConstU32, BoundedVec};

    let pallet_bounded: BoundedVec<u8, ConstU32<MAX_NAME_LEN>> = pallet_name
        .as_bytes()
        .to_vec()
        .try_into()
        .map_err(|_| "Pallet name too long")?;

    let call_bounded: BoundedVec<u8, ConstU32<MAX_NAME_LEN>> = call_name
        .as_bytes()
        .to_vec()
        .try_into()
        .map_err(|_| "Call name too long")?;

    Ok((pallet_bounded, call_bounded))
}

/// Helper functions for SafeMode and TxPause governance operations
pub mod helpers {
    use frame_support::{pallet_prelude::*, traits::Get};
    use sp_std::vec::Vec;

    /// Build RuntimeCallNameOf tuple for SafeMode whitelist
    pub fn build_safe_mode_call_name<MaxLen: Get<u32>>(
        pallet_name: &str,
        call_name: &str,
    ) -> Result<(BoundedVec<u8, MaxLen>, BoundedVec<u8, MaxLen>), &'static str> {
        let pallet_bounded: BoundedVec<u8, MaxLen> = pallet_name
            .as_bytes()
            .to_vec()
            .try_into()
            .map_err(|_| "Pallet name too long for SafeMode MaxNameLen")?;

        let call_bounded: BoundedVec<u8, MaxLen> = call_name
            .as_bytes()
            .to_vec()
            .try_into()
            .map_err(|_| "Call name too long for SafeMode MaxNameLen")?;

        Ok((pallet_bounded, call_bounded))
    }

    /// Build RuntimeCallNameOf tuple for TxPause operations
    pub fn build_tx_pause_call_name<MaxLen: Get<u32>>(
        pallet_name: &str,
        call_name: &str,
    ) -> Result<(BoundedVec<u8, MaxLen>, BoundedVec<u8, MaxLen>), &'static str> {
        let pallet_bounded: BoundedVec<u8, MaxLen> = pallet_name
            .as_bytes()
            .to_vec()
            .try_into()
            .map_err(|_| "Pallet name too long for TxPause MaxNameLen")?;

        let call_bounded: BoundedVec<u8, MaxLen> = call_name
            .as_bytes()
            .to_vec()
            .try_into()
            .map_err(|_| "Call name too long for TxPause MaxNameLen")?;

        Ok((pallet_bounded, call_bounded))
    }

    /// Batch build multiple call names for SafeMode whitelist
    pub fn build_safe_mode_whitelist<MaxLen: Get<u32>>(
        calls: &[(&str, &str)],
    ) -> Result<Vec<(BoundedVec<u8, MaxLen>, BoundedVec<u8, MaxLen>)>, &'static str> {
        calls
            .iter()
            .map(|(pallet, call)| build_safe_mode_call_name::<MaxLen>(pallet, call))
            .collect()
    }

    /// Batch build multiple call names for TxPause operations
    pub fn build_tx_pause_whitelist<MaxLen: Get<u32>>(
        calls: &[(&str, &str)],
    ) -> Result<Vec<(BoundedVec<u8, MaxLen>, BoundedVec<u8, MaxLen>)>, &'static str> {
        calls
            .iter()
            .map(|(pallet, call)| build_tx_pause_call_name::<MaxLen>(pallet, call))
            .collect()
    }

    /// Common essential calls that should always be whitelisted in SafeMode
    pub const ESSENTIAL_SAFE_MODE_CALLS: &[(&str, &str)] = &[
        // System calls for basic functionality
        ("System", "remark"),
        ("System", "remark_with_event"),
        // Timestamp for block production
        ("Timestamp", "set"),
        // Consensus calls
        ("Babe", "plan_config_change"),
        ("Babe", "report_equivocation"),
        ("Grandpa", "report_equivocation"),
        // SafeMode management
        ("SafeMode", "exit"),
        ("SafeMode", "force_exit"),
        ("SafeMode", "force_release_deposit"),
        ("SafeMode", "force_slash_deposit"),
        // TxPause management
        ("TxPause", "pause"),
        ("TxPause", "unpause"),
        // Emergency governance
        ("Sudo", "sudo"),
        ("Sudo", "sudo_unchecked_weight"),
    ];

    /// Common calls that should never be paused by TxPause
    pub const ESSENTIAL_TX_PAUSE_WHITELIST: &[(&str, &str)] = &[
        // System calls
        ("System", "remark"),
        ("System", "remark_with_event"),
        // Consensus calls that must not be paused
        ("Timestamp", "set"),
        ("Babe", "plan_config_change"),
        ("Babe", "report_equivocation"),
        ("Grandpa", "report_equivocation"),
        // Emergency management calls
        ("SafeMode", "enter"),
        ("SafeMode", "force_enter"),
        ("SafeMode", "extend"),
        ("SafeMode", "force_extend"),
        ("SafeMode", "exit"),
        ("SafeMode", "force_exit"),
        ("TxPause", "pause"),
        ("TxPause", "unpause"),
        // Emergency governance
        ("Sudo", "sudo"),
        ("Sudo", "sudo_unchecked_weight"),
        ("Sudo", "set_key"),
    ];

    /// Build essential SafeMode whitelist with common calls
    pub fn build_essential_safe_mode_whitelist<MaxLen: Get<u32>>(
    ) -> Result<Vec<(BoundedVec<u8, MaxLen>, BoundedVec<u8, MaxLen>)>, &'static str> {
        build_safe_mode_whitelist::<MaxLen>(ESSENTIAL_SAFE_MODE_CALLS)
    }

    /// Build essential TxPause whitelist with common calls
    pub fn build_essential_tx_pause_whitelist<MaxLen: Get<u32>>(
    ) -> Result<Vec<(BoundedVec<u8, MaxLen>, BoundedVec<u8, MaxLen>)>, &'static str> {
        build_tx_pause_whitelist::<MaxLen>(ESSENTIAL_TX_PAUSE_WHITELIST)
    }

    /// Validate that a call name fits within the MaxNameLen constraint
    pub fn validate_call_name_length<MaxLen: Get<u32>>(
        pallet_name: &str,
        call_name: &str,
    ) -> Result<(), &'static str> {
        let max_len = MaxLen::get() as usize;

        if pallet_name.len() > max_len {
            return Err("Pallet name exceeds MaxNameLen");
        }

        if call_name.len() > max_len {
            return Err("Call name exceeds MaxNameLen");
        }

        Ok(())
    }

    /// Helper to convert string tuples to Vec<u8> tuples for parameter_types! macro
    pub fn string_calls_to_bytes(calls: &[(&str, &str)]) -> Vec<(Vec<u8>, Vec<u8>)> {
        calls
            .iter()
            .map(|(pallet, call)| (pallet.as_bytes().to_vec(), call.as_bytes().to_vec()))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use frame_support::parameter_types;

    parameter_types! {
        pub const TestMaxNameLen: u32 = 32;
    }

    #[test]
    fn test_build_safe_mode_call_name() {
        let result = helpers::build_safe_mode_call_name::<TestMaxNameLen>("System", "remark");
        assert!(result.is_ok());

        let (pallet, call) = result.unwrap();
        assert_eq!(pallet.as_slice(), b"System");
        assert_eq!(call.as_slice(), b"remark");
    }

    #[test]
    fn test_build_tx_pause_call_name() {
        let result = helpers::build_tx_pause_call_name::<TestMaxNameLen>("TxPause", "pause");
        assert!(result.is_ok());

        let (pallet, call) = result.unwrap();
        assert_eq!(pallet.as_slice(), b"TxPause");
        assert_eq!(call.as_slice(), b"pause");
    }

    #[test]
    fn test_validate_call_name_length() {
        // Valid names
        assert!(helpers::validate_call_name_length::<TestMaxNameLen>("System", "remark").is_ok());

        // Invalid names (too long)
        let long_name = "a".repeat(33);
        assert!(
            helpers::validate_call_name_length::<TestMaxNameLen>(&long_name, "remark").is_err()
        );
        assert!(
            helpers::validate_call_name_length::<TestMaxNameLen>("System", &long_name).is_err()
        );
    }

    #[test]
    fn test_build_essential_whitelists() {
        let safe_mode_result = helpers::build_essential_safe_mode_whitelist::<TestMaxNameLen>();
        assert!(safe_mode_result.is_ok());
        assert!(!safe_mode_result.unwrap().is_empty());

        let tx_pause_result = helpers::build_essential_tx_pause_whitelist::<TestMaxNameLen>();
        assert!(tx_pause_result.is_ok());
        assert!(!tx_pause_result.unwrap().is_empty());
    }

    #[test]
    fn test_string_calls_to_bytes() {
        let calls = &[("System", "remark"), ("TxPause", "pause")];
        let result = helpers::string_calls_to_bytes(calls);

        assert_eq!(result.len(), 2);
        assert_eq!(result[0], (b"System".to_vec(), b"remark".to_vec()));
        assert_eq!(result[1], (b"TxPause".to_vec(), b"pause".to_vec()));
    }
}
