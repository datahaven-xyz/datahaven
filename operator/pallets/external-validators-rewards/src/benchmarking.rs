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

/// Helper: insert a single entry into the ring buffer at slot 0.
fn push_unsent_entry<T: Config>(era_index: u32, timestamp: u32, inflation: u128) {
    ExternalValidatorsRewards::<T>::unsent_queue_push((era_index, timestamp, inflation));
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

    /// Helper to populate reward points for an era with 1000 validators.
    fn setup_era_reward_points<T: Config + pallet_balances::Config>(era_index: u32) {
        let mut era_reward_points = EraRewardPoints::default();
        era_reward_points.total = 20 * 1000;

        for i in 0..1000 {
            let account_id = create_funded_user::<T>("candidate", i, 100);
            era_reward_points.individual.insert(account_id, 20);
        }

        <RewardPointsForEra<T>>::insert(era_index, era_reward_points);
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

    // on_initialize: oldest entry has pruned reward points
    #[benchmark]
    fn process_unsent_reward_eras_expired() -> Result<(), BenchmarkError> {
        // Push an entry whose reward points do NOT exist in storage
        push_unsent_entry::<T>(999, 0, 42);

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
        setup_era_reward_points::<T>(1);

        push_unsent_entry::<T>(1, 0, 42);

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
        setup_era_reward_points::<T>(1);

        push_unsent_entry::<T>(1, 0, 42);

        #[block]
        {
            ExternalValidatorsRewards::<T>::process_unsent_reward_eras();
        }

        Ok(())
    }

    // Governance extrinsic: retry a specific unsent era
    #[benchmark]
    fn retry_unsent_reward_era() -> Result<(), BenchmarkError> {
        frame_system::Pallet::<T>::set_block_number(0u32.into());
        T::BenchmarkHelper::setup();
        setup_era_reward_points::<T>(1);

        push_unsent_entry::<T>(1, 0, 42);

        let origin =
            T::GovernanceOrigin::try_successful_origin().map_err(|_| BenchmarkError::Weightless)?;

        #[extrinsic_call]
        _(origin as T::RuntimeOrigin, 1u32);

        assert!(ExternalValidatorsRewards::<T>::unsent_queue_is_empty());

        Ok(())
    }

    impl_benchmark_test_suite!(
        ExternalValidatorsRewards,
        crate::mock::new_test_ext(),
        crate::mock::Test,
    );
}
