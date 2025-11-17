// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;

/// Basic operating modes for a bridges module (Normal/Halted).
#[derive(
    Encode,
    Decode,
    DecodeWithMemTracking,
    Clone,
    Copy,
    PartialEq,
    Eq,
    RuntimeDebug,
    TypeInfo,
    MaxEncodedLen,
)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub enum BasicOperatingMode {
    /// Normal mode, when all operations are allowed.
    Normal,
    /// The pallet is halted. All non-governance operations are disabled.
    Halted,
}

impl Default for BasicOperatingMode {
    fn default() -> Self {
        Self::Normal
    }
}

impl BasicOperatingMode {
    pub fn is_halted(&self) -> bool {
        *self == BasicOperatingMode::Halted
    }
}

/// Check whether the export message is paused based on the status of the basic operating mode.
pub trait ExportPausedQuery {
    fn is_paused() -> bool;
}
