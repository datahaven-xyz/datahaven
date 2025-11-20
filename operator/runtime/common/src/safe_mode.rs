// Copyright 2025 DataHaven
// This file is part of DataHaven.

// DataHaven is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// DataHaven is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with DataHaven.  If not, see <http://www.gnu.org/licenses/>.

//! Safe Mode and Tx Pause shared types, constants, and utilities

use crate::time::DAYS;
use crate::Balance;
use frame_support::{parameter_types, traits::Contains};
use pallet_tx_pause::RuntimeCallNameOf;
use polkadot_primitives::BlockNumber;
use sp_std::marker::PhantomData;

// Safe Mode Constants
parameter_types! {
    /// Default duration for safe mode activation (1 day)
    pub const SafeModeDuration: BlockNumber = DAYS;
    pub const SafeModeEnterDeposit: Option<Balance> = None;
    /// Safe mode extend deposit - None disables permissionless extend
    pub const SafeModeExtendDeposit: Option<Balance> = None;
    /// Release delay - None disables permissionless release
    pub const ReleaseDelayNone: Option<BlockNumber> = None;
}

/// Calls that cannot be paused by the tx-pause pallet.
pub struct TxPauseWhitelistedCalls<R>(PhantomData<R>);
/// Whitelist `Balances::transfer_keep_alive`, all others are pauseable.
impl<R> Contains<RuntimeCallNameOf<R>> for TxPauseWhitelistedCalls<R>
where
    R: pallet_tx_pause::Config,
{
    fn contains(full_name: &RuntimeCallNameOf<R>) -> bool {
        match (full_name.0.as_slice(), full_name.1.as_slice()) {
            // sudo calls
            (b"Sudo", _) => true,
            // SafeMode calls
            (b"SafeMode", _) => true,
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
