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

//! Benchmarking setup for pallet-external-validator-slashes

use super::*;

#[allow(unused)]
use crate::Pallet as ExternalValidatorSlashes;
use {
    crate::SlashingModeOption,
    frame_benchmarking::{v2::*, BenchmarkError},
    frame_system::RawOrigin,
    pallet_session as session,
    sp_runtime::traits::TrailingZeroInput,
};

const MAX_SLASHES: u32 = 1000;

#[allow(clippy::multiple_bound_locations)]
#[benchmarks(where T: session::Config)]
mod benchmarks {
    use super::*;

    fn dummy_slash<T: Config>(slash_id: T::SlashId) -> Slash<T::AccountId, T::SlashId> {
        let dummy = || T::AccountId::decode(&mut TrailingZeroInput::zeroes()).unwrap();
        Slash {
            validator: dummy(),
            reporters: vec![],
            slash_id,
            percentage: Perbill::from_percent(1),
            confirmed: false,
            offence_kind: OffenceKind::LivenessOffence,
        }
    }

    #[benchmark]
    fn cancel_deferred_slash(s: Linear<1, MAX_SLASHES>) -> Result<(), BenchmarkError> {
        let mut existing_slashes = Vec::new();
        let era = T::EraIndexProvider::active_era().index;
        for _ in 0..MAX_SLASHES {
            existing_slashes.push(dummy_slash::<T>(One::one()));
        }
        Slashes::<T>::insert(
            era.saturating_add(T::SlashDeferDuration::get())
                .saturating_add(One::one()),
            &existing_slashes,
        );
        let slash_indices: Vec<u32> = (0..s).collect();

        #[extrinsic_call]
        _(
            RawOrigin::Root,
            era.saturating_add(T::SlashDeferDuration::get())
                .saturating_add(One::one()),
            slash_indices,
        );

        assert_eq!(
            Slashes::<T>::get(
                era.saturating_add(T::SlashDeferDuration::get())
                    .saturating_add(One::one())
            )
            .len(),
            (MAX_SLASHES - s) as usize
        );
        Ok(())
    }

    #[benchmark]
    fn force_inject_slash() -> Result<(), BenchmarkError> {
        let era = T::EraIndexProvider::active_era().index;
        let dummy = || T::AccountId::decode(&mut TrailingZeroInput::zeroes()).unwrap();
        #[extrinsic_call]
        _(
            RawOrigin::Root,
            era,
            dummy(),
            Perbill::from_percent(50),
            OffenceKind::LivenessOffence,
        );

        assert_eq!(
            Slashes::<T>::get(
                era.saturating_add(T::SlashDeferDuration::get())
                    .saturating_add(One::one())
            )
            .len(),
            1_usize
        );
        Ok(())
    }

    #[benchmark]
    fn process_slashes_queue(s: Linear<1, 200>) -> Result<(), BenchmarkError> {
        let first_batch = (0..s)
            .map(|_| dummy_slash::<T>(One::one()))
            .collect::<Vec<_>>();
        let second_batch = vec![dummy_slash::<T>(One::one())];

        assert!(ExternalValidatorSlashes::<T>::unsent_queue_push((
            1,
            first_batch
        )));
        assert!(ExternalValidatorSlashes::<T>::unsent_queue_push((
            2,
            second_batch
        )));

        let processed;

        #[block]
        {
            processed = match Pallet::<T>::process_slashes_queue() {
                crate::ProcessSlashesQueueOutcome::Sent(count) => count,
                crate::ProcessSlashesQueueOutcome::Empty
                | crate::ProcessSlashesQueueOutcome::Requeued(_) => {
                    return Err(BenchmarkError::Stop("unexpected slashes queue outcome"))
                }
            };
        }

        assert_eq!(ExternalValidatorSlashes::<T>::unsent_queue_len(), 1);
        assert_eq!(processed, s);

        Ok(())
    }

    #[benchmark]
    fn retry_unsent_slash_era() -> Result<(), BenchmarkError> {
        let batch = vec![dummy_slash::<T>(One::one())];
        assert!(ExternalValidatorSlashes::<T>::unsent_queue_push((1, batch)));

        let origin =
            T::GovernanceOrigin::try_successful_origin().map_err(|_| BenchmarkError::Weightless)?;

        #[extrinsic_call]
        _(origin as T::RuntimeOrigin, 1u32);

        assert!(ExternalValidatorSlashes::<T>::unsent_queue_is_empty());

        Ok(())
    }

    #[benchmark]
    fn set_slashing_mode() -> Result<(), BenchmarkError> {
        #[extrinsic_call]
        _(RawOrigin::Root, SlashingModeOption::Enabled);

        Ok(())
    }

    impl_benchmark_test_suite!(
        ExternalValidatorSlashes,
        crate::mock::new_test_ext(),
        crate::mock::Test,
    );
}
