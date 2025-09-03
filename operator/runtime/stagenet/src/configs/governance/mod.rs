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
