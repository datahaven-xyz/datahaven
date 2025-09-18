use crate::common::*;
use datahaven_mainnet_runtime::{pallet_migrations, RuntimeCall, RuntimeOrigin};
use frame_support::{assert_noop, assert_ok};
use sp_runtime::DispatchError;

#[test]
fn migrations_force_calls_are_root_only() {
    ExtBuilder::default().build().execute_with(|| {
        let call = RuntimeCall::MultiBlockMigrations(pallet_migrations::Call::force_onboard_mbms {});

        assert_noop!(call.clone().dispatch(RuntimeOrigin::signed(account_id(ALICE))), DispatchError::BadOrigin);
        assert_ok!(call.dispatch(RuntimeOrigin::root()));
    });
}
