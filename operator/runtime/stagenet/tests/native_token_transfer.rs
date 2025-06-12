// Copyright 2025 Moonbeam Foundation.
// This file is part of DataHaven.

//! Native token transfer integration tests for DataHaven stagenet runtime
//!
//! Tests for native token transfers between DataHaven and Ethereum via Snowbridge

#[path = "common.rs"]
mod common;

use common::*;
use datahaven_stagenet_runtime::{
    configs::EthereumSovereignAccount, AccountId, Balances, DataHavenNativeTransfer, Runtime,
    RuntimeEvent, RuntimeOrigin, SnowbridgeSystemV2, System, UNIT,
};
use frame_support::{assert_noop, assert_ok, traits::fungible::Inspect};
use pallet_datahaven_native_transfer::Event as NativeTransferEvent;
use snowbridge_core::TokenIdOf;
use snowbridge_outbound_queue_primitives::v2::Command;
use snowbridge_pallet_outbound_queue_v2::Event as OutboundQueueEvent;
use snowbridge_pallet_system::NativeToForeignId;
use snowbridge_pallet_system_v2::Event as SystemV2Event;
use sp_core::{H160, H256};
use xcm::prelude::*;
use xcm_executor::traits::ConvertLocation;

#[test]
fn test_datahaven_native_token_registration_succeeds() {
    ExtBuilder::default().build().execute_with(|| {
        let origin = root_origin();
        let sender_location = Location::here();
        let asset_location = Location::here();
        let metadata = datahaven_token_metadata();

        // Step 1: Verify preconditions - token not yet registered
        let initial_reanchored = SnowbridgeSystemV2::reanchor(asset_location.clone()).unwrap();
        assert!(NativeToForeignId::<Runtime>::get(&initial_reanchored).is_none());
        assert!(
            snowbridge_pallet_system::ForeignToNativeId::<Runtime>::iter()
                .next()
                .is_none()
        );

        // Step 2: Register the token
        assert_ok!(SnowbridgeSystemV2::register_token(
            origin,
            Box::new(VersionedLocation::V5(sender_location)),
            Box::new(VersionedLocation::V5(asset_location.clone())),
            metadata.clone()
        ));

        // Step 3: Verify reanchoring works correctly
        let reanchored_location = SnowbridgeSystemV2::reanchor(asset_location.clone()).unwrap();
        assert_eq!(reanchored_location.parent_count(), 1);
        // Verify it contains GlobalConsensus junction with DataHaven network
        let first_junction = reanchored_location.first_interior();
        assert!(matches!(first_junction, Some(Junction::GlobalConsensus(_))));

        // Step 4: Verify TokenId generation is deterministic
        let token_id = TokenIdOf::convert_location(&reanchored_location).unwrap();
        assert_ne!(token_id, H256::zero());

        // Step 5: Verify bidirectional storage mappings
        assert_eq!(
            NativeToForeignId::<Runtime>::get(&reanchored_location),
            Some(token_id)
        );
        assert_eq!(
            snowbridge_pallet_system::ForeignToNativeId::<Runtime>::get(&token_id),
            Some(reanchored_location.clone())
        );

        // Step 6: Verify event emission with all details
        let expected_event = RuntimeEvent::SnowbridgeSystemV2(SystemV2Event::RegisterToken {
            location: reanchored_location.clone().into(),
            foreign_token_id: token_id,
        });
        assert_eq!(last_event(), expected_event);
    });
}

#[test]
fn test_native_token_transfer_to_ethereum_succeeds() {
    ExtBuilder::default().build().execute_with(|| {
        // Register token first
        register_native_token();

        let alice = account_id(ALICE);
        let eth_recipient = H160::from_low_u64_be(0x1234);
        let transfer_amount = 1000 * UNIT;
        let fee = 10 * UNIT;

        // Record initial balances
        let alice_initial = Balances::balance(&alice);
        let sovereign_initial = Balances::balance(&EthereumSovereignAccount::get());
        let treasury_initial =
            Balances::balance(&datahaven_stagenet_runtime::configs::TreasuryAccountId::get());

        // Execute transfer
        assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
            RuntimeOrigin::signed(alice.clone()),
            eth_recipient,
            transfer_amount,
            fee
        ));

        // Verify balance changes
        assert_eq!(
            Balances::balance(&alice),
            alice_initial - transfer_amount - fee
        );
        assert_eq!(
            Balances::balance(&EthereumSovereignAccount::get()),
            sovereign_initial + transfer_amount
        );
        // Verify treasury received the fee
        assert_eq!(
            Balances::balance(&datahaven_stagenet_runtime::configs::TreasuryAccountId::get()),
            treasury_initial + fee
        );

        // Verify events in correct order
        let events = System::events();

        // Find the transfer events
        let mut found_transfer_event = false;
        let mut found_message_event = false;

        for event in events.iter().rev() {
            match &event.event {
                RuntimeEvent::DataHavenNativeTransfer(
                    NativeTransferEvent::TokensTransferredToEthereum { from, to, amount },
                ) => {
                    assert_eq!(from, &alice);
                    assert_eq!(to, &eth_recipient);
                    assert_eq!(amount, &transfer_amount);
                    found_transfer_event = true;
                }
                RuntimeEvent::EthereumOutboundQueueV2(OutboundQueueEvent::MessageQueued {
                    message,
                    ..
                }) => {
                    // Check if this is the transfer message (not registration)
                    if let Command::MintForeignToken {
                        recipient, amount, ..
                    } = &message.commands[0]
                    {
                        // Verify message structure for transfer
                        assert_eq!(message.fee, fee);
                        assert_eq!(message.commands.len(), 1);
                        assert_eq!(recipient, &eth_recipient);
                        assert_eq!(amount, &transfer_amount);
                        found_message_event = true;
                    }
                }
                _ => {}
            }
        }

        assert!(
            found_transfer_event,
            "TokensTransferredToEthereum event not found"
        );
        assert!(
            found_message_event,
            "OutboundQueue MessageQueued event not found"
        );
    });
}

#[test]
fn test_transfer_with_exact_balance_preserves_existential_deposit() {
    ExtBuilder::default().build().execute_with(|| {
        register_native_token();

        let alice = account_id(ALICE);
        let eth_recipient = H160::from_low_u64_be(0x5678);

        // Set Alice's balance to a specific amount
        let existential_deposit = 1 * UNIT; // Assuming 1 DH is ED
        let transfer_amount = 900 * UNIT;
        let fee = 99 * UNIT;
        let initial_balance = existential_deposit + transfer_amount + fee;

        // Reset Alice's balance to exact amount
        let _ = Balances::force_set_balance(root_origin(), alice.clone(), initial_balance);
        assert_eq!(Balances::balance(&alice), initial_balance);

        // Transfer should succeed and leave exactly existential deposit
        assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
            RuntimeOrigin::signed(alice.clone()),
            eth_recipient,
            transfer_amount,
            fee
        ));

        // Verify Alice has exactly existential deposit remaining
        assert_eq!(Balances::balance(&alice), existential_deposit);
        assert_eq!(
            Balances::balance(&EthereumSovereignAccount::get()),
            transfer_amount
        );
    });
}

#[test]
fn test_multiple_concurrent_transfers_maintain_consistency() {
    ExtBuilder::default().build().execute_with(|| {
        register_native_token();

        let alice = account_id(ALICE);
        let bob = account_id(BOB);
        let eth_recipient1 = H160::from_low_u64_be(0xABCD);
        let eth_recipient2 = H160::from_low_u64_be(0xDEAD);

        let transfer1 = 500 * UNIT;
        let transfer2 = 300 * UNIT;
        let fee = 5 * UNIT;
        let treasury_initial =
            Balances::balance(&datahaven_stagenet_runtime::configs::TreasuryAccountId::get());

        // Execute multiple transfers
        assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
            RuntimeOrigin::signed(alice.clone()),
            eth_recipient1,
            transfer1,
            fee
        ));

        assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
            RuntimeOrigin::signed(bob.clone()),
            eth_recipient2,
            transfer2,
            fee
        ));

        // Verify total locked balance
        assert_eq!(
            Balances::balance(&EthereumSovereignAccount::get()),
            transfer1 + transfer2
        );

        // Verify treasury received all fees (2 transfers * fee)
        assert_eq!(
            Balances::balance(&datahaven_stagenet_runtime::configs::TreasuryAccountId::get()),
            treasury_initial + (fee * 2)
        );

        // Verify outbound queue has both transfer messages (excluding registration)
        let events = System::events();
        let transfer_message_count = events
            .iter()
            .filter(|e| {
                if let RuntimeEvent::EthereumOutboundQueueV2(OutboundQueueEvent::MessageQueued {
                    message,
                    ..
                }) = &e.event
                {
                    // Only count MintForeignToken messages (transfer messages, not registration)
                    matches!(
                        message.commands.get(0),
                        Some(Command::MintForeignToken { .. })
                    )
                } else {
                    false
                }
            })
            .count();
        assert_eq!(transfer_message_count, 2);
    });
}

#[test]
fn test_transfer_generates_unique_message_ids() {
    ExtBuilder::default().build().execute_with(|| {
        register_native_token();

        let alice = account_id(ALICE);
        let eth_recipient = H160::from_low_u64_be(0x9999);
        let amount = 100 * UNIT;
        let fee = 1 * UNIT;

        // Collect message IDs from multiple transfers
        let mut message_ids = Vec::new();

        for _ in 0..3 {
            assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
                RuntimeOrigin::signed(alice.clone()),
                eth_recipient,
                amount,
                fee
            ));

            // Extract message ID from last event
            let events = System::events();
            for event in events.iter().rev() {
                if let RuntimeEvent::EthereumOutboundQueueV2(OutboundQueueEvent::MessageQueued {
                    message,
                    ..
                }) = &event.event
                {
                    message_ids.push(message.id);
                    break;
                }
            }
        }

        // Verify all message IDs are unique
        assert_eq!(message_ids.len(), 3);
        let unique_ids: std::collections::HashSet<_> = message_ids.iter().collect();
        assert_eq!(unique_ids.len(), 3, "Message IDs should be unique");
    });
}

#[test]
fn test_pause_functionality_blocks_transfers() {
    ExtBuilder::default().build().execute_with(|| {
        register_native_token();

        let alice = account_id(ALICE);
        let eth_recipient = H160::from_low_u64_be(0x4444);

        // Pause the pallet
        assert_ok!(DataHavenNativeTransfer::pause(root_origin()));

        // Verify transfer fails
        assert_noop!(
            DataHavenNativeTransfer::transfer_to_ethereum(
                RuntimeOrigin::signed(alice.clone()),
                eth_recipient,
                100 * UNIT,
                1 * UNIT
            ),
            pallet_datahaven_native_transfer::Error::<Runtime>::TransfersDisabled
        );

        // Unpause
        assert_ok!(DataHavenNativeTransfer::unpause(root_origin()));

        // Verify transfer now succeeds
        assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
            RuntimeOrigin::signed(alice),
            eth_recipient,
            100 * UNIT,
            1 * UNIT
        ));
    });
}

#[test]
fn test_treasury_fee_collection() {
    ExtBuilder::default().build().execute_with(|| {
        register_native_token();

        let alice = account_id(ALICE);
        let bob = account_id(BOB);
        let treasury_account = datahaven_stagenet_runtime::configs::TreasuryAccountId::get();
        let initial_treasury_balance = Balances::balance(&treasury_account);

        // Test case 1: Single transfer with fee
        let fee1 = 5 * UNIT;
        assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
            RuntimeOrigin::signed(alice.clone()),
            H160::from_low_u64_be(0x1111),
            100 * UNIT,
            fee1
        ));

        // Verify treasury received the fee
        assert_eq!(
            Balances::balance(&treasury_account),
            initial_treasury_balance + fee1
        );

        // Test case 2: Multiple transfers with different fees
        let fee2 = 10 * UNIT;
        let fee3 = 15 * UNIT;

        assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
            RuntimeOrigin::signed(bob.clone()),
            H160::from_low_u64_be(0x2222),
            200 * UNIT,
            fee2
        ));

        assert_ok!(DataHavenNativeTransfer::transfer_to_ethereum(
            RuntimeOrigin::signed(alice.clone()),
            H160::from_low_u64_be(0x3333),
            300 * UNIT,
            fee3
        ));

        // Verify treasury received all accumulated fees
        let total_fees = fee1 + fee2 + fee3;
        assert_eq!(
            Balances::balance(&treasury_account),
            initial_treasury_balance + total_fees,
            "Treasury should accumulate all fees from transfers"
        );

        // Verify treasury account is not the zero address
        assert_ne!(
            treasury_account,
            AccountId::from([0u8; 20]),
            "Treasury account should not be the zero address"
        );
    });
}

// Helper function to register native token
fn register_native_token() {
    let origin = root_origin();
    let sender_location = Location::here();
    let asset_location = Location::here();
    let metadata = datahaven_token_metadata();

    let _ = SnowbridgeSystemV2::register_token(
        origin,
        Box::new(VersionedLocation::V5(sender_location)),
        Box::new(VersionedLocation::V5(asset_location)),
        metadata,
    );
}
