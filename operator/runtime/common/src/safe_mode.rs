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
use pallet_tx_pause::RuntimeCallNameOf;
use polkadot_primitives::BlockNumber;
use sp_std::marker::PhantomData;

// Safe Mode Constants
parameter_types! {
    /// Default duration for safe mode activation (1 day)
    pub const SafeModeDuration: BlockNumber = DAYS;

    /// Release delay for safe mode (1 hour) - time before forced release takes effect
    pub const SafeModeReleaseDelay: BlockNumber = HOURS;

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

/// Calls that cannot be paused by the tx-pause pallet.
pub struct TxPauseWhitelistedCalls<R>(PhantomData<R>);
/// Whitelist `Balances::transfer_keep_alive`, all others are pauseable.
impl<R> Contains<RuntimeCallNameOf<R>> for TxPauseWhitelistedCalls<R>
where
    R: pallet_tx_pause::Config,
{
    fn contains(full_name: &RuntimeCallNameOf<R>) -> bool {
        match (full_name.0.as_slice(), full_name.1.as_slice()) {
            (b"Balances", b"transfer_keep_alive") => true,
            // sudo calls
            (b"Sudo", b"sudo") => true,
            (b"Sudo", b"sudo_unchecked_weight") => true,
            (b"Sudo", b"set_key") => true,
            // SafeMode calls
            (b"SafeMode", b"enter") => true,
            (b"SafeMode", b"force_enter") => true,
            (b"SafeMode", b"extend") => true,
            (b"SafeMode", b"force_extend") => true,
            (b"SafeMode", b"exit") => true,
            (b"SafeMode", b"force_exit") => true,
            _ => false,
        }
    }
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
