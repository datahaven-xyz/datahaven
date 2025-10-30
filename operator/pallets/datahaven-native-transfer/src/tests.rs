// Copyright (C) DataHaven.
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
// along with DataHaven.  If not, see <http://www.gnu.org/licenses/>

use {
    crate::{mock::*, Error, Pallet as DataHavenNativeTransfer, Paused},
    frame_support::{
        assert_noop, assert_ok,
        traits::fungible::{Inspect, Mutate},
    },
    sp_core::H160,
    sp_runtime::DispatchError,
};

fn ethereum_address() -> H160 {
    H160::from_low_u64_be(42)
}

// ===========================
// Transfer Tests
// ===========================

#[test]
fn transfer_to_ethereum_works() {
    new_test_ext().execute_with(|| {
        let amount = 1000u128;
        let fee = 100u128;
        let recipient = ethereum_address();

        assert_ok!(DataHavenNativeTransfer::<Test>::transfer_to_ethereum(
            RuntimeOrigin::signed(ALICE),
            recipient,
            amount,
            fee
        ));

        // Check tokens were locked and fee was withdrawn
        assert_eq!(Balances::balance(&ALICE), INITIAL_BALANCE - amount - fee);
        assert_eq!(Balances::balance(&ETHEREUM_SOVEREIGN), amount);
        assert_eq!(Balances::balance(&FEE_RECIPIENT), fee);

        // Check event was emitted
        assert_eq!(
            last_event(),
            RuntimeEvent::DataHavenNativeTransfer(crate::Event::TokensTransferredToEthereum {
                from: ALICE,
                to: recipient,
                amount,
            })
        );
    });
}

#[test]
fn transfer_zero_amount_fails() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            DataHavenNativeTransfer::<Test>::transfer_to_ethereum(
                RuntimeOrigin::signed(ALICE),
                ethereum_address(),
                0,
                100
            ),
            Error::<Test>::InvalidAmount
        );
    });
}

#[test]
fn transfer_to_zero_address_fails() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            DataHavenNativeTransfer::<Test>::transfer_to_ethereum(
                RuntimeOrigin::signed(ALICE),
                H160::zero(),
                1000,
                100
            ),
            Error::<Test>::InvalidEthereumAddress
        );
    });
}

#[test]
fn transfer_insufficient_balance_fails() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            DataHavenNativeTransfer::<Test>::transfer_to_ethereum(
                RuntimeOrigin::signed(ALICE),
                ethereum_address(),
                INITIAL_BALANCE + 1,
                100
            ),
            DispatchError::Token(sp_runtime::TokenError::FundsUnavailable)
        );
    });
}

#[test]
fn transfer_when_paused_fails() {
    new_test_ext().execute_with(|| {
        // Pause the pallet
        assert_ok!(DataHavenNativeTransfer::<Test>::pause(RuntimeOrigin::root()));

        assert_noop!(
            DataHavenNativeTransfer::<Test>::transfer_to_ethereum(
                RuntimeOrigin::signed(ALICE),
                ethereum_address(),
                1000,
                100
            ),
            Error::<Test>::TransfersDisabled
        );
    });
}

// Test removed: transfer_with_send_message_failure
// Cannot test message failures without mock state

#[test]
fn multiple_transfers_work() {
    new_test_ext().execute_with(|| {
        let amount1 = 1000u128;
        let amount2 = 2000u128;
        let recipient = ethereum_address();

        // First transfer
        assert_ok!(DataHavenNativeTransfer::<Test>::transfer_to_ethereum(
            RuntimeOrigin::signed(ALICE),
            recipient,
            amount1,
            50
        ));

        // Second transfer
        assert_ok!(DataHavenNativeTransfer::<Test>::transfer_to_ethereum(
            RuntimeOrigin::signed(ALICE),
            recipient,
            amount2,
            50
        ));

        // Check balances (account for fees: 50 + 50 = 100 total)
        assert_eq!(
            Balances::balance(&ALICE),
            INITIAL_BALANCE - amount1 - amount2 - 100
        );
        assert_eq!(Balances::balance(&ETHEREUM_SOVEREIGN), amount1 + amount2);
        assert_eq!(Balances::balance(&FEE_RECIPIENT), 100);
    });
}

#[test]
fn transfer_with_zero_fee_fails() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            DataHavenNativeTransfer::<Test>::transfer_to_ethereum(
                RuntimeOrigin::signed(ALICE),
                ethereum_address(),
                1000,
                0
            ),
            Error::<Test>::ZeroFee
        );
    });
}

#[test]
fn transfer_fails_when_token_not_registered() {
    new_test_ext().execute_with(|| {
        // Unregister the token
        IsTokenRegistered::set(&false);

        assert_noop!(
            DataHavenNativeTransfer::<Test>::transfer_to_ethereum(
                RuntimeOrigin::signed(ALICE),
                ethereum_address(),
                1000,
                100
            ),
            Error::<Test>::TokenNotRegistered
        );

        // Re-register for other tests
        IsTokenRegistered::set(&true);
    });
}

// ===========================
// Lock/Unlock Tests
// ===========================

#[test]
fn lock_tokens_works() {
    new_test_ext().execute_with(|| {
        let amount = 1000u128;

        assert_ok!(DataHavenNativeTransfer::<Test>::lock_tokens(&ALICE, amount));

        assert_eq!(Balances::balance(&ALICE), INITIAL_BALANCE - amount);
        assert_eq!(Balances::balance(&ETHEREUM_SOVEREIGN), amount);

        // Check event
        assert_eq!(
            last_event(),
            RuntimeEvent::DataHavenNativeTransfer(crate::Event::TokensLocked {
                account: ALICE,
                amount,
            })
        );
    });
}

#[test]
fn unlock_tokens_works() {
    new_test_ext().execute_with(|| {
        let amount = 1000u128;

        // First lock some tokens
        assert_ok!(DataHavenNativeTransfer::<Test>::lock_tokens(&ALICE, amount));

        // Give sovereign account some balance first to ensure it has enough
        // The lock_tokens call should have done this, verify it
        assert_eq!(Balances::balance(&ETHEREUM_SOVEREIGN), amount);

        // Unlock less than full amount to keep existential deposit in sovereign
        let unlock_amount = amount - 1; // Keep 1 for existential deposit
        assert_ok!(DataHavenNativeTransfer::<Test>::unlock_tokens(
            &BOB,
            unlock_amount
        ));

        assert_eq!(Balances::balance(&BOB), INITIAL_BALANCE + unlock_amount);
        assert_eq!(
            Balances::balance(&ETHEREUM_SOVEREIGN),
            Balances::minimum_balance()
        ); // Existential deposit remains

        // Check event
        assert_eq!(
            last_event(),
            RuntimeEvent::DataHavenNativeTransfer(crate::Event::TokensUnlocked {
                account: BOB,
                amount: unlock_amount,
            })
        );
    });
}

#[test]
fn unlock_insufficient_sovereign_balance_fails() {
    new_test_ext().execute_with(|| {
        // Try to unlock without any locked tokens
        assert_noop!(
            DataHavenNativeTransfer::<Test>::unlock_tokens(&BOB, 1000),
            Error::<Test>::InsufficientSovereignBalance
        );
    });
}

#[test]
fn unlock_fails_if_existential_deposit_would_be_consumed() {
    new_test_ext().execute_with(|| {
        let amount = 10u128;
        assert_ok!(DataHavenNativeTransfer::<Test>::lock_tokens(&ALICE, amount));

        // Attempt to withdraw the full sovereign balance, which should leave the account below ED
        assert_noop!(
            DataHavenNativeTransfer::<Test>::unlock_tokens(&BOB, amount),
            Error::<Test>::InsufficientSovereignBalance
        );
    });
}

#[test]
fn lock_unlock_different_amounts() {
    new_test_ext().execute_with(|| {
        // Lock 5000
        assert_ok!(DataHavenNativeTransfer::<Test>::lock_tokens(&ALICE, 5000));
        assert_eq!(Balances::balance(&ETHEREUM_SOVEREIGN), 5000);

        // Unlock 2000 to Bob
        assert_ok!(DataHavenNativeTransfer::<Test>::unlock_tokens(&BOB, 2000));
        assert_eq!(Balances::balance(&ETHEREUM_SOVEREIGN), 3000);

        // Unlock 2999 to Charlie (keep 1 for existential deposit)
        assert_ok!(DataHavenNativeTransfer::<Test>::unlock_tokens(
            &CHARLIE, 2999
        ));

        assert_eq!(
            Balances::balance(&ETHEREUM_SOVEREIGN),
            Balances::minimum_balance()
        ); // Existential deposit remains
        assert_eq!(Balances::balance(&BOB), INITIAL_BALANCE + 2000);
        assert_eq!(Balances::balance(&CHARLIE), INITIAL_BALANCE + 2999);
    });
}

// ===========================
// Pause/Unpause Tests
// ===========================

#[test]
fn pause_works() {
    new_test_ext().execute_with(|| {
        assert_ok!(DataHavenNativeTransfer::<Test>::pause(RuntimeOrigin::root()));

        assert!(Paused::<Test>::get());

        assert_eq!(
            last_event(),
            RuntimeEvent::DataHavenNativeTransfer(crate::Event::Paused)
        );
    });
}

#[test]
fn pause_unauthorized_fails() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            DataHavenNativeTransfer::<Test>::pause(RuntimeOrigin::signed(ALICE)),
            DispatchError::BadOrigin
        );
    });
}

#[test]
fn unpause_works() {
    new_test_ext().execute_with(|| {
        // First pause
        assert_ok!(DataHavenNativeTransfer::<Test>::pause(RuntimeOrigin::root()));

        // Then unpause
        assert_ok!(DataHavenNativeTransfer::<Test>::unpause(
            RuntimeOrigin::root()
        ));

        assert!(!Paused::<Test>::get());

        assert_eq!(
            last_event(),
            RuntimeEvent::DataHavenNativeTransfer(crate::Event::Unpaused)
        );
    });
}

#[test]
fn unpause_unauthorized_fails() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            DataHavenNativeTransfer::<Test>::unpause(RuntimeOrigin::signed(ALICE)),
            DispatchError::BadOrigin
        );
    });
}

#[test]
fn pause_unpause_cycle_works() {
    new_test_ext().execute_with(|| {
        let amount = 1000u128;
        let recipient = ethereum_address();

        // Transfer works initially
        assert_ok!(DataHavenNativeTransfer::<Test>::transfer_to_ethereum(
            RuntimeOrigin::signed(ALICE),
            recipient,
            amount,
            50
        ));

        // Pause
        assert_ok!(DataHavenNativeTransfer::<Test>::pause(RuntimeOrigin::root()));

        // Transfer fails when paused
        assert_noop!(
            DataHavenNativeTransfer::<Test>::transfer_to_ethereum(
                RuntimeOrigin::signed(BOB),
                recipient,
                amount,
                50
            ),
            Error::<Test>::TransfersDisabled
        );

        // Unpause
        assert_ok!(DataHavenNativeTransfer::<Test>::unpause(
            RuntimeOrigin::root()
        ));

        // Transfer works again
        assert_ok!(DataHavenNativeTransfer::<Test>::transfer_to_ethereum(
            RuntimeOrigin::signed(BOB),
            recipient,
            amount,
            50
        ));
    });
}

// ===========================
// Balance Preservation Tests
// ===========================

#[test]
fn transfer_preserves_existential_deposit() {
    new_test_ext().execute_with(|| {
        // Set Alice's balance to just above existential deposit
        let balance = 20u128;
        <Balances as Mutate<_>>::set_balance(&ALICE, balance);

        // Try to transfer almost all, keeping 1 for existential deposit
        let transfer_amount = 9u128;
        let fee = 10u128;

        assert_ok!(DataHavenNativeTransfer::<Test>::transfer_to_ethereum(
            RuntimeOrigin::signed(ALICE),
            ethereum_address(),
            transfer_amount,
            fee
        ));

        // Alice should still have existential deposit
        assert_eq!(Balances::balance(&ALICE), 1);
        assert_eq!(Balances::balance(&ETHEREUM_SOVEREIGN), transfer_amount);
        assert_eq!(Balances::balance(&FEE_RECIPIENT), fee);
    });
}

#[test]
fn unlock_preserves_existential_deposit() {
    new_test_ext().execute_with(|| {
        // Lock tokens first
        assert_ok!(DataHavenNativeTransfer::<Test>::lock_tokens(&ALICE, 5000));

        // Create a new account with 0 balance
        let dave: u64 = 4;
        assert_eq!(Balances::balance(&dave), 0);

        // Unlock tokens to Dave - should work and create the account
        assert_ok!(DataHavenNativeTransfer::<Test>::unlock_tokens(&dave, 1000));

        assert_eq!(Balances::balance(&dave), 1000);
    });
}

#[test]
fn transfer_with_preservation_mode() {
    new_test_ext().execute_with(|| {
        // Set Alice's balance to just above existential deposit
        let balance = 3u128;
        <Balances as Mutate<_>>::set_balance(&ALICE, balance);

        // Try to transfer all - should fail due to Preservation::Preserve
        assert_noop!(
            DataHavenNativeTransfer::<Test>::transfer_to_ethereum(
                RuntimeOrigin::signed(ALICE),
                ethereum_address(),
                2,
                1
            ),
            DispatchError::Token(sp_runtime::TokenError::NotExpendable)
        );
    });
}
