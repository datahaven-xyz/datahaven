#![allow(clippy::too_many_arguments)]

#[path = "common.rs"]
mod common;

use common::{account_id, ExtBuilder, ALICE, BOB};
use datahaven_testnet_runtime::{
    Runtime, RuntimeCall, RuntimeEvent, RuntimeOrigin, SafeMode, System, TxPause,
    UncheckedExtrinsic,
};
use frame_support::{assert_noop, assert_ok, BoundedVec};
use pallet_safe_mode::EnteredUntil;
use pallet_tx_pause::{Error as TxPauseError, RuntimeCallNameOf};
use sp_runtime::{
    traits::Dispatchable,
    transaction_validity::{InvalidTransaction, TransactionSource, TransactionValidityError},
};
use sp_transaction_pool::runtime_api::runtime_decl_for_tagged_transaction_queue::TaggedTransactionQueueV3;

fn call_name(call: &RuntimeCall) -> RuntimeCallNameOf<Runtime> {
    use frame_support::traits::GetCallMetadata;
    let metadata = call.get_call_metadata();
    (
        BoundedVec::try_from(metadata.pallet_name.as_bytes().to_vec()).unwrap(),
        BoundedVec::try_from(metadata.function_name.as_bytes().to_vec()).unwrap(),
    )
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
                assert_ok!(
                    RuntimeCall::SafeMode(pallet_safe_mode::Call::force_enter {})
                        .dispatch(RuntimeOrigin::root())
                );

                let xt = transfer_call(1u128);
                let unchecked_xt = UncheckedExtrinsic::new_bare(xt.into());
                let validity = Runtime::validate_transaction(
                    TransactionSource::External,
                    unchecked_xt,
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

    #[test]
    fn exit_restores_normal_flow() {
        ExtBuilder::default()
            .with_sudo(account_id(ALICE))
            .with_balances(vec![(account_id(ALICE), 1_000_000)])
            .build()
            .execute_with(|| {
                // Enter safe mode
                assert_ok!(
                    RuntimeCall::SafeMode(pallet_safe_mode::Call::force_enter {})
                        .dispatch(RuntimeOrigin::root())
                );

                let call = transfer_call(100);

                // Verify call is blocked in safe mode
                let xt = UncheckedExtrinsic::new_bare(call.clone().into());
                assert_eq!(
                    Runtime::validate_transaction(
                        TransactionSource::External,
                        xt,
                        Default::default()
                    ),
                    Err(TransactionValidityError::Invalid(InvalidTransaction::Call))
                );

                // Exit safe mode
                assert_ok!(RuntimeCall::SafeMode(pallet_safe_mode::Call::force_exit {})
                    .dispatch(RuntimeOrigin::root()));

                // Verify call now works
                assert_ok!(call.dispatch(RuntimeOrigin::signed(account_id(ALICE))));
            });
    }

    #[test]
    fn sudo_bypass() {
        ExtBuilder::default()
            .with_sudo(account_id(ALICE))
            .with_balances(vec![(account_id(ALICE), 1_000_000)])
            .build()
            .execute_with(|| {
                // Enter safe mode
                assert_ok!(
                    RuntimeCall::SafeMode(pallet_safe_mode::Call::force_enter {})
                        .dispatch(RuntimeOrigin::root())
                );

                let transfer = transfer_call(100);

                // Wrap in sudo call
                let sudo_call = RuntimeCall::Sudo(pallet_sudo::Call::sudo {
                    call: Box::new(transfer),
                });

                // Sudo should bypass safe mode filter
                assert_ok!(sudo_call.dispatch(RuntimeOrigin::signed(account_id(ALICE))));
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

            assert_ok!(RuntimeCall::TxPause(pallet_tx_pause::Call::pause {
                full_name: call_name.clone(),
            })
            .dispatch(RuntimeOrigin::root()));

            assert_noop!(
                RuntimeCall::TxPause(pallet_tx_pause::Call::pause {
                    full_name: call_name.clone(),
                })
                .dispatch(RuntimeOrigin::signed(account_id(ALICE))),
                sp_runtime::DispatchError::BadOrigin
            );

            assert_ok!(
                RuntimeCall::TxPause(pallet_tx_pause::Call::unpause { ident: call_name })
                    .dispatch(RuntimeOrigin::root())
            );
        });
    }

    #[test]
    fn paused_call_is_blocked() {
        ExtBuilder::default().build().execute_with(|| {
            let call = transfer_call(1u128);
            let call_name = call_name(&call);

            assert_ok!(RuntimeCall::TxPause(pallet_tx_pause::Call::pause {
                full_name: call_name.clone(),
            })
            .dispatch(RuntimeOrigin::root()));

            let xt = UncheckedExtrinsic::new_bare(call.clone().into());
            assert_eq!(
                Runtime::validate_transaction(TransactionSource::External, xt, Default::default()),
                Err(TransactionValidityError::Invalid(InvalidTransaction::Call))
            );

            assert_noop!(
                call.clone()
                    .dispatch(RuntimeOrigin::signed(account_id(ALICE))),
                frame_system::Error::<Runtime>::CallFiltered
            );

            assert_ok!(
                RuntimeCall::TxPause(pallet_tx_pause::Call::unpause { ident: call_name })
                    .dispatch(RuntimeOrigin::root())
            );

            // After unpause, the call should be dispatchable
            assert_ok!(call.dispatch(RuntimeOrigin::signed(account_id(ALICE))));
        });
    }

    #[test]
    fn whitelisted_call_cannot_be_paused() {
        ExtBuilder::default().build().execute_with(|| {
            let call = RuntimeCall::SafeMode(pallet_safe_mode::Call::force_exit {});
            let call_name = call_name(&call);

            assert_noop!(
                RuntimeCall::TxPause(pallet_tx_pause::Call::pause {
                    full_name: call_name,
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
                assert_ok!(
                    RuntimeCall::SafeMode(pallet_safe_mode::Call::force_enter {})
                        .dispatch(RuntimeOrigin::root())
                );

                let call = transfer_call(1u128);
                let call_name = call_name(&call);

                assert_ok!(RuntimeCall::TxPause(pallet_tx_pause::Call::pause {
                    full_name: call_name.clone(),
                })
                .dispatch(RuntimeOrigin::root()));

                let xt = UncheckedExtrinsic::new_bare(call.clone().into());
                let validity = Runtime::validate_transaction(
                    TransactionSource::External,
                    xt,
                    Default::default(),
                );
                assert_eq!(
                    validity,
                    Err(TransactionValidityError::Invalid(InvalidTransaction::Call))
                );

                assert_ok!(RuntimeCall::TxPause(pallet_tx_pause::Call::unpause {
                    ident: call_name.clone()
                })
                .dispatch(RuntimeOrigin::root()));

                let xt = UncheckedExtrinsic::new_bare(call.clone().into());
                let still_blocked = Runtime::validate_transaction(
                    TransactionSource::External,
                    xt,
                    Default::default(),
                );
                assert_eq!(
                    still_blocked,
                    Err(TransactionValidityError::Invalid(InvalidTransaction::Call))
                );

                assert_ok!(RuntimeCall::SafeMode(pallet_safe_mode::Call::force_exit {})
                    .dispatch(RuntimeOrigin::root()));

                // After exiting safe mode and unpausing, call should be dispatchable
                assert_ok!(call
                    .clone()
                    .dispatch(RuntimeOrigin::signed(account_id(ALICE))));

                assert_ok!(RuntimeCall::TxPause(pallet_tx_pause::Call::pause {
                    full_name: call_name,
                })
                .dispatch(RuntimeOrigin::root()));

                let xt = UncheckedExtrinsic::new_bare(call.into());
                assert_eq!(
                    Runtime::validate_transaction(
                        TransactionSource::External,
                        xt,
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
                assert_ok!(
                    RuntimeCall::SafeMode(pallet_safe_mode::Call::force_enter {})
                        .dispatch(RuntimeOrigin::root())
                );

                let call = transfer_call(1u128);
                let call_name = call_name(&call);

                assert_ok!(RuntimeCall::TxPause(pallet_tx_pause::Call::pause {
                    full_name: call_name.clone(),
                })
                .dispatch(RuntimeOrigin::root()));

                assert_ok!(RuntimeCall::TxPause(pallet_tx_pause::Call::unpause {
                    ident: call_name.clone()
                })
                .dispatch(RuntimeOrigin::root()));

                assert_ok!(RuntimeCall::TxPause(pallet_tx_pause::Call::pause {
                    full_name: call_name,
                })
                .dispatch(RuntimeOrigin::root()));

                assert_ok!(RuntimeCall::SafeMode(pallet_safe_mode::Call::force_exit {})
                    .dispatch(RuntimeOrigin::root()));
            });
    }

    #[test]
    fn error_surface_consistency() {
        ExtBuilder::default()
            .with_sudo(account_id(ALICE))
            .with_balances(vec![(account_id(ALICE), 1_000_000)])
            .build()
            .execute_with(|| {
                // Activate both restrictions
                assert_ok!(
                    RuntimeCall::SafeMode(pallet_safe_mode::Call::force_enter {})
                        .dispatch(RuntimeOrigin::root())
                );

                let call = transfer_call(100);
                let call_name = call_name(&call);

                assert_ok!(RuntimeCall::TxPause(pallet_tx_pause::Call::pause {
                    full_name: call_name,
                })
                .dispatch(RuntimeOrigin::root()));

                // Validate the blocked call - should return consistent error
                let xt = UncheckedExtrinsic::new_bare(call.clone().into());
                let validation_result = Runtime::validate_transaction(
                    TransactionSource::External,
                    xt,
                    Default::default(),
                );

                // Should return InvalidTransaction::Call
                assert_eq!(
                    validation_result,
                    Err(TransactionValidityError::Invalid(InvalidTransaction::Call))
                );

                // Dispatch should also fail with consistent error
                assert_noop!(
                    call.dispatch(RuntimeOrigin::signed(account_id(ALICE))),
                    frame_system::Error::<Runtime>::CallFiltered
                );
            });
    }
}
