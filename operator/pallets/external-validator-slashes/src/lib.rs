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

//! ExternalValidatorSlashes pallet.
//!
//! A pallet to store slashes based on offences committed by validators
//! Slashes can be cancelled during the DeferPeriod through cancel_deferred_slash
//! Slashes can also be forcedly injected via the force_inject_slash extrinsic
//! Slashes for a particular era are removed after the bondingPeriod has elapsed
//!
//! ## OnOffence trait
//!
//! The pallet also implements the OnOffence trait that reacts to offences being injected by other pallets
//! Invulnerables are not slashed and no slashing information is stored for them

#![cfg_attr(not(feature = "std"), no_std)]
extern crate alloc;
use pallet_external_validators::apply;
use snowbridge_outbound_queue_primitives::SendError;
use {
    alloc::{collections::vec_deque::VecDeque, string::String, vec, vec::Vec},
    frame_support::{pallet_prelude::*, traits::DefensiveSaturating},
    frame_system::pallet_prelude::*,
    log::log,
    pallet_external_validators::{
        derive_storage_traits,
        traits::{EraIndexProvider, ExternalIndexProvider, InvulnerablesProvider, OnEraStart},
    },
    parity_scale_codec::{Decode, DecodeWithMemTracking, Encode, FullCodec},
    sp_core::H256,
    sp_runtime::{
        traits::{Convert, Debug, One, Saturating, Zero},
        DispatchResult, Perbill,
    },
    sp_staking::{
        offence::{Offence, OffenceDetails, OffenceError, OnOffenceHandler, ReportOffence},
        EraIndex, SessionIndex,
    },
};

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;
pub mod weights;

/// Identifies the type of consensus offence for EigenLayer slash reporting.
#[derive(
    Encode,
    Decode,
    DecodeWithMemTracking,
    RuntimeDebug,
    TypeInfo,
    Clone,
    PartialEq,
    Eq,
    MaxEncodedLen,
)]
pub enum OffenceKind {
    /// Liveness offence (i.e. Unresponsiveness)
    LivenessOffence,
    BabeEquivocation,
    GrandpaEquivocation,
    BeefyEquivocation,
    Custom(BoundedVec<u8, ConstU32<256>>),
}

impl Default for OffenceKind {
    fn default() -> Self {
        Self::LivenessOffence
    }
}

impl OffenceKind {
    pub fn to_description(&self) -> String {
        match self {
            Self::LivenessOffence => "Liveness offence".into(),
            Self::BabeEquivocation => "BABE equivocation".into(),
            Self::GrandpaEquivocation => "GRANDPA equivocation".into(),
            Self::BeefyEquivocation => "BEEFY equivocation".into(),
            Self::Custom(desc) => String::from_utf8(desc.to_vec())
                .unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).into_owned()),
        }
    }
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct SlashData<AccountId> {
    pub validator: AccountId,
    pub wad_to_slash: u128,
    pub description: String,
}

// FIXME (nice to have): Merge with SendMessage trait from pallet external-validator-reward (similar trait)
pub trait SendMessage<AccountId> {
    type Message;
    type Ticket;

    fn build(utils: &Vec<SlashData<AccountId>>, era: u32) -> Option<Self::Message>;

    fn validate(message: Self::Message) -> Result<Self::Ticket, SendError>;

    fn deliver(ticket: Self::Ticket) -> Result<H256, SendError>;
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    pub use crate::weights::WeightInfo;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// Removed author data
        SlashReported {
            validator: T::ValidatorId,
            fraction: Perbill,
            slash_era: EraIndex,
        },
        /// The slashes message was sent correctly.
        SlashesMessageSent { message_id: H256 },
        /// We injected a slash
        SlashInjected { slash_id: T::SlashId, era: u32 },
        /// Number of slashes processed
        SlashAddedToQueue { number: u32, era: u32 },
    }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// The overarching event type.
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// A stable ID for a validator.
        type ValidatorId: Member
            + Parameter
            + MaybeSerializeDeserialize
            + MaxEncodedLen
            + TryFrom<Self::AccountId>;

        /// A conversion from account ID to validator ID.
        type ValidatorIdOf: Convert<Self::AccountId, Option<Self::ValidatorId>>;

        /// Number of eras that slashes are deferred by, after computation.
        ///
        /// This should be less than the bonding duration. Set to 0 if slashes
        /// should be applied immediately, without opportunity for intervention.
        #[pallet::constant]
        type SlashDeferDuration: Get<EraIndex>;

        /// Number of eras that staked funds must remain bonded for.
        #[pallet::constant]
        type BondingDuration: Get<EraIndex>;

        // SlashId type, used as a counter on the number of slashes
        type SlashId: Default
            + FullCodec
            + TypeInfo
            + Copy
            + Clone
            + Debug
            + Eq
            + Saturating
            + One
            + Ord
            + MaxEncodedLen;

        type SendMessage: SendMessage<Self::AccountId>;

        /// Era index provider, used to fetch the active era among other things
        type EraIndexProvider: EraIndexProvider;

        /// Invulnerable provider, used to get the invulnerables to know when not to slash
        type InvulnerablesProvider: InvulnerablesProvider<Self::ValidatorId>;

        /// Provider to retrieve the current external index of validators
        type ExternalIndexProvider: ExternalIndexProvider;

        /// Maximum WAD value for EigenLayer slashing. Maps Perbill(100%) to this value.
        /// Default: 5e16 = 5% in WAD format (1e18 = 100%).
        #[pallet::constant]
        type MaxSlashWad: Get<u128>;

        /// How many queued slashes are being processed per block.
        #[pallet::constant]
        type QueuedSlashesProcessedPerBlock: Get<u32>;

        /// The weight information of this pallet.
        type WeightInfo: WeightInfo;
    }

    #[pallet::error]
    pub enum Error<T> {
        /// The era for which the slash wants to be cancelled has no slashes
        EmptyTargets,
        /// No slash was found to be cancelled at the given index
        InvalidSlashIndex,
        /// Slash indices to be cancelled are not sorted or unique
        NotSortedAndUnique,
        /// Provided an era in the future
        ProvidedFutureEra,
        /// Provided an era that is not slashable
        ProvidedNonSlashableEra,
        /// The slash to be cancelled has already elapsed the DeferPeriod
        DeferPeriodIsOver,
        /// There was an error computing the slash
        ErrorComputingSlash,
        /// Failed to validate the message that was going to be sent to Ethereum
        EthereumValidateFail,
        /// Failed to deliver the message to Ethereum
        EthereumDeliverFail,
        /// Invalid params for root_test_send_msg_to_eth
        RootTestInvalidParams,
    }

    #[apply(derive_storage_traits)]
    #[derive(
        MaxEncodedLen, DecodeWithMemTracking, serde::Deserialize, serde::Serialize, Default,
    )]
    pub enum SlashingModeOption {
        #[default]
        Enabled,
        LogOnly,
        Disabled,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(PhantomData<T>);

    /// All slashing events on validators, mapped by era to the highest slash proportion
    /// and slash value of the era.
    #[pallet::storage]
    pub type ValidatorSlashInEra<T: Config> =
        StorageDoubleMap<_, Twox64Concat, EraIndex, Twox64Concat, T::AccountId, Perbill>;

    /// A mapping from still-bonded eras to the first session index of that era.
    ///
    /// Must contains information for eras for the range:
    /// `[active_era - bounding_duration; active_era]`
    #[pallet::storage]
    #[pallet::unbounded]
    pub type BondedEras<T: Config> =
        StorageValue<_, Vec<(EraIndex, SessionIndex, u64)>, ValueQuery>;

    /// A counter on the number of slashes we have performed
    #[pallet::storage]
    #[pallet::getter(fn next_slash_id)]
    pub type NextSlashId<T: Config> = StorageValue<_, T::SlashId, ValueQuery>;

    /// All unapplied slashes that are queued for later.
    #[pallet::storage]
    #[pallet::unbounded]
    #[pallet::getter(fn slashes)]
    pub type Slashes<T: Config> =
        StorageMap<_, Twox64Concat, EraIndex, Vec<Slash<T::AccountId, T::SlashId>>, ValueQuery>;

    /// All unreported slashes that will be processed in the future.
    #[pallet::storage]
    #[pallet::unbounded]
    #[pallet::getter(fn unreported_slashes)]
    pub type UnreportedSlashesQueue<T: Config> =
        StorageValue<_, VecDeque<Slash<T::AccountId, T::SlashId>>, ValueQuery>;

    // Turns slashing on or off
    #[pallet::storage]
    pub type SlashingMode<T: Config> = StorageValue<_, SlashingModeOption, ValueQuery>;

    /// Temporarily stores the offence kind per (session, offender), set by
    /// `EquivocationReportWrapper` before `on_offence` is called synchronously within
    /// the same block. Keyed by session index and validator ID so that offences from
    /// different sessions or for different validators cannot interfere with each other.
    #[pallet::storage]
    pub type PendingOffenceKind<T: Config> = StorageDoubleMap<
        _,
        Twox64Concat,
        SessionIndex,
        Twox64Concat,
        T::ValidatorId,
        OffenceKind,
        OptionQuery,
    >;

    #[pallet::genesis_config]
    #[derive(frame_support::DefaultNoBound)]
    pub struct GenesisConfig<T: Config> {
        // Slashing mode
        pub slashing_mode: SlashingModeOption,
        #[serde(skip)]
        pub _config: PhantomData<T>,
    }

    #[pallet::genesis_build]
    impl<T: Config> BuildGenesisConfig for GenesisConfig<T> {
        fn build(&self) {
            <SlashingMode<T>>::put(self.slashing_mode.clone());
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Cancel a slash that was deferred for a later era
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::cancel_deferred_slash(slash_indices.len() as u32))]
        pub fn cancel_deferred_slash(
            origin: OriginFor<T>,
            era: EraIndex,
            slash_indices: Vec<u32>,
        ) -> DispatchResult {
            ensure_root(origin)?;

            let active_era = T::EraIndexProvider::active_era().index;

            // We need to be in the defer period
            ensure!(
                era <= active_era
                    .saturating_add(T::SlashDeferDuration::get().saturating_add(One::one()))
                    && era > active_era,
                Error::<T>::DeferPeriodIsOver
            );

            ensure!(!slash_indices.is_empty(), Error::<T>::EmptyTargets);
            ensure!(
                is_sorted_and_unique(&slash_indices),
                Error::<T>::NotSortedAndUnique
            );
            // fetch slashes for the era in which we want to defer
            let mut era_slashes = Slashes::<T>::get(era);

            let last_item = slash_indices[slash_indices.len().saturating_sub(1)];
            ensure!(
                (last_item as usize) < era_slashes.len(),
                Error::<T>::InvalidSlashIndex
            );

            // Remove elements starting from the highest index to avoid shifting issues.
            for index in slash_indices.into_iter().rev() {
                era_slashes.remove(index as usize);
            }
            // insert back slashes
            Slashes::<T>::insert(era, &era_slashes);
            Ok(())
        }

        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::force_inject_slash())]
        pub fn force_inject_slash(
            origin: OriginFor<T>,
            era: EraIndex,
            validator: T::AccountId,
            percentage: Perbill,
            offence_kind: OffenceKind,
        ) -> DispatchResult {
            ensure_root(origin)?;
            let active_era = T::EraIndexProvider::active_era().index;

            ensure!(era <= active_era, Error::<T>::ProvidedFutureEra);

            let slash_defer_duration = T::SlashDeferDuration::get();

            let _ = T::EraIndexProvider::era_to_session_start(era)
                .ok_or(Error::<T>::ProvidedNonSlashableEra)?;

            let next_slash_id = NextSlashId::<T>::get();

            let slash = compute_slash::<T>(
                percentage,
                next_slash_id,
                era,
                validator,
                slash_defer_duration,
                offence_kind,
            )
            .ok_or(Error::<T>::ErrorComputingSlash)?;

            // If we defer duration is 0, we immediately apply and confirm
            let era_to_consider = if slash_defer_duration == 0 {
                era.saturating_add(One::one())
            } else {
                era.saturating_add(slash_defer_duration)
                    .saturating_add(One::one())
            };

            Slashes::<T>::mutate(era_to_consider, |era_slashes| {
                era_slashes.push(slash);
            });

            NextSlashId::<T>::put(next_slash_id.saturating_add(One::one()));

            Self::deposit_event(Event::<T>::SlashInjected {
                slash_id: next_slash_id,
                era: era_to_consider,
            });

            Ok(())
        }

        #[pallet::call_index(3)]
        #[pallet::weight(T::WeightInfo::set_slashing_mode())]
        pub fn set_slashing_mode(origin: OriginFor<T>, mode: SlashingModeOption) -> DispatchResult {
            ensure_root(origin)?;

            SlashingMode::<T>::put(mode);

            Ok(())
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        fn on_initialize(_n: BlockNumberFor<T>) -> Weight {
            let processed = Self::process_slashes_queue(T::QueuedSlashesProcessedPerBlock::get());

            if let Some(p) = processed {
                T::WeightInfo::process_slashes_queue(p)
            } else {
                T::WeightInfo::process_slashes_queue(0)
            }
        }
    }
}

/// This is intended to be used with `EquivocationReportWrapper`, which filters
/// out historical offences (before the bonding period) and tags the offence kind.
impl<T: Config>
    OnOffenceHandler<T::AccountId, pallet_session::historical::IdentificationTuple<T>, Weight>
    for Pallet<T>
where
    T: Config<ValidatorId = <T as frame_system::Config>::AccountId>,
    T: pallet_session::Config<ValidatorId = <T as frame_system::Config>::AccountId>,
    T: pallet_session::historical::Config,
    T::SessionHandler: pallet_session::SessionHandler<<T as frame_system::Config>::AccountId>,
    T::SessionManager: pallet_session::SessionManager<<T as frame_system::Config>::AccountId>,
    <T as pallet::Config>::ValidatorIdOf: Convert<
        <T as frame_system::Config>::AccountId,
        Option<<T as frame_system::Config>::AccountId>,
    >,
{
    fn on_offence(
        offenders: &[OffenceDetails<
            T::AccountId,
            pallet_session::historical::IdentificationTuple<T>,
        >],
        slash_fraction: &[Perbill],
        slash_session: SessionIndex,
    ) -> Weight {
        let mut consumed_weight = Weight::default();
        let mut add_db_reads_writes = |reads, writes| {
            consumed_weight += T::DbWeight::get().reads_writes(reads, writes);
        };

        let slashing_mode = SlashingMode::<T>::get();
        add_db_reads_writes(1, 0);

        if slashing_mode == SlashingModeOption::Disabled {
            return consumed_weight;
        }

        let active_era = { T::EraIndexProvider::active_era().index };
        let active_era_start_session_index = T::EraIndexProvider::era_to_session_start(active_era)
            .unwrap_or_else(|| {
                frame_support::print("Error: start_session_index must be set for current_era");
                0
            });

        // Account reads for active_era and era_to_session_start.
        add_db_reads_writes(2, 0);

        // Fast path for active-era report - most likely.
        // `slash_session` cannot be in a future active era. It must be in `active_era` or before.
        let slash_era = if slash_session >= active_era_start_session_index {
            add_db_reads_writes(1, 0);

            active_era
        } else {
            let eras = BondedEras::<T>::get();
            add_db_reads_writes(1, 0);

            // Reverse because it's more likely to find reports from recent eras.
            match eras
                .iter()
                .rev()
                .find(|&(_, sesh, _)| sesh <= &slash_session)
            {
                Some((slash_era, _, _external_idx)) => *slash_era,
                // Before bonding period. defensive - should be filtered out.
                None => return consumed_weight,
            }
        };

        let slash_defer_duration = T::SlashDeferDuration::get();
        add_db_reads_writes(1, 0);

        let invulnerables = T::InvulnerablesProvider::invulnerables();
        add_db_reads_writes(1, 0);

        let mut next_slash_id = NextSlashId::<T>::get();
        add_db_reads_writes(1, 0);

        for (details, slash_fraction) in offenders.iter().zip(slash_fraction) {
            let (stash, _) = &details.offender;

            // Read the per-(session, offender) offence kind set by EquivocationReportWrapper.
            // This is set synchronously before on_offence is called, so take() clears it.
            let offence_kind =
                pallet::PendingOffenceKind::<T>::take(slash_session, stash).unwrap_or_default();
            add_db_reads_writes(1, 1);

            // Skip if the validator is invulnerable.
            if invulnerables.contains(stash) {
                continue;
            }

            Self::deposit_event(Event::<T>::SlashReported {
                validator: stash.clone(),
                fraction: *slash_fraction,
                slash_era,
            });

            if slashing_mode == SlashingModeOption::LogOnly {
                continue;
            }

            // Account for one read and one possible write inside compute_slash.
            add_db_reads_writes(1, 1);

            let slash = compute_slash::<T>(
                *slash_fraction,
                next_slash_id,
                slash_era,
                stash.clone(),
                slash_defer_duration,
                offence_kind.clone(),
            );

            if let Some(mut slash) = slash {
                slash.reporters = details.reporters.clone();

                // Defer to end of some `slash_defer_duration` from now.
                log!(
                    log::Level::Debug,
                    "deferring slash of {:?}% happened in {:?} (reported in {:?}) to {:?}",
                    slash_fraction,
                    slash_era,
                    active_era,
                    slash_era + slash_defer_duration + 1,
                );

                // Cover slash defer duration equal to 0
                // Slashes are applied at the end of the current era
                if slash_defer_duration == 0 {
                    Slashes::<T>::mutate(active_era.saturating_add(One::one()), move |for_now| {
                        for_now.push(slash)
                    });
                    add_db_reads_writes(1, 1);
                } else {
                    // Else, slashes are applied after slash_defer_period since the slashed era
                    Slashes::<T>::mutate(
                        slash_era
                            .saturating_add(slash_defer_duration)
                            .saturating_add(One::one()),
                        move |for_later| for_later.push(slash),
                    );
                    add_db_reads_writes(1, 1);
                }

                // Fix unwrap
                next_slash_id = next_slash_id.saturating_add(One::one());
            }
        }
        NextSlashId::<T>::put(next_slash_id);
        add_db_reads_writes(0, 1);
        consumed_weight
    }
}

impl<T: Config> OnEraStart for Pallet<T>
where
    T: pallet_session::historical::Config,
{
    fn on_era_start(era_index: EraIndex, session_start: SessionIndex, external_idx: u64) {
        // This should be small, as slashes are limited by the num of validators
        // let's put 1000 as a conservative measure
        const REMOVE_LIMIT: u32 = 1000;

        let bonding_duration = T::BondingDuration::get();

        BondedEras::<T>::mutate(|bonded| {
            bonded.push((era_index, session_start, external_idx));

            if era_index > bonding_duration {
                let first_kept = era_index.defensive_saturating_sub(bonding_duration);

                // Prune out everything that's from before the first-kept index.
                let n_to_prune = bonded
                    .iter()
                    .take_while(|&&(era_idx, _, _)| era_idx < first_kept)
                    .count();

                // Kill slashing metadata.
                for (pruned_era, _, _) in bonded.drain(..n_to_prune) {
                    let removal_result =
                        ValidatorSlashInEra::<T>::clear_prefix(pruned_era, REMOVE_LIMIT, None);
                    if removal_result.maybe_cursor.is_some() {
                        log::error!(
                            "Not all validator slashes were remove for era {:?}",
                            pruned_era
                        );
                    }
                    Slashes::<T>::remove(pruned_era);
                }

                if let Some(&(_, first_session, _)) = bonded.first() {
                    <pallet_session::historical::Pallet<T>>::prune_up_to(first_session);
                }
            }
        });

        Self::add_era_slashes_to_queue(era_index);
    }
}

impl<T: Config> Pallet<T> {
    fn add_era_slashes_to_queue(active_era: EraIndex) {
        let mut slashes: VecDeque<_> = Slashes::<T>::get(active_era).into();

        let len = slashes.len();

        UnreportedSlashesQueue::<T>::mutate(|queue| queue.append(&mut slashes));

        if len > 0 {
            Self::deposit_event(Event::<T>::SlashAddedToQueue {
                number: len as u32,
                era: active_era,
            });
        }
    }

    /// Returns number of slashes that were sent to ethereum.
    fn process_slashes_queue(amount: u32) -> Option<u32> {
        let mut slashes_to_send: Vec<SlashData<T::AccountId>> = vec![];
        let era_index = T::EraIndexProvider::active_era().index;

        UnreportedSlashesQueue::<T>::mutate(|queue| {
            for _ in 0..amount {
                let Some(slash) = queue.pop_front() else {
                    // no more slashes to process in the queue
                    break;
                };

                // Convert Perbill to EigenLayer WAD format with linear mapping.
                // Perbill(100%) → MaxSlashWad (e.g. 5% WAD = 5e16).
                // Formula: perbill_inner * MaxSlashWad / 1e9
                let wad_to_slash = (slash.percentage.deconstruct() as u128)
                    .saturating_mul(T::MaxSlashWad::get())
                    .checked_div(1_000_000_000u128)
                    .unwrap_or(0);

                slashes_to_send.push(SlashData {
                    validator: slash.validator,
                    wad_to_slash,
                    description: slash.offence_kind.to_description(),
                });
            }
        });

        if slashes_to_send.is_empty() {
            return None;
        }

        let slashes_count = slashes_to_send.len() as u32;

        let outbound = match T::SendMessage::build(&slashes_to_send, era_index) {
            Some(send_msg) => send_msg,
            None => {
                log::error!(target: "ext_validators_slashes", "Failed to build outbound message");
                return None;
            }
        };

        // Validate and deliver the message
        let ticket = T::SendMessage::validate(outbound)
            .map_err(|e| {
                log::error!(
                    target: "ext_validators_slashes",
                    "Failed to validate outbound message: {:?}",
                    e
                );
            })
            .ok()?;

        let message_id = T::SendMessage::deliver(ticket)
            .map_err(|e| {
                log::error!(
                    target: "ext_validators_slashes",
                    "Failed to deliver outbound message: {:?}",
                    e
                );
            })
            .ok()?;

        Self::deposit_event(Event::<T>::SlashesMessageSent { message_id });

        Some(slashes_count)
    }
}

/// A pending slash record. The value of the slash has been computed but not applied yet,
/// rather deferred for several eras.
#[derive(Encode, Decode, RuntimeDebug, TypeInfo, Clone, PartialEq)]
pub struct Slash<AccountId, SlashId> {
    /// The stash ID of the offending validator.
    pub validator: AccountId,
    /// Reporters of the offence; bounty payout recipients.
    pub reporters: Vec<AccountId>,
    /// The amount of payout.
    pub slash_id: SlashId,
    pub percentage: Perbill,
    // Whether the slash is confirmed or still needs to go through deferred period
    pub confirmed: bool,
    /// The type of consensus offence (relayed to EigenLayer as a description string).
    pub offence_kind: OffenceKind,
}

impl<AccountId, SlashId: One> Slash<AccountId, SlashId> {
    /// Initializes the default object using the given `validator`.
    pub fn default_from(validator: AccountId) -> Self {
        Self {
            validator,
            reporters: vec![],
            slash_id: One::one(),
            percentage: Perbill::from_percent(1),
            confirmed: false,
            offence_kind: OffenceKind::default(),
        }
    }
}

/// Computes a slash of a validator and nominators. It returns an unapplied
/// record to be applied at some later point. Slashing metadata is updated in storage,
/// since unapplied records are only rarely intended to be dropped.
///
/// The pending slash record returned does not have initialized reporters. Those have
/// to be set at a higher level, if any.
pub(crate) fn compute_slash<T: Config>(
    slash_fraction: Perbill,
    slash_id: T::SlashId,
    slash_era: EraIndex,
    stash: T::AccountId,
    slash_defer_duration: EraIndex,
    offence_kind: OffenceKind,
) -> Option<Slash<T::AccountId, T::SlashId>> {
    let prior_slash_p = ValidatorSlashInEra::<T>::get(slash_era, &stash).unwrap_or(Zero::zero());

    // compare slash proportions rather than slash values to avoid issues due to rounding
    // error.
    if slash_fraction.deconstruct() > prior_slash_p.deconstruct() {
        ValidatorSlashInEra::<T>::insert(slash_era, &stash, slash_fraction);
    } else {
        // we slash based on the max in era - this new event is not the max,
        // so neither the validator or any nominators will need an update.
        //
        // this does lead to a divergence of our system from the paper, which
        // pays out some reward even if the latest report is not max-in-era.
        // we opt to avoid the nominator lookups and edits and leave more rewards
        // for more drastic misbehavior.
        return None;
    }

    let confirmed = slash_defer_duration.is_zero();
    Some(Slash {
        validator: stash.clone(),
        percentage: slash_fraction,
        slash_id,
        reporters: Vec::new(),
        confirmed,
        offence_kind,
    })
}

/// Check that list is sorted and has no duplicates.
fn is_sorted_and_unique(list: &[u32]) -> bool {
    list.windows(2).all(|w| w[0] < w[1])
}

/// Trait for associating an `OffenceKind` with a reporter type.
pub trait OffenceKindProvider {
    fn kind() -> OffenceKind;
}

/// Extracts the validator (account) ID from an offender identification tuple.
pub trait HasValidatorId<ValidatorId> {
    fn validator_id(&self) -> &ValidatorId;
}

impl<V, F> HasValidatorId<V> for (V, F) {
    fn validator_id(&self) -> &V {
        &self.0
    }
}

/// Wraps a `ReportOffence` implementation to:
/// 1. **Filter historical offences**: discard reports whose session predates the bonding
///    period (similar to `FilterHistoricalOffences` in `pallet_staking`, but using this
///    pallet's own `BondedEras` storage instead of staking eras).
/// 2. **Tag offence kind**: store the `OffenceKind` per offender in `PendingOffenceKind`
///    before delegating to the inner reporter, so that `on_offence` can read it via
///    `PendingOffenceKind::take()`.
///
/// If the inner `report_offence` fails (e.g. duplicate report), stale `PendingOffenceKind`
/// entries are cleaned up to prevent leaking into unrelated future offences.
pub struct EquivocationReportWrapper<T, Inner, Kind>(PhantomData<(T, Inner, Kind)>);

impl<T, Inner, Kind, R, O, Id> ReportOffence<R, Id, O> for EquivocationReportWrapper<T, Inner, Kind>
where
    T: Config,
    Inner: ReportOffence<R, Id, O>,
    O: Offence<Id>,
    Kind: OffenceKindProvider,
    Id: HasValidatorId<T::ValidatorId>,
{
    fn report_offence(reporters: Vec<R>, offence: O) -> Result<(), OffenceError> {
        // Discard offences from before the bonding period.
        let offence_session = offence.session_index();
        let bonded_eras = pallet::BondedEras::<T>::get();
        if bonded_eras
            .first()
            .filter(|(_, start, _)| offence_session >= *start)
            .is_none()
        {
            // Too old to be slashable — silently discard.
            return Ok(());
        }

        let offenders = offence.offenders();
        for offender in &offenders {
            pallet::PendingOffenceKind::<T>::insert(
                offence_session,
                offender.validator_id(),
                Kind::kind(),
            );
        }
        let result = Inner::report_offence(reporters, offence);
        if result.is_err() {
            for offender in &offenders {
                pallet::PendingOffenceKind::<T>::remove(offence_session, offender.validator_id());
            }
        }
        result
    }

    fn is_known_offence(offenders: &[Id], time_slot: &O::TimeSlot) -> bool {
        Inner::is_known_offence(offenders, time_slot)
    }
}

pub struct BabeEquivocation;
impl OffenceKindProvider for BabeEquivocation {
    fn kind() -> OffenceKind {
        OffenceKind::BabeEquivocation
    }
}

pub struct GrandpaEquivocation;
impl OffenceKindProvider for GrandpaEquivocation {
    fn kind() -> OffenceKind {
        OffenceKind::GrandpaEquivocation
    }
}

pub struct BeefyEquivocation;
impl OffenceKindProvider for BeefyEquivocation {
    fn kind() -> OffenceKind {
        OffenceKind::BeefyEquivocation
    }
}

pub struct ImOnlineUnresponsive;
impl OffenceKindProvider for ImOnlineUnresponsive {
    fn kind() -> OffenceKind {
        OffenceKind::LivenessOffence
    }
}
