// Copyright (C) Gautam Dhameja.
// Copyright (C) Parity Technologies (UK) Ltd.
// SPDX-License-Identifier: Apache-2.0

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#![cfg(feature = "runtime-benchmarks")]

use super::{Pallet as ValidatorSet, *};
use frame_benchmarking::v2::{account, benchmarks, impl_test_function, BenchmarkError};
use frame_support::traits::EnsureOrigin;
use frame_system::{EventRecord, Pallet as System};

const SEED: u32 = 0;

fn assert_last_event<T: Config>(generic_event: <T as Config>::RuntimeEvent) {
    let events = System::<T>::events();
    let system_event: <T as frame_system::Config>::RuntimeEvent = generic_event.into();
    let EventRecord { event, .. } = &events[events.len() - 1];
    assert_eq!(event, &system_event);
}

#[benchmarks]
mod benchmarks {
    use super::*;

    #[benchmark]
    fn add_validator() -> Result<(), BenchmarkError> {
        let origin = T::AddRemoveOrigin::try_successful_origin()
            .map_err(|_| BenchmarkError::Stop("unable to compute origin"))?;
        let who: T::AccountId = account("validator", 0, SEED);

        #[extrinsic_call]
        _(origin as T::RuntimeOrigin, who.clone());

        assert_last_event::<T>(Event::ValidatorAdded(who).into());
        Ok(())
    }

    #[benchmark]
    fn remove_validator() -> Result<(), BenchmarkError> {
        let origin = T::AddRemoveOrigin::try_successful_origin()
            .map_err(|_| BenchmarkError::Stop("unable to compute origin"))?;
        let who: T::AccountId = account("validator", 0, SEED);

        ValidatorSet::<T>::add_validator(origin.clone(), who.clone())
            .map_err(|_| BenchmarkError::Stop("unable to add validator"))?;

        #[extrinsic_call]
        _(origin as T::RuntimeOrigin, who.clone());

        assert_last_event::<T>(Event::ValidatorRemoved(who).into());
        Ok(())
    }

    impl_benchmark_test_suite!(ValidatorSet, crate::mock::new_test_ext(), crate::mock::Test);
}
