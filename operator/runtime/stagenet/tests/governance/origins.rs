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

//! Origins tests for DataHaven governance system
//!
//! Tests for custom governance origins and combined origins that exist
//! in the actual stagenet runtime configuration.

use crate::common::*;
use datahaven_stagenet_runtime::{
    configs::governance::{
        councils::{TechnicalCommitteeInstance, TreasuryCouncilInstance},
        referenda::{FastGeneralAdminOrRoot, GeneralAdminOrRoot},
        GeneralAdmin, ReferendumCanceller, ReferendumKiller, WhitelistedCaller,
    },
    Runtime, RuntimeOrigin,
};
use frame_support::traits::EnsureOrigin;

/// Test that root origin works for combined origins
#[test]
fn root_origin_works_with_combined_origins() {
    ExtBuilder::default().build().execute_with(|| {
        let root_origin = RuntimeOrigin::root();

        // Test combined origins available in stagenet
        assert!(GeneralAdminOrRoot::try_origin(root_origin.clone()).is_ok());
        assert!(FastGeneralAdminOrRoot::try_origin(root_origin.clone()).is_ok());

        // Test custom origins fail with root (since root != custom origin)
        assert!(GeneralAdmin::try_origin(root_origin.clone()).is_err());
        assert!(ReferendumCanceller::try_origin(root_origin.clone()).is_err());
        assert!(ReferendumKiller::try_origin(root_origin.clone()).is_err());
        assert!(WhitelistedCaller::try_origin(root_origin.clone()).is_err());
    });
}

/// Test general admin origins work correctly
#[test]
fn general_admin_origins_work() {
    ExtBuilder::default().build().execute_with(|| {
        // Test that GeneralAdminOrRoot works with root
        let root_origin = RuntimeOrigin::root();
        assert!(GeneralAdminOrRoot::try_origin(root_origin.clone()).is_ok());

        // Test custom origins from the Origins pallet
        use datahaven_stagenet_runtime::governance::custom_origins;
        let general_admin_origin = RuntimeOrigin::from(custom_origins::Origin::GeneralAdmin);
        assert!(GeneralAdminOrRoot::try_origin(general_admin_origin.clone()).is_ok());
        assert!(FastGeneralAdminOrRoot::try_origin(general_admin_origin.clone()).is_ok());
    });
}

/// Test fast general admin origins work correctly
#[test]
fn fast_general_admin_origins_work() {
    ExtBuilder::default().build().execute_with(|| {
        // Test that FastGeneralAdminOrRoot works with root
        let root_origin = RuntimeOrigin::root();
        assert!(FastGeneralAdminOrRoot::try_origin(root_origin.clone()).is_ok());

        // Test custom origins from the Origins pallet
        use datahaven_stagenet_runtime::governance::custom_origins;
        let fast_admin_origin = RuntimeOrigin::from(custom_origins::Origin::FastGeneralAdmin);
        assert!(FastGeneralAdminOrRoot::try_origin(fast_admin_origin.clone()).is_ok());

        let general_admin_origin = RuntimeOrigin::from(custom_origins::Origin::GeneralAdmin);
        assert!(FastGeneralAdminOrRoot::try_origin(general_admin_origin.clone()).is_ok());
    });
}

/// Test referendum canceller origins work correctly
#[test]
fn referendum_canceller_origins_work() {
    ExtBuilder::default().build().execute_with(|| {
        use datahaven_stagenet_runtime::governance::custom_origins;

        // Test referendum canceller origin
        let canceller_origin = RuntimeOrigin::from(custom_origins::Origin::ReferendumCanceller);
        assert!(ReferendumCanceller::try_origin(canceller_origin.clone()).is_ok());

        // Test that other origins don't work for referendum canceller
        let general_admin_origin = RuntimeOrigin::from(custom_origins::Origin::GeneralAdmin);
        assert!(ReferendumCanceller::try_origin(general_admin_origin.clone()).is_err());

        let killer_origin = RuntimeOrigin::from(custom_origins::Origin::ReferendumKiller);
        assert!(ReferendumCanceller::try_origin(killer_origin.clone()).is_err());
    });
}

/// Test referendum killer origins work correctly
#[test]
fn referendum_killer_origins_work() {
    ExtBuilder::default().build().execute_with(|| {
        use datahaven_stagenet_runtime::governance::custom_origins;

        // Test referendum killer origin
        let killer_origin = RuntimeOrigin::from(custom_origins::Origin::ReferendumKiller);
        assert!(ReferendumKiller::try_origin(killer_origin.clone()).is_ok());

        // Test that other origins don't work for referendum killer
        let general_admin_origin = RuntimeOrigin::from(custom_origins::Origin::GeneralAdmin);
        assert!(ReferendumKiller::try_origin(general_admin_origin.clone()).is_err());

        let canceller_origin = RuntimeOrigin::from(custom_origins::Origin::ReferendumCanceller);
        assert!(ReferendumKiller::try_origin(canceller_origin.clone()).is_err());
    });
}

/// Test whitelisted caller origins work correctly
#[test]
fn whitelisted_caller_origins_work() {
    ExtBuilder::default().build().execute_with(|| {
        use datahaven_stagenet_runtime::governance::custom_origins;

        // Test whitelisted caller origin
        let whitelisted_origin = RuntimeOrigin::from(custom_origins::Origin::WhitelistedCaller);
        assert!(WhitelistedCaller::try_origin(whitelisted_origin.clone()).is_ok());

        // Test that other origins don't work for whitelisted caller
        let general_admin_origin = RuntimeOrigin::from(custom_origins::Origin::GeneralAdmin);
        assert!(WhitelistedCaller::try_origin(general_admin_origin.clone()).is_err());
    });
}

/// Test collective instance types exist and are properly configured
#[test]
fn collective_instances_configured() {
    ExtBuilder::default().build().execute_with(|| {
        let tech_members = vec![alice(), bob(), charlie()];
        let treasury_members = vec![alice(), dave(), eve()];

        setup_technical_committee(tech_members.clone());
        setup_treasury_council(treasury_members.clone());

        // Verify technical committee members
        assert_eq!(
            pallet_collective::Members::<Runtime, TechnicalCommitteeInstance>::get(),
            tech_members
        );

        // Verify treasury council members
        assert_eq!(
            pallet_collective::Members::<Runtime, TreasuryCouncilInstance>::get(),
            treasury_members
        );
    });
}

/// Test signed origins fail for custom origins
#[test]
fn signed_origins_fail_for_custom_origins() {
    ExtBuilder::default().build().execute_with(|| {
        let signed_origin = RuntimeOrigin::signed(alice());

        // Signed origins should fail for all custom origins
        assert!(GeneralAdmin::try_origin(signed_origin.clone()).is_err());
        assert!(ReferendumCanceller::try_origin(signed_origin.clone()).is_err());
        assert!(ReferendumKiller::try_origin(signed_origin.clone()).is_err());
        assert!(WhitelistedCaller::try_origin(signed_origin.clone()).is_err());
        assert!(GeneralAdminOrRoot::try_origin(signed_origin.clone()).is_err());
        assert!(FastGeneralAdminOrRoot::try_origin(signed_origin.clone()).is_err());
    });
}

/// Test all custom origins are distinct
#[test]
fn custom_origins_are_distinct() {
    ExtBuilder::default().build().execute_with(|| {
        use datahaven_stagenet_runtime::governance::custom_origins;

        let general_admin = RuntimeOrigin::from(custom_origins::Origin::GeneralAdmin);
        let fast_general_admin = RuntimeOrigin::from(custom_origins::Origin::FastGeneralAdmin);
        let referendum_canceller = RuntimeOrigin::from(custom_origins::Origin::ReferendumCanceller);
        let referendum_killer = RuntimeOrigin::from(custom_origins::Origin::ReferendumKiller);
        let whitelisted_caller = RuntimeOrigin::from(custom_origins::Origin::WhitelistedCaller);

        // Each origin should only work for its own origin checker
        assert!(GeneralAdmin::try_origin(general_admin.clone()).is_ok());
        assert!(GeneralAdmin::try_origin(fast_general_admin.clone()).is_err());
        assert!(GeneralAdmin::try_origin(referendum_canceller.clone()).is_err());
        assert!(GeneralAdmin::try_origin(referendum_killer.clone()).is_err());
        assert!(GeneralAdmin::try_origin(whitelisted_caller.clone()).is_err());

        assert!(ReferendumCanceller::try_origin(referendum_canceller.clone()).is_ok());
        assert!(ReferendumCanceller::try_origin(general_admin.clone()).is_err());
        assert!(ReferendumCanceller::try_origin(referendum_killer.clone()).is_err());

        assert!(ReferendumKiller::try_origin(referendum_killer.clone()).is_ok());
        assert!(ReferendumKiller::try_origin(referendum_canceller.clone()).is_err());

        assert!(WhitelistedCaller::try_origin(whitelisted_caller.clone()).is_ok());
        assert!(WhitelistedCaller::try_origin(general_admin.clone()).is_err());
    });
}

/// Test origin elevation scenarios (lower privilege cannot become higher)
#[test]
fn origin_elevation_prevented() {
    ExtBuilder::default().build().execute_with(|| {
        use datahaven_stagenet_runtime::governance::custom_origins;

        // GeneralAdmin cannot become ReferendumKiller
        let general_admin = RuntimeOrigin::from(custom_origins::Origin::GeneralAdmin);
        assert!(ReferendumKiller::try_origin(general_admin.clone()).is_err());

        // ReferendumCanceller cannot become ReferendumKiller
        let canceller = RuntimeOrigin::from(custom_origins::Origin::ReferendumCanceller);
        assert!(ReferendumKiller::try_origin(canceller.clone()).is_err());

        // WhitelistedCaller cannot become GeneralAdmin
        let whitelisted = RuntimeOrigin::from(custom_origins::Origin::WhitelistedCaller);
        assert!(GeneralAdmin::try_origin(whitelisted.clone()).is_err());
        assert!(FastGeneralAdminOrRoot::try_origin(whitelisted.clone()).is_err());
    });
}

/// Test combined origins work correctly in practice
#[test]
fn combined_origins_practical_usage() {
    ExtBuilder::default().build().execute_with(|| {
        use datahaven_stagenet_runtime::governance::custom_origins;

        // GeneralAdminOrRoot should accept both GeneralAdmin and Root
        let root = RuntimeOrigin::root();
        let general_admin = RuntimeOrigin::from(custom_origins::Origin::GeneralAdmin);

        assert!(GeneralAdminOrRoot::try_origin(root.clone()).is_ok());
        assert!(GeneralAdminOrRoot::try_origin(general_admin.clone()).is_ok());

        // But not other origins
        let canceller = RuntimeOrigin::from(custom_origins::Origin::ReferendumCanceller);
        assert!(GeneralAdminOrRoot::try_origin(canceller.clone()).is_err());

        // FastGeneralAdminOrRoot should accept Root, GeneralAdmin, and FastGeneralAdmin
        let fast_admin = RuntimeOrigin::from(custom_origins::Origin::FastGeneralAdmin);
        assert!(FastGeneralAdminOrRoot::try_origin(root.clone()).is_ok());
        assert!(FastGeneralAdminOrRoot::try_origin(general_admin.clone()).is_ok());
        assert!(FastGeneralAdminOrRoot::try_origin(fast_admin.clone()).is_ok());

        // But not unrelated origins
        assert!(FastGeneralAdminOrRoot::try_origin(canceller.clone()).is_err());
    });
}

/// Test origin conversion to track IDs for referenda
#[test]
fn origin_to_track_conversion() {
    ExtBuilder::default().build().execute_with(|| {
        use datahaven_stagenet_runtime::governance::{custom_origins, TracksInfo};
        use frame_support::traits::OriginTrait;
        use pallet_referenda::TracksInfo as TracksInfoTrait;

        // Root origin maps to track 0
        let root_origin = RuntimeOrigin::root();
        let root_caller = root_origin.caller();
        assert_eq!(TracksInfo::track_for(root_caller), Ok(0u16));

        // WhitelistedCaller maps to track 1
        let whitelisted_origin = RuntimeOrigin::from(custom_origins::Origin::WhitelistedCaller);
        let whitelisted_caller = whitelisted_origin.caller();
        assert_eq!(TracksInfo::track_for(whitelisted_caller), Ok(1u16));

        // GeneralAdmin maps to track 2
        let admin_origin = RuntimeOrigin::from(custom_origins::Origin::GeneralAdmin);
        let admin_caller = admin_origin.caller();
        assert_eq!(TracksInfo::track_for(admin_caller), Ok(2u16));

        // ReferendumCanceller maps to track 3
        let canceller_origin = RuntimeOrigin::from(custom_origins::Origin::ReferendumCanceller);
        let canceller_caller = canceller_origin.caller();
        assert_eq!(TracksInfo::track_for(canceller_caller), Ok(3u16));

        // ReferendumKiller maps to track 4
        let killer_origin = RuntimeOrigin::from(custom_origins::Origin::ReferendumKiller);
        let killer_caller = killer_origin.caller();
        assert_eq!(TracksInfo::track_for(killer_caller), Ok(4u16));

        // FastGeneralAdmin maps to track 5
        let fast_admin_origin = RuntimeOrigin::from(custom_origins::Origin::FastGeneralAdmin);
        let fast_admin_caller = fast_admin_origin.caller();
        assert_eq!(TracksInfo::track_for(fast_admin_caller), Ok(5u16));

        // Signed origin should not map to any track
        let signed_origin = RuntimeOrigin::signed(alice());
        let signed_caller = signed_origin.caller();
        assert!(TracksInfo::track_for(signed_caller).is_err());
    });
}
