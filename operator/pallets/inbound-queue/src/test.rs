// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use super::*;

use frame_support::{assert_noop, assert_ok};
use hex_literal::hex;
use snowbridge_core::{inbound::Proof, ChannelId};
use sp_keyring::Sr25519Keyring as Keyring;
use sp_runtime::DispatchError;
use sp_std::convert::From;

use crate::Error;

use crate::mock::*;

#[test]
fn test_submit_happy_path() {
    new_tester().execute_with(|| {
        let relayer: AccountId = Keyring::Bob.into();
        let channel_sovereign = sibling_sovereign_account::<Test>(ASSET_HUB_PARAID.into());

        let origin = RuntimeOrigin::signed(relayer.clone());

        // Submit message
        let message = Message {
            event_log: mock_event_log(),
            proof: Proof {
                receipt_proof: Default::default(),
                execution_proof: mock_execution_proof(),
            },
        };

        let initial_fund = InitialFund::get();
        assert_eq!(Balances::balance(&relayer), 0);
        assert_eq!(Balances::balance(&channel_sovereign), initial_fund);

        assert_ok!(InboundQueue::submit(origin.clone(), message.clone()));

        let events = frame_system::Pallet::<Test>::events();
        assert!(
            events.iter().any(|event| matches!(
                event.event,
                RuntimeEvent::InboundQueue(Event::MessageReceived { nonce, ..})
                    if nonce == 1
            )),
            "no event emit."
        );

        let delivery_cost = InboundQueue::calculate_delivery_cost(message.encode().len() as u32);
        assert!(
            Parameters::get().rewards.local < delivery_cost,
            "delivery cost exceeds pure reward"
        );

        assert_eq!(
            Balances::balance(&relayer),
            delivery_cost,
            "relayer was rewarded"
        );
        assert!(
            Balances::balance(&channel_sovereign) <= initial_fund - delivery_cost,
            "sovereign account paid reward"
        );
    });
}

#[test]
fn test_submit_xcm_invalid_channel() {
    new_tester().execute_with(|| {
        let relayer: AccountId = Keyring::Bob.into();
        let origin = RuntimeOrigin::signed(relayer);

        // Deposit funds into sovereign account of parachain 1001
        let sovereign_account = sibling_sovereign_account::<Test>(TEMPLATE_PARAID.into());
        println!("account: {}", sovereign_account);
        let _ = Balances::mint_into(&sovereign_account, 10000);

        // Submit message
        let message = Message {
            event_log: mock_event_log_invalid_channel(),
            proof: Proof {
                receipt_proof: Default::default(),
                execution_proof: mock_execution_proof(),
            },
        };
        assert_noop!(
            InboundQueue::submit(origin.clone(), message.clone()),
            Error::<Test>::InvalidChannel,
        );
    });
}

#[test]
fn test_submit_with_invalid_gateway() {
    new_tester().execute_with(|| {
        let relayer: AccountId = Keyring::Bob.into();
        let origin = RuntimeOrigin::signed(relayer);

        // Deposit funds into sovereign account of Asset Hub (Statemint)
        let sovereign_account = sibling_sovereign_account::<Test>(ASSET_HUB_PARAID.into());
        let _ = Balances::mint_into(&sovereign_account, 10000);

        // Submit message
        let message = Message {
            event_log: mock_event_log_invalid_gateway(),
            proof: Proof {
                receipt_proof: Default::default(),
                execution_proof: mock_execution_proof(),
            },
        };
        assert_noop!(
            InboundQueue::submit(origin.clone(), message.clone()),
            Error::<Test>::InvalidGateway
        );
    });
}

#[test]
fn test_submit_with_invalid_nonce() {
    new_tester().execute_with(|| {
        let relayer: AccountId = Keyring::Bob.into();
        let origin = RuntimeOrigin::signed(relayer);

        // Deposit funds into sovereign account of Asset Hub (Statemint)
        let sovereign_account = sibling_sovereign_account::<Test>(ASSET_HUB_PARAID.into());
        let _ = Balances::mint_into(&sovereign_account, 10000);

        // Submit message
        let message = Message {
            event_log: mock_event_log(),
            proof: Proof {
                receipt_proof: Default::default(),
                execution_proof: mock_execution_proof(),
            },
        };
        assert_ok!(InboundQueue::submit(origin.clone(), message.clone()));

        let nonce: u64 = <Nonce<Test>>::get(ChannelId::from(hex!(
            "c173fac324158e77fb5840738a1a541f633cbec8884c6a601c567d2b376a0539"
        )));
        assert_eq!(nonce, 1);

        // Submit the same again
        assert_noop!(
            InboundQueue::submit(origin.clone(), message.clone()),
            Error::<Test>::InvalidNonce
        );
    });
}

#[test]
fn test_submit_no_funds_to_reward_relayers_just_ignore() {
    new_tester().execute_with(|| {
        let relayer: AccountId = Keyring::Bob.into();
        let origin = RuntimeOrigin::signed(relayer);

        // Reset balance of sovereign_account to zero first
        let sovereign_account = sibling_sovereign_account::<Test>(ASSET_HUB_PARAID.into());
        Balances::set_balance(&sovereign_account, 0);

        // Submit message
        let message = Message {
            event_log: mock_event_log(),
            proof: Proof {
                receipt_proof: Default::default(),
                execution_proof: mock_execution_proof(),
            },
        };
        // Check submit successfully in case no funds available
        assert_ok!(InboundQueue::submit(origin.clone(), message.clone()));
    });
}

#[test]
fn test_set_operating_mode() {
    new_tester().execute_with(|| {
        let relayer: AccountId = Keyring::Bob.into();
        let origin = RuntimeOrigin::signed(relayer);
        let message = Message {
            event_log: mock_event_log(),
            proof: Proof {
                receipt_proof: Default::default(),
                execution_proof: mock_execution_proof(),
            },
        };

        assert_ok!(InboundQueue::set_operating_mode(
            RuntimeOrigin::root(),
            snowbridge_core::BasicOperatingMode::Halted
        ));

        assert_noop!(InboundQueue::submit(origin, message), Error::<Test>::Halted);
    });
}

#[test]
fn test_set_operating_mode_root_only() {
    new_tester().execute_with(|| {
        assert_noop!(
            InboundQueue::set_operating_mode(
                RuntimeOrigin::signed(Keyring::Bob.into()),
                snowbridge_core::BasicOperatingMode::Halted
            ),
            DispatchError::BadOrigin
        );
    });
}

#[test]
fn test_submit_no_funds_to_reward_relayers_and_ed_preserved() {
    new_tester().execute_with(|| {
        let relayer: AccountId = Keyring::Bob.into();
        let origin = RuntimeOrigin::signed(relayer);

        // Reset balance of sovereign account to (ED+1) first
        let sovereign_account = sibling_sovereign_account::<Test>(ASSET_HUB_PARAID.into());
        Balances::set_balance(&sovereign_account, ExistentialDeposit::get() + 1);

        // Submit message successfully
        let message = Message {
            event_log: mock_event_log(),
            proof: Proof {
                receipt_proof: Default::default(),
                execution_proof: mock_execution_proof(),
            },
        };
        assert_ok!(InboundQueue::submit(origin.clone(), message.clone()));

        // Check balance of sovereign account to ED
        let amount = Balances::balance(&sovereign_account);
        assert_eq!(amount, ExistentialDeposit::get());

        // Submit another message with nonce set as 2
        let mut event_log = mock_event_log();
        event_log.data[31] = 2;
        let message = Message {
            event_log,
            proof: Proof {
                receipt_proof: Default::default(),
                execution_proof: mock_execution_proof(),
            },
        };
        assert_ok!(InboundQueue::submit(origin.clone(), message.clone()));
        // Check balance of sovereign account as ED does not change
        let amount = Balances::balance(&sovereign_account);
        assert_eq!(amount, ExistentialDeposit::get());
    });
}
