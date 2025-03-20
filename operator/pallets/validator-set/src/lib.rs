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

//! Validator set pallet. Maintains a set of validators which can be added to or removed from by a
//! privileged origin.
//!
//! Provides a [`SessionManager`] implementation which returns the current validator set from
//! `new_session`. Also provides an [`OnOffenceHandler`] implementation which removes the offending
//! validators from the set (if they would be slashed) and temporarily disables them according to
//! the [`DisableStrategy`].
//!
//! Adding a validator to the set increments the validator account's provider reference count. This
//! allows the validator to set their session keys with
//! [`set_keys`](pallet_session::Pallet::set_keys). When a validator is removed, either explicitly
//! via [`remove_validator`](Pallet::remove_validator) or implicitly due to an offence, the
//! validator's session keys are automatically purged and the validator account's provider
//! reference count is decremented again. Note that failure to decrement the provider reference
//! count does not cause removal to fail; the provider reference is just leaked.
//!
//! This pallet directly depends on [`pallet_session`] and [`pallet_session::historical`].
//! [`pallet_session::Config::ValidatorId`] must be [`AccountId`](frame_system::Config::AccountId)
//! and [`pallet_session::Config::ValidatorIdOf`] must be [`ConvertInto`].

#![cfg_attr(not(feature = "std"), no_std)]

mod benchmarking;
mod mock;
mod tests;
pub mod weights;

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::{
    dispatch::RawOrigin,
    ensure,
    pallet_prelude::{DispatchResult, Weight},
    traits::Get,
    DefaultNoBound,
};
use frame_system::pallet_prelude::BlockNumberFor;
pub use pallet::*;
use pallet_session::SessionManager;
use sp_runtime::{
    traits::{ConvertInto, Zero},
    transaction_validity::{InvalidTransaction, TransactionValidityError},
    Perbill, Saturating, Vec,
};
use sp_staking::{
    offence::{OffenceDetails, OnOffenceHandler},
    SessionIndex,
};
pub use weights::WeightInfo;

const LOG_TARGET: &str = "runtime::validator-set";

/// Per-validator data stored by this pallet.
#[derive(Encode, Decode, scale_info::TypeInfo, MaxEncodedLen)]
struct Validator<BlockNumber> {
    /// The validator may not set its session keys before this block.
    min_set_keys_block: BlockNumber,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;

    #[pallet::config]
    pub trait Config:
        frame_system::Config
        + pallet_session::Config<
            ValidatorId = <Self as frame_system::Config>::AccountId,
            ValidatorIdOf = ConvertInto,
        >
    {
        /// The overarching event type.
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Weight information for extrinsics in this pallet.
        type WeightInfo: WeightInfo;

        /// Origin for adding or removing a validator.
        type AddRemoveOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// Maximum number of validators.
        #[pallet::constant]
        type MaxAuthorities: Get<u32>;

        /// Minimum number of blocks between [`set_keys`](pallet_session::Pallet::set_keys) calls
        /// by a validator.
        #[pallet::constant]
        type SetKeysCooldownBlocks: Get<BlockNumberFor<Self>>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// Validator set. Changes to this will take effect in the session after next.
    #[pallet::storage]
    pub(super) type Validators<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, Validator<BlockNumberFor<T>>, OptionQuery>;

    /// Number of validators in `Validators`.
    #[pallet::storage]
    pub(super) type NumValidators<T: Config> = StorageValue<_, u32, ValueQuery>;

    /// Validators that should be disabled in the next session.
    ///
    /// Validator removal takes effect in the session after next. Validator disabling takes effect
    /// until the end of the session. We extend disables to cover the next session as well (by
    /// adding validators here when we disable them) so that when a validator is both disabled and
    /// removed in response to an offence, there isn't a gap where it is actually present and
    /// enabled.
    #[pallet::storage]
    pub(super) type NextDisabledValidators<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, (), OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// New validator added. Effective in session after next.
        ValidatorAdded(T::AccountId),
        /// Validator removed. Effective in session after next.
        ValidatorRemoved(T::AccountId),
    }

    #[pallet::error]
    pub enum Error<T> {
        /// Validator is already in the validator set.
        Duplicate,
        /// Validator is not in the validator set.
        NotAValidator,
        /// Adding the validator would take the validator count above the maximum.
        TooManyValidators,
    }

    #[pallet::genesis_config]
    #[derive(DefaultNoBound)]
    pub struct GenesisConfig<T: Config> {
        pub initial_validators: BoundedVec<T::AccountId, T::MaxAuthorities>,
    }

    #[pallet::genesis_build]
    impl<T: Config> BuildGenesisConfig for GenesisConfig<T> {
        fn build(&self) {
            assert!(
                Validators::<T>::iter().next().is_none(),
                "Validators are already initialized"
            );
            assert_eq!(NumValidators::<T>::get(), 0);
            for who in &self.initial_validators {
                assert!(Pallet::<T>::do_add_validator(who).is_ok());
            }
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Add a new validator.
        ///
        /// This will increment the validator's provider reference count, allowing the validator to
        /// call [`set_keys`](pallet_session::Pallet::set_keys).
        ///
        /// Provided the validator calls `set_keys` in time, the addition will take effect the
        /// session after next.
        ///
        /// The origin for this call must be the pallet's `AddRemoveOrigin`. Emits
        /// [`ValidatorAdded`](Event::ValidatorAdded) when successful.
        #[pallet::call_index(0)]
        #[pallet::weight(<T as Config>::WeightInfo::add_validator())]
        pub fn add_validator(origin: OriginFor<T>, who: T::AccountId) -> DispatchResult {
            T::AddRemoveOrigin::ensure_origin(origin)?;
            Self::do_add_validator(&who)?;
            Self::deposit_event(Event::ValidatorAdded(who));
            Ok(())
        }

        /// Set the validator set to exactly match the provided list of validators.
        ///
        /// This will:
        /// 1. Keep existing validators that are in the input list
        /// 2. Remove validators that are not in the input list
        /// 3. Add new validators from the input list
        ///
        /// The origin for this call must be the pallet's `AddRemoveOrigin`. Emits
        /// [`ValidatorAdded`](Event::ValidatorAdded) for each new validator and
        /// [`ValidatorRemoved`](Event::ValidatorRemoved) for each removed validator.
        ///
        /// If the number of validators would exceed the maximum, the operation fails.
        #[pallet::call_index(1)]
        #[pallet::weight(<T as Config>::WeightInfo::add_validator().saturating_mul(validators.len() as u64))]
        pub fn set_validators(
            origin: OriginFor<T>,
            validators: Vec<T::AccountId>,
        ) -> DispatchResult {
            T::AddRemoveOrigin::ensure_origin(origin)?;

            // Check if the new validator count would exceed the maximum
            ensure!(
                validators.len() <= T::MaxAuthorities::get() as usize,
                Error::<T>::TooManyValidators
            );

            // Check for duplicates in the input list
            for (i, _) in validators.iter().enumerate() {
                for j in 0..i {
                    ensure!(validators[i] != validators[j], Error::<T>::Duplicate);
                }
            }

            // Get current validators
            let current_validators: Vec<T::AccountId> = Validators::<T>::iter_keys().collect();

            // Remove validators that are not in the new list
            for who in current_validators.iter() {
                if !validators.contains(who) {
                    if Self::do_remove_validator(who) {
                        Self::deposit_event(Event::ValidatorRemoved(who.clone()));
                    }
                }
            }

            // Add new validators
            for who in validators {
                if Validators::<T>::get(&who).is_none() {
                    Self::do_add_validator(&who)?;
                    Self::deposit_event(Event::ValidatorAdded(who));
                }
            }

            Ok(())
        }

        /// Remove a validator.
        ///
        /// This will purge the validator's session keys and decrement the validator's provider
        /// reference count.
        ///
        /// The removal will take effect the session after next.
        ///
        /// The origin for this call must be the pallet's `AddRemoveOrigin`. Emits
        /// [`ValidatorRemoved`](Event::ValidatorRemoved) when successful.
        #[pallet::call_index(2)]
        #[pallet::weight(<T as Config>::WeightInfo::remove_validator())]
        pub fn remove_validator(origin: OriginFor<T>, who: T::AccountId) -> DispatchResult {
            T::AddRemoveOrigin::ensure_origin(origin)?;
            ensure!(Self::do_remove_validator(&who), Error::<T>::NotAValidator);
            Self::deposit_event(Event::ValidatorRemoved(who));
            Ok(())
        }
    }
}

impl<T: Config> Pallet<T> {
    pub fn validators() -> Vec<T::AccountId> {
        Validators::<T>::iter_keys().collect()
    }

    fn do_add_validator(who: &T::AccountId) -> DispatchResult {
        NumValidators::<T>::mutate(|num| {
            if *num >= T::MaxAuthorities::get() {
                return Err(Error::<T>::TooManyValidators);
            }

            Validators::<T>::mutate(who, |validator| {
                if !validator.is_none() {
                    return Err(Error::<T>::Duplicate);
                }
                *validator = Some(Validator {
                    min_set_keys_block: Zero::zero(),
                });
                Ok(())
            })?;

            *num += 1;
            Ok(())
        })?;

        frame_system::Pallet::<T>::inc_providers(who);

        Ok(())
    }

    /// Returns `false` if `who` is not a validator.
    fn do_remove_validator(who: &T::AccountId) -> bool {
        if Validators::<T>::take(who).is_none() {
            return false;
        }
        NumValidators::<T>::mutate(|num| *num -= 1);

        // Decrement who's provider reference count. Purge who's session keys first as
        // dec_providers will fail if there are any consumers.
        if let Err(err) =
            pallet_session::Pallet::<T>::purge_keys(RawOrigin::Signed(who.clone()).into())
        {
            log::trace!(
                target: LOG_TARGET,
                "Failed to purge session keys for validator {who:?}: {err:?}"
            );
        }
        if let Err(err) = frame_system::Pallet::<T>::dec_providers(who) {
            log::warn!(
                target: LOG_TARGET,
                "Failed to decrement provider reference count for validator {who:?}, \
                leaking reference: {err:?}"
            );
        }

        true
    }

    fn check_min_set_keys_block(
        validator: &Validator<BlockNumberFor<T>>,
    ) -> Result<(), TransactionValidityError> {
        if frame_system::Pallet::<T>::block_number() < validator.min_set_keys_block {
            Err(InvalidTransaction::Future.into())
        } else {
            Ok(())
        }
    }

    /// Check the validity of a [`set_keys`](pallet_session::Pallet::set_keys) call by `who`.
    pub fn validate_set_keys(who: &T::AccountId) -> Result<(), TransactionValidityError> {
        match Validators::<T>::get(who) {
            Some(validator) => Self::check_min_set_keys_block(&validator),
            None => Err(InvalidTransaction::BadSigner.into()),
        }
    }

    /// Check the validity of a [`set_keys`](pallet_session::Pallet::set_keys) call by `who`, and,
    /// if valid, note the call.
    pub fn pre_dispatch_set_keys(who: &T::AccountId) -> Result<(), TransactionValidityError> {
        Validators::<T>::mutate(who, |validator| match validator {
            Some(validator) => {
                Self::check_min_set_keys_block(validator)?;
                validator.min_set_keys_block = frame_system::Pallet::<T>::block_number()
                    .saturating_add(T::SetKeysCooldownBlocks::get());
                Ok(())
            }
            None => Err(InvalidTransaction::BadSigner.into()),
        })
    }
}

impl<T: Config> SessionManager<T::AccountId> for Pallet<T> {
    fn new_session(_new_index: SessionIndex) -> Option<Vec<T::AccountId>> {
        Some(Self::validators())
    }

    fn end_session(_end_index: SessionIndex) {}

    fn start_session(_start_index: SessionIndex) {
        for (who, _) in NextDisabledValidators::<T>::drain() {
            pallet_session::Pallet::<T>::disable(&who);
        }
    }
}

impl<T: Config>
    OnOffenceHandler<T::AccountId, pallet_session::historical::IdentificationTuple<T>, Weight>
    for Pallet<T>
where
    T: pallet_session::historical::Config,
{
    fn on_offence(
        offenders: &[OffenceDetails<
            T::AccountId,
            pallet_session::historical::IdentificationTuple<T>,
        >],
        slash_fractions: &[Perbill],
        _slash_session: SessionIndex,
    ) -> Weight {
        let mut weight = Weight::zero();
        let db_weight = T::DbWeight::get();

        for (offender, slash_fraction) in offenders.iter().zip(slash_fractions) {
            // Determine actions to take with this validator
            let remove = !slash_fraction.is_zero();

            if remove {
                // Note that the validator might already have been removed (explicitly, for another
                // offence, or even by an earlier report of this offence)
                weight.saturating_accrue(db_weight.reads(1));
                if Self::do_remove_validator(&offender.offender.0) {
                    weight.saturating_accrue(db_weight.reads_writes(1, 2));
                }
            }
        }

        weight
    }
}
