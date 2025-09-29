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
    traits::{Contains, Get},
    BoundedVec,
};
use polkadot_primitives::BlockNumber;
use sp_std::{marker::PhantomData, vec, vec::Vec};

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

    /// Safe mode release delay - Some(blocks) enables permissionless release
    /// This is common across all runtimes
    pub const SafeModeReleaseDelayBlocks: Option<BlockNumber> = Some(SafeModeReleaseDelay::get());

}

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

/// Common SafeMode Whitelist Filter - implements Contains<RuntimeCall> for safe mode
/// This filter is identical across all runtimes
pub struct SafeModeWhitelistFilter;

// Note: The actual implementation of Contains<RuntimeCall> for SafeModeWhitelistFilter
// needs to be done in each runtime since it depends on the specific RuntimeCall enum
// for that runtime. This struct is just the common type definition.

/// Get the common TxPause whitelist - calls that cannot be paused
/// This whitelist is identical across all runtimes
pub fn get_common_tx_pause_whitelist() -> Vec<(Vec<u8>, Vec<u8>)> {
    vec![
        // System calls
        (b"System".to_vec(), b"remark".to_vec()),
        (b"System".to_vec(), b"remark_with_event".to_vec()),
        // Consensus calls that must not be paused
        (b"Timestamp".to_vec(), b"set".to_vec()),
        (b"Babe".to_vec(), b"plan_config_change".to_vec()),
        (b"Babe".to_vec(), b"report_equivocation".to_vec()),
        (b"Grandpa".to_vec(), b"report_equivocation".to_vec()),
        // Emergency management calls
        (b"SafeMode".to_vec(), b"enter".to_vec()),
        (b"SafeMode".to_vec(), b"force_enter".to_vec()),
        (b"SafeMode".to_vec(), b"extend".to_vec()),
        (b"SafeMode".to_vec(), b"force_extend".to_vec()),
        (b"SafeMode".to_vec(), b"exit".to_vec()),
        (b"SafeMode".to_vec(), b"force_exit".to_vec()),
        (b"TxPause".to_vec(), b"pause".to_vec()),
        (b"TxPause".to_vec(), b"unpause".to_vec()),
        // Sudo calls for emergency governance
        (b"Sudo".to_vec(), b"sudo".to_vec()),
        (b"Sudo".to_vec(), b"sudo_unchecked_weight".to_vec()),
        (b"Sudo".to_vec(), b"set_key".to_vec()),
    ]
}

/// Combined Call Filter that applies Normal, SafeMode, and TxPause filters
/// This filter is generic over the runtime call type and identical across all runtimes
pub struct RuntimeCallFilter<Call, NormalFilter, SafeModeFilter, TxPauseFilter>(
    PhantomData<(Call, NormalFilter, SafeModeFilter, TxPauseFilter)>,
);

impl<Call, NormalFilter, SafeModeFilter, TxPauseFilter> Contains<Call>
    for RuntimeCallFilter<Call, NormalFilter, SafeModeFilter, TxPauseFilter>
where
    NormalFilter: Contains<Call>,
    SafeModeFilter: Contains<Call>,
    TxPauseFilter: Contains<Call>,
{
    fn contains(call: &Call) -> bool {
        NormalFilter::contains(call)
            && SafeModeFilter::contains(call)
            && TxPauseFilter::contains(call)
    }
}
