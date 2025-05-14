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

//! Benchmarking setup for pallet_external_validators

use super::*;

#[allow(unused)]
use crate::Pallet as ExternalValidators;
use {
    frame_benchmarking::{account, v2::*, BenchmarkError},
    frame_support::traits::{Currency, EnsureOrigin, Get},
    frame_system::{EventRecord, RawOrigin},
    pallet_session::{self as session, SessionManager},
    rand::{RngCore, SeedableRng},
    sp_runtime::{codec, traits::Convert},
    sp_std::prelude::*,
};
const SEED: u32 = 0;

fn assert_last_event<T: Config>(generic_event: <T as Config>::RuntimeEvent) {
    let events = frame_system::Pallet::<T>::events();
    let system_event: <T as frame_system::Config>::RuntimeEvent = generic_event.into();
    // compare to the last event record
    let EventRecord { event, .. } = &events[events.len() - 1];
    assert_eq!(event, &system_event);
}

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

struct InputFromRng<'a, T>(&'a mut T);
impl<'a, T: RngCore> codec::Input for InputFromRng<'a, T> {
    fn remaining_len(&mut self) -> Result<Option<usize>, codec::Error> {
        Ok(None)
    }

    fn read(&mut self, into: &mut [u8]) -> Result<(), codec::Error> {
        self.0.fill_bytes(into);
        Ok(())
    }
}

fn keys<T: Config + session::Config>(c: u32) -> <T as session::Config>::Keys {
    let mut rng = rand::rngs::StdRng::seed_from_u64(u64::from(c));

    Decode::decode(&mut InputFromRng(&mut rng)).unwrap()
}

fn invulnerable<T: Config + session::Config + pallet_balances::Config>(
    c: u32,
) -> (
    T::AccountId,
    <T as Config>::ValidatorId,
    <T as session::Config>::Keys,
) {
    let funded_user = create_funded_user::<T>("candidate", c, 100);
    let collator_id = <T as Config>::ValidatorIdOf::convert(funded_user.clone())
        .expect("Converstion of account id of collator id failed.");
    (funded_user, collator_id, keys::<T>(c))
}

fn invulnerables<
    T: Config + frame_system::Config + pallet_session::Config + pallet_balances::Config,
>(
    count: u32,
) -> Vec<(T::AccountId, <T as Config>::ValidatorId)> {
    let invulnerables = (0..count).map(|c| invulnerable::<T>(c)).collect::<Vec<_>>();

    for (who, _collator_id, keys) in invulnerables.clone() {
        <session::Pallet<T>>::set_keys(RawOrigin::Signed(who).into(), keys, Vec::new()).unwrap();
    }

    invulnerables
        .into_iter()
        .map(|(who, collator_id, _)| (who, collator_id))
        .collect()
}

#[allow(clippy::multiple_bound_locations)]
#[benchmarks(where T: session::Config + pallet_balances::Config)]
mod benchmarks {
    use super::*;

    #[benchmark]
    fn skip_external_validators() -> Result<(), BenchmarkError> {
        let origin =
            T::UpdateOrigin::try_successful_origin().map_err(|_| BenchmarkError::Weightless)?;

        #[extrinsic_call]
        _(origin as T::RuntimeOrigin, true);

        Ok(())
    }

    #[benchmark]
    fn add_whitelisted(
        b: Linear<1, { T::MaxWhitelistedValidators::get() - 1 }>,
    ) -> Result<(), BenchmarkError> {
        let origin =
            T::UpdateOrigin::try_successful_origin().map_err(|_| BenchmarkError::Weightless)?;

        // now we need to fill up invulnerables
        let invulnerables = invulnerables::<T>(b);

        let (_account_ids, collator_ids): (Vec<T::AccountId>, Vec<<T as Config>::ValidatorId>) =
            invulnerables.into_iter().unzip();

        let invulnerables: frame_support::BoundedVec<_, T::MaxWhitelistedValidators> =
            frame_support::BoundedVec::try_from(collator_ids).unwrap();
        <WhitelistedValidators<T>>::put(invulnerables);

        let (new_invulnerable, _collator_id, keys) = invulnerable::<T>(b + 1);
        <session::Pallet<T>>::set_keys(
            RawOrigin::Signed(new_invulnerable.clone()).into(),
            keys,
            Vec::new(),
        )
        .unwrap();

        #[extrinsic_call]
        _(origin as T::RuntimeOrigin, new_invulnerable.clone());

        assert_last_event::<T>(
            Event::WhitelistedValidatorAdded {
                account_id: new_invulnerable,
            }
            .into(),
        );
        Ok(())
    }

    #[benchmark]
    fn remove_whitelisted(
        b: Linear<{ 1 }, { T::MaxWhitelistedValidators::get() }>,
    ) -> Result<(), BenchmarkError> {
        let origin =
            T::UpdateOrigin::try_successful_origin().map_err(|_| BenchmarkError::Weightless)?;
        let invulnerables = invulnerables::<T>(b);

        let (account_ids, collator_ids): (Vec<T::AccountId>, Vec<<T as Config>::ValidatorId>) =
            invulnerables.into_iter().unzip();

        let invulnerables: frame_support::BoundedVec<_, T::MaxWhitelistedValidators> =
            frame_support::BoundedVec::try_from(collator_ids).unwrap();
        <WhitelistedValidators<T>>::put(invulnerables);

        let to_remove = account_ids.last().unwrap().clone();

        #[extrinsic_call]
        _(origin as T::RuntimeOrigin, to_remove.clone());

        assert_last_event::<T>(
            Event::WhitelistedValidatorRemoved {
                account_id: to_remove,
            }
            .into(),
        );
        Ok(())
    }

    #[benchmark]
    fn force_era() -> Result<(), BenchmarkError> {
        let origin =
            T::UpdateOrigin::try_successful_origin().map_err(|_| BenchmarkError::Weightless)?;

        #[extrinsic_call]
        _(origin as T::RuntimeOrigin, Forcing::ForceNew);

        Ok(())
    }

    #[benchmark]
    fn set_external_validators() -> Result<(), BenchmarkError> {
        let origin =
            T::UpdateOrigin::try_successful_origin().map_err(|_| BenchmarkError::Weightless)?;

        // Insert 4 external, the number should not be critical as its not a map
        let invulnerables = invulnerables::<T>(4);

        let (_account_ids, validator_ids): (Vec<T::AccountId>, Vec<<T as Config>::ValidatorId>) =
            invulnerables.into_iter().unzip();

        #[extrinsic_call]
        _(origin as T::RuntimeOrigin, validator_ids, 0);

        Ok(())
    }

    // worst case for new session.
    #[benchmark]
    fn new_session(
        r: Linear<1, { T::MaxWhitelistedValidators::get() }>,
    ) -> Result<(), BenchmarkError> {
        // start fresh
        WhitelistedValidators::<T>::kill();

        let origin =
            T::UpdateOrigin::try_successful_origin().map_err(|_| BenchmarkError::Weightless)?;

        frame_system::Pallet::<T>::set_block_number(0u32.into());
        // now we need to fill up invulnerables
        let invulnerables = invulnerables::<T>(r);

        let (account_ids, _collator_ids): (Vec<T::AccountId>, Vec<<T as Config>::ValidatorId>) =
            invulnerables.into_iter().unzip();

        for account in account_ids {
            <ExternalValidators<T>>::add_whitelisted(origin.clone(), account)
                .expect("add whitelisted failed");
        }

        let new_era_session = T::SessionsPerEra::get();

        #[block]
        {
            <ExternalValidators<T> as SessionManager<_>>::new_session(new_era_session);
        }

        Ok(())
    }

    impl_benchmark_test_suite!(
        ExternalValidators,
        crate::mock::new_test_ext(),
        crate::mock::Test,
    );
}
