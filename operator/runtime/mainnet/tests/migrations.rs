#[path = "common.rs"]
mod common;

use common::*;
use datahaven_mainnet_runtime::{Runtime, RuntimeCall, RuntimeOrigin};
use frame_support::{assert_noop, assert_ok};
use pallet_migrations::Call as MigrationsCall;
use sp_runtime::{traits::Dispatchable, DispatchError};

#[test]
fn migrations_force_calls_are_root_only() {
    ExtBuilder::default().build().execute_with(|| {
        let call =
            RuntimeCall::MultiBlockMigrations(MigrationsCall::<Runtime>::force_onboard_mbms {});

        assert_noop!(
            call.clone()
                .dispatch(RuntimeOrigin::signed(account_id(ALICE))),
            DispatchError::BadOrigin
        );
        assert_ok!(call.dispatch(RuntimeOrigin::root()));
    });
}
