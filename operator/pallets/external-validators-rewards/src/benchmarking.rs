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

//! Benchmarking setup for pallet_external_validators_rewards

use super::*;

#[allow(unused)]
use crate::Pallet as ExternalValidatorsRewards;
use {
    crate::types::BenchmarkHelper,
    frame_benchmarking::{account, v2::*, BenchmarkError},
    frame_support::traits::{Currency, EnsureOrigin},
    sp_std::prelude::*,
};

const SEED: u32 = 0;

fn create_funded_user<T: Config + pallet_balances::Config>(
    string: &'static str,
    n: u32,
    balance_factor: u32,
) -> T::AccountId {
    let user = account(string, n, SEED);
    let balance = <pallet_balances::Pallet<T> as Currency<T::AccountId>>::minimum_balance()
        * balance_factor.into();
    let _ = <pallet_balances::Pallet<T> as Currency<T::AccountId>>::make_free_balance_be(
        &user, balance,
    );
    user
}

/// Helper: insert a single queued window into the ring buffer at slot 0.
fn push_unsent_entry<T: Config>(window_start: u32, window_index: u32, duration: u32) {
    ExternalValidatorsRewards::<T>::unsent_queue_push(QueuedRewardsWindow {
        window_start,
        window_index,
        duration,
    });
}

#[allow(clippy::multiple_bound_locations)]
#[benchmarks(where T: pallet_balances::Config)]
mod benchmarks {
    use super::*;

    // worst case for the end of an era.
    #[benchmark]
    fn on_era_end() -> Result<(), BenchmarkError> {
        frame_system::Pallet::<T>::set_block_number(0u32.into());

        let mut era_reward_points = EraRewardPoints::default();
        era_reward_points.total = 20 * 1000;

        for i in 0..1000 {
            let account_id = create_funded_user::<T>("candidate", i, 100);
            era_reward_points.individual.insert(account_id, 20);
        }

        T::BenchmarkHelper::setup();
        <RewardPointsForEra<T>>::insert(1u32, era_reward_points);

        #[block]
        {
            <ExternalValidatorsRewards<T> as OnEraEnd>::on_era_end(1u32);
        }

        Ok(())
    }

    /// Helper to populate persisted state for a closed window with 1000 operators.
    fn setup_window_reward_state<T: Config + pallet_balances::Config>(
        window_start: u32,
        inflation_amount: u128,
    ) {
        let mut operator_points = sp_std::collections::btree_map::BTreeMap::new();

        for i in 0..1000 {
            let _ = create_funded_user::<T>("candidate", i, 100);
            operator_points.insert(sp_core::H160::from_low_u64_be(i as u64 + 1), 20);
        }

        <WindowOperatorPoints<T>>::insert(window_start, operator_points);
        <WindowInflationAmount<T>>::insert(window_start, inflation_amount);
    }

    // on_initialize: unsent queue is empty (2 reads for head+tail)
    #[benchmark]
    fn process_unsent_reward_eras_empty() -> Result<(), BenchmarkError> {
        // Ensure queue is empty (default state: head == tail == 0)
        assert!(ExternalValidatorsRewards::<T>::unsent_queue_is_empty());

        #[block]
        {
            ExternalValidatorsRewards::<T>::process_unsent_reward_eras();
        }

        Ok(())
    }

    // on_initialize: oldest queued window no longer has persisted state
    #[benchmark]
    fn process_unsent_reward_eras_expired() -> Result<(), BenchmarkError> {
        push_unsent_entry::<T>(999, 99, 10);

        #[block]
        {
            ExternalValidatorsRewards::<T>::process_unsent_reward_eras();
        }

        // Entry should have been removed
        assert!(ExternalValidatorsRewards::<T>::unsent_queue_is_empty());

        Ok(())
    }

    // on_initialize: oldest entry retried successfully
    #[benchmark]
    fn process_unsent_reward_eras_success() -> Result<(), BenchmarkError> {
        frame_system::Pallet::<T>::set_block_number(0u32.into());
        T::BenchmarkHelper::setup();
        setup_window_reward_state::<T>(0, 42);

        push_unsent_entry::<T>(0, 0, 10);

        #[block]
        {
            ExternalValidatorsRewards::<T>::process_unsent_reward_eras();
        }

        assert!(ExternalValidatorsRewards::<T>::unsent_queue_is_empty());

        Ok(())
    }

    // Use success weight as upper bound for the failed path
    #[benchmark]
    fn process_unsent_reward_eras_failed() -> Result<(), BenchmarkError> {
        frame_system::Pallet::<T>::set_block_number(0u32.into());
        T::BenchmarkHelper::setup();
        setup_window_reward_state::<T>(0, 42);

        push_unsent_entry::<T>(0, 0, 10);

        #[block]
        {
            ExternalValidatorsRewards::<T>::process_unsent_reward_eras();
        }

        Ok(())
    }

    // Governance extrinsic: retry a specific unsent window
    #[benchmark]
    fn retry_unsent_reward_window() -> Result<(), BenchmarkError> {
        frame_system::Pallet::<T>::set_block_number(0u32.into());
        T::BenchmarkHelper::setup();
        setup_window_reward_state::<T>(0, 42);

        push_unsent_entry::<T>(0, 0, 10);

        let origin =
            T::GovernanceOrigin::try_successful_origin().map_err(|_| BenchmarkError::Weightless)?;

        #[extrinsic_call]
        _(origin as T::RuntimeOrigin, 0u32);

        assert!(ExternalValidatorsRewards::<T>::unsent_queue_is_empty());

        Ok(())
    }

    impl_benchmark_test_suite!(
        ExternalValidatorsRewards,
        crate::mock::new_test_ext(),
        crate::mock::Test,
    );
}
