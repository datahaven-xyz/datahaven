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
    crate::{BenchmarkHelper, OnEraEnd},
    frame_benchmarking::{account, v2::*, BenchmarkError},
    frame_support::traits::Currency,
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

    impl_benchmark_test_suite!(
        ExternalValidatorsRewards,
        crate::mock::new_test_ext(),
        crate::mock::Test,
    );
}
