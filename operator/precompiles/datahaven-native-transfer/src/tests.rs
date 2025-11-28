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

//! Comprehensive test suite for DataHaven Native Transfer precompile

use crate::mock::{
    balance, precompiles, Alice, Bob, EthereumSovereign, ExistentialDeposit, ExtBuilder,
    FeeRecipient, NativeTransfer, NativeTransferPrecompile, PCall, Root,
};
use precompile_utils::prelude::Address;
use precompile_utils::testing::*;
use sp_core::{H160, U256};

// Test helper to get the precompile address
fn precompile_address() -> H160 {
    NativeTransferPrecompile.into()
}

// ============================================================================
// Selector Tests
// ============================================================================

#[test]
fn test_selectors() {
    // Just verify that selectors are generated - actual values may vary
    assert!(!PCall::transfer_to_ethereum_selectors().is_empty());
    assert!(!PCall::pause_selectors().is_empty());
    assert!(!PCall::unpause_selectors().is_empty());
    assert!(!PCall::is_paused_selectors().is_empty());
    assert!(!PCall::total_locked_balance_selectors().is_empty());
    assert!(!PCall::ethereum_sovereign_account_selectors().is_empty());
}

// ============================================================================
// Modifier Tests
// ============================================================================

#[test]
fn test_function_modifiers() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000)])
        .build()
        .execute_with(|| {
            let mut tester =
                PrecompilesModifierTester::new(precompiles(), Alice, precompile_address());

            // transferToEthereum - non-view, non-payable
            tester.test_default_modifier(PCall::transfer_to_ethereum_selectors());

            // pause - non-view, non-payable
            tester.test_default_modifier(PCall::pause_selectors());

            // unpause - non-view, non-payable
            tester.test_default_modifier(PCall::unpause_selectors());

            // isPaused - view
            tester.test_view_modifier(PCall::is_paused_selectors());

            // totalLockedBalance - view
            tester.test_view_modifier(PCall::total_locked_balance_selectors());

            // ethereumSovereignAccount - view
            tester.test_view_modifier(PCall::ethereum_sovereign_account_selectors());
        });
}

// ============================================================================
// Transfer To Ethereum Tests
// ============================================================================

#[test]
fn test_transfer_to_ethereum_success() {
    ExtBuilder::default()
        .with_balances(vec![
            (Alice.into(), 10000),
            (EthereumSovereign.into(), ExistentialDeposit::get()),
        ])
        .build()
        .execute_with(|| {
            let recipient = H160::from_low_u64_be(0x1234);
            let amount = U256::from(1000);
            let fee = U256::from(100);

            let initial_balance = balance(Alice);
            let initial_sovereign_balance = balance(EthereumSovereign);

            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_returns(());

            // Verify balances changed correctly
            assert_eq!(
                balance(Alice),
                initial_balance - 1000 - 100 // amount + fee
            );

            // Fee should go to fee recipient
            assert_eq!(balance(FeeRecipient), 100);

            // Amount should be locked in sovereign account
            assert_eq!(balance(EthereumSovereign), initial_sovereign_balance + 1000);
        });
}

#[test]
fn test_transfer_to_ethereum_zero_address() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10000)])
        .build()
        .execute_with(|| {
            let recipient = H160::zero();
            let amount = U256::from(1000);
            let fee = U256::from(100);

            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_reverts(|output| output == b"Recipient cannot be zero address");
        });
}

#[test]
fn test_transfer_to_ethereum_zero_amount() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10000)])
        .build()
        .execute_with(|| {
            let recipient = H160::from_low_u64_be(0x1234);
            let amount = U256::zero();
            let fee = U256::from(100);

            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_reverts(|output| output == b"Amount must be greater than zero");
        });
}

#[test]
fn test_transfer_to_ethereum_zero_fee() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10000)])
        .build()
        .execute_with(|| {
            let recipient = H160::from_low_u64_be(0x1234);
            let amount = U256::from(1000);
            let fee = U256::zero();

            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_reverts(|output| output == b"Fee must be greater than zero");
        });
}

#[test]
fn test_transfer_to_ethereum_insufficient_balance() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100)])
        .build()
        .execute_with(|| {
            let recipient = H160::from_low_u64_be(0x1234);
            let amount = U256::from(1000);
            let fee = U256::from(100);

            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_reverts(|output| {
                    // Pallet will return Token(NotExpendable) or similar balance error
                    let output_str = from_utf8_lossy(output);
                    output_str.contains("Token") || output_str.contains("InsufficientBalance")
                });
        });
}

#[test]
fn test_transfer_to_ethereum_when_paused() {
    ExtBuilder::default()
        .with_balances(vec![
            (Alice.into(), 10000),
            (EthereumSovereign.into(), ExistentialDeposit::get()),
        ])
        .build()
        .execute_with(|| {
            // First pause the pallet as root
            precompiles()
                .prepare_test(Root, precompile_address(), PCall::pause {})
                .execute_returns(());

            // Now try to transfer
            let recipient = H160::from_low_u64_be(0x1234);
            let amount = U256::from(1000);
            let fee = U256::from(100);

            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_reverts(|output| {
                    // Pallet will return TransfersDisabled error
                    from_utf8_lossy(output).contains("TransfersDisabled")
                });
        });
}

#[test]
fn test_transfer_to_ethereum_multiple_transfers() {
    ExtBuilder::default()
        .with_balances(vec![
            (Alice.into(), 10000),
            (Bob.into(), 10000),
            (EthereumSovereign.into(), ExistentialDeposit::get()),
        ])
        .build()
        .execute_with(|| {
            let recipient = H160::from_low_u64_be(0x1234);
            let amount = U256::from(1000);
            let fee = U256::from(100);

            let initial_sovereign = balance(EthereumSovereign);

            // Alice transfers
            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_returns(());

            // Bob transfers
            precompiles()
                .prepare_test(
                    Bob,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_returns(());

            // Verify sovereign account has both amounts locked
            assert_eq!(balance(EthereumSovereign), initial_sovereign + 2000);

            // Verify fee recipient got both fees
            assert_eq!(balance(FeeRecipient), 200);
        });
}

#[test]
fn test_transfer_to_ethereum_large_amount() {
    ExtBuilder::default()
        .with_balances(vec![
            (Alice.into(), u128::MAX / 2),
            (EthereumSovereign.into(), ExistentialDeposit::get()),
        ])
        .build()
        .execute_with(|| {
            let recipient = H160::from_low_u64_be(0x1234);
            let amount = U256::from(u128::MAX / 4);
            let fee = U256::from(1000);

            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_returns(());
        });
}

// ============================================================================
// Pause/Unpause Tests
// ============================================================================

#[test]
fn test_pause_success() {
    ExtBuilder::default().build().execute_with(|| {
        // Root account can pause
        precompiles()
            .prepare_test(Root, precompile_address(), PCall::pause {})
            .execute_returns(());

        // Verify paused state
        assert!(NativeTransfer::is_paused());
    });
}

#[test]
fn test_pause_unauthorized() {
    ExtBuilder::default().build().execute_with(|| {
        // Non-root account cannot pause
        precompiles()
            .prepare_test(Alice, precompile_address(), PCall::pause {})
            .execute_reverts(|output| {
                // Should get BadOrigin error from pallet
                from_utf8_lossy(output).contains("BadOrigin")
            });
    });
}

#[test]
fn test_unpause_success() {
    ExtBuilder::default().build().execute_with(|| {
        // First pause
        precompiles()
            .prepare_test(Root, precompile_address(), PCall::pause {})
            .execute_returns(());

        assert!(NativeTransfer::is_paused());

        // Then unpause
        precompiles()
            .prepare_test(Root, precompile_address(), PCall::unpause {})
            .execute_returns(());

        // Verify unpaused state
        assert!(!NativeTransfer::is_paused());
    });
}

#[test]
fn test_unpause_unauthorized() {
    ExtBuilder::default().build().execute_with(|| {
        // Non-root account cannot unpause
        precompiles()
            .prepare_test(Alice, precompile_address(), PCall::unpause {})
            .execute_reverts(|output| from_utf8_lossy(output).contains("BadOrigin"));
    });
}

#[test]
fn test_pause_unpause_cycle() {
    ExtBuilder::default()
        .with_balances(vec![
            (Alice.into(), 10000),
            (EthereumSovereign.into(), ExistentialDeposit::get()),
        ])
        .build()
        .execute_with(|| {
            let recipient = H160::from_low_u64_be(0x1234);
            let amount = U256::from(1000);
            let fee = U256::from(100);

            // Initially not paused - transfer should work
            assert!(!NativeTransfer::is_paused());
            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_returns(());

            // Pause
            precompiles()
                .prepare_test(Root, precompile_address(), PCall::pause {})
                .execute_returns(());
            assert!(NativeTransfer::is_paused());

            // Transfer should fail when paused
            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_reverts(|output| from_utf8_lossy(output).contains("TransfersDisabled"));

            // Unpause
            precompiles()
                .prepare_test(Root, precompile_address(), PCall::unpause {})
                .execute_returns(());
            assert!(!NativeTransfer::is_paused());

            // Transfer should work again
            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_returns(());
        });
}

// ============================================================================
// View Function Tests
// ============================================================================

#[test]
fn test_is_paused_false() {
    ExtBuilder::default().build().execute_with(|| {
        precompiles()
            .prepare_test(Alice, precompile_address(), PCall::is_paused {})
            .execute_returns(false);
    });
}

#[test]
fn test_is_paused_true() {
    ExtBuilder::default().build().execute_with(|| {
        // Pause the pallet
        precompiles()
            .prepare_test(Root, precompile_address(), PCall::pause {})
            .execute_returns(());

        // Check paused state
        precompiles()
            .prepare_test(Alice, precompile_address(), PCall::is_paused {})
            .execute_returns(true);
    });
}

#[test]
fn test_total_locked_balance_zero() {
    ExtBuilder::default().build().execute_with(|| {
        precompiles()
            .prepare_test(Alice, precompile_address(), PCall::total_locked_balance {})
            .execute_returns(U256::zero());
    });
}

#[test]
fn test_total_locked_balance_with_existential_deposit() {
    ExtBuilder::default()
        .with_balances(vec![(EthereumSovereign.into(), ExistentialDeposit::get())])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(Alice, precompile_address(), PCall::total_locked_balance {})
                .execute_returns(U256::from(ExistentialDeposit::get()));
        });
}

#[test]
fn test_total_locked_balance_after_transfer() {
    ExtBuilder::default()
        .with_balances(vec![
            (Alice.into(), 10000),
            (EthereumSovereign.into(), ExistentialDeposit::get()),
        ])
        .build()
        .execute_with(|| {
            let recipient = H160::from_low_u64_be(0x1234);
            let amount = U256::from(1000);
            let fee = U256::from(100);

            // Transfer some tokens
            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_returns(());

            // Check locked balance
            precompiles()
                .prepare_test(Alice, precompile_address(), PCall::total_locked_balance {})
                .execute_returns(U256::from(ExistentialDeposit::get() + 1000));
        });
}

#[test]
fn test_total_locked_balance_after_multiple_transfers() {
    ExtBuilder::default()
        .with_balances(vec![
            (Alice.into(), 10000),
            (Bob.into(), 10000),
            (EthereumSovereign.into(), ExistentialDeposit::get()),
        ])
        .build()
        .execute_with(|| {
            let recipient = H160::from_low_u64_be(0x1234);
            let amount = U256::from(1000);
            let fee = U256::from(100);

            // Alice transfers
            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_returns(());

            // Bob transfers
            precompiles()
                .prepare_test(
                    Bob,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_returns(());

            // Check total locked balance
            precompiles()
                .prepare_test(Alice, precompile_address(), PCall::total_locked_balance {})
                .execute_returns(U256::from(ExistentialDeposit::get() + 2000));
        });
}

#[test]
fn test_ethereum_sovereign_account() {
    ExtBuilder::default().build().execute_with(|| {
        let expected: H160 = EthereumSovereign.into();

        precompiles()
            .prepare_test(
                Alice,
                precompile_address(),
                PCall::ethereum_sovereign_account {},
            )
            .execute_returns(Address(expected));
    });
}

// ============================================================================
// Gas Accounting Tests
// ============================================================================

#[test]
fn test_transfer_to_ethereum_gas_cost() {
    ExtBuilder::default()
        .with_balances(vec![
            (Alice.into(), 10000),
            (EthereumSovereign.into(), ExistentialDeposit::get()),
        ])
        .build()
        .execute_with(|| {
            let recipient = H160::from_low_u64_be(0x1234);
            let amount = U256::from(1000);
            let fee = U256::from(100);

            // Just verify the call succeeds, don't check exact gas cost
            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_some();
        });
}

#[test]
fn test_view_functions_gas_costs() {
    ExtBuilder::default()
        .with_balances(vec![(EthereumSovereign.into(), 1000)])
        .build()
        .execute_with(|| {
            // isPaused should have minimal gas cost
            precompiles()
                .prepare_test(Alice, precompile_address(), PCall::is_paused {})
                .expect_cost(0) // TODO: Calculate actual expected cost
                .execute_some();

            // totalLockedBalance should have minimal gas cost
            precompiles()
                .prepare_test(Alice, precompile_address(), PCall::total_locked_balance {})
                .expect_cost(0) // TODO: Calculate actual expected cost
                .execute_some();

            // ethereumSovereignAccount should have minimal gas cost
            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::ethereum_sovereign_account {},
                )
                .expect_cost(0) // TODO: Calculate actual expected cost
                .execute_some();
        });
}

// ============================================================================
// Edge Cases and Error Handling Tests
// ============================================================================

#[test]
fn test_transfer_respects_existential_deposit() {
    ExtBuilder::default()
        .with_balances(vec![
            (Alice.into(), 1000),
            (EthereumSovereign.into(), ExistentialDeposit::get()),
        ])
        .build()
        .execute_with(|| {
            let recipient = H160::from_low_u64_be(0x1234);
            // Try to transfer everything except existential deposit
            let amount = U256::from(1000 - ExistentialDeposit::get() - 100);
            let fee = U256::from(100);

            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_returns(());

            // Alice should have at least existential deposit left
            assert!(balance(Alice) >= ExistentialDeposit::get());
        });
}

#[test]
fn test_u256_to_balance_overflow() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), u128::MAX)])
        .build()
        .execute_with(|| {
            let recipient = H160::from_low_u64_be(0x1234);
            // U256::MAX cannot fit in u128
            let amount = U256::MAX;
            let fee = U256::from(100);

            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_reverts(|output| from_utf8_lossy(output).contains("Amount overflow"));
        });
}

#[test]
fn test_fee_overflow() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), u128::MAX)])
        .build()
        .execute_with(|| {
            let recipient = H160::from_low_u64_be(0x1234);
            let amount = U256::from(1000);
            let fee = U256::MAX;

            precompiles()
                .prepare_test(
                    Alice,
                    precompile_address(),
                    PCall::transfer_to_ethereum {
                        recipient: recipient.into(),
                        amount,
                        fee,
                    },
                )
                .execute_reverts(|output| from_utf8_lossy(output).contains("Fee overflow"));
        });
}

// Helper function to convert bytes to UTF-8 string for debugging
fn from_utf8_lossy(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).to_string()
}
