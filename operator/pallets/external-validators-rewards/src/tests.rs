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
        ExternalValidatorsRewards::on_era_end(1);

        let era_rewards = pallet_external_validators_rewards::RewardPointsForEra::<Test>::get(1);
        let rewards_utils = era_rewards.generate_era_rewards_utils::<<Test as pallet_external_validators_rewards::Config>::Hashing>(1, None);

        let root = rewards_utils.unwrap().rewards_merkle_root;
        let inflation = <Test as pallet_external_validators_rewards::Config>::EraInflationProvider::get();
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
