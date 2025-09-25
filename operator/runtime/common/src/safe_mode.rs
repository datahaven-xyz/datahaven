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
    traits::{Contains, InsideBoth},
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
