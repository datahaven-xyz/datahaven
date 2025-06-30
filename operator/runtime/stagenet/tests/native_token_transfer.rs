// Copyright 2025 Moonbeam Foundation.
// This file is part of DataHaven.

#[path = "common.rs"]
mod common;

use codec::Encode;
use common::*;
use datahaven_stagenet_runtime::{
    configs::EthereumSovereignAccount, AccountId, Balance, Balances, DataHavenNativeTransfer,
    Runtime, RuntimeEvent, RuntimeOrigin, SnowbridgeSystemV2, System, UNIT,
};
use dhp_bridge::NativeTokenTransferMessageProcessor;
use frame_support::{assert_noop, assert_ok, traits::fungible::Inspect};
use pallet_datahaven_native_transfer::Event as NativeTransferEvent;
use snowbridge_core::TokenIdOf;
use snowbridge_inbound_queue_primitives::v2::{
    EthereumAsset, Message as SnowbridgeMessage, MessageProcessor, Payload,
};
use snowbridge_pallet_outbound_queue_v2::Event as OutboundQueueEvent;
use snowbridge_pallet_system::NativeToForeignId;
use sp_core::{H160, H256};
use sp_runtime::DispatchError;
use xcm::prelude::*;
use xcm_executor::traits::ConvertLocation;

const TRANSFER_AMOUNT: Balance = 1000 * UNIT;
const FEE_AMOUNT: Balance = 10 * UNIT;
const ETH_ALICE: H160 = H160([0x11; 20]);
const ETH_BOB: H160 = H160([0x22; 20]);

fn register_native_token() -> H256 {
    let asset_location = Location::here();
    let _ = SnowbridgeSystemV2::register_token(
        root_origin(),
        Box::new(VersionedLocation::V5(asset_location.clone())),
        Box::new(VersionedLocation::V5(asset_location.clone())),
        datahaven_token_metadata(),
    );
    let reanchored = SnowbridgeSystemV2::reanchor(asset_location).unwrap();
    TokenIdOf::convert_location(&reanchored).unwrap()
}

fn setup_sovereign_balance(amount: Balance) {
    let _ = Balances::force_set_balance(root_origin(), EthereumSovereignAccount::get(), amount);
}

fn create_message(token_id: H256, amount: Balance, claimer: H160, nonce: u64) -> SnowbridgeMessage {
    SnowbridgeMessage {
        gateway: H160::zero(),
        nonce,
        origin: H160::zero(),
        assets: vec![EthereumAsset::ForeignTokenERC20 {
            token_id,
            value: amount,
        }],
        xcm: Payload::Raw(vec![0x01, 0x02, 0x03]),
        claimer: Some(claimer.encode()),
        value: 0,
        execution_fee: 100,
        relayer_fee: 50,
    }
}

// === Token Registration Tests ===

#[test]
fn native_token_registration_works() {
    ExtBuilder::default().build().execute_with(|| {
        let asset_location = Location::here();

        // Register the native HAVE token with Snowbridge
        assert_ok!(SnowbridgeSystemV2::register_token(
            root_origin(),
            Box::new(VersionedLocation::V5(asset_location.clone())),
            Box::new(VersionedLocation::V5(asset_location.clone())),
            datahaven_token_metadata()
        ));

        // Verify token was registered and assigned a valid token ID
        let reanchored = SnowbridgeSystemV2::reanchor(asset_location).unwrap();
        let token_id = TokenIdOf::convert_location(&reanchored).unwrap();

        assert_ne!(token_id, H256::zero());
        assert_eq!(
            NativeToForeignId::<Runtime>::get(&reanchored),
            Some(token_id)
        );
    });
}

// === Outbound Transfer Tests ===

#[test]
fn transfer_to_ethereum_works() {
    ExtBuilder::default().build().execute_with(|| {
        let _token_id = register_native_token();
        let alice = account_id(ALICE);

        let alice_initial = Balances::balance(&alice);
        let sovereign_initial = Balances::balance(&EthereumSovereignAccount::get());

        assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
            RuntimeOrigin::signed(alice.clone()),
            ETH_ALICE,
            TRANSFER_AMOUNT,
            FEE_AMOUNT
        ));

        assert_eq!(
            Balances::balance(&alice),
            alice_initial - TRANSFER_AMOUNT - FEE_AMOUNT
        );
        assert_eq!(
            Balances::balance(&EthereumSovereignAccount::get()),
            sovereign_initial + TRANSFER_AMOUNT
        );

        // Check event was emitted
        assert!(System::events().iter().any(|e| matches!(
            &e.event,
            RuntimeEvent::DataHavenNativeTransfer(
                NativeTransferEvent::TokensTransferredToEthereum { .. }
            )
        )));
    });
}

#[test]
fn transfer_fails_when_paused() {
    ExtBuilder::default().build().execute_with(|| {
        let _token_id = register_native_token();
        let alice = account_id(ALICE);

        assert_ok!(DataHavenNativeTransfer::pause(root_origin()));

        assert_noop!(
            DataHavenNativeTransfer::transfer_to_ethereum(
                RuntimeOrigin::signed(alice),
                ETH_ALICE,
                TRANSFER_AMOUNT,
                FEE_AMOUNT
            ),
            pallet_datahaven_native_transfer::Error::<Runtime>::TransfersDisabled
        );
    });
}

#[test]
fn multiple_transfers_work() {
    ExtBuilder::default().build().execute_with(|| {
        let _token_id = register_native_token();
        let alice = account_id(ALICE);
        let bob = account_id(BOB);

        assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
            RuntimeOrigin::signed(alice),
            ETH_ALICE,
            TRANSFER_AMOUNT,
            FEE_AMOUNT
        ));

        assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
            RuntimeOrigin::signed(bob),
            ETH_BOB,
            TRANSFER_AMOUNT,
            FEE_AMOUNT
        ));

        let expected_sovereign_balance = TRANSFER_AMOUNT * 2;
        assert_eq!(
            Balances::balance(&EthereumSovereignAccount::get()),
            expected_sovereign_balance
        );
    });
}

#[test]
fn treasury_collects_fees_from_multiple_transfers() {
    ExtBuilder::default().build().execute_with(|| {
        let _token_id = register_native_token();
        let alice = account_id(ALICE);
        let bob = account_id(BOB);
        let treasury_account = datahaven_stagenet_runtime::configs::TreasuryAccount::get();
        let initial_treasury_balance = Balances::balance(&treasury_account);

        let fee1 = 5 * UNIT;
        let fee2 = 10 * UNIT;

        assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
            RuntimeOrigin::signed(alice),
            ETH_ALICE,
            TRANSFER_AMOUNT,
            fee1
        ));

        assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
            RuntimeOrigin::signed(bob),
            ETH_BOB,
            TRANSFER_AMOUNT,
            fee2
        ));

        let expected_treasury_balance = initial_treasury_balance + fee1 + fee2;
        assert_eq!(
            Balances::balance(&treasury_account),
            expected_treasury_balance
        );
    });
}

// === Inbound Message Processing Tests ===

#[test]
fn message_processor_accepts_registered_token() {
    ExtBuilder::default().build().execute_with(|| {
        let token_id = register_native_token();
        let alice = account_id(ALICE);
        let message = create_message(token_id, TRANSFER_AMOUNT, ETH_ALICE, 1);

        assert!(
            NativeTokenTransferMessageProcessor::<Runtime>::can_process_message(&alice, &message)
        );
    });
}

#[test]
fn message_processor_rejects_unregistered_token() {
    ExtBuilder::default().build().execute_with(|| {
        let fake_token_id = H256::from_low_u64_be(0x9999);
        let alice = account_id(ALICE);
        let message = create_message(fake_token_id, TRANSFER_AMOUNT, ETH_ALICE, 1);

        assert!(
            !NativeTokenTransferMessageProcessor::<Runtime>::can_process_message(&alice, &message)
        );
    });
}

#[test]
fn message_processor_rejects_empty_assets() {
    ExtBuilder::default().build().execute_with(|| {
        let token_id = register_native_token();
        let alice = account_id(ALICE);

        let mut message = create_message(token_id, TRANSFER_AMOUNT, ETH_ALICE, 1);
        message.assets = vec![];

        assert!(
            !NativeTokenTransferMessageProcessor::<Runtime>::can_process_message(&alice, &message)
        );
    });
}

#[test]
fn inbound_message_processing_works() {
    ExtBuilder::default().build().execute_with(|| {
        let token_id = register_native_token();
        let alice = account_id(ALICE);
        let message = create_message(token_id, TRANSFER_AMOUNT, ETH_ALICE, 1);

        setup_sovereign_balance(TRANSFER_AMOUNT * 2);
        let sovereign_initial = Balances::balance(&EthereumSovereignAccount::get());

        assert_ok!(
            snowbridge_pallet_inbound_queue_v2::Pallet::<Runtime>::process_message(alice, message)
        );

        let recipient: AccountId = ETH_ALICE.into();
        assert_eq!(Balances::balance(&recipient), TRANSFER_AMOUNT);
        assert_eq!(
            Balances::balance(&EthereumSovereignAccount::get()),
            sovereign_initial - TRANSFER_AMOUNT
        );

        // Check unlock event was emitted
        assert!(System::events().iter().any(|e| matches!(
            &e.event,
            RuntimeEvent::DataHavenNativeTransfer(NativeTransferEvent::TokensUnlocked { .. })
        )));
    });
}

#[test]
fn multiple_assets_processing_sums_amounts() {
    ExtBuilder::default().build().execute_with(|| {
        let token_id = register_native_token();
        let alice = account_id(ALICE);

        let mut message = create_message(token_id, 0, ETH_ALICE, 1);
        message.assets = vec![
            EthereumAsset::ForeignTokenERC20 {
                token_id,
                value: 300 * UNIT,
            },
            EthereumAsset::ForeignTokenERC20 {
                token_id,
                value: 200 * UNIT,
            },
            EthereumAsset::ForeignTokenERC20 {
                token_id,
                value: 500 * UNIT,
            },
        ];

        setup_sovereign_balance(2000 * UNIT);

        assert_ok!(
            snowbridge_pallet_inbound_queue_v2::Pallet::<Runtime>::process_message(alice, message)
        );

        let recipient: AccountId = ETH_ALICE.into();
        let total_amount = 1000 * UNIT;
        assert_eq!(Balances::balance(&recipient), total_amount);
    });
}

#[test]
fn processing_fails_without_claimer() {
    ExtBuilder::default().build().execute_with(|| {
        let token_id = register_native_token();
        let alice = account_id(ALICE);

        let mut message = create_message(token_id, TRANSFER_AMOUNT, ETH_ALICE, 1);
        message.claimer = None;

        assert_noop!(
            snowbridge_pallet_inbound_queue_v2::Pallet::<Runtime>::process_message(alice, message),
            DispatchError::Other("No claimer specified in message")
        );
    });
}

#[test]
fn processing_fails_with_zero_amount() {
    ExtBuilder::default().build().execute_with(|| {
        let token_id = register_native_token();
        let alice = account_id(ALICE);
        let message = create_message(token_id, 0, ETH_ALICE, 1);

        assert_noop!(
            snowbridge_pallet_inbound_queue_v2::Pallet::<Runtime>::process_message(alice, message),
            DispatchError::Other("No native token found in assets")
        );
    });
}

#[test]
fn processing_fails_with_insufficient_sovereign_balance() {
    ExtBuilder::default().build().execute_with(|| {
        let token_id = register_native_token();
        let alice = account_id(ALICE);
        let message = create_message(token_id, TRANSFER_AMOUNT, ETH_ALICE, 1);

        setup_sovereign_balance(TRANSFER_AMOUNT / 2); // Insufficient balance

        let result =
            snowbridge_pallet_inbound_queue_v2::Pallet::<Runtime>::process_message(alice, message);
        assert!(result.is_err());
    });
}

// === Integration Tests ===

#[test]
fn end_to_end_transfer_flow() {
    ExtBuilder::default().build().execute_with(|| {
        let token_id = register_native_token();
        let alice = account_id(ALICE);

        // Outbound transfer
        assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
            RuntimeOrigin::signed(alice.clone()),
            ETH_ALICE,
            TRANSFER_AMOUNT,
            FEE_AMOUNT
        ));

        // Verify message was queued
        assert!(System::events().iter().any(|e| matches!(
            &e.event,
            RuntimeEvent::EthereumOutboundQueueV2(OutboundQueueEvent::MessageQueued { .. })
        )));

        // Simulate inbound processing
        let message = create_message(token_id, TRANSFER_AMOUNT, ETH_BOB, 1);
        setup_sovereign_balance(TRANSFER_AMOUNT * 3);

        assert_ok!(
            snowbridge_pallet_inbound_queue_v2::Pallet::<Runtime>::process_message(alice, message)
        );

        let recipient: AccountId = ETH_BOB.into();
        assert_eq!(Balances::balance(&recipient), TRANSFER_AMOUNT);
    });
}

#[test]
fn message_routing_works_correctly() {
    ExtBuilder::default().build().execute_with(|| {
        let token_id = register_native_token();
        let alice = account_id(ALICE);

        // Native token message should be accepted
        let native_message = create_message(token_id, TRANSFER_AMOUNT, ETH_ALICE, 1);
        assert!(
            NativeTokenTransferMessageProcessor::<Runtime>::can_process_message(
                &alice,
                &native_message
            )
        );

        // Non-native token message should be rejected
        let fake_token_id = H256::from_low_u64_be(0x8888);
        let non_native_message = create_message(fake_token_id, TRANSFER_AMOUNT, ETH_ALICE, 2);
        assert!(
            !NativeTokenTransferMessageProcessor::<Runtime>::can_process_message(
                &alice,
                &non_native_message
            )
        );
    });
}
