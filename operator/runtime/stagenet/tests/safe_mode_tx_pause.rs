#![allow(clippy::too_many_arguments)]

#[path = "common.rs"]
mod common;

use common::{account_id, ExtBuilder, ALICE, BOB};
use datahaven_stagenet_runtime::{
    Runtime, RuntimeCall, RuntimeEvent, RuntimeOrigin, SafeMode, System, TxPause,
};
use frame_support::{assert_noop, assert_ok};
use pallet_safe_mode::EnteredUntil;
use pallet_tx_pause::{CallNameOf, Error as TxPauseError};
use sp_runtime::{
    traits::Dispatchable,
    transaction_validity::{InvalidTransaction, TransactionSource, TransactionValidityError},
};
use sp_transaction_pool::runtime_api::runtime_decl_for_tagged_transaction_queue::TaggedTransactionQueueV3;

fn call_name(call: &RuntimeCall) -> CallNameOf<Runtime> {
    TxPause::call_name(call).expect("call name should resolve for runtime call")
}

fn transfer_call(amount: u128) -> RuntimeCall {
    RuntimeCall::Balances(pallet_balances::Call::transfer_keep_alive {
        dest: account_id(BOB),
        value: amount,
    })
}

mod safe_mode {
    use super::*;

    #[test]
    fn force_enter_requires_root() {
        ExtBuilder::default()
            .with_sudo(account_id(ALICE))
            .build()
            .execute_with(|| {
                assert_ok!(
                    RuntimeCall::SafeMode(pallet_safe_mode::Call::force_enter {})
                        .dispatch(RuntimeOrigin::root())
                );

                assert_noop!(
                    RuntimeCall::SafeMode(pallet_safe_mode::Call::force_enter {})
                        .dispatch(RuntimeOrigin::signed(account_id(ALICE))),
                    sp_runtime::DispatchError::BadOrigin
                );

                assert!(EnteredUntil::<Runtime>::get().is_some());
                System::assert_last_event(RuntimeEvent::SafeMode(pallet_safe_mode::Event::<
                    Runtime,
                >::Entered {
                    until: EnteredUntil::<Runtime>::get().unwrap(),
                }));
            });
    }

    #[test]
    fn active_safe_mode_blocks_non_whitelisted_calls() {
        ExtBuilder::default()
            .with_sudo(account_id(ALICE))
            .build()
            .execute_with(|| {
                assert_ok!(pallet_safe_mode::Call::<Runtime>::force_enter {}
                    .dispatch(RuntimeOrigin::root()));

                let xt = transfer_call(1u128);
                let validity = Runtime::validate_transaction(
                    TransactionSource::External,
                    xt.clone().into(),
                    Default::default(),
                );
                assert_eq!(
                    validity,
                    Err(TransactionValidityError::Invalid(InvalidTransaction::Call))
                );
            });
    }

    #[test]
    fn whitelisted_calls_dispatch_in_safe_mode() {
        ExtBuilder::default()
            .with_sudo(account_id(ALICE))
            .build()
            .execute_with(|| {
                assert_ok!(
                    RuntimeCall::SafeMode(pallet_safe_mode::Call::force_enter {})
                        .dispatch(RuntimeOrigin::root())
                );

                assert_ok!(RuntimeCall::SafeMode(pallet_safe_mode::Call::force_exit {})
                    .dispatch(RuntimeOrigin::root()));

                assert!(EnteredUntil::<Runtime>::get().is_none());
            });
    }
}

mod tx_pause {
    use super::*;

    #[test]
    fn pause_requires_root() {
        ExtBuilder::default().build().execute_with(|| {
            let call = transfer_call(1u128);
            let call_name = call_name(&call);

            assert_ok!(RuntimeCall::TxPause(pallet_tx_pause::Call::pause_call {
                call_name: call_name.clone(),
                reason: None,
            })
            .dispatch(RuntimeOrigin::root()));

            assert_noop!(
                RuntimeCall::TxPause(pallet_tx_pause::Call::pause_call {
                    call_name: call_name.clone(),
                    reason: None,
                })
                .dispatch(RuntimeOrigin::signed(account_id(ALICE))),
                sp_runtime::DispatchError::BadOrigin
            );

            assert_ok!(
                RuntimeCall::TxPause(pallet_tx_pause::Call::unpause_call { call_name })
                    .dispatch(RuntimeOrigin::root())
            );
        });
    }

    #[test]
    fn paused_call_is_blocked() {
        ExtBuilder::default().build().execute_with(|| {
            let call = transfer_call(1u128);
            let call_name = call_name(&call);

            assert_ok!(pallet_tx_pause::Call::<Runtime>::pause_call {
                call_name: call_name.clone(),
                reason: None,
            }
            .dispatch(RuntimeOrigin::root()));

            assert_eq!(
                Runtime::validate_transaction(
                    TransactionSource::External,
                    call.clone().into(),
                    Default::default()
                ),
                Err(TransactionValidityError::Invalid(InvalidTransaction::Call))
            );

            assert_noop!(
                call.dispatch(RuntimeOrigin::signed(account_id(ALICE))),
                TxPauseError::<Runtime>::IsPaused
            );

            assert_ok!(pallet_tx_pause::Call::<Runtime>::unpause_call { call_name }
                .dispatch(RuntimeOrigin::root()));

            assert_ok!(Runtime::validate_transaction(
                TransactionSource::External,
                call.into(),
                Default::default()
            ));
        });
    }

    #[test]
    fn whitelisted_call_cannot_be_paused() {
        ExtBuilder::default().build().execute_with(|| {
            let call = RuntimeCall::SafeMode(pallet_safe_mode::Call::force_exit {});
            let call_name = call_name(&call);

            assert_noop!(
                RuntimeCall::TxPause(pallet_tx_pause::Call::pause_call {
                    call_name,
                    reason: None,
                })
                .dispatch(RuntimeOrigin::root()),
                TxPauseError::<Runtime>::Unpausable
            );
        });
    }
}

mod combined_behaviour {
    use super::*;

    #[test]
    fn dual_restrictions_require_both_to_clear() {
        ExtBuilder::default()
            .with_sudo(account_id(ALICE))
            .build()
            .execute_with(|| {
                assert_ok!(pallet_safe_mode::Call::<Runtime>::force_enter {}
                    .dispatch(RuntimeOrigin::root()));

                let call = transfer_call(1u128);
                let call_name = call_name(&call);

                assert_ok!(pallet_tx_pause::Call::<Runtime>::pause_call {
                call_name: call_name.clone(),
                    reason: None,
                }
                .dispatch(RuntimeOrigin::root()));

                let validity = Runtime::validate_transaction(
                    TransactionSource::External,
                    call.clone().into(),
                    Default::default(),
                );
                assert_eq!(
                    validity,
                    Err(TransactionValidityError::Invalid(InvalidTransaction::Call))
                );

                assert_ok!(pallet_tx_pause::Call::<Runtime>::unpause_call {
                call_name: call_name.clone()
                }
                .dispatch(RuntimeOrigin::root()));

                let still_blocked = Runtime::validate_transaction(
                    TransactionSource::External,
                    call.clone().into(),
                    Default::default(),
                );
                assert_eq!(
                    still_blocked,
                    Err(TransactionValidityError::Invalid(InvalidTransaction::Call))
                );

                assert_ok!(pallet_safe_mode::Call::<Runtime>::force_exit {}
                    .dispatch(RuntimeOrigin::root()));

                assert_ok!(Runtime::validate_transaction(
                    TransactionSource::External,
                    call.clone().into(),
                    Default::default()
                ));

                assert_ok!(pallet_tx_pause::Call::<Runtime>::pause_call {
                call_name: call_name,
                    reason: None,
                }
                .dispatch(RuntimeOrigin::root()));

                assert_eq!(
                    Runtime::validate_transaction(
                        TransactionSource::External,
                        call.into(),
                        Default::default()
                    ),
                    Err(TransactionValidityError::Invalid(InvalidTransaction::Call))
                );
            });
    }

    #[test]
    fn control_plane_calls_work_under_restrictions() {
        ExtBuilder::default()
            .with_sudo(account_id(ALICE))
            .build()
            .execute_with(|| {
                assert_ok!(pallet_safe_mode::Call::<Runtime>::force_enter {}
                    .dispatch(RuntimeOrigin::root()));

                let call = transfer_call(1u128);
                let call_name = call_name(&call);

                assert_ok!(pallet_tx_pause::Call::<Runtime>::pause_call {
                call_name: call_name.clone(),
                    reason: None,
                }
                .dispatch(RuntimeOrigin::root()));

                assert_ok!(pallet_tx_pause::Call::<Runtime>::unpause_call {
                call_name: call_name.clone()
                }
                .dispatch(RuntimeOrigin::root()));

                assert_ok!(pallet_tx_pause::Call::<Runtime>::pause_call {
                call_name: call_name,
                    reason: None,
                }
                .dispatch(RuntimeOrigin::root()));

                assert_ok!(pallet_safe_mode::Call::<Runtime>::force_exit {}
                    .dispatch(RuntimeOrigin::root()));
            });
    }
}
