// Copyright (C) Moondance Labs Ltd.
// This file is part of Tanssi.

// Tanssi is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Tanssi is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Tanssi.  If not, see <http://www.gnu.org/licenses/>

//! Runtime API for External Validators Rewards pallet
//!
//! NOTE: This crate is kept for potential future API additions.
//! The previous merkle proof functions have been removed in favor of
//! EigenLayer Rewards V2 distribution.

#![cfg_attr(not(feature = "std"), no_std)]

sp_api::decl_runtime_apis! {
    /// Runtime API for external validators rewards.
    /// The previous merkle proof functions have been removed in favor of
    /// EigenLayer Rewards V2 distribution.
    pub trait ExternalValidatorsRewardsApi {
        /// Returns the current API version.
        /// This is a placeholder to keep the API trait alive.
        fn api_version() -> u32;
    }
}
