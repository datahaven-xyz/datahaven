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

#[path = "common.rs"]
mod common;

use common::*;
use datahaven_stagenet_runtime::{
    Runtime, RuntimeCall, RuntimeEvent, RuntimeOrigin, SafeMode, System,
};
use frame_support::{assert_noop, assert_ok};
use pallet_migrations::{Call as MigrationsCall, HistoricCleanupSelector};
use sp_runtime::{traits::Dispatchable, DispatchError};

#[test]
fn migrations_force_calls_are_root_only() {
    ExtBuilder::default().build().execute_with(|| {
        let signed_origin = RuntimeOrigin::signed(account_id(ALICE));

        let force_onboard =
            RuntimeCall::MultiBlockMigrations(MigrationsCall::<Runtime>::force_onboard_mbms {});
        assert_noop!(
            force_onboard.clone().dispatch(signed_origin.clone()),
            DispatchError::BadOrigin
        );
        assert_ok!(force_onboard.dispatch(RuntimeOrigin::root()));

        let force_set_cursor =
            RuntimeCall::MultiBlockMigrations(MigrationsCall::<Runtime>::force_set_cursor {
                cursor: None,
            });
        assert_noop!(
            force_set_cursor.clone().dispatch(signed_origin.clone()),
            DispatchError::BadOrigin
        );
        assert_ok!(force_set_cursor.dispatch(RuntimeOrigin::root()));

        let force_set_active =
            RuntimeCall::MultiBlockMigrations(MigrationsCall::<Runtime>::force_set_active_cursor {
                index: 0,
                inner_cursor: None,
                started_at: None,
            });
        assert_noop!(
            force_set_active.clone().dispatch(signed_origin.clone()),
            DispatchError::BadOrigin
        );
        assert_ok!(force_set_active.dispatch(RuntimeOrigin::root()));

        let clear_historic =
            RuntimeCall::MultiBlockMigrations(MigrationsCall::<Runtime>::clear_historic {
                selector: HistoricCleanupSelector::Specific(Vec::new()),
            });
        assert_noop!(
            clear_historic.clone().dispatch(signed_origin),
            DispatchError::BadOrigin
        );
        assert_ok!(clear_historic.dispatch(RuntimeOrigin::root()));
    });
}

#[test]
fn failed_migration_enters_safe_mode() {
    ExtBuilder::default().build().execute_with(|| {
        // Verify SafeMode is not active initially
        assert!(
            !SafeMode::is_entered(),
            "SafeMode should not be active initially"
        );

        // Simulate a failed migration by directly calling the FailedMigrationHandler
        // This tests that when migrations fail, the system enters SafeMode
        use frame_support::migrations::FailedMigrationHandler;
        type Handler = <Runtime as pallet_migrations::Config>::FailedMigrationHandler;

        // Call the failed handler (simulating a migration failure)
        let result = Handler::failed(Some(0));

        // The handler should indicate that SafeMode was entered
        assert_eq!(
            result,
            frame_support::migrations::FailedMigrationHandling::KeepStuck,
            "Handler should keep the chain stuck in SafeMode"
        );

        // Verify that SafeMode is now active
        assert!(
            SafeMode::is_entered(),
            "SafeMode should be active after migration failure"
        );

        // Get the block number when SafeMode should expire
        let entered_until = pallet_safe_mode::EnteredUntil::<Runtime>::get();
        assert!(
            entered_until.is_some(),
            "SafeMode should have an expiry block"
        );

        // Verify that the SafeMode event was emitted
        let events = System::events();
        assert!(
            events.iter().any(|e| matches!(
                e.event,
                RuntimeEvent::SafeMode(pallet_safe_mode::Event::Entered { .. })
            )),
            "SafeMode::Entered event should be emitted"
        );
    });
}

#[test]
fn safe_mode_allows_governance_during_migration_failure() {
    ExtBuilder::default().build().execute_with(|| {
        // Simulate a failed migration
        use frame_support::migrations::FailedMigrationHandler;
        type Handler = <Runtime as pallet_migrations::Config>::FailedMigrationHandler;
        Handler::failed(Some(0));

        // Verify SafeMode is active
        assert!(SafeMode::is_entered(), "SafeMode should be active");

        // Test that SafeMode management calls are still allowed
        let force_exit_call = RuntimeCall::SafeMode(pallet_safe_mode::Call::force_exit {});
        let result = force_exit_call.dispatch(RuntimeOrigin::root());
        assert_ok!(result);

        // Verify SafeMode is now inactive
        assert!(
            !SafeMode::is_entered(),
            "SafeMode should be inactive after force exit"
        );
    });
}
