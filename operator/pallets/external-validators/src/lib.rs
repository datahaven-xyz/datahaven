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

//! ExternalValidators pallet.
//!
//! A pallet to manage external validators for a solochain.
//!
//! ## Terminology
//!
//! - WhitelistedValidators: Fixed validators set by root/governance. Have priority over the external validators.
//!      Are not rewarded.
//! - ExternalValidators: Validators set using storage proofs from another blockchain. Can be disabled by setting
//!     `SkipExternalValidators` to true.
//!
//! Validators only change once per era. By default the era changes after a fixed number of sessions, but new eras
//! can be forced or disabled using a root extrinsic.
//!
//! The structure of this pallet and the concept of eras is inspired by `pallet_staking` from Polkadot.

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;
use {
    frame_support::pallet_prelude::Weight,
    log::log,
    parity_scale_codec::{Decode, Encode, MaxEncodedLen},
    scale_info::TypeInfo,
    sp_runtime::{traits::Get, RuntimeDebug},
    sp_staking::SessionIndex,
    sp_std::{collections::btree_set::BTreeSet, vec::Vec},
    traits::{
        ActiveEraInfo, EraIndex, EraIndexProvider, ExternalIndexProvider, InvulnerablesProvider,
        OnEraEnd, OnEraStart, ValidatorProvider,
    },
};

pub use macro_rules_attribute::apply;

pub mod __reexports {
    pub use {
        frame_support::{CloneNoBound, EqNoBound, PartialEqNoBound, RuntimeDebugNoBound},
        parity_scale_codec::DecodeWithMemTracking,
        scale_info::TypeInfo,
        sp_core::{Decode, Encode, RuntimeDebug},
    };
}

#[macro_export]
macro_rules! derive_storage_traits {
    ( $( $tt:tt )* ) => {
        #[derive(
            $crate::__reexports::RuntimeDebug,
            ::core::cmp::PartialEq,
            ::core::cmp::Eq,
            ::core::clone::Clone,
            $crate::__reexports::Encode,
            $crate::__reexports::Decode,
            $crate::__reexports::TypeInfo,
        )]
        $($tt)*
    }
}
#[cfg(test)]
mod mock;
pub mod traits;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;
pub mod weights;

#[frame_support::pallet]
pub mod pallet {
    pub use crate::weights::WeightInfo;

    #[cfg(feature = "runtime-benchmarks")]
    use frame_support::traits::Currency;
    use {
        super::*,
        frame_support::{
            dispatch::DispatchResultWithPostInfo,
            pallet_prelude::*,
            traits::{EnsureOrigin, UnixTime, ValidatorRegistration},
            BoundedVec, DefaultNoBound,
        },
        frame_system::pallet_prelude::*,
        sp_runtime::{traits::Convert, SaturatedConversion},
        sp_std::vec::Vec,
    };

    /// Configure the pallet by specifying the parameters and types on which it depends.
    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// Overarching event type.
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Origin that can dictate updating parameters of this pallet.
        type UpdateOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// Number of eras to keep in history.
        ///
        /// Following information is kept for eras in `[current_era -
        /// HistoryDepth, current_era]`: `ErasStartSessionIndex`
        ///
        /// Must be more than the number of eras delayed by session.
        /// I.e. active era must always be in history. I.e. `active_era >
        /// current_era - history_depth` must be guaranteed.
        ///
        /// If migrating an existing pallet from storage value to config value,
        /// this should be set to same value or greater as in storage.
        #[pallet::constant]
        type HistoryDepth: Get<u32>;

        /// Maximum number of whitelisted validators.
        #[pallet::constant]
        type MaxWhitelistedValidators: Get<u32>;

        /// Maximum number of external validators.
        #[pallet::constant]
        type MaxExternalValidators: Get<u32>;

        /// A stable ID for a validator.
        type ValidatorId: Member
            + Parameter
            + Ord
            + MaybeSerializeDeserialize
            + MaxEncodedLen
            + TryFrom<Self::AccountId>;

        /// A conversion from account ID to validator ID.
        ///
        /// Its cost must be at most one storage read.
        type ValidatorIdOf: Convert<Self::AccountId, Option<Self::ValidatorId>>;

        /// Validate a user is registered
        type ValidatorRegistration: ValidatorRegistration<Self::ValidatorId>;

        /// Time used for computing era duration.
        ///
        /// It is guaranteed to start being called from the first `on_finalize`. Thus value at
        /// genesis is not used.
        type UnixTime: UnixTime;

        /// Number of sessions per era.
        #[pallet::constant]
        type SessionsPerEra: Get<SessionIndex>;

        type OnEraStart: OnEraStart;
        type OnEraEnd: OnEraEnd;

        /// The weight information of this pallet.
        type WeightInfo: WeightInfo;

        #[cfg(feature = "runtime-benchmarks")]
        type Currency: Currency<Self::AccountId>
            + frame_support::traits::fungible::Balanced<Self::AccountId>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// Fixed validators set by root/governance. Have priority over the external validators.
    #[pallet::storage]
    pub type WhitelistedValidators<T: Config> =
        StorageValue<_, BoundedVec<T::ValidatorId, T::MaxWhitelistedValidators>, ValueQuery>;

    /// Copy of `WhitelistedValidators` at the start of this active era.
    /// Used to check which validators we don't need to reward.
    #[pallet::storage]
    pub type WhitelistedValidatorsActiveEra<T: Config> =
        StorageValue<_, BoundedVec<T::ValidatorId, T::MaxWhitelistedValidators>, ValueQuery>;

    /// Same as `WhitelistedValidatorsActiveEra` but only exists for a brief period of time when the
    /// next era has been planned but not enacted yet.
    #[pallet::storage]
    pub type WhitelistedValidatorsActiveEraPending<T: Config> =
        StorageValue<_, BoundedVec<T::ValidatorId, T::MaxWhitelistedValidators>, ValueQuery>;

    /// Validators set using storage proofs from another blockchain. Ignored if `SkipExternalValidators` is true.
    #[pallet::storage]
    pub type ExternalValidators<T: Config> =
        StorageValue<_, BoundedVec<T::ValidatorId, T::MaxExternalValidators>, ValueQuery>;

    /// Allow to disable external validators.
    #[pallet::storage]
    pub type SkipExternalValidators<T: Config> = StorageValue<_, bool, ValueQuery>;

    /// The current era information, it is either ActiveEra or ActiveEra + 1 if the new era validators have been queued.
    #[pallet::storage]
    pub type CurrentEra<T: Config> = StorageValue<_, EraIndex>;

    /// The active era information, it holds index and start.
    #[pallet::storage]
    pub type ActiveEra<T: Config> = StorageValue<_, ActiveEraInfo>;

    /// The session index at which the era start for the last [`Config::HistoryDepth`] eras.
    ///
    /// Note: This tracks the starting session (i.e. session index when era start being active)
    /// for the eras in `[CurrentEra - HISTORY_DEPTH, CurrentEra]`.
    #[pallet::storage]
    pub type ErasStartSessionIndex<T> = StorageMap<_, Twox64Concat, EraIndex, SessionIndex>;

    /// Mode of era forcing.
    #[pallet::storage]
    pub type ForceEra<T> = StorageValue<_, Forcing, ValueQuery>;

    /// Latest received external index. This index can be a timestamp
    /// a set-id, an epoch or in general anything that identifies
    /// a particular set of validators selected at a given point in time
    #[pallet::storage]
    pub type ExternalIndex<T> = StorageValue<_, u64, ValueQuery>;

    /// Pending external index to be applied in the upcoming era
    #[pallet::storage]
    pub type PendingExternalIndex<T> = StorageValue<_, u64, ValueQuery>;

    /// Current external index attached to the latest validators
    #[pallet::storage]
    pub type CurrentExternalIndex<T> = StorageValue<_, u64, ValueQuery>;

    #[pallet::genesis_config]
    #[derive(DefaultNoBound)]
    pub struct GenesisConfig<T: Config> {
        pub skip_external_validators: bool,
        pub whitelisted_validators: Vec<T::ValidatorId>,
        pub external_validators: Vec<T::ValidatorId>,
    }

    #[pallet::genesis_build]
    impl<T: Config> BuildGenesisConfig for GenesisConfig<T> {
        fn build(&self) {
            let duplicate_validators = self
                .whitelisted_validators
                .iter()
                // T::ValidatorId does not impl Ord or Hash so we cannot collect into set directly,
                // but we can check for duplicates if we encode them first.
                .map(|x| x.encode())
                .collect::<sp_std::collections::btree_set::BTreeSet<_>>();
            assert!(
                duplicate_validators.len() == self.whitelisted_validators.len(),
                "duplicate validators in genesis."
            );

            let bounded_validators = BoundedVec::<_, T::MaxWhitelistedValidators>::try_from(
                self.whitelisted_validators.clone(),
            )
            .expect("genesis validators are more than T::MaxWhitelistedValidators");

            let bounded_external_validators = BoundedVec::<_, T::MaxExternalValidators>::try_from(
                self.external_validators.clone(),
            )
            .expect("genesis external validators are more than T::MaxExternalValidators");

            <SkipExternalValidators<T>>::put(self.skip_external_validators);
            <WhitelistedValidators<T>>::put(&bounded_validators);
            <WhitelistedValidatorsActiveEra<T>>::put(&bounded_validators);
            <WhitelistedValidatorsActiveEraPending<T>>::put(&bounded_validators);
            <ExternalValidators<T>>::put(&bounded_external_validators);
        }
    }

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// A new whitelisted validator was added.
        WhitelistedValidatorAdded { account_id: T::AccountId },
        /// A whitelisted validator was removed.
        WhitelistedValidatorRemoved { account_id: T::AccountId },
        /// A new era has started.
        NewEra { era: EraIndex },
        /// A new force era mode was set.
        ForceEra { mode: Forcing },
        /// External validators were set.
        ExternalValidatorsSet {
            validators: Vec<T::ValidatorId>,
            external_index: u64,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// There are too many whitelisted validators.
        TooManyWhitelisted,
        /// Account is already whitelisted.
        AlreadyWhitelisted,
        /// Account is not whitelisted.
        NotWhitelisted,
        /// Account does not have keys registered
        NoKeysRegistered,
        /// Unable to derive validator id from account id
        UnableToDeriveValidatorId,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Allow to ignore external validators and use only whitelisted ones.
        ///
        /// The origin for this call must be the `UpdateOrigin`.
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::skip_external_validators())]
        pub fn skip_external_validators(origin: OriginFor<T>, skip: bool) -> DispatchResult {
            T::UpdateOrigin::ensure_origin(origin)?;

            <SkipExternalValidators<T>>::put(skip);

            Ok(())
        }

        /// Add a new account `who` to the list of `WhitelistedValidators`.
        ///
        /// The origin for this call must be the `UpdateOrigin`.
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::add_whitelisted(
			T::MaxWhitelistedValidators::get().saturating_sub(1),
		))]
        pub fn add_whitelisted(
            origin: OriginFor<T>,
            who: T::AccountId,
        ) -> DispatchResultWithPostInfo {
            T::UpdateOrigin::ensure_origin(origin)?;
            // don't let one unprepared validator ruin things for everyone.
            let maybe_validator_id = T::ValidatorIdOf::convert(who.clone())
                .filter(T::ValidatorRegistration::is_registered);

            let validator_id = maybe_validator_id.ok_or(Error::<T>::NoKeysRegistered)?;

            <WhitelistedValidators<T>>::try_mutate(|whitelisted| -> DispatchResult {
                if whitelisted.contains(&validator_id) {
                    Err(Error::<T>::AlreadyWhitelisted)?;
                }
                whitelisted
                    .try_push(validator_id.clone())
                    .map_err(|_| Error::<T>::TooManyWhitelisted)?;
                Ok(())
            })?;

            Self::deposit_event(Event::WhitelistedValidatorAdded { account_id: who });

            let weight_used = <T as Config>::WeightInfo::add_whitelisted(
                WhitelistedValidators::<T>::decode_len()
                    .unwrap_or_default()
                    .try_into()
                    .unwrap_or(T::MaxWhitelistedValidators::get().saturating_sub(1)),
            );

            Ok(Some(weight_used).into())
        }

        /// Remove an account `who` from the list of `WhitelistedValidators` collators.
        ///
        /// The origin for this call must be the `UpdateOrigin`.
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::remove_whitelisted(T::MaxWhitelistedValidators::get()))]
        pub fn remove_whitelisted(origin: OriginFor<T>, who: T::AccountId) -> DispatchResult {
            T::UpdateOrigin::ensure_origin(origin)?;

            let validator_id = T::ValidatorIdOf::convert(who.clone())
                .ok_or(Error::<T>::UnableToDeriveValidatorId)?;

            <WhitelistedValidators<T>>::try_mutate(|whitelisted| -> DispatchResult {
                let pos = whitelisted
                    .iter()
                    .position(|x| x == &validator_id)
                    .ok_or(Error::<T>::NotWhitelisted)?;
                whitelisted.remove(pos);
                Ok(())
            })?;

            Self::deposit_event(Event::WhitelistedValidatorRemoved { account_id: who });
            Ok(())
        }

        /// Force when the next era will start. Possible values: next session, never, same as always.
        #[pallet::call_index(3)]
        #[pallet::weight(T::WeightInfo::force_era())]
        pub fn force_era(origin: OriginFor<T>, mode: Forcing) -> DispatchResult {
            T::UpdateOrigin::ensure_origin(origin)?;
            Self::set_force_era(mode);
            Ok(())
        }

        /// Manually set external validators. Should only be needed for tests, validators are set
        /// automatically by the bridge.
        #[pallet::call_index(4)]
        #[pallet::weight(T::WeightInfo::set_external_validators())]
        pub fn set_external_validators(
            origin: OriginFor<T>,
            validators: Vec<T::ValidatorId>,
            external_index: u64,
        ) -> DispatchResult {
            T::UpdateOrigin::ensure_origin(origin)?;

            Self::set_external_validators_inner(validators, external_index)
        }
    }

    impl<T: Config> Pallet<T> {
        pub fn set_external_validators_inner(
            validators: Vec<T::ValidatorId>,
            external_index: u64,
        ) -> DispatchResult {
            // If more validators than max, take the first n
            let validators = BoundedVec::truncate_from(validators);
            <ExternalValidators<T>>::put(&validators);
            <ExternalIndex<T>>::put(external_index);

            Self::deposit_event(Event::<T>::ExternalValidatorsSet {
                validators: validators.into_inner(),
                external_index,
            });
            Ok(())
        }

        /// Helper to set a new `ForceEra` mode.
        pub(crate) fn set_force_era(mode: Forcing) {
            log::info!("Setting force era mode {:?}.", mode);
            ForceEra::<T>::put(mode);
            Self::deposit_event(Event::<T>::ForceEra { mode });
        }

        pub fn whitelisted_validators() -> Vec<T::ValidatorId> {
            <WhitelistedValidators<T>>::get().into()
        }

        pub fn active_era() -> Option<ActiveEraInfo> {
            <ActiveEra<T>>::get()
        }

        pub fn current_era() -> Option<EraIndex> {
            <CurrentEra<T>>::get()
        }

        pub fn eras_start_session_index(era: EraIndex) -> Option<u32> {
            <ErasStartSessionIndex<T>>::get(era)
        }

        /// Returns validators for the next session. Whitelisted validators first, then external validators.
        /// The returned list is deduplicated, but the order is respected.
        /// If `SkipExternalValidators` is true, this function will ignore external validators.
        pub fn validators() -> Vec<T::ValidatorId> {
            let mut validators: Vec<_> = WhitelistedValidators::<T>::get().into();

            if !SkipExternalValidators::<T>::get() {
                validators.extend(ExternalValidators::<T>::get())
            }

            remove_duplicates(validators)
        }

        /// Plan a new session potentially trigger a new era.
        pub(crate) fn new_session(session_index: SessionIndex) -> Option<Vec<T::ValidatorId>> {
            if let Some(current_era) = Self::current_era() {
                // Initial era has been set.
                let current_era_start_session_index = Self::eras_start_session_index(current_era)
                    .unwrap_or_else(|| {
                        frame_support::print(
                            "Error: start_session_index must be set for current_era",
                        );
                        0
                    });

                let era_length = session_index.saturating_sub(current_era_start_session_index); // Must never happen.

                match ForceEra::<T>::get() {
                    // Will be set to `NotForcing` again if a new era has been triggered.
                    Forcing::ForceNew => (),
                    // Short circuit to `try_trigger_new_era`.
                    Forcing::ForceAlways => (),
                    // Only go to `try_trigger_new_era` if deadline reached.
                    Forcing::NotForcing if era_length >= T::SessionsPerEra::get() => (),
                    _ => {
                        // Either `Forcing::ForceNone`,
                        // or `Forcing::NotForcing if era_length < T::SessionsPerEra::get()`.
                        return None;
                    }
                }

                // New era.
                let maybe_new_era_validators = Self::try_trigger_new_era(session_index);
                if maybe_new_era_validators.is_some()
                    && matches!(ForceEra::<T>::get(), Forcing::ForceNew)
                {
                    Self::set_force_era(Forcing::NotForcing);
                }

                maybe_new_era_validators
            } else {
                // Set initial era.
                log!(log::Level::Debug, "Starting the first era.");
                Self::try_trigger_new_era(session_index)
            }
        }

        /// Start a session potentially starting an era.
        pub(crate) fn start_session(start_session: SessionIndex) {
            let next_active_era = Self::active_era()
                .map(|e| e.index.saturating_add(1))
                .unwrap_or(0);
            // This is only `Some` when current era has already progressed to the next era, while the
            // active era is one behind (i.e. in the *last session of the active era*, or *first session
            // of the new current era*, depending on how you look at it).
            if let Some(next_active_era_start_session_index) =
                Self::eras_start_session_index(next_active_era)
            {
                if next_active_era_start_session_index == start_session {
                    Self::start_era(start_session);
                } else if next_active_era_start_session_index < start_session {
                    // This arm should never happen, but better handle it than to stall the pallet.
                    frame_support::print("Warning: A session appears to have been skipped.");
                    Self::start_era(start_session);
                }
            }
        }

        /// End a session potentially ending an era.
        pub(crate) fn end_session(session_index: SessionIndex) {
            if let Some(active_era) = Self::active_era() {
                if let Some(next_active_era_start_session_index) =
                    Self::eras_start_session_index(active_era.index.saturating_add(1))
                {
                    if next_active_era_start_session_index == session_index.saturating_add(1) {
                        Self::end_era(active_era, session_index);
                    }
                }
            }
        }

        /// Start a new era. It does:
        /// * Increment `active_era.index`,
        /// * reset `active_era.start`,
        /// * emit `NewEra` event,
        /// * call `OnEraStart` hook,
        pub(crate) fn start_era(start_session: SessionIndex) {
            let active_era = ActiveEra::<T>::mutate(|active_era| {
                let new_index = active_era
                    .as_ref()
                    .map(|info| info.index.saturating_add(1))
                    .unwrap_or(0);
                *active_era = Some(ActiveEraInfo {
                    index: new_index,
                    // Set new active era start in next `on_finalize`. To guarantee usage of `Time`
                    start: None,
                });
                new_index
            });
            WhitelistedValidatorsActiveEra::<T>::put(
                WhitelistedValidatorsActiveEraPending::<T>::take(),
            );
            let external_idx = PendingExternalIndex::<T>::take();
            CurrentExternalIndex::<T>::put(external_idx);
            Self::deposit_event(Event::NewEra { era: active_era });
            T::OnEraStart::on_era_start(active_era, start_session, external_idx);
        }

        /// End era. It does:
        /// * call `OnEraEnd` hook,
        pub(crate) fn end_era(active_era: ActiveEraInfo, _session_index: SessionIndex) {
            // Note: active_era.start can be None if end era is called during genesis config.
            T::OnEraEnd::on_era_end(active_era.index);
        }

        /// Plan a new era.
        ///
        /// * Bump the current era storage (which holds the latest planned era).
        /// * Store start session index for the new planned era.
        /// * Clean old era information.
        ///
        /// Returns the new validator set.
        pub fn trigger_new_era(start_session_index: SessionIndex) -> Vec<T::ValidatorId> {
            // Increment or set current era.
            let new_planned_era = CurrentEra::<T>::mutate(|s| {
                *s = Some(s.map(|s| s.saturating_add(1)).unwrap_or(0));
                s.unwrap()
            });
            ErasStartSessionIndex::<T>::insert(&new_planned_era, &start_session_index);

            // Clean old era information.
            if let Some(old_era) =
                new_planned_era.checked_sub(T::HistoryDepth::get().saturating_add(1))
            {
                Self::clear_era_information(old_era);
            }

            // Save whitelisted validators for when the era truly changes (start_era)
            WhitelistedValidatorsActiveEraPending::<T>::put(WhitelistedValidators::<T>::get());
            // Save the external index for when the era truly changes (start_era)
            PendingExternalIndex::<T>::put(ExternalIndex::<T>::get());

            // Returns new validators
            Self::validators()
        }

        /// Potentially plan a new era.
        ///
        /// In case a new era is planned, the new validator set is returned.
        pub(crate) fn try_trigger_new_era(
            start_session_index: SessionIndex,
        ) -> Option<Vec<T::ValidatorId>> {
            Some(Self::trigger_new_era(start_session_index))
        }

        /// Clear all era information for given era.
        pub(crate) fn clear_era_information(era_index: EraIndex) {
            ErasStartSessionIndex::<T>::remove(era_index);
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        fn on_initialize(_now: BlockNumberFor<T>) -> Weight {
            // just return the weight of the on_finalize.
            T::DbWeight::get().reads(1)
        }

        fn on_finalize(_n: BlockNumberFor<T>) {
            // Set the start of the first era.
            if let Some(mut active_era) = <ActiveEra<T>>::get() {
                if active_era.start.is_none() {
                    let now_as_millis_u64 = T::UnixTime::now().as_millis().saturated_into::<u64>();
                    active_era.start = Some(now_as_millis_u64);
                    // This write only ever happens once, we don't include it in the weight in
                    // general
                    ActiveEra::<T>::put(active_era);
                }
            }
            // `on_finalize` weight is tracked in `on_initialize`
        }
    }

    impl<T: Config> ExternalIndexProvider for Pallet<T> {
        fn get_external_index() -> u64 {
            CurrentExternalIndex::<T>::get()
        }
    }
}

/// Keeps only the first instance of each element in the input vec. Respects ordering of elements.
fn remove_duplicates<T: Ord + Clone>(input: Vec<T>) -> Vec<T> {
    let mut seen = BTreeSet::new();
    let mut result = Vec::with_capacity(input.len());

    for item in input {
        if seen.insert(item.clone()) {
            result.push(item);
        }
    }

    result
}

impl<T: Config> pallet_session::SessionManager<T::ValidatorId> for Pallet<T> {
    fn new_session(new_index: SessionIndex) -> Option<Vec<T::ValidatorId>> {
        log!(log::Level::Trace, "planning new session {}", new_index);
        Self::new_session(new_index)
    }
    fn new_session_genesis(new_index: SessionIndex) -> Option<Vec<T::ValidatorId>> {
        log!(
            log::Level::Trace,
            "planning new session {} at genesis",
            new_index
        );
        Self::new_session(new_index)
    }
    fn start_session(start_index: SessionIndex) {
        log!(log::Level::Trace, "starting session {}", start_index);
        Self::start_session(start_index)
    }
    fn end_session(end_index: SessionIndex) {
        log!(log::Level::Trace, "ending session {}", end_index);
        Self::end_session(end_index)
    }
}

impl<T: Config> pallet_session::historical::SessionManager<T::ValidatorId, ()> for Pallet<T> {
    fn new_session(new_index: SessionIndex) -> Option<Vec<(T::ValidatorId, ())>> {
        <Self as pallet_session::SessionManager<_>>::new_session(new_index)
            .map(|r| r.into_iter().map(|v| (v, Default::default())).collect())
    }

    fn start_session(start_index: SessionIndex) {
        <Self as pallet_session::SessionManager<_>>::start_session(start_index)
    }

    fn end_session(end_index: SessionIndex) {
        <Self as pallet_session::SessionManager<_>>::end_session(end_index)
    }
}

impl<T: Config> EraIndexProvider for Pallet<T> {
    fn active_era() -> ActiveEraInfo {
        <ActiveEra<T>>::get().unwrap_or(ActiveEraInfo {
            index: 0,
            start: None,
        })
    }

    fn era_to_session_start(era_index: EraIndex) -> Option<u32> {
        <ErasStartSessionIndex<T>>::get(era_index)
    }
}

impl<T: Config> ValidatorProvider<T::ValidatorId> for Pallet<T> {
    fn validators() -> Vec<T::ValidatorId> {
        Self::validators()
    }
}

impl<T: Config> InvulnerablesProvider<T::ValidatorId> for Pallet<T> {
    fn invulnerables() -> Vec<T::ValidatorId> {
        Self::whitelisted_validators()
    }
}

/// Mode of era-forcing.
#[derive(
    Copy, Clone, PartialEq, Eq, Default, Encode, Decode, RuntimeDebug, TypeInfo, MaxEncodedLen,
)]
pub enum Forcing {
    /// Not forcing anything - just let whatever happen.
    #[default]
    NotForcing,
    /// Force a new era on the next session start, then reset to `NotForcing` as soon as it is done.
    ForceNew,
    /// Avoid a new era indefinitely.
    ForceNone,
    /// Force a new era at the end of all sessions indefinitely.
    ForceAlways,
}
