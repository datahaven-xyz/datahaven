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

//! Governance configuration for DataHaven Testnet Runtime
//!
//! This module contains all governance-related pallet configurations
//! following Moonbeam's approach with separate councils, custom origins,
//! and OpenGov referenda with tracks.

pub mod councils;
pub mod referenda;

use super::*;

mod origins;
pub use origins::{
    custom_origins, GeneralAdmin, ReferendumCanceller, ReferendumKiller, WhitelistedCaller,
};

mod tracks;
pub use tracks::TracksInfo;
