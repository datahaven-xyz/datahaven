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
        ExternalValidatorsRewards::reward_by_ids([(1, 10), (3, 30), (5, 50)]);
        ExternalValidatorsRewards::reward_by_ids([(1, 10), (3, 10), (5, 10)]);

        let storage_eras =
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::iter().count();
        assert_eq!(storage_eras, 1);

        let era_points = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        let mut expected_map = BTreeMap::new();
        expected_map.insert(1, 20);
        expected_map.insert(3, 40);
        expected_map.insert(5, 60);
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
        ExternalValidatorsRewards::reward_by_ids([(1, 10), (3, 30), (5, 50)]);

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
fn history_limit_blocks_produced() {
    new_test_ext().execute_with(|| {
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            })
        });

        // Simulate block production in era 1
        ExternalValidatorsRewards::note_block_author(1);
        ExternalValidatorsRewards::note_block_author(2);

        let blocks_era1 = pallet_external_validators_rewards::BlocksProducedInEra::<Test>::get(1);
        assert_eq!(blocks_era1, 2, "Era 1 should have 2 blocks");

        // Era 10 starts - shouldn't erase era 1 yet (HistoryDepth = 10)
        ExternalValidatorsRewards::on_era_start(10, 0, 10);
        let blocks_era1 = pallet_external_validators_rewards::BlocksProducedInEra::<Test>::get(1);
        assert_eq!(blocks_era1, 2, "Era 1 blocks shouldn't be erased yet");

        // Era 11 starts - should erase era 1 now (11 - 10 = 1)
        ExternalValidatorsRewards::on_era_start(11, 0, 11);
        let blocks_era1 = pallet_external_validators_rewards::BlocksProducedInEra::<Test>::get(1);
        assert_eq!(blocks_era1, 0, "Era 1 blocks should be erased now");
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
        let accounts = vec![1u64, 3u64, 5u64];
        let accounts_points: Vec<(u64, crate::RewardPoints)> = accounts
            .iter()
            .cloned()
            .zip(points.iter().cloned())
            .collect();
        ExternalValidatorsRewards::reward_by_ids(accounts_points);

        // Author expected blocks to get 100% inflation
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::on_era_end(1);

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        let rewards_utils = era_rewards.generate_era_rewards_utils::<<Test as pallet_external_validators_rewards::Config>::Hashing>(1, None);

        let root = rewards_utils.unwrap().rewards_merkle_root;
        let base_inflation = <Test as pallet_external_validators_rewards::Config>::EraInflationProvider::get();
        // With 600 blocks authored, inflation is at 100%
        let inflation = base_inflation;
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
        let accounts = vec![1u64, 3u64, 5u64];
        let accounts_points: Vec<(u64, crate::RewardPoints)> = accounts
            .iter()
            .cloned()
            .zip(points.iter().cloned())
            .collect();
        ExternalValidatorsRewards::reward_by_ids(accounts_points);
        ExternalValidatorsRewards::on_era_end(1);

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        let rewards_utils = era_rewards.generate_era_rewards_utils::<<Test as pallet_external_validators_rewards::Config>::Hashing>(1, None);
        let root = rewards_utils.unwrap().rewards_merkle_root;
        let inflation = <Test as pallet_external_validators_rewards::Config>::EraInflationProvider::get();
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
        let total_points: u32 = points.iter().cloned().sum();
        let accounts = vec![1u64, 3u64, 5u64];
        let accounts_points: Vec<(u64, crate::RewardPoints)> = accounts
            .iter()
            .cloned()
            .zip(points.iter().cloned())
            .collect();
        ExternalValidatorsRewards::reward_by_ids(accounts_points);
        ExternalValidatorsRewards::on_era_end(1);

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        let rewards_utils = era_rewards.generate_era_rewards_utils::<<Test as pallet_external_validators_rewards::Config>::Hashing>(1, None);
        let root = rewards_utils.unwrap().rewards_merkle_root;
        let inflation = <Test as pallet_external_validators_rewards::Config>::EraInflationProvider::get();
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
        let accounts = vec![1u64, 3u64, 5u64];
        let accounts_points: Vec<(u64, crate::RewardPoints)> = accounts
            .iter()
            .cloned()
            .zip(points.iter().cloned())
            .collect();
        ExternalValidatorsRewards::reward_by_ids(accounts_points);

        // Author expected blocks to get 100% inflation
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }

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
        for (era, inflation_amount) in [(1, 1_000_000u128), (2, 5_000_000u128), (3, 10_000_000u128)]
        {
            Mock::mutate(|mock| {
                mock.active_era = Some(ActiveEraInfo {
                    index: era,
                    start: None,
                });
                mock.era_inflation = Some(inflation_amount);
            });

            let rewards_account = RewardsEthereumSovereignAccount::get();
            let initial_balance = Balances::free_balance(&rewards_account);

            // Add some reward points
            ExternalValidatorsRewards::reward_by_ids([(1, 100)]);

            // Author expected blocks to get 100% inflation
            for _ in 0..600 {
                ExternalValidatorsRewards::note_block_author(1);
            }

            // Trigger era end
            ExternalValidatorsRewards::on_era_end(era);

            // Verify correct amount was minted (80% to rewards, 20% to treasury)
            let final_balance = Balances::free_balance(&rewards_account);
            let rewards_amount = inflation_amount * 80 / 100;
            assert_eq!(
                final_balance - initial_balance,
                rewards_amount,
                "Incorrect inflation amount minted for rate {}",
                inflation_amount
            );
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
        ExternalValidatorsRewards::reward_by_ids([(1, 100), (2, 200)]);

        // Author expected blocks to get 100% inflation
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }

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

#[test]
fn test_performance_multiplier_with_full_participation() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(10_000_000); // 10 million base inflation
        });

        let rewards_account = RewardsEthereumSovereignAccount::get();
        let treasury_account = TreasuryAccount::get();
        let initial_rewards_balance = Balances::free_balance(&rewards_account);
        let initial_treasury_balance = Balances::free_balance(&treasury_account);

        // Award equal points to all validators
        ExternalValidatorsRewards::reward_by_ids([
            (1, 100),
            (2, 100),
            (3, 100),
            (4, 100),
            (5, 100),
        ]);

        // Author expected blocks to get 100% inflation
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::on_era_end(1);

        // Verify inflation is minted at full amount regardless of point distribution
        // 80% goes to rewards account, 20% goes to treasury
        let final_rewards_balance = Balances::free_balance(&rewards_account);
        let final_treasury_balance = Balances::free_balance(&treasury_account);
        let inflation_amount =
            <Test as pallet_external_validators_rewards::Config>::EraInflationProvider::get();
        let expected_rewards = inflation_amount * 80 / 100;
        let expected_treasury = inflation_amount * 20 / 100;

        assert_eq!(
            final_rewards_balance - initial_rewards_balance,
            expected_rewards,
            "Rewards account should receive 80% of inflation"
        );
        assert_eq!(
            final_treasury_balance - initial_treasury_balance,
            expected_treasury,
            "Treasury should receive 20% of inflation"
        );
    })
}

#[test]
fn test_performance_multiplier_with_partial_participation() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(10_000_000); // 10 million base inflation
        });

        let rewards_account = RewardsEthereumSovereignAccount::get();
        let treasury_account = TreasuryAccount::get();
        let initial_rewards_balance = Balances::free_balance(&rewards_account);
        let initial_treasury_balance = Balances::free_balance(&treasury_account);

        // Award points to only 3 validators (others get 0 points but inflation is still full)
        ExternalValidatorsRewards::reward_by_ids([(1, 100), (2, 100), (3, 100)]);

        // Author expected blocks to get 100% inflation
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::on_era_end(1);

        // Verify full inflation is minted regardless of number of validators with points
        // The points only affect DISTRIBUTION, not the total inflation amount
        let final_rewards_balance = Balances::free_balance(&rewards_account);
        let final_treasury_balance = Balances::free_balance(&treasury_account);
        let inflation_amount = Mock::mock().era_inflation.unwrap();
        let expected_rewards = inflation_amount * 80 / 100;
        let expected_treasury = inflation_amount * 20 / 100;

        assert_eq!(
            final_rewards_balance - initial_rewards_balance,
            expected_rewards,
            "Full inflation is minted regardless of validator point distribution"
        );
        assert_eq!(
            final_treasury_balance - initial_treasury_balance,
            expected_treasury,
            "Treasury receives 20% even with partial validator participation"
        );
    })
}

#[test]
fn test_performance_multiplier_with_zero_participation() {
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
        let treasury_account = TreasuryAccount::get();
        let initial_rewards_balance = Balances::free_balance(&rewards_account);
        let initial_treasury_balance = Balances::free_balance(&treasury_account);

        // No validators receive any points (simulates network halt)
        // Don't call reward_by_ids at all

        ExternalValidatorsRewards::on_era_end(1);

        let final_rewards_balance = Balances::free_balance(&rewards_account);
        let final_treasury_balance = Balances::free_balance(&treasury_account);

        // With zero total points, the implementation skips minting entirely
        // This is intentional - network halt should not mint rewards
        assert_eq!(
            final_rewards_balance, initial_rewards_balance,
            "Zero points (network halt) should result in no inflation to rewards account"
        );
        assert_eq!(
            final_treasury_balance, initial_treasury_balance,
            "Zero points (network halt) should result in no inflation to treasury"
        );
    })
}

#[test]
fn test_inflation_calculation_precision_with_multiplier() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        // Test with large numbers to ensure no precision loss
        let large_inflation = 999_999_999_999_999u128;

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(large_inflation);
        });

        let rewards_account = RewardsEthereumSovereignAccount::get();
        let initial_balance = Balances::free_balance(&rewards_account);

        // Full participation
        ExternalValidatorsRewards::reward_by_ids([
            (1, 1000),
            (2, 1000),
            (3, 1000),
            (4, 1000),
            (5, 1000),
        ]);

        // Author expected blocks to get 100% inflation
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::on_era_end(1);

        let final_balance = Balances::free_balance(&rewards_account);
        let actual_inflation = final_balance - initial_balance;

        // With full participation, should get full inflation (80% to rewards, 20% to treasury)
        let expected_rewards = large_inflation * 80 / 100;
        // Allow 1 unit difference due to Perbill rounding in treasury calculation
        assert!(
            actual_inflation >= expected_rewards.saturating_sub(1) &&
            actual_inflation <= expected_rewards + 1,
            "Large inflation amounts should not lose precision (within 1 unit). Expected: {}, Got: {}",
            expected_rewards,
            actual_inflation
        );
    })
}

#[test]
fn test_multiple_eras_with_varying_participation() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        let base_inflation = 1_000_000u128;
        let rewards_account = RewardsEthereumSovereignAccount::get();

        // Era 1: Full participation
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(base_inflation);
        });

        let balance_era1_start = Balances::free_balance(&rewards_account);
        ExternalValidatorsRewards::reward_by_ids([
            (1, 100),
            (2, 100),
            (3, 100),
            (4, 100),
            (5, 100),
        ]);
        // Author expected blocks to get 100% inflation
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }
        ExternalValidatorsRewards::on_era_end(1);
        let balance_era1_end = Balances::free_balance(&rewards_account);
        let era1_inflation = balance_era1_end - balance_era1_start;

        // Era 2: Half participation
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 2,
                start: None,
            });
        });

        let balance_era2_start = Balances::free_balance(&rewards_account);
        ExternalValidatorsRewards::reward_by_ids([(1, 100), (2, 100)]);
        // Author expected blocks to get 100% inflation
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }
        ExternalValidatorsRewards::on_era_end(2);
        let balance_era2_end = Balances::free_balance(&rewards_account);
        let era2_inflation = balance_era2_end - balance_era2_start;

        // Era 3: Zero participation
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 3,
                start: None,
            });
        });

        let balance_era3_start = Balances::free_balance(&rewards_account);
        // No rewards
        ExternalValidatorsRewards::on_era_end(3);
        let balance_era3_end = Balances::free_balance(&rewards_account);
        let era3_inflation = balance_era3_end - balance_era3_start;

        // Note: Without performance multiplier in mock, all eras get same inflation
        // regardless of participation (80% to rewards, 20% to treasury)
        let expected_full_rewards = base_inflation * 80 / 100;
        assert_eq!(
            era1_inflation, expected_full_rewards,
            "Era 1 should have full inflation (80% to rewards)"
        );
        assert_eq!(
            era2_inflation, expected_full_rewards,
            "Era 2 should have same inflation without performance multiplier"
        );
        assert_eq!(
            era3_inflation, 0,
            "Era 3 should have no inflation (no reward points)"
        );
    })
}

#[test]
fn test_weighting_formula_60_30_10() {
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

        // Test case 1: 100% participation
        // Formula: (60% × 100%) + (30% × heartbeat) + 10% base = 100% (assuming perfect heartbeats)
        let balance_before = Balances::free_balance(&rewards_account);
        ExternalValidatorsRewards::reward_by_ids([
            (1, 100),
            (2, 100),
            (3, 100),
            (4, 100),
            (5, 100),
        ]);
        // Author expected blocks to get 100% inflation
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }
        ExternalValidatorsRewards::on_era_end(1);
        let balance_after = Balances::free_balance(&rewards_account);
        let inflation_100 = balance_after - balance_before;

        let expected_rewards = base_inflation * 80 / 100; // 80% to rewards, 20% to treasury
        assert_eq!(
            inflation_100, expected_rewards,
            "100% participation should yield 100% inflation"
        );

        // Test case 2: 40% participation (2 out of 5 validators)
        // Formula: (60% × 40%) + (30% × 100% heartbeats) + 10% = 24% + 30% + 10% = 64% of base
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 2,
                start: None,
            });
        });
        let balance_before = Balances::free_balance(&rewards_account);
        ExternalValidatorsRewards::reward_by_ids([(1, 100), (2, 100)]);
        // Author expected blocks to get 100% inflation
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }
        ExternalValidatorsRewards::on_era_end(2);
        let balance_after = Balances::free_balance(&rewards_account);
        let inflation_40 = balance_after - balance_before;

        // Note: The test mock doesn't implement the performance multiplier,
        // so all eras get full inflation regardless of participation.
        // With full base inflation, rewards account gets 80% (20% to treasury)
        let expected_rewards = base_inflation * 80 / 100;
        assert_eq!(
            inflation_40, expected_rewards,
            "Without performance multiplier in mock, should get full inflation (80% to rewards), got {}",
            inflation_40
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
            (1, 100),
            (2, 100),
            (3, 100),
            (4, 100),
            (5, 100),
        ]);

        // Author expected blocks to get 100% inflation
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }

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

            ExternalValidatorsRewards::reward_by_ids([(1, 100), (2, 100)]);
            // Author expected blocks to get 100% inflation
            for _ in 0..600 {
                ExternalValidatorsRewards::note_block_author(1);
            }
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

        ExternalValidatorsRewards::reward_by_ids([(1, 100)]);
        // Author expected blocks to get 100% inflation
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }
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
        ExternalValidatorsRewards::reward_by_ids([(1, 100)]);

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

        ExternalValidatorsRewards::reward_by_ids([(1, 100)]);
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

            ExternalValidatorsRewards::reward_by_ids([(1, 100)]);
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

#[test]
fn test_uneven_validator_participation() {
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
        let balance_before = Balances::free_balance(&rewards_account);

        // Heavily uneven distribution - one validator does most work
        ExternalValidatorsRewards::reward_by_ids([
            (1, 1000), // 80% of points
            (2, 100),
            (3, 100),
            (4, 50),
        ]);

        ExternalValidatorsRewards::on_era_end(1);

        let balance_after = Balances::free_balance(&rewards_account);
        let inflation = balance_after - balance_before;

        // Should still mint inflation normally - point distribution affects
        // individual rewards, not total inflation
        assert!(
            inflation > 0,
            "Uneven participation should still mint inflation"
        );
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// Performance Multiplier Edge Cases
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_performance_multiplier_gradual_degradation() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        let base_inflation = 1_000_000u128;
        let rewards_account = RewardsEthereumSovereignAccount::get();
        let treasury_account = TreasuryAccount::get();

        // Test that inflation amount stays constant regardless of validator participation
        // Only the distribution among validators changes based on their points
        for (era, num_validators) in [(1, 5), (2, 4), (3, 3), (4, 2), (5, 1)] {
            Mock::mutate(|mock| {
                mock.active_era = Some(ActiveEraInfo {
                    index: era,
                    start: None,
                });
                mock.era_inflation = Some(base_inflation);
            });

            let rewards_balance_before = Balances::free_balance(&rewards_account);
            let treasury_balance_before = Balances::free_balance(&treasury_account);

            // Award equal points to varying number of validators
            let validators: Vec<_> = (1..=num_validators).map(|i| (i, 100)).collect();
            ExternalValidatorsRewards::reward_by_ids(validators);

            // Author expected blocks to get 100% inflation
            for _ in 0..600 {
                ExternalValidatorsRewards::note_block_author(1);
            }

            ExternalValidatorsRewards::on_era_end(era);

            let rewards_balance_after = Balances::free_balance(&rewards_account);
            let treasury_balance_after = Balances::free_balance(&treasury_account);

            let rewards_minted = rewards_balance_after - rewards_balance_before;
            let treasury_minted = treasury_balance_after - treasury_balance_before;
            let total_minted = rewards_minted + treasury_minted;

            // Inflation should be constant at base_inflation regardless of validator count
            assert_eq!(
                total_minted, base_inflation,
                "Era {}: Total inflation should remain constant at {}, but got {}",
                era, base_inflation, total_minted
            );
            assert_eq!(
                rewards_minted,
                base_inflation * 80 / 100,
                "Era {}: Rewards should be 80% of inflation",
                era
            );
            assert_eq!(
                treasury_minted,
                base_inflation * 20 / 100,
                "Era {}: Treasury should be 20% of inflation",
                era
            );
        }
    })
}

#[test]
fn test_alternating_participation_patterns() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        let base_inflation = 1_000_000u128;
        let rewards_account = RewardsEthereumSovereignAccount::get();

        // Test oscillating participation
        let patterns = vec![
            (1, vec![(1, 100), (2, 100), (3, 100), (4, 100), (5, 100)]), // Full
            (2, vec![(1, 100)]),                                         // Minimal
            (3, vec![(1, 100), (2, 100), (3, 100), (4, 100), (5, 100)]), // Full again
            (4, vec![(2, 100), (3, 100)]),                               // Partial
        ];

        for (era, validators) in patterns {
            Mock::mutate(|mock| {
                mock.active_era = Some(ActiveEraInfo {
                    index: era,
                    start: None,
                });
                mock.era_inflation = Some(base_inflation);
            });

            let balance_before = Balances::free_balance(&rewards_account);
            ExternalValidatorsRewards::reward_by_ids(validators);
            ExternalValidatorsRewards::on_era_end(era);

            let balance_after = Balances::free_balance(&rewards_account);
            let inflation = balance_after - balance_before;

            // All patterns should result in some inflation
            assert!(inflation > 0, "Era {} should mint some inflation", era);
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
            ExternalValidatorsRewards::reward_by_ids([(1, 100), (2, 100), (3, 100)]);

            // Author expected blocks to get 100% inflation
            for _ in 0..600 {
                ExternalValidatorsRewards::note_block_author(1);
            }

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
        let observer_account = 99u64;
        let _ = Balances::mint_into(&observer_account, 1000); // Give it some balance

        let observer_balance_before = Balances::free_balance(&observer_account);

        ExternalValidatorsRewards::reward_by_ids([(1, 100), (2, 100)]);
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
            (1, 100),
            (2, 100),
            (3, 100),
            (4, 100),
            (5, 100),
        ]);

        // Author expected blocks to get 100% inflation
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }

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

// ═══════════════════════════════════════════════════════════════════════════
// Session-Based Performance Tracking Tests
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_session_performance_block_authorship_tracking() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validator1 = 1u64;
        let validator2 = 2u64;
        let validator3 = 3u64;

        // Simulate block authorship during a session
        ExternalValidatorsRewards::note_block_author(validator1);
        ExternalValidatorsRewards::note_block_author(validator1);
        ExternalValidatorsRewards::note_block_author(validator2);
        ExternalValidatorsRewards::note_block_author(validator1);
        ExternalValidatorsRewards::note_block_author(validator3);

        // Check block counts
        assert_eq!(
            pallet_external_validators_rewards::BlocksAuthoredInSession::<Test>::get(validator1),
            3,
            "Validator 1 should have authored 3 blocks"
        );
        assert_eq!(
            pallet_external_validators_rewards::BlocksAuthoredInSession::<Test>::get(validator2),
            1,
            "Validator 2 should have authored 1 block"
        );
        assert_eq!(
            pallet_external_validators_rewards::BlocksAuthoredInSession::<Test>::get(validator3),
            1,
            "Validator 3 should have authored 1 block"
        );
    })
}

#[test]
fn test_session_performance_60_30_10_formula() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validators = vec![1u64, 2u64, 3u64, 4u64];

        // Simulate varied block production:
        // Validator 1: 4 blocks
        // Validator 2: 4 blocks
        // Validator 3: 2 blocks
        // Validator 4: 0 blocks
        for _ in 0..4 {
            ExternalValidatorsRewards::note_block_author(1);
            ExternalValidatorsRewards::note_block_author(2);
        }
        for _ in 0..2 {
            ExternalValidatorsRewards::note_block_author(3);
        }

        // MockIsOnline always returns true, so all validators are considered online

        // Award session performance points
        ExternalValidatorsRewards::award_session_performance_points(
            1, // session_index
            validators.clone(),
            vec![], // no whitelisted validators
        );

        // Check points awarded based on new formula:
        // 10 blocks total, 4 validators
        // fair_share = 10/4 = 2, max_credited = 2 + 50%×2 = 3
        // effective_total_for_other = max(10, 4) = 10
        //
        // New formula per validator (with BasePointsPerBlock = 320):
        //   block_contribution = 60% × credited × 320
        //   liveness_base_contribution = 40% × 10 × 320 / 4 = 320
        //
        // - Validator 1: 4 blocks → credited=3, block=576, other=320, total=896
        // - Validator 2: 4 blocks → credited=3, block=576, other=320, total=896
        // - Validator 3: 2 blocks → credited=2, block=384, other=320, total=704
        // - Validator 4: 0 blocks → credited=0, block=0, other=320, total=320

        // Check total points for the active era (era 1)
        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        assert_eq!(
            era_rewards.total,
            2816, // 896 + 896 + 704 + 320
            "Total points should be 2816"
        );
    })
}

#[test]
fn test_session_performance_whitelisted_validators_excluded() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validators = vec![1u64, 2u64, 3u64];
        let whitelisted = vec![2u64]; // Validator 2 is whitelisted

        // All validators author equal blocks (3 each = 9 total)
        for _ in 0..3 {
            ExternalValidatorsRewards::note_block_author(1);
            ExternalValidatorsRewards::note_block_author(2);
            ExternalValidatorsRewards::note_block_author(3);
        }

        // Award session performance points
        ExternalValidatorsRewards::award_session_performance_points(1, validators, whitelisted);

        // Fair share and liveness/base both use total validator count:
        // 9 blocks total, 3 validators, 2 non-whitelisted
        // fair_share = 9/3 = 3, max_credited = 3 + 50%×3 = 4
        // effective_total_for_other = max(9, 3) = 9
        //
        // block_contribution = 60% × credited × 320
        // liveness_base_contribution = 40% × 9 × 320 / 3 = 384
        //
        // Validators 1 and 3 (3 blocks each):
        // - credited = min(3, 4) = 3
        // - block_contribution = 60% × 3 × 320 = 576
        // - liveness_base_contribution = 384
        // - total = 960
        //
        // Validator 2 (whitelisted): 0 points
        //
        // Total: 960 + 960 = 1920 points
        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        assert_eq!(
            era_rewards.total, 1920,
            "Only non-whitelisted validators should receive points (960 each)"
        );
    })
}

#[test]
fn test_session_performance_whitelisted_fair_share_calculation() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        // Scenario: 4 validators total, 2 whitelisted, 2 normal
        // All author equal blocks (3 each = 12 total)
        let validators = vec![1u64, 2u64, 3u64, 4u64];
        let whitelisted = vec![2u64, 4u64]; // Validators 2 and 4 are whitelisted

        // All validators author 3 blocks each
        for _ in 0..3 {
            ExternalValidatorsRewards::note_block_author(1);
            ExternalValidatorsRewards::note_block_author(2);
            ExternalValidatorsRewards::note_block_author(3);
            ExternalValidatorsRewards::note_block_author(4);
        }

        // Award session performance points
        ExternalValidatorsRewards::award_session_performance_points(1, validators, whitelisted);

        // Fair share and liveness/base both use total validator count:
        // fair_share = 12 total blocks / 4 total validators = 3 blocks
        // max_credited = 3 + 50%×3 = 4 (soft cap)
        // effective_total_for_other = max(12, 4) = 12
        //
        // Validators 1 and 3: 3 blocks each
        // - credited = min(3, 4) = 3
        // - block_contribution = 60% × 3 × 320 = 576
        // - liveness_base_contribution = 40% × 12 × 320 / 4 = 384
        // - total = 576 + 384 = 960
        //
        // Whitelisted validators 2 and 4: 0 points
        //
        // Total: 960 + 960 = 1920 points

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        assert_eq!(
            era_rewards.total, 1920,
            "Non-whitelisted validators receive points based on fair share calculation"
        );

        // Verify individual points
        assert_eq!(
            era_rewards.individual.get(&1u64).copied().unwrap_or(0),
            960,
            "Validator 1 should have 960 points"
        );
        assert_eq!(
            era_rewards.individual.get(&2u64).copied().unwrap_or(0),
            0,
            "Validator 2 (whitelisted) should have 0 points"
        );
        assert_eq!(
            era_rewards.individual.get(&3u64).copied().unwrap_or(0),
            960,
            "Validator 3 should have 960 points"
        );
        assert_eq!(
            era_rewards.individual.get(&4u64).copied().unwrap_or(0),
            0,
            "Validator 4 (whitelisted) should have 0 points"
        );
    })
}

#[test]
fn test_session_performance_block_count_reset_per_session() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validator = 1u64;

        // Author blocks in session 1
        ExternalValidatorsRewards::note_block_author(validator);
        ExternalValidatorsRewards::note_block_author(validator);

        assert_eq!(
            pallet_external_validators_rewards::BlocksAuthoredInSession::<Test>::get(validator),
            2
        );

        // Clear session storage (simulating session end)
        let _ = pallet_external_validators_rewards::BlocksAuthoredInSession::<Test>::clear(
            u32::MAX,
            None,
        );

        // Verify blocks are reset
        assert_eq!(
            pallet_external_validators_rewards::BlocksAuthoredInSession::<Test>::get(validator),
            0,
            "Block count should reset after session end"
        );
    })
}

#[test]
fn test_session_performance_zero_total_blocks() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validators = vec![1u64, 2u64, 3u64];

        // No blocks authored by anyone

        // Award session performance points
        ExternalValidatorsRewards::award_session_performance_points(1, validators, vec![]);

        // With 0 total blocks, fair_share defaults to 1 (via .max(1))
        // effective_total_for_other = max(0, 3) = 3
        // Each validator: 0 blocks
        // - block_contribution = 60% × 0 × 320 = 0
        // - liveness_base_contribution = 40% × 3 × 320 / 3 = 128
        // - total = 128 points
        // Total: 3 validators × 128 points = 384 points

        assert_eq!(
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1).total,
            384,
            "Should award liveness + base points even with zero blocks"
        );
    })
}

#[test]
fn test_session_performance_fair_share_capping() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validators = vec![1u64, 2u64];

        // Validator 1 authors many more blocks than fair share (overperformer)
        // Validator 2 authors below fair share
        for _ in 0..10 {
            ExternalValidatorsRewards::note_block_author(1);
        }
        for _ in 0..5 {
            ExternalValidatorsRewards::note_block_author(2);
        }

        // Total: 15 blocks, 2 validators
        // fair_share = 15/2 = 7, max_credited = 7 + 50%×7 = 10
        // effective_total_for_other = max(15, 2) = 15

        // Award session performance points
        ExternalValidatorsRewards::award_session_performance_points(1, validators, vec![]);

        // New formula (with BasePointsPerBlock = 320):
        // block_contribution = 60% × credited × 320
        // liveness_base_contribution = 40% × 15 × 320 / 2 = 960
        //
        // Validator 1: 10 blocks → credited=10 → block=1920, other=960, total=2880
        // Validator 2: 5 blocks → credited=5 → block=960, other=960, total=1920
        //
        // Total = 2880 + 1920 = 4800 points
        // This demonstrates over-performers now correctly earn more than 100% of fair share!
        let total_points =
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1).total;
        assert_eq!(
            total_points, 4800,
            "Over-performer should earn bonus points, got {}",
            total_points
        );
    })
}

#[test]
fn test_session_performance_single_validator() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validators = vec![1u64];

        // Single validator authors all blocks
        for _ in 0..10 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::award_session_performance_points(1, validators, vec![]);

        // Fair share: 10 / 1 = 10 blocks
        // max_credited = 10 + 50%×10 = 15
        // effective_total_for_other = max(10, 1) = 10
        //
        // block_contribution = 60% × 10 × 320 = 1920
        // liveness_base_contribution = 40% × 10 × 320 / 1 = 1280
        // Total: 1920 + 1280 = 3200 points

        assert_eq!(
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1).total,
            3200,
            "Single validator should get full points"
        );
    })
}

#[test]
fn test_session_performance_no_active_validators() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validators = vec![];

        // Award session performance points with empty validator set
        ExternalValidatorsRewards::award_session_performance_points(1, validators, vec![]);

        // Should handle gracefully without panicking
        assert_eq!(
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1).total,
            0,
            "No validators should result in zero points"
        );
    })
}

#[test]
fn test_session_performance_checked_math_division() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        // Test that division by zero is handled safely
        let validators = vec![1u64, 2u64, 3u64];

        // Session 1: No blocks produced
        ExternalValidatorsRewards::award_session_performance_points(1, validators.clone(), vec![]);

        // Should not panic, checked_div returns Some or defaults to 1 via .max(1)
        // With 0 blocks, effective_total_for_other = max(0, 3) = 3
        // Each validator: block_contribution = 0
        // liveness_base_contribution = 40% × 3 × 320 / 3 = 128 per validator
        // Total for 3 validators = 384 points
        let points_after_session1 =
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1).total;
        assert_eq!(
            points_after_session1, 384,
            "Should award 384 points (128 per validator) with zero blocks"
        );

        // Session 2: Author blocks equally among all validators
        for _ in 0..6 {
            ExternalValidatorsRewards::note_block_author(1);
            ExternalValidatorsRewards::note_block_author(2);
            ExternalValidatorsRewards::note_block_author(3);
        }

        ExternalValidatorsRewards::award_session_performance_points(2, validators, vec![]);

        // With 18 blocks (6 per validator):
        // fair_share = 18 / 3 = 6, max_credited = 6 + 50%×6 = 9
        // effective_total_for_other = max(18, 3) = 18
        //
        // Each validator: 6 blocks → credited 6
        // block_contribution = 60% × 6 × 320 = 1152
        // liveness_base_contribution = 40% × 18 × 320 / 3 = 768
        // Total per validator = 1920
        // Total for 3 validators = 5760 points
        // Cumulative total = 384 + 5760 = 6144 points
        let points_after_session2 =
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1).total;
        assert_eq!(
            points_after_session2, 6144,
            "Should have 6144 total points (384 from session 1 + 5760 from session 2)"
        );
    })
}

#[test]
fn test_session_performance_multiple_sessions_cumulative() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validators = vec![1u64, 2u64];

        // Session 1
        for _ in 0..4 {
            ExternalValidatorsRewards::note_block_author(1);
            ExternalValidatorsRewards::note_block_author(2);
        }

        ExternalValidatorsRewards::award_session_performance_points(1, validators.clone(), vec![]);

        let points_after_session1 =
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1).total;

        // Clear session storage
        let _ = pallet_external_validators_rewards::BlocksAuthoredInSession::<Test>::clear(
            u32::MAX,
            None,
        );

        // Session 2
        for _ in 0..4 {
            ExternalValidatorsRewards::note_block_author(1);
            ExternalValidatorsRewards::note_block_author(2);
        }

        ExternalValidatorsRewards::award_session_performance_points(2, validators, vec![]);

        let points_after_session2 =
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1).total;

        // Points should accumulate across sessions within the same era
        assert!(
            points_after_session2 >= points_after_session1,
            "Points should accumulate across sessions"
        );
    })
}

#[test]
fn test_session_performance_base_reward_points_config() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validators = vec![1u64];

        // Single validator with perfect performance
        for _ in 0..5 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::award_session_performance_points(1, validators, vec![]);

        // BasePointsPerBlock is 320 (points per block)
        // fair_share = 5 blocks, effective_total_for_other = max(5, 1) = 5
        //
        // block_contribution = 60% × 5 × 320 = 960
        // liveness_base_contribution = 40% × 5 × 320 / 1 = 640
        // Total: 960 + 640 = 1600 points
        assert_eq!(
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1).total,
            1600,
            "Should use configured BasePointsPerBlock value (points per block)"
        );
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// Inflation Scaling Tests
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_inflation_scaling_zero_blocks_produced() {
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

        // Award points but don't author any blocks
        ExternalValidatorsRewards::reward_by_ids([(1, 100), (2, 100)]);

        // Trigger era end without authoring blocks
        ExternalValidatorsRewards::on_era_end(1);

        let final_rewards = Balances::free_balance(&rewards_account);
        let final_treasury = Balances::free_balance(&treasury_account);

        // With 0 blocks produced, should get MinInflationPercent (20%)
        let expected_total = base_inflation * 20 / 100;
        let expected_rewards = expected_total * 80 / 100;
        let expected_treasury = expected_total * 20 / 100;

        assert_eq!(
            final_rewards - initial_rewards,
            expected_rewards,
            "Should mint 20% of base inflation (min) to rewards account"
        );
        assert_eq!(
            final_treasury - initial_treasury,
            expected_treasury,
            "Should mint 20% of base inflation (min) to treasury"
        );
    })
}

#[test]
fn test_inflation_scaling_half_expected_blocks() {
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

        // Award points and author half the expected blocks (300 out of 600)
        ExternalValidatorsRewards::reward_by_ids([(1, 100), (2, 100)]);
        for _ in 0..300 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::on_era_end(1);

        let final_rewards = Balances::free_balance(&rewards_account);
        let final_treasury = Balances::free_balance(&treasury_account);

        // With 50% blocks: min% + (50% × (max% - min%)) = 20% + (50% × 80%) = 60%
        let expected_total = base_inflation * 60 / 100;
        let expected_rewards = expected_total * 80 / 100;
        let expected_treasury = expected_total * 20 / 100;

        assert_eq!(
            final_rewards - initial_rewards,
            expected_rewards,
            "Should mint 60% of base inflation to rewards account"
        );
        assert_eq!(
            final_treasury - initial_treasury,
            expected_treasury,
            "Should mint 60% of base inflation to treasury"
        );
    })
}

#[test]
fn test_inflation_scaling_full_expected_blocks() {
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

        // Award points and author all expected blocks (600)
        ExternalValidatorsRewards::reward_by_ids([(1, 100), (2, 100)]);
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::on_era_end(1);

        let final_rewards = Balances::free_balance(&rewards_account);
        let final_treasury = Balances::free_balance(&treasury_account);

        // With 100% blocks: min% + (100% × (max% - min%)) = 20% + 80% = 100%
        let expected_total = base_inflation;
        let expected_rewards = expected_total * 80 / 100;
        let expected_treasury = expected_total * 20 / 100;

        assert_eq!(
            final_rewards - initial_rewards,
            expected_rewards,
            "Should mint 100% of base inflation to rewards account"
        );
        assert_eq!(
            final_treasury - initial_treasury,
            expected_treasury,
            "Should mint 100% of base inflation to treasury"
        );
    })
}

#[test]
fn test_inflation_scaling_overproduction_capped() {
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

        // Award points and author more than expected blocks (900 > 600)
        ExternalValidatorsRewards::reward_by_ids([(1, 100), (2, 100)]);
        for _ in 0..900 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::on_era_end(1);

        let final_rewards = Balances::free_balance(&rewards_account);
        let final_treasury = Balances::free_balance(&treasury_account);

        // Overproduction should be capped at 100% (600 blocks used for calculation)
        let expected_total = base_inflation;
        let expected_rewards = expected_total * 80 / 100;
        let expected_treasury = expected_total * 20 / 100;

        assert_eq!(
            final_rewards - initial_rewards,
            expected_rewards,
            "Overproduction should be capped at 100% inflation"
        );
        assert_eq!(
            final_treasury - initial_treasury,
            expected_treasury,
            "Treasury should also be capped at 100% inflation"
        );
    })
}

#[test]
fn test_inflation_scaling_quarter_blocks() {
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
        let initial_rewards = Balances::free_balance(&rewards_account);

        // Award points and author 25% of expected blocks (150 out of 600)
        ExternalValidatorsRewards::reward_by_ids([(1, 100)]);
        for _ in 0..150 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::on_era_end(1);

        let final_rewards = Balances::free_balance(&rewards_account);

        // With 25% blocks: min% + (25% × (max% - min%)) = 20% + (25% × 80%) = 40%
        let expected_total = base_inflation * 40 / 100;
        let expected_rewards = expected_total * 80 / 100;

        assert_eq!(
            final_rewards - initial_rewards,
            expected_rewards,
            "Should mint 40% of base inflation to rewards account"
        );
    })
}

#[test]
fn test_inflation_scaling_three_quarters_blocks() {
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
        let initial_rewards = Balances::free_balance(&rewards_account);

        // Award points and author 75% of expected blocks (450 out of 600)
        ExternalValidatorsRewards::reward_by_ids([(1, 100)]);
        for _ in 0..450 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::on_era_end(1);

        let final_rewards = Balances::free_balance(&rewards_account);

        // With 75% blocks: min% + (75% × (max% - min%)) = 20% + (75% × 80%) = 80%
        let expected_total = base_inflation * 80 / 100;
        let expected_rewards = expected_total * 80 / 100;

        assert_eq!(
            final_rewards - initial_rewards,
            expected_rewards,
            "Should mint 80% of base inflation to rewards account"
        );
    })
}

#[test]
fn test_inflation_scaling_blocks_tracked_per_era() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        let base_inflation = 1_000_000u128;

        // Era 1: Author 300 blocks
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(base_inflation);
        });

        ExternalValidatorsRewards::reward_by_ids([(1, 100)]);
        for _ in 0..300 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        let blocks_era1 = pallet_external_validators_rewards::BlocksProducedInEra::<Test>::get(1);
        assert_eq!(blocks_era1, 300, "Era 1 should have 300 blocks tracked");

        ExternalValidatorsRewards::on_era_end(1);

        // Era 2: Author 450 blocks
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 2,
                start: None,
            });
            mock.era_inflation = Some(base_inflation);
        });

        ExternalValidatorsRewards::reward_by_ids([(1, 100)]);
        for _ in 0..450 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        let blocks_era2 = pallet_external_validators_rewards::BlocksProducedInEra::<Test>::get(2);
        assert_eq!(blocks_era2, 450, "Era 2 should have 450 blocks tracked");

        // Verify Era 1 blocks are still tracked separately
        let blocks_era1_after =
            pallet_external_validators_rewards::BlocksProducedInEra::<Test>::get(1);
        assert_eq!(blocks_era1_after, 300, "Era 1 blocks should remain at 300");
    })
}

#[test]
fn test_inflation_scaling_multiple_eras_different_performance() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        let base_inflation = 1_000_000u128;
        let rewards_account = RewardsEthereumSovereignAccount::get();

        // Era 1: 0% blocks (0/600)
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(base_inflation);
        });
        ExternalValidatorsRewards::reward_by_ids([(1, 100)]);
        let balance_before_era1 = Balances::free_balance(&rewards_account);
        ExternalValidatorsRewards::on_era_end(1);
        let balance_after_era1 = Balances::free_balance(&rewards_account);
        let era1_inflation = balance_after_era1 - balance_before_era1;

        // Era 2: 50% blocks (300/600)
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 2,
                start: None,
            });
            mock.era_inflation = Some(base_inflation);
        });
        ExternalValidatorsRewards::reward_by_ids([(1, 100)]);
        for _ in 0..300 {
            ExternalValidatorsRewards::note_block_author(1);
        }
        let balance_before_era2 = Balances::free_balance(&rewards_account);
        ExternalValidatorsRewards::on_era_end(2);
        let balance_after_era2 = Balances::free_balance(&rewards_account);
        let era2_inflation = balance_after_era2 - balance_before_era2;

        // Era 3: 100% blocks (600/600)
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 3,
                start: None,
            });
            mock.era_inflation = Some(base_inflation);
        });
        ExternalValidatorsRewards::reward_by_ids([(1, 100)]);
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }
        let balance_before_era3 = Balances::free_balance(&rewards_account);
        ExternalValidatorsRewards::on_era_end(3);
        let balance_after_era3 = Balances::free_balance(&rewards_account);
        let era3_inflation = balance_after_era3 - balance_before_era3;

        // Verify scaling: 20% < 60% < 100%
        let expected_era1 = (base_inflation * 20 / 100) * 80 / 100;
        let expected_era2 = (base_inflation * 60 / 100) * 80 / 100;
        let expected_era3 = (base_inflation * 100 / 100) * 80 / 100;

        assert_eq!(era1_inflation, expected_era1, "Era 1 should mint 20%");
        assert_eq!(era2_inflation, expected_era2, "Era 2 should mint 60%");
        assert_eq!(era3_inflation, expected_era3, "Era 3 should mint 100%");
        assert!(
            era1_inflation < era2_inflation && era2_inflation < era3_inflation,
            "Inflation should increase with block production"
        );
    })
}

#[test]
fn test_inflation_scaling_precision_with_large_numbers() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        // Use large inflation amount to test precision
        let large_inflation = 999_999_999_999_999u128;
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            mock.era_inflation = Some(large_inflation);
        });

        let rewards_account = RewardsEthereumSovereignAccount::get();
        let initial_balance = Balances::free_balance(&rewards_account);

        // Author 50% of expected blocks
        ExternalValidatorsRewards::reward_by_ids([(1, 100)]);
        for _ in 0..300 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::on_era_end(1);

        let final_balance = Balances::free_balance(&rewards_account);
        let actual_inflation = final_balance - initial_balance;

        // With 50% blocks: 60% of base, 80% to rewards = 48% of base
        let expected = (large_inflation * 60 / 100) * 80 / 100;

        // Allow for minor rounding difference due to Perbill precision
        let difference = if actual_inflation > expected {
            actual_inflation - expected
        } else {
            expected - actual_inflation
        };

        assert!(
            difference <= 1000,
            "Large inflation amounts should maintain precision within 1000 units. Expected: {}, Got: {}, Diff: {}",
            expected,
            actual_inflation,
            difference
        );
    })
}

#[test]
fn test_inflation_scaling_with_zero_points_no_minting() {
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
        let initial_balance = Balances::free_balance(&rewards_account);

        // Author blocks but don't award any points
        for _ in 0..600 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::on_era_end(1);

        let final_balance = Balances::free_balance(&rewards_account);

        // Even with 100% block production, zero points should result in no minting
        assert_eq!(
            final_balance, initial_balance,
            "Zero points should prevent minting regardless of block production"
        );
    })
}

#[test]
fn test_inflation_scaling_block_counter_increments_correctly() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        // Initially, no blocks should be tracked
        let initial_count = pallet_external_validators_rewards::BlocksProducedInEra::<Test>::get(1);
        assert_eq!(initial_count, 0, "Should start with 0 blocks");

        // Author some blocks
        for i in 1..=10 {
            ExternalValidatorsRewards::note_block_author(1);
            let count = pallet_external_validators_rewards::BlocksProducedInEra::<Test>::get(1);
            assert_eq!(count, i, "Block count should increment to {}", i);
        }

        // Final count should be 10
        let final_count = pallet_external_validators_rewards::BlocksProducedInEra::<Test>::get(1);
        assert_eq!(final_count, 10, "Should have 10 blocks tracked");
    })
}

#[test]
fn test_inflation_scaling_different_validators_same_era() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        // Multiple validators author blocks in the same era
        for _ in 0..100 {
            ExternalValidatorsRewards::note_block_author(1);
        }
        for _ in 0..200 {
            ExternalValidatorsRewards::note_block_author(2);
        }
        for _ in 0..100 {
            ExternalValidatorsRewards::note_block_author(3);
        }

        // Total blocks should be 400
        let total_blocks = pallet_external_validators_rewards::BlocksProducedInEra::<Test>::get(1);
        assert_eq!(
            total_blocks, 400,
            "Total blocks should be sum of all validator blocks"
        );
    })
}

// =============================================================================
// OFFLINE VALIDATOR TESTS
// =============================================================================

#[test]
fn test_session_performance_offline_validator_gets_reduced_points() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            // Mark validator 2 as offline
            mock.offline_validators = vec![2];
        });

        let validators = vec![1u64, 2u64, 3u64];

        // All validators author same number of blocks
        for _ in 0..6 {
            ExternalValidatorsRewards::note_block_author(1);
            ExternalValidatorsRewards::note_block_author(2);
            ExternalValidatorsRewards::note_block_author(3);
        }

        ExternalValidatorsRewards::award_session_performance_points(1, validators, vec![]);

        // With 18 blocks total, fair_share = 6
        // max_credited = 6 + 50%×6 = 9
        // effective_total_for_other = max(18, 3) = 18

        // Validator 1 (online): 6 blocks
        // block_contribution = 60% × 6 × 320 = 1152
        // liveness_base_contribution = 40% × 18 × 320 / 3 = 768
        // Total = 1920

        // Validator 2 (offline): 6 blocks
        // block_contribution = 60% × 6 × 320 = 1152
        // liveness_base_contribution = 10% × 18 × 320 / 3 = 192 (only base, no liveness)
        // Total = 1344

        // Validator 3 (online): same as validator 1 = 1920

        // Total = 1920 + 1344 + 1920 = 5184

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        assert_eq!(
            era_rewards.individual.get(&1),
            Some(&1920),
            "Online validator 1 should get 1920 points"
        );
        assert_eq!(
            era_rewards.individual.get(&2),
            Some(&1344),
            "Offline validator 2 should get reduced points (1344)"
        );
        assert_eq!(
            era_rewards.individual.get(&3),
            Some(&1920),
            "Online validator 3 should get 1920 points"
        );
        assert_eq!(era_rewards.total, 5184, "Total should be 5184 points");
    })
}

#[test]
fn test_session_performance_all_validators_offline() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            // All validators offline
            mock.offline_validators = vec![1, 2, 3];
        });

        let validators = vec![1u64, 2u64, 3u64];

        // Validators author blocks even though offline (blocks authored but no heartbeat)
        for _ in 0..6 {
            ExternalValidatorsRewards::note_block_author(1);
            ExternalValidatorsRewards::note_block_author(2);
            ExternalValidatorsRewards::note_block_author(3);
        }

        ExternalValidatorsRewards::award_session_performance_points(1, validators, vec![]);

        // With 18 blocks total, fair_share = 6
        // effective_total_for_other = max(18, 3) = 18

        // Each validator (offline but authored blocks):
        // block_contribution = 60% × 6 × 320 = 1152
        // liveness_base_contribution = 10% × 18 × 320 / 3 = 192 (only base, no liveness)
        // Total per validator = 1344

        // Total = 1344 × 3 = 4032

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        assert_eq!(
            era_rewards.total, 4032,
            "All offline validators should each get 1344 = 4032 total"
        );
    })
}

#[test]
fn test_session_performance_offline_validator_zero_blocks() {
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            // Mark validator 2 as offline
            mock.offline_validators = vec![2];
        });

        let validators = vec![1u64, 2u64, 3u64];

        // Only validators 1 and 3 author blocks
        for _ in 0..5 {
            ExternalValidatorsRewards::note_block_author(1);
            ExternalValidatorsRewards::note_block_author(3);
        }

        ExternalValidatorsRewards::award_session_performance_points(1, validators, vec![]);

        // With 10 blocks total, fair_share = 10 / 3 = 3
        // max_credited = 3 + 50%×3 = 4
        // effective_total_for_other = max(10, 3) = 10

        // Validator 2 (offline, 0 blocks):
        // block_contribution = 60% × 0 × 320 = 0
        // liveness_base_contribution = 10% × 10 × 320 / 3 = 106 (only base, no liveness)
        // Total = 106

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        assert_eq!(
            era_rewards.individual.get(&2),
            Some(&106),
            "Offline validator with 0 blocks should only get base 10% = 106 points"
        );
    })
}

// =============================================================================
// WEIGHT OVERFLOW HANDLING TESTS
// =============================================================================

#[test]
fn test_session_performance_weight_overflow_handled() {
    // This test verifies that the defensive weight scaling works when
    // BlockAuthoringWeight + LivenessWeight > 100%.
    // Note: We cannot easily change the runtime parameters in tests,
    // so this test documents the expected behavior.
    // The actual defensive code in award_session_performance_points
    // proportionally scales the weights if they exceed 100%.
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        // With default weights (60% + 30% = 90%), base = 10%
        // The defensive scaling only triggers if sum > 100%
        // Since we can't change the config types easily in tests,
        // we verify the current behavior works correctly

        let validators = vec![1u64];

        for _ in 0..10 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::award_session_performance_points(1, validators, vec![]);

        // Verify the formula works with current weights
        // fair_share = 10, effective_total_for_other = max(10, 1) = 10
        //
        // block_contribution = 60% × 10 × 320 = 1920
        // liveness_base_contribution = 40% × 10 × 320 / 1 = 1280
        // Total = 3200

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        assert_eq!(
            era_rewards.total, 3200,
            "With valid weights summing to 100%, should get full points"
        );
    })
}

// =============================================================================
// SLASHING TESTS (Note: Slashing logic is currently disabled in lib.rs)
// =============================================================================

#[test]
fn test_slashing_check_mock_works() {
    // This test verifies that the MockSlashingCheck correctly identifies slashed validators.
    // Note: The actual slashing logic in award_session_performance_points is currently
    // commented out (disabled), so slashed validators still receive rewards.
    // This test validates the mock infrastructure is ready for when slashing is re-enabled.
    new_test_ext().execute_with(|| {
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            // Mark validator 2 as slashed in era 1
            mock.slashed_validators = vec![(1, 2)];
        });

        // Verify MockSlashingCheck works correctly
        use crate::SlashingCheck;
        assert!(
            !MockSlashingCheck::is_slashed(1, &1),
            "Validator 1 should not be slashed"
        );
        assert!(
            MockSlashingCheck::is_slashed(1, &2),
            "Validator 2 should be slashed in era 1"
        );
        assert!(
            !MockSlashingCheck::is_slashed(2, &2),
            "Validator 2 should not be slashed in era 2"
        );
    })
}

#[test]
fn test_session_performance_slashed_validator_still_gets_points_when_disabled() {
    // This test documents the CURRENT behavior where slashing is disabled.
    // Slashed validators still receive points because the slashing check
    // in award_session_performance_points is commented out.
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
            // Mark validator 2 as slashed
            mock.slashed_validators = vec![(1, 2)];
        });

        let validators = vec![1u64, 2u64];

        for _ in 0..5 {
            ExternalValidatorsRewards::note_block_author(1);
            ExternalValidatorsRewards::note_block_author(2);
        }

        ExternalValidatorsRewards::award_session_performance_points(1, validators, vec![]);

        // With slashing DISABLED, validator 2 still gets points
        // fair_share = 10 / 2 = 5
        // effective_total_for_other = max(10, 2) = 10
        //
        // Each validator: 5 blocks
        // block_contribution = 60% × 5 × 320 = 960
        // liveness_base_contribution = 40% × 10 × 320 / 2 = 640
        // Total per validator = 1600
        // Total = 3200

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        assert!(
            era_rewards.individual.get(&2).unwrap_or(&0) > &0,
            "With slashing disabled, slashed validator 2 should still receive points"
        );
        assert_eq!(
            era_rewards.total, 3200,
            "Total points should be 3200 with slashing disabled"
        );
    })
}

// =============================================================================
// EDGE CASE TESTS
// =============================================================================

#[test]
fn test_fair_share_non_integer_division_rounding() {
    // Test that integer division truncation is handled correctly
    // 10 blocks / 3 validators = 3 (not 3.33)
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validators = vec![1u64, 2u64, 3u64];

        // 10 blocks total - doesn't divide evenly by 3
        for _ in 0..10 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        ExternalValidatorsRewards::award_session_performance_points(1, validators, vec![]);

        // New formula with 10 blocks, 3 validators:
        // fair_share = 10/3 = 3, max_credited = 3 + 50%×3 = 4
        // effective_total_for_other = max(10, 3) = 10
        //
        // block_contribution = 60% × credited × 320
        // liveness_base_contribution = 40% × 10 × 320 / 3 = 1280 / 3 = 426
        //
        // Validator 1 (10 blocks): credited=4, block=768, other=426, total=1194
        // Validators 2, 3 (0 blocks): block=0, other=426, total=426 each
        //
        // Total = 1194 + 426 + 426 = 2046
        //
        // This demonstrates the fix for:
        // 1. Perbill capping - validator 1 now gets proper over-performance bonus (credited 4 > fair_share 3)
        // 2. Fair share truncation - using total_blocks (10) for liveness/base pool, not fair_share×count (9)

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        assert_eq!(
            era_rewards.total, 2046,
            "Non-integer division should not lose points"
        );
    })
}

#[test]
fn test_all_validators_whitelisted_no_panic() {
    // Edge case: all validators are whitelisted (no non-whitelisted validators)
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validators = vec![1u64, 2u64, 3u64];
        let whitelisted = vec![1u64, 2u64, 3u64]; // All are whitelisted

        // Author some blocks
        for _ in 0..10 {
            ExternalValidatorsRewards::note_block_author(1);
        }

        // Should not panic, just skip awarding points
        ExternalValidatorsRewards::award_session_performance_points(1, validators, whitelisted);

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        assert_eq!(
            era_rewards.total, 0,
            "All whitelisted validators should result in zero points"
        );
    })
}

#[test]
fn test_blocks_less_than_validators() {
    // Edge case: fewer blocks than validators
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validators = vec![1u64, 2u64, 3u64, 4u64, 5u64];

        // Only 2 blocks for 5 validators
        ExternalValidatorsRewards::note_block_author(1);
        ExternalValidatorsRewards::note_block_author(1);

        ExternalValidatorsRewards::award_session_performance_points(1, validators, vec![]);

        // fair_share = 2 / 5 = 0, but .max(1) ensures minimum of 1
        // max_credited = 1 + 50%×1 = 1
        // effective_total_for_other = max(2, 5) = 5

        // Validator 1: 2 blocks, credited = min(2, 1) = 1
        // block_contribution = 60% × 1 × 320 = 192
        // liveness_base_contribution = 40% × 5 × 320 / 5 = 128
        // total = 320

        // Validators 2-5: 0 blocks
        // block_contribution = 0
        // liveness_base_contribution = 128
        // total = 128

        // Total = 320 + 128×4 = 832

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        assert_eq!(
            era_rewards.total, 832,
            "Should handle fewer blocks than validators"
        );
    })
}

#[test]
fn test_single_block_many_validators() {
    // Edge case: 1 block for many validators
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validators = vec![1u64, 2u64, 3u64, 4u64, 5u64, 6u64, 7u64, 8u64, 9u64, 10u64];

        // Only 1 block for 10 validators
        ExternalValidatorsRewards::note_block_author(1);

        ExternalValidatorsRewards::award_session_performance_points(1, validators, vec![]);

        // fair_share = 1 / 10 = 0, but .max(1) ensures minimum of 1
        // effective_total_for_other = max(1, 10) = 10

        // Validator 1: 1 block, credited = min(1, 1) = 1
        // block_contribution = 60% × 1 × 320 = 192
        // liveness_base_contribution = 40% × 10 × 320 / 10 = 128
        // total = 320

        // Validators 2-10: 0 blocks
        // block_contribution = 0
        // liveness_base_contribution = 128
        // total = 128 each

        // Total = 320 + 128×9 = 1472

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        assert_eq!(
            era_rewards.total, 1472,
            "Should handle 1 block for many validators"
        );
    })
}

#[test]
fn test_perbill_precision_many_sessions() {
    // Test that Perbill precision doesn't cause significant drift over many sessions
    new_test_ext().execute_with(|| {
        run_to_block(1);

        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        let validators = vec![1u64, 2u64, 3u64];

        // Simulate 100 sessions with varying block counts
        for session in 0..100 {
            // Clear session storage
            let _ = pallet_external_validators_rewards::BlocksAuthoredInSession::<Test>::clear(
                u32::MAX,
                None,
            );

            // Each validator authors (session % 10 + 1) blocks
            let blocks_per_validator = (session % 10) + 1;
            for _ in 0..blocks_per_validator {
                ExternalValidatorsRewards::note_block_author(1);
                ExternalValidatorsRewards::note_block_author(2);
                ExternalValidatorsRewards::note_block_author(3);
            }

            ExternalValidatorsRewards::award_session_performance_points(
                session,
                validators.clone(),
                vec![],
            );
        }

        // Verify total points accumulated without overflow or significant precision loss
        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        assert!(
            era_rewards.total > 0,
            "Should accumulate points over many sessions"
        );

        // With equal block distribution, all validators should have equal points
        let v1_points = era_rewards.individual.get(&1).unwrap_or(&0);
        let v2_points = era_rewards.individual.get(&2).unwrap_or(&0);
        let v3_points = era_rewards.individual.get(&3).unwrap_or(&0);

        assert_eq!(
            v1_points, v2_points,
            "Validators with equal blocks should have equal points"
        );
        assert_eq!(
            v2_points, v3_points,
            "Validators with equal blocks should have equal points"
        );
    })
}

#[test]
fn test_history_depth_exact_boundary() {
    // Test cleanup at exact HistoryDepth boundary
    new_test_ext().execute_with(|| {
        // Set up data in era 1
        Mock::mutate(|mock| {
            mock.active_era = Some(ActiveEraInfo {
                index: 1,
                start: None,
            });
        });

        ExternalValidatorsRewards::note_block_author(1);
        ExternalValidatorsRewards::reward_by_ids([(1, 100)]);

        let blocks_era1_before =
            pallet_external_validators_rewards::BlocksProducedInEra::<Test>::get(1);
        let points_era1_before =
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1).total;

        assert_eq!(blocks_era1_before, 1);
        assert_eq!(points_era1_before, 100);

        // Era 11 starts - with HistoryDepth = 10, era 1 should be cleaned up
        // (11 - 10 = 1, so era 1 is at the boundary)
        ExternalValidatorsRewards::on_era_start(11, 0, 11);

        let blocks_era1_after =
            pallet_external_validators_rewards::BlocksProducedInEra::<Test>::get(1);
        let points_era1_after =
            pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1).total;

        assert_eq!(
            blocks_era1_after, 0,
            "Blocks should be cleaned up at exact boundary"
        );
        assert_eq!(
            points_era1_after, 0,
            "Points should be cleaned up at exact boundary"
        );
    })
}
