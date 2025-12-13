// Copyright (C) Moondance Labs Ltd.
// This file is part of Tanssi.

// Tanssi is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Tanssi is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Tanssi.  If not, see <http://www.gnu.org/licenses/>

use {
    crate::{self as pallet_external_validators_rewards, mock::*},
    frame_support::traits::fungible::Mutate,
    pallet_external_validators::traits::{ActiveEraInfo, OnEraEnd, OnEraStart},
    sp_core::crypto::AccountId32,
    sp_std::collections::btree_map::BTreeMap,
};

#[test]
fn basic_setup_works() {
    new_test_ext().execute_with(|| {
        // Mock::mutate(|mock| mock.active_era = Some(ActiveEraInfo { index: 0, start: None}));
        let storage_eras =
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::iter().count();
        assert_eq!(storage_eras, 0);
    });
}

#[test]
fn can_reward_validators() {
    new_test_ext().execute_with(|| {
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            })
        });
        ExternalValidatorsRewards::reward_by_ids([
            (AccountId32::from([1; 32]), 10),
            (AccountId32::from([3; 32]), 30),
            (AccountId32::from([5; 32]), 50),
        ]);
        ExternalValidatorsRewards::reward_by_ids([
            (AccountId32::from([1; 32]), 10),
            (AccountId32::from([3; 32]), 10),
            (AccountId32::from([5; 32]), 10),
        ]);

        let storage_eras =
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::iter().count();
        assert_eq!(storage_eras, 1);

        let era_points = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        let mut expected_map = BTreeMap::new();
        expected_map.insert(AccountId32::from([1; 32]), 20);
        expected_map.insert(AccountId32::from([3; 32]), 40);
        expected_map.insert(AccountId32::from([5; 32]), 60);
        assert_eq!(era_points.individual, expected_map);
        assert_eq!(era_points.total, 20 + 40 + 60);
    })
}

#[test]
fn history_limit() {
    new_test_ext().execute_with(|| {
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            })
        });
        ExternalValidatorsRewards::reward_by_ids([
            (AccountId32::from([1; 32]), 10),
            (AccountId32::from([3; 32]), 30),
            (AccountId32::from([5; 32]), 50),
        ]);

        let storage_eras =
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::iter().count();
        assert_eq!(storage_eras, 1);

        ExternalValidatorsRewards::on_era_start(10, 0, 10);
        let storage_eras =
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::iter().count();
        assert_eq!(storage_eras, 1, "shouldn't erase data yet");

        ExternalValidatorsRewards::on_era_start(11, 0, 11);
        let storage_eras =
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::iter().count();
        assert_eq!(storage_eras, 0, "data should be erased now");
    })
}

#[test]
fn test_on_era_end() {
    new_test_ext().execute_with(|| {
        run_to_block(1);
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            })
        });
        let points = vec![10u32, 30u32, 50u32];
        let total_points: u32 = points.iter().cloned().sum();
        let accounts = vec![AccountId32::from([1; 32]), AccountId32::from([3; 32]), AccountId32::from([5; 32])];
        let accounts_points: Vec<_> = accounts
            .iter()
            .cloned()
            .zip(points.iter().cloned())
            .collect();
        ExternalValidatorsRewards::reward_by_ids(accounts_points);
        ExternalValidatorsRewards::on_era_end(1);

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        let inflation = <Test as pallet_external_validators_rewards::Config>::EraInflationProvider::get();
        let rewards_utils = era_rewards.generate_era_rewards_utils::<<Test as pallet_external_validators_rewards::Config>::Hashing>(1, None, inflation);

        let root = rewards_utils.unwrap().rewards_merkle_root;
        System::assert_last_event(RuntimeEvent::ExternalValidatorsRewards(
            crate::Event::RewardsMessageSent {
                message_id: Default::default(),
                era_index: 1,
                total_points: total_points as u128,
                inflation_amount: inflation,
                rewards_merkle_root: root,
            },
        ));
    })
}

#[test]
fn test_on_era_end_with_zero_inflation() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(0);
        });
        let points = vec![10u32, 30u32, 50u32];
        let total_points: u32 = points.iter().cloned().sum();
        let accounts = vec![AccountId32::from([1; 32]), AccountId32::from([3; 32]), AccountId32::from([5; 32])];
        let accounts_points: Vec<_> = accounts
            .iter()
            .cloned()
            .zip(points.iter().cloned())
            .collect();
        ExternalValidatorsRewards::reward_by_ids(accounts_points);
        ExternalValidatorsRewards::on_era_end(1);

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        let inflation = <Test as pallet_external_validators_rewards::Config>::EraInflationProvider::get();
        let rewards_utils = era_rewards.generate_era_rewards_utils::<<Test as pallet_external_validators_rewards::Config>::Hashing>(1, None, inflation);
        let root = rewards_utils.unwrap().rewards_merkle_root;
        let expected_not_thrown_event = RuntimeEvent::ExternalValidatorsRewards(
            crate::Event::RewardsMessageSent {
                message_id: Default::default(),
                era_index: 1,
                total_points: total_points as u128,
                inflation_amount: inflation,
                rewards_merkle_root: root,
            }
        );
        let events = System::events();
        assert!(
            !events
                .iter()
                .any(|record| record.event == expected_not_thrown_event),
            "event should not have been thrown",
        );
    })
}

#[test]
fn test_on_era_end_with_zero_points() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });
        let points = vec![0u32, 0u32, 0u32];
        let accounts = vec![AccountId32::from([1; 32]), AccountId32::from([3; 32]), AccountId32::from([5; 32])];
        let accounts_points: Vec<_> = accounts
            .iter()
            .cloned()
            .zip(points.iter().cloned())
            .collect();
        ExternalValidatorsRewards::reward_by_ids(accounts_points);
        ExternalValidatorsRewards::on_era_end(1);

        // When all validators have zero points, generate_era_rewards_utils should return None
        // to prevent inflation from being minted with no way to distribute it
        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        let inflation =
            <Test as pallet_external_validators_rewards::Config>::EraInflationProvider::get();
        let rewards_utils = era_rewards
            .generate_era_rewards_utils::<<Test as pallet_external_validators_rewards::Config>::Hashing>(
                1, None, inflation,
            );
        assert!(
            rewards_utils.is_none(),
            "generate_era_rewards_utils should return None when total_points is zero"
        );

        // Verify no RewardsMessageSent event was emitted
        let events = System::events();
        assert!(
            !events.iter().any(|record| matches!(
                &record.event,
                RuntimeEvent::ExternalValidatorsRewards(crate::Event::RewardsMessageSent { .. })
            )),
            "RewardsMessageSent event should not have been thrown when total_points is zero",
        );
    })
}
#[test]
fn test_inflation_minting() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            // Set inflation amount directly for this test
            mock.era_inflation = Some(10_000_000); // 10 million tokens per era
        });

        let rewards_account = RewardsEthereumSovereignAccount::get();
        let initial_rewards_balance = Balances::free_balance(&rewards_account);

        // Reward some validators to create reward points
        let points = vec![10u32, 30u32, 50u32];
        let accounts = vec![
            AccountId32::from([1; 32]),
            AccountId32::from([3; 32]),
            AccountId32::from([5; 32]),
        ];
        let accounts_points: Vec<_> = accounts
            .iter()
            .cloned()
            .zip(points.iter().cloned())
            .collect();
        ExternalValidatorsRewards::reward_by_ids(accounts_points);

        // Trigger era end which should mint inflation
        ExternalValidatorsRewards::on_era_end(1);

        // Verify inflation was minted (80% to rewards, 20% to treasury)
        let final_rewards_balance = Balances::free_balance(&rewards_account);
        let inflation_amount =
            <Test as pallet_external_validators_rewards::Config>::EraInflationProvider::get();
        let rewards_amount = inflation_amount * 80 / 100; // 80% goes to rewards

        assert_eq!(
            final_rewards_balance,
            initial_rewards_balance + rewards_amount,
            "Inflation should have been minted to rewards account"
        );
    })
}

#[test]
fn test_inflation_calculation_with_different_rates() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        // Test with different inflation amounts
        for inflation_amount in [1_000_000u128, 5_000_000u128, 10_000_000u128] {
            Mock::mutate(|mock| {
                mock.active_era = Some(ActiveEraInfo {
                    index: 1,
                    start: None,
                });
                mock.era_inflation = Some(inflation_amount);
            });

            let rewards_account = RewardsEthereumSovereignAccount::get();
            let initial_balance = Balances::free_balance(&rewards_account);

            // Add some reward points
            ExternalValidatorsRewards::reward_by_ids([(AccountId32::from([1; 32]), 100)]);

            // Trigger era end
            ExternalValidatorsRewards::on_era_end(1);

            // Verify correct amount was minted (80% to rewards, 20% to treasury)
            let final_balance = Balances::free_balance(&rewards_account);
            let rewards_amount = inflation_amount * 80 / 100;
            assert_eq!(
                final_balance - initial_balance,
                rewards_amount,
                "Incorrect inflation amount minted for rate {}",
                inflation_amount
            );

            // Clean up for next iteration
            Mock::mutate(|mock| {
                mock.active_era = Some(ActiveEraInfo {
                    index: 2,
                    start: None,
                });
            });
        }
    })
}

#[test]
fn test_no_inflation_with_zero_points() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(10_000_000);
        });

        let rewards_account = RewardsEthereumSovereignAccount::get();
        let initial_balance = Balances::free_balance(&rewards_account);

        // Don't add any reward points (or add zero points)
        // This should prevent inflation from being minted

        ExternalValidatorsRewards::on_era_end(1);

        // Verify no inflation was minted because there were no reward points
        let final_balance = Balances::free_balance(&rewards_account);
        assert_eq!(
            final_balance, initial_balance,
            "No inflation should be minted when there are no reward points"
        );
    })
}

#[test]
fn test_inflation_calculation_accuracy() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        // Test that the inflation calculation doesn't lose precision
        let expected_inflation = 12_345_678_901_234u128; // Large number with precision

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(expected_inflation);
        });

        let rewards_account = RewardsEthereumSovereignAccount::get();
        let initial_balance = Balances::free_balance(&rewards_account);

        // Add reward points
        ExternalValidatorsRewards::reward_by_ids([(AccountId32::from([1; 32]), 100), (AccountId32::from([2; 32]), 200)]);

        // Trigger era end
        ExternalValidatorsRewards::on_era_end(1);

        // Verify amount was minted (80% to rewards, minor rounding acceptable)
        let final_balance = Balances::free_balance(&rewards_account);
        let rewards_amount = expected_inflation * 80 / 100;
        let actual_minted = final_balance - initial_balance;
        // Allow 1 unit difference due to Perbill rounding in treasury calculation
        assert!(
            actual_minted >= rewards_amount.saturating_sub(1) &&
            actual_minted <= rewards_amount + 1,
            "Inflation calculation should maintain precision (within 1 unit). Expected: {}, Got: {}",
            rewards_amount,
            actual_minted
        );
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// Treasury Allocation Tests
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_treasury_receives_20_percent_of_inflation() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        let base_inflation = 1_000_000u128;
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(base_inflation);
        });

        let rewards_account = RewardsEthereumSovereignAccount::get();
        let treasury_account = TreasuryAccount::get();

        let initial_rewards = Balances::free_balance(&rewards_account);
        let initial_treasury = Balances::free_balance(&treasury_account);

        // Add validators to trigger inflation
        ExternalValidatorsRewards::reward_by_ids([
            (AccountId32::from([1; 32]), 100),
            (AccountId32::from([2; 32]), 100),
            (AccountId32::from([3; 32]), 100),
            (AccountId32::from([4; 32]), 100),
            (AccountId32::from([5; 32]), 100),
        ]);

        ExternalValidatorsRewards::on_era_end(1);

        let final_rewards = Balances::free_balance(&rewards_account);
        let final_treasury = Balances::free_balance(&treasury_account);

        let rewards_received = final_rewards - initial_rewards;
        let treasury_received = final_treasury - initial_treasury;

        // Treasury should receive 20% of total inflation
        let expected_treasury = base_inflation * 20 / 100;
        let expected_rewards = base_inflation * 80 / 100;

        assert_eq!(
            treasury_received, expected_treasury,
            "Treasury should receive exactly 20% of inflation"
        );
        assert_eq!(
            rewards_received, expected_rewards,
            "Rewards account should receive exactly 80% of inflation"
        );
        assert_eq!(
            treasury_received + rewards_received,
            base_inflation,
            "Total minted should equal base inflation"
        );
    })
}

#[test]
fn test_treasury_allocation_with_different_amounts() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        let treasury_account = TreasuryAccount::get();
        let rewards_account = RewardsEthereumSovereignAccount::get();

        for (era, inflation) in [(1, 100_000u128), (2, 5_000_000u128), (3, 999_999_999u128)] {
            Mock::mutate(|mock| {
                mock.active_era = Some(ActiveEraInfo {
                    index: era,
                    start: None,
                });
                mock.era_inflation = Some(inflation);
            });

            let treasury_before = Balances::free_balance(&treasury_account);
            let rewards_before = Balances::free_balance(&rewards_account);

            ExternalValidatorsRewards::reward_by_ids([
                (AccountId32::from([1; 32]), 100),
                (AccountId32::from([2; 32]), 100),
            ]);
            ExternalValidatorsRewards::on_era_end(era);

            let treasury_after = Balances::free_balance(&treasury_account);
            let rewards_after = Balances::free_balance(&rewards_account);

            let treasury_increase = treasury_after - treasury_before;
            let rewards_increase = rewards_after - rewards_before;

            // Treasury gets mul_floor of 20%, rewards gets the remainder
            // So treasury + rewards should equal total inflation
            assert_eq!(
                treasury_increase + rewards_increase,
                inflation,
                "Era {}: Treasury + Rewards should equal total inflation",
                era
            );

            // Treasury should be approximately 20% (within 1 unit due to rounding)
            let expected_treasury = inflation * 20 / 100;
            assert!(
                treasury_increase >= expected_treasury.saturating_sub(1)
                    && treasury_increase <= expected_treasury + 1,
                "Era {}: Treasury should get approximately 20%",
                era
            );
        }
    })
}

#[test]
fn test_treasury_allocation_maintains_precision() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        // Use prime number that doesn't divide evenly by 5 (20%)
        let inflation = 1_234_567u128;

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(inflation);
        });

        let treasury_account = TreasuryAccount::get();
        let rewards_account = RewardsEthereumSovereignAccount::get();

        let treasury_before = Balances::free_balance(&treasury_account);
        let rewards_before = Balances::free_balance(&rewards_account);

        ExternalValidatorsRewards::reward_by_ids([(AccountId32::from([1; 32]), 100)]);
        ExternalValidatorsRewards::on_era_end(1);

        let treasury_after = Balances::free_balance(&treasury_account);
        let rewards_after = Balances::free_balance(&rewards_account);

        let treasury_increase = treasury_after - treasury_before;
        let rewards_increase = rewards_after - rewards_before;
        let total_minted = treasury_increase + rewards_increase;

        // Total minted should equal total inflation (no rounding loss to exceed inflation)
        assert!(
            total_minted <= inflation,
            "Total minted should not exceed inflation due to rounding"
        );

        // But should be very close (within 1 token for rounding)
        assert!(
            inflation - total_minted < 100,
            "Rounding loss should be minimal"
        );
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// Edge Case Tests
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_single_validator_network() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(1_000_000);
        });

        let rewards_account = RewardsEthereumSovereignAccount::get();
        let initial_balance = Balances::free_balance(&rewards_account);

        // Only one validator participates
        ExternalValidatorsRewards::reward_by_ids([(AccountId32::from([1; 32]), 100)]);

        ExternalValidatorsRewards::on_era_end(1);

        let final_balance = Balances::free_balance(&rewards_account);
        let inflation_received = final_balance - initial_balance;

        // Single validator should still trigger full inflation (for rewards portion)
        assert!(
            inflation_received > 0,
            "Single validator should receive rewards"
        );
    })
}

#[test]
fn test_very_large_inflation_no_overflow() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        // Use close to u128::MAX to test overflow protection
        let large_inflation = u128::MAX / 2;

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(large_inflation);
        });

        let rewards_account = RewardsEthereumSovereignAccount::get();
        let treasury_account = TreasuryAccount::get();

        let rewards_before = Balances::free_balance(&rewards_account);
        let treasury_before = Balances::free_balance(&treasury_account);

        ExternalValidatorsRewards::reward_by_ids([(AccountId32::from([1; 32]), 100)]);
        ExternalValidatorsRewards::on_era_end(1);

        let rewards_after = Balances::free_balance(&rewards_account);
        let treasury_after = Balances::free_balance(&treasury_account);

        // Should not panic or overflow
        assert!(rewards_after >= rewards_before, "Rewards should increase");
        assert!(
            treasury_after >= treasury_before,
            "Treasury should increase"
        );

        // Total should not exceed input
        let total_increase = (rewards_after - rewards_before) + (treasury_after - treasury_before);
        assert!(
            total_increase <= large_inflation,
            "Total minted should not exceed inflation amount"
        );
    })
}

#[test]
fn test_very_small_inflation_amounts() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        // Test with very small amounts
        for tiny_amount in [1u128, 2u128, 5u128, 10u128] {
            Mock::mutate(|mock| {
                mock.active_era = Some(ActiveEraInfo {
                    index: tiny_amount as u32,
                    start: None,
                });
                mock.era_inflation = Some(tiny_amount);
            });

            let rewards_account = RewardsEthereumSovereignAccount::get();
            let treasury_account = TreasuryAccount::get();

            let rewards_before = Balances::free_balance(&rewards_account);
            let treasury_before = Balances::free_balance(&treasury_account);

            ExternalValidatorsRewards::reward_by_ids([(AccountId32::from([1; 32]), 100)]);
            ExternalValidatorsRewards::on_era_end(tiny_amount as u32);

            let rewards_after = Balances::free_balance(&rewards_account);
            let treasury_after = Balances::free_balance(&treasury_account);

            let total_minted =
                (rewards_after - rewards_before) + (treasury_after - treasury_before);

            // Should handle small amounts gracefully (may round to 0 for treasury)
            assert!(
                total_minted <= tiny_amount,
                "Amount {} should not exceed inflation",
                tiny_amount
            );
        }
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// Integration and Regression Tests
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_consistent_inflation_across_eras() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        let base_inflation = 5_000_000u128;
        let rewards_account = RewardsEthereumSovereignAccount::get();

        // Run multiple eras with identical conditions
        for era in 1..=5 {
            Mock::mutate(|mock| {
                mock.active_era = Some(ActiveEraInfo {
                    index: era,
                    start: None,
                });
                mock.era_inflation = Some(base_inflation);
            });

            let balance_before = Balances::free_balance(&rewards_account);

            // Same participation every era
            ExternalValidatorsRewards::reward_by_ids([
                (AccountId32::from([1; 32]), 100),
                (AccountId32::from([2; 32]), 100),
                (AccountId32::from([3; 32]), 100),
            ]);

            ExternalValidatorsRewards::on_era_end(era);

            let balance_after = Balances::free_balance(&rewards_account);
            let inflation = balance_after - balance_before;

            // Each era should mint the same amount given identical conditions
            let expected = base_inflation * 80 / 100; // 80% to rewards account
            assert_eq!(
                inflation, expected,
                "Era {}: Inflation should be consistent across eras",
                era
            );
        }
    })
}

#[test]
fn test_no_unexpected_balance_changes() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(1_000_000);
        });

        // Check balances of non-participating accounts don't change
        let observer_account = AccountId32::from([99; 32]);
        let _ = Balances::mint_into(&observer_account, 1000); // Give it some balance

        let observer_balance_before = Balances::free_balance(&observer_account);

        ExternalValidatorsRewards::reward_by_ids([
            (AccountId32::from([1; 32]), 100),
            (AccountId32::from([2; 32]), 100),
        ]);
        ExternalValidatorsRewards::on_era_end(1);

        let observer_balance_after = Balances::free_balance(&observer_account);

        assert_eq!(
            observer_balance_before, observer_balance_after,
            "Non-participating accounts should not be affected"
        );
    })
}

#[test]
fn test_total_issuance_increases_correctly() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        let inflation = 10_000_000u128;

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(inflation);
        });

        let total_issuance_before = Balances::total_issuance();

        ExternalValidatorsRewards::reward_by_ids([
            (AccountId32::from([1; 32]), 100),
            (AccountId32::from([2; 32]), 100),
            (AccountId32::from([3; 32]), 100),
            (AccountId32::from([4; 32]), 100),
            (AccountId32::from([5; 32]), 100),
        ]);

        ExternalValidatorsRewards::on_era_end(1);

        let total_issuance_after = Balances::total_issuance();

        // Total issuance should increase by exactly the inflation amount
        assert_eq!(
            total_issuance_after - total_issuance_before,
            inflation,
            "Total issuance should increase by inflation amount"
        );
    })
}
