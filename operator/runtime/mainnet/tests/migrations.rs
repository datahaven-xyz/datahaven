#[path = "common.rs"]
mod common;

use common::*;
use datahaven_mainnet_runtime::{Runtime, RuntimeCall, RuntimeOrigin};
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
