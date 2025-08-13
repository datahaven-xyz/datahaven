// Copyright 2019-2025 PureStake Inc.
// This file is part of Moonbeam.

// Moonbeam is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Moonbeam is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Moonbeam.  If not, see <http://www.gnu.org/licenses/>.

//! DataHaven Mainnet Runtime Integration Tests

mod common;
use common::*;

use datahaven_mainnet_runtime::{
    configs::{
        runtime_params::dynamic_params::runtime_config::FeesTreasuryProportion,
        TransactionPaymentAsGasPrice,
    },
    currency::*,
    AccountId, Balances, ExistentialDeposit, Runtime, RuntimeCall, RuntimeEvent, RuntimeOrigin,
    System, Treasury,
};
use datahaven_runtime_common::Balance;
use fp_evm::FeeCalculator;
use frame_support::{
    assert_ok,
    traits::{Currency as CurrencyT, Get},
};
use sp_core::{H160, U256};
use sp_runtime::traits::Dispatchable;

const BASE_FEE_GENESIS: u128 = 10 * MILLIUNIT / 4;

/// Helper function to get existential deposit (specific to this test file)
fn existential_deposit() -> Balance {
    ExistentialDeposit::get()
}

#[test]
fn author_does_receive_priority_fee() {
    ExtBuilder::default()
        .with_balances(vec![(
            AccountId::from(BOB),
            (1 * UNIT) + (21_000 * (500 * MILLIUNIT)),
        )])
        .build()
        .execute_with(|| {
            // Set Charlie (validator index 0) as the block author
            set_block_author_by_index(0);
            let author = get_validator_by_index(0);

            // Currently the default impl of the evm uses `deposit_into_existing`.
            // If we were to use this implementation, and for an author to receive eventual tips,
            // the account needs to be somehow initialized, otherwise the deposit would fail.
            Balances::make_free_balance_be(&author, 100 * UNIT);

            // EVM transfer.
            assert_ok!(RuntimeCall::Evm(pallet_evm::Call::<Runtime>::call {
                source: H160::from(BOB),
                target: H160::from(ALICE),
                input: Vec::new(),
                value: (1 * UNIT).into(),
                gas_limit: 21_000u64,
                max_fee_per_gas: U256::from(300 * MILLIUNIT),
                max_priority_fee_per_gas: Some(U256::from(200 * MILLIUNIT)),
                nonce: Some(U256::from(0)),
                access_list: Vec::new(),
            })
            .dispatch(<Runtime as frame_system::Config>::RuntimeOrigin::root()));

            let priority_fee = 200 * MILLIUNIT * 21_000;
            // Author free balance increased by priority fee.
            assert_eq!(Balances::free_balance(author), 100 * UNIT + priority_fee,);
        });
}

#[test]
fn total_issuance_after_evm_transaction_with_priority_fee() {
    ExtBuilder::default()
        .with_balances(vec![
            (
                AccountId::from(BOB),
                (1 * UNIT) + (21_000 * (2 * BASE_FEE_GENESIS) + existential_deposit()),
            ),
            (AccountId::from(ALICE), existential_deposit()),
            (
                <pallet_treasury::TreasuryAccountId<Runtime> as sp_core::TypedGet>::get(),
                existential_deposit(),
            ),
        ])
        .build()
        .execute_with(|| {
            let issuance_before = <Runtime as pallet_evm::Config>::Currency::total_issuance();

            // Set Charlie (validator index 0) as the block author
            set_block_author_by_index(0);
            let _author = get_validator_by_index(0);

            // EVM transfer.
            assert_ok!(RuntimeCall::Evm(pallet_evm::Call::<Runtime>::call {
                source: H160::from(BOB),
                target: H160::from(ALICE),
                input: Vec::new(),
                value: (1 * UNIT).into(),
                gas_limit: 21_000u64,
                max_fee_per_gas: U256::from(2 * BASE_FEE_GENESIS),
                max_priority_fee_per_gas: Some(U256::from(BASE_FEE_GENESIS)),
                nonce: Some(U256::from(0)),
                access_list: Vec::new(),
            })
            .dispatch(<Runtime as frame_system::Config>::RuntimeOrigin::root()));

            let issuance_after = <Runtime as pallet_evm::Config>::Currency::total_issuance();

            // Get the actual base fee that was charged by querying the fee calculator
            // This represents the real network base fee, not the genesis constant
            let (actual_base_fee_u256, _) = TransactionPaymentAsGasPrice::min_gas_price();
            let actual_base_fee: Balance = actual_base_fee_u256.as_u128();

            // Calculate expected treasury and burn amounts based on the actual base fee
            let gas_used = 21_000u128; // Standard transfer gas
            let total_base_fee_charged = actual_base_fee * gas_used;

            let treasury_proportion = FeesTreasuryProportion::get();
            let expected_treasury_amount = treasury_proportion.mul_floor(total_base_fee_charged);
            let expected_burnt_amount = total_base_fee_charged - expected_treasury_amount;

            // Verify total issuance was reduced by the burnt amount
            assert_eq!(
                issuance_after,
                issuance_before - expected_burnt_amount,
                "Total issuance should decrease by burnt base fee amount"
            );

            // Verify treasury received the expected amount
            // Treasury pot starts at 0 and should equal exactly the treasury fee amount
            let treasury_final_balance = datahaven_mainnet_runtime::Treasury::pot();
            assert_eq!(
                treasury_final_balance,
                expected_treasury_amount,
                "Treasury should receive {}% of base fee: expected {}, got {}",
                treasury_proportion.deconstruct() as f64 / 10_000_000.0 * 100.0,
                expected_treasury_amount,
                treasury_final_balance
            );
        });
}

#[test]
fn total_issuance_after_evm_transaction_without_priority_fee() {
    ExtBuilder::default()
        .with_balances(vec![
            (
                AccountId::from(BOB),
                (1 * UNIT) + (21_000 * (2 * BASE_FEE_GENESIS)),
            ),
            (AccountId::from(ALICE), existential_deposit()),
            (
                <pallet_treasury::TreasuryAccountId<Runtime> as sp_core::TypedGet>::get(),
                existential_deposit(),
            ),
        ])
        .build()
        .execute_with(|| {
            // Set block author for fee allocation
            set_block_author_by_index(0);
            let issuance_before = <Runtime as pallet_evm::Config>::Currency::total_issuance();
            // EVM transfer.
            assert_ok!(RuntimeCall::Evm(pallet_evm::Call::<Runtime>::call {
                source: H160::from(BOB),
                target: H160::from(ALICE),
                input: Vec::new(),
                value: (1 * UNIT).into(),
                gas_limit: 21_000u64,
                max_fee_per_gas: U256::from(BASE_FEE_GENESIS),
                max_priority_fee_per_gas: None,
                nonce: Some(U256::from(0)),
                access_list: Vec::new(),
            })
            .dispatch(<Runtime as frame_system::Config>::RuntimeOrigin::root()));

            let issuance_after = <Runtime as pallet_evm::Config>::Currency::total_issuance();

            // Get the actual base fee that was charged by querying the fee calculator
            // This represents the real network base fee, not the genesis constant
            let (actual_base_fee_u256, _) = TransactionPaymentAsGasPrice::min_gas_price();
            let actual_base_fee: Balance = actual_base_fee_u256.as_u128();

            // Calculate expected treasury and burn amounts based on the actual base fee
            let gas_used = 21_000u128; // Standard transfer gas
            let total_base_fee_charged = actual_base_fee * gas_used;

            let treasury_proportion = FeesTreasuryProportion::get();
            let expected_treasury_amount = treasury_proportion.mul_floor(total_base_fee_charged);
            let expected_burnt_amount = total_base_fee_charged - expected_treasury_amount;

            // Verify total issuance was reduced by the burnt amount
            assert_eq!(
                issuance_after,
                issuance_before - expected_burnt_amount,
                "Total issuance should decrease by burnt base fee amount"
            );

            // Verify treasury received the expected amount
            // Treasury pot starts at 0 and should equal exactly the treasury fee amount
            let treasury_final_balance = datahaven_mainnet_runtime::Treasury::pot();
            assert_eq!(
                treasury_final_balance,
                expected_treasury_amount,
                "Treasury should receive {}% of base fee: expected {}, got {}",
                treasury_proportion.deconstruct() as f64 / 10_000_000.0 * 100.0,
                expected_treasury_amount,
                treasury_final_balance
            );
        });
}

#[test]
fn deal_with_fees_handles_tip() {
    use datahaven_runtime_common::deal_with_fees::DealWithSubstrateFeesAndTip;
    use frame_support::traits::OnUnbalanced;

    ExtBuilder::default()
        .with_balances(vec![
            // Set up minimal balances for treasury to avoid existential deposit issues
            (
                datahaven_mainnet_runtime::Treasury::account_id(),
                existential_deposit(),
            ),
            (get_validator_by_index(0), existential_deposit()),
        ])
        .build()
        .execute_with(|| {
            // Set block author for fee allocation
            set_block_author_by_index(0);

            // This test validates the functionality of the `DealWithSubstrateFeesAndTip` trait implementation
            // in the DataHaven runtime. It verifies that:
            // - The correct proportion of the fee is sent to the treasury.
            // - The remaining fee is burned (removed from the total supply).
            // - The entire tip is sent to the block author.

            // The test details:
            // 1. Simulate issuing a `fee` of 100 and a `tip` of 1000.
            // 2. Confirm the initial total supply is 1,100 (equal to the sum of the issued fee and tip).
            // 3. Confirm the treasury's balance is initially 0.
            // 4. Execute the `DealWithSubstrateFeesAndTip::on_unbalanceds` function with the `fee` and `tip`.
            // 5. Validate that the treasury's balance has increased by 20% of the fee (based on FeesTreasuryProportion).
            // 6. Validate that 80% of the fee is burned, and the total supply decreases accordingly.
            // 7. Validate that the entire tip (100%) is sent to the block author (collator).

            // Step 1: Issue the fee and tip amounts.
            let fee =
                <pallet_balances::Pallet<Runtime> as frame_support::traits::fungible::Balanced<
                    AccountId,
                >>::issue(100);
            let tip =
                <pallet_balances::Pallet<Runtime> as frame_support::traits::fungible::Balanced<
                    AccountId,
                >>::issue(1000);

            // Step 2: Validate the initial supply and balances.
            let total_supply_before = Balances::total_issuance();
            let block_author = get_validator_by_index(0);
            let block_author_balance_before = Balances::free_balance(&block_author);

            // Total supply should be: issued fee (100) + issued tip (1000) + 2 existential deposits
            let expected_supply = 1_100 + (2 * existential_deposit());
            assert_eq!(total_supply_before, expected_supply);
            assert_eq!(
                Balances::free_balance(&datahaven_mainnet_runtime::Treasury::account_id()),
                existential_deposit()
            );

            // Step 3: Execute the fees handling logic.
            DealWithSubstrateFeesAndTip::<Runtime, FeesTreasuryProportion>::on_unbalanceds(
                vec![fee, tip].into_iter(),
            );

            // Step 4: Compute the split between treasury and burned fees based on FeesTreasuryProportion (20%).
            let treasury_proportion = FeesTreasuryProportion::get();

            let treasury_fee_part: Balance = treasury_proportion.mul_floor(100);
            let burnt_fee_part: Balance = 100 - treasury_fee_part;

            // Step 5: Validate the treasury received 20% of the fee.
            assert_eq!(
                Balances::free_balance(&datahaven_mainnet_runtime::Treasury::account_id()),
                existential_deposit() + treasury_fee_part,
            );

            // Step 6: Verify that 80% of the fee was burned (removed from the total supply).
            let total_supply_after = Balances::total_issuance();
            assert_eq!(total_supply_before - total_supply_after, burnt_fee_part,);

            // Step 7: Validate that the block author (collator) received 100% of the tip.
            let block_author_balance_after = Balances::free_balance(&block_author);
            assert_eq!(
                block_author_balance_after - block_author_balance_before,
                1000,
            );
        });
}

#[test]
fn fees_burned_when_block_author_not_set() {
    use datahaven_runtime_common::deal_with_fees::DealWithSubstrateFeesAndTip;
    use frame_support::traits::OnUnbalanced;

    ExtBuilder::default()
        .with_balances(vec![(
            datahaven_mainnet_runtime::Treasury::account_id(),
            existential_deposit(),
        )])
        .build()
        .execute_with(|| {
            // Explicitly do NOT set block author - this is the key difference from the test above

            let fee =
                <pallet_balances::Pallet<Runtime> as frame_support::traits::fungible::Balanced<
                    AccountId,
                >>::issue(100);
            let tip =
                <pallet_balances::Pallet<Runtime> as frame_support::traits::fungible::Balanced<
                    AccountId,
                >>::issue(1000);

            let total_supply_before = Balances::total_issuance();

            // Expected supply: issued fee (100) + issued tip (1000) + existential deposit
            let expected_supply = 1_100 + existential_deposit();
            assert_eq!(total_supply_before, expected_supply);

            DealWithSubstrateFeesAndTip::<Runtime, FeesTreasuryProportion>::on_unbalanceds(
                vec![fee, tip].into_iter(),
            );

            let treasury_proportion = FeesTreasuryProportion::get();
            let treasury_fee_part: Balance = treasury_proportion.mul_floor(100);
            let burnt_fee_part: Balance = 100 - treasury_fee_part;

            // Verify treasury received its portion of the fee
            assert_eq!(
                Balances::free_balance(&datahaven_mainnet_runtime::Treasury::account_id()),
                existential_deposit() + treasury_fee_part,
            );

            // When block author is not set and ExistentialDeposit is 0,
            // the tip goes to the default account (zero account) instead of being burned
            let total_supply_after = Balances::total_issuance();
            let expected_burned = burnt_fee_part; // Only the fee portion is burned
            assert_eq!(
                total_supply_before - total_supply_after,
                expected_burned,
                "Only fee portion should be burned when block author is not set"
            );

            // With ExistentialDeposit = 0, the default account can now hold the tip
            let default_account: AccountId = Default::default();
            assert_eq!(
                Balances::free_balance(&default_account),
                1000,
                "Default account should receive the tip when ExistentialDeposit is 0"
            );
        });
}

#[cfg(test)]
mod treasury_tests {
    use super::*;
    use frame_support::traits::Hooks;

    /// Helper function to create an origin for an account
    fn origin_of(account_id: AccountId) -> RuntimeOrigin {
        RuntimeOrigin::signed(account_id)
    }

    fn expect_events(events: Vec<RuntimeEvent>) {
        let block_events: Vec<RuntimeEvent> =
            System::events().into_iter().map(|r| r.event).collect();

        dbg!(events.clone());
        dbg!(block_events.clone());

        assert!(events.iter().all(|evt| block_events.contains(evt)))
    }

    fn next_block() {
        System::reset_events();
        System::set_block_number(System::block_number() + 1u32);
        System::on_initialize(System::block_number());
        datahaven_mainnet_runtime::Treasury::on_initialize(System::block_number());
    }

    #[test]
    fn test_treasury_spend_local_with_root_origin() {
        let initial_treasury_balance = 1_000 * UNIT;
        ExtBuilder::default()
            .with_balances(vec![
                (AccountId::from(ALICE), 2_000 * UNIT),
                (Treasury::account_id(), initial_treasury_balance),
            ])
            .build()
            .execute_with(|| {
                let spend_amount = 100u128 * UNIT;
                let spend_beneficiary = AccountId::from(BOB);

                next_block();

                // Perform treasury spending
                let valid_from = System::block_number() + 5u32;
                assert_ok!(datahaven_mainnet_runtime::Sudo::sudo(
                    root_origin(),
                    Box::new(RuntimeCall::Treasury(pallet_treasury::Call::spend {
                        amount: spend_amount,
                        asset_kind: Box::new(()),
                        beneficiary: Box::new(AccountId::from(BOB)),
                        valid_from: Some(valid_from),
                    }))
                ));

                let payout_period =
                    <<Runtime as pallet_treasury::Config>::PayoutPeriod as Get<u32>>::get();
                let expected_events = [RuntimeEvent::Treasury(
                    pallet_treasury::Event::AssetSpendApproved {
                        index: 0,
                        asset_kind: (),
                        amount: spend_amount,
                        beneficiary: spend_beneficiary,
                        valid_from,
                        expire_at: payout_period + valid_from,
                    },
                )]
                .to_vec();
                expect_events(expected_events);

                while System::block_number() < valid_from {
                    next_block();
                }

                assert_ok!(Treasury::payout(origin_of(spend_beneficiary), 0));

                let expected_events = [
                    RuntimeEvent::Treasury(pallet_treasury::Event::Paid {
                        index: 0,
                        payment_id: (),
                    }),
                    RuntimeEvent::Balances(pallet_balances::Event::Transfer {
                        from: Treasury::account_id(),
                        to: spend_beneficiary,
                        amount: spend_amount,
                    }),
                ]
                .to_vec();
                expect_events(expected_events);
            });
    }
}
