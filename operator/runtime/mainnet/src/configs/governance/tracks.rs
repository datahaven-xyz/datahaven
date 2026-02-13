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

//! Track configurations for DataHaven Mainnet Runtime
//!
//! This module defines referendum tracks with different parameters for different
//! types of governance decisions, inspired by Moonbeam's governance structure.

use super::*;
use crate::currency::{HAVE, KILOHAVE, SUPPLY_FACTOR};
use alloc::borrow::Cow;
use core::str::from_utf8;
use core::str::FromStr;
use datahaven_runtime_common::time::*;
use pallet_referenda::Curve;
use pallet_referenda::Track;
use sp_runtime::str_array;

const fn percent(x: i32) -> sp_runtime::FixedI64 {
    sp_runtime::FixedI64::from_rational(x as u128, 100)
}
const fn permill(x: i32) -> sp_runtime::FixedI64 {
    sp_runtime::FixedI64::from_rational(x as u128, 1000)
}

const TRACKS_DATA: [Track<u16, Balance, BlockNumber>; 6] = [
    Track {
        id: 0,
        info: pallet_referenda::TrackInfo {
            // Name of this track.
            name: str_array("root"),
            // A limit for the number of referenda on this track that can be being decided at once.
            // For Root origin this should generally be just one.
            max_deciding: 5,
            // Amount that must be placed on deposit before a decision can be made.
            decision_deposit: 20 * KILOHAVE * SUPPLY_FACTOR,
            // Amount of time this must be submitted for before a decision can be made.
            prepare_period: 1 * DAYS,
            // Amount of time that a decision may take to be approved prior to cancellation.
            decision_period: 14 * DAYS,
            // Amount of time that the approval criteria must hold before it can be approved.
            confirm_period: 1 * DAYS,
            // Minimum amount of time that an approved proposal must be in the dispatch queue.
            min_enactment_period: 1 * DAYS,
            // Minimum aye votes as percentage of overall conviction-weighted votes needed for
            // approval as a function of time into decision period.
            min_approval: Curve::make_reciprocal(4, 14, percent(80), percent(50), percent(100)),
            // Minimum pre-conviction aye-votes ("support") as percentage of overall population that
            // is needed for approval as a function of time into decision period.
            min_support: Curve::make_linear(14, 14, permill(5), percent(25)),
        },
    },
    Track {
        id: 1,
        info: pallet_referenda::TrackInfo {
            name: str_array("whitelisted_caller"),
            max_deciding: 100,
            decision_deposit: 2 * KILOHAVE * SUPPLY_FACTOR,
            prepare_period: 10 * MINUTES,
            decision_period: 14 * DAYS,
            confirm_period: 10 * MINUTES,
            min_enactment_period: 30 * MINUTES,
            min_approval: Curve::make_reciprocal(1, 14, percent(96), percent(50), percent(100)),
            min_support: Curve::make_reciprocal(1, 14 * 24, percent(1), percent(0), percent(2)),
        },
    },
    Track {
        id: 2,
        info: pallet_referenda::TrackInfo {
            name: str_array("general_admin"),
            max_deciding: 10,
            decision_deposit: 100 * HAVE * SUPPLY_FACTOR,
            prepare_period: 1 * HOURS,
            decision_period: 14 * DAYS,
            confirm_period: 1 * DAYS,
            min_enactment_period: 1 * DAYS,
            min_approval: Curve::make_reciprocal(4, 14, percent(80), percent(50), percent(100)),
            min_support: Curve::make_reciprocal(7, 14, percent(10), percent(0), percent(50)),
        },
    },
    Track {
        id: 3,
        info: pallet_referenda::TrackInfo {
            name: str_array("referendum_canceller"),
            max_deciding: 20,
            decision_deposit: 2 * KILOHAVE * SUPPLY_FACTOR,
            prepare_period: 1 * HOURS,
            decision_period: 14 * DAYS,
            confirm_period: 3 * HOURS,
            min_enactment_period: 10 * MINUTES,
            min_approval: Curve::make_reciprocal(1, 14, percent(96), percent(50), percent(100)),
            min_support: Curve::make_reciprocal(1, 14, percent(1), percent(0), percent(10)),
        },
    },
    Track {
        id: 4,
        info: pallet_referenda::TrackInfo {
            name: str_array("referendum_killer"),
            max_deciding: 100,
            decision_deposit: 4 * KILOHAVE * SUPPLY_FACTOR,
            prepare_period: 1 * HOURS,
            decision_period: 14 * DAYS,
            confirm_period: 3 * HOURS,
            min_enactment_period: 10 * MINUTES,
            min_approval: Curve::make_reciprocal(1, 14, percent(96), percent(50), percent(100)),
            min_support: Curve::make_reciprocal(1, 14, percent(1), percent(0), percent(10)),
        },
    },
    Track {
        id: 5,
        info: pallet_referenda::TrackInfo {
            name: str_array("fast_general_admin"),
            max_deciding: 10,
            decision_deposit: 100 * HAVE * SUPPLY_FACTOR,
            prepare_period: 1 * HOURS,
            decision_period: 14 * DAYS,
            confirm_period: 3 * HOURS,
            min_enactment_period: 10 * MINUTES,
            min_approval: Curve::make_reciprocal(4, 14, percent(80), percent(50), percent(100)),
            min_support: Curve::make_reciprocal(5, 14, percent(1), percent(0), percent(50)),
        },
    },
];

pub struct TracksInfo;
impl pallet_referenda::TracksInfo<Balance, BlockNumber> for TracksInfo {
    type Id = u16;
    type RuntimeOrigin = <RuntimeOrigin as frame_support::traits::OriginTrait>::PalletsOrigin;

    fn tracks() -> impl Iterator<Item = Cow<'static, Track<Self::Id, Balance, BlockNumber>>> {
        TRACKS_DATA.iter().map(Cow::Borrowed)
    }
    fn track_for(id: &Self::RuntimeOrigin) -> Result<Self::Id, ()> {
        if let Ok(system_origin) = frame_system::RawOrigin::try_from(id.clone()) {
            match system_origin {
                frame_system::RawOrigin::Root => {
                    if let Some(track) = Self::tracks()
                        .into_iter()
                        .find(|track| track.info.name == str_array("root"))
                    {
                        Ok(track.id)
                    } else {
                        Err(())
                    }
                }
                _ => Err(()),
            }
        } else if let Ok(custom_origin) = custom_origins::Origin::try_from(id.clone()) {
            if let Some(track) = Self::tracks().into_iter().find(|track| {
                let Ok(track_name) = from_utf8(&track.info.name) else {
                    return false;
                };
                let track_name = track_name.trim_end_matches('\0');
                if let Ok(track_custom_origin) = custom_origins::Origin::from_str(track_name) {
                    track_custom_origin == custom_origin
                } else {
                    false
                }
            }) {
                Ok(track.id)
            } else {
                Err(())
            }
        } else {
            Err(())
        }
    }
}

#[test]
/// To ensure voters are always locked into their vote
fn vote_locking_always_longer_than_enactment_period() {
    for track in TRACKS_DATA {
        assert!(
            <Runtime as pallet_conviction_voting::Config>::VoteLockingPeriod::get()
                >= track.min_enactment_period,
            "Track {} has enactment period {} < vote locking period {}",
            track.name,
            track.min_enactment_period,
            <Runtime as pallet_conviction_voting::Config>::VoteLockingPeriod::get(),
        );
    }
}

#[test]
fn all_tracks_have_origins() {
    for track in TRACKS_DATA {
        // check name.into() is successful either converts into "root" or custom origin
        let track_is_root = track.name == "root";
        let track_has_custom_origin = custom_origins::Origin::from_str(track.name).is_ok();
        assert!(track_is_root || track_has_custom_origin);
    }
}
