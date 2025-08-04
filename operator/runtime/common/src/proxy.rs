// Copyright 2019-2025 PureStake Inc.
// This file is part of Moonbeam.

// Moonbeam is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Moonbeam is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Moonbeam.  If not, see <http://www.gnu.org/licenses/>.

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
    /// Allow only identity-related calls
    Identity = 4,
    /// Allow only calls that cancel proxy announcements and reject announcements
    CancelProxy = 5,
    /// Allow only Balances calls (transfers, set_balance, force_transfer, etc.)
    Balances = 6,
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