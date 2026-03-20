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

//! This pallet keep tracks of the validators reward points.
//! Storage will be cleared after a period of time.

#![cfg_attr(not(feature = "std"), no_std)]

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

pub mod types;
pub mod weights;

pub use pallet::*;

use {
    crate::types::{HandleInflation, RewardsPeriodUtils, SendMessage},
    frame_support::traits::{Get, UnixTime, ValidatorSet},
    pallet_external_validators::traits::{ExternalIndexProvider, OnEraEnd, OnEraStart},
    parity_scale_codec::{Decode, Encode, MaxEncodedLen},
    sp_core::{H160, H256},
    sp_runtime::{
        traits::{Hash, SaturatedConversion},
        Perbill,
    },
    sp_staking::SessionIndex,
    sp_std::vec::Vec,
};

/// Trait for checking if a validator has been slashed in a given era
pub trait SlashingCheck<AccountId> {
    fn is_slashed(era_index: u32, validator: &AccountId) -> bool;
}

/// Implementation that always returns false (no slashes)
impl<AccountId> SlashingCheck<AccountId> for () {
    fn is_slashed(_era_index: u32, _validator: &AccountId) -> bool {
        false
    }
}

#[frame_support::pallet]
pub mod pallet {
    use frame_support::traits::fungible;
    use sp_runtime::PerThing;

    pub use crate::weights::WeightInfo;
    use {
        super::*, frame_support::pallet_prelude::*, frame_system::pallet_prelude::OriginFor,
        pallet_external_validators::traits::EraIndexProvider, sp_runtime::traits::Saturating,
        sp_std::collections::btree_map::BTreeMap,
    };

    /// The current storage version.
    const STORAGE_VERSION: StorageVersion = StorageVersion::new(1);

    pub type RewardPoints = u32;
    pub type EraIndex = u32;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// Overarching event type.
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// How to fetch the current era info.
        type EraIndexProvider: EraIndexProvider;

        /// For how many eras points are kept in storage.
        #[pallet::constant]
        type HistoryDepth: Get<EraIndex>;

        /// Provider to know how may tokens were inflated (added) in a specific era.
        type EraInflationProvider: Get<u128>;

        /// Provider to retrieve the current external index indetifying the validators
        type ExternalIndexProvider: ExternalIndexProvider;

        type GetWhitelistedValidators: Get<Vec<Self::AccountId>>;

        /// Validator set provider for performance tracking.
        /// Requires ValidatorId = AccountId so we can use validators() directly.
        type ValidatorSet: frame_support::traits::ValidatorSet<
            Self::AccountId,
            ValidatorId = Self::AccountId,
        >;

        /// Check if a validator has been slashed in a given era
        type SlashingCheck: SlashingCheck<Self::AccountId>;

        /// Base points added to the reward pool per block produced.
        /// These points are distributed according to the weighted formula:
        /// - 60% (BlockAuthoringWeight) goes to the block author
        /// - 40% (LivenessWeight + base) is shared among all online validators
        ///
        /// Example with 320 points and 32 validators:
        /// - Per block: author gets 192 + 4 = 196, each non-author gets 4
        /// - Per session (600 blocks): each validator earns ~6,000 points (uniform distribution)
        /// - Per era (6 sessions): each validator earns ~36,000 points
        #[pallet::constant]
        type BasePointsPerBlock: Get<u32>;

        /// Weight of block authoring in the rewards formula (e.g., 60% = Perbill::from_percent(60)).
        /// Combined with LivenessWeight, the sum should not exceed 100%.
        /// The remainder (100% - block - liveness) is the unconditional base reward.
        type BlockAuthoringWeight: Get<Perbill>;

        /// Weight of liveness (block authorship) in the rewards formula.
        /// Combined with BlockAuthoringWeight, the sum should not exceed 100%.
        /// The remainder (100% - block - liveness) is the unconditional base reward.
        type LivenessWeight: Get<Perbill>;

        /// Soft cap on block authoring rewards as a percentage above fair share.
        /// E.g., 50% means validators can earn credit for up to 150% of their fair share.
        /// With 60% BlockAuthoringWeight, this gives over-performers up to 30% bonus reward.
        type FairShareCap: Get<Perbill>;

        /// Expected number of blocks to be produced per era (based on era duration and block time).
        /// Used as the baseline (100%) for performance-based inflation scaling.
        #[pallet::constant]
        type ExpectedBlocksPerEra: Get<u32>;

        /// Minimum inflation percentage even with zero blocks produced (e.g., 20 = 20%).
        /// Prevents complete halt of inflation during network issues.
        #[pallet::constant]
        type MinInflationPercent: Get<u32>;

        /// Maximum inflation percentage cap (e.g., 100 = 100%).
        /// Prevents runaway inflation if blocks exceed expectations.
        #[pallet::constant]
        type MaxInflationPercent: Get<u32>;

        /// Hashing tool used to generate/verify merkle roots and proofs.
        type Hashing: Hash<Output = H256>;

        /// Currency the rewards are minted in
        type Currency: fungible::Inspect<Self::AccountId, Balance: From<u128>>
            + fungible::Mutate<Self::AccountId>;

        /// Ethereum Sovereign Account where rewards will be minted
        type RewardsEthereumSovereignAccount: Get<Self::AccountId>;

        /// EigenLayer rewards window genesis timestamp (seconds).
        type RewardsWindowGenesisTimestamp: Get<u32>;

        /// EigenLayer rewards window duration (seconds).
        /// Must be a positive multiple of EigenLayer `CALCULATION_INTERVAL_SECONDS`
        /// and not exceed EigenLayer `MAX_REWARDS_DURATION`.
        type RewardsWindowDuration: Get<u32>;

        /// Unix time provider used to place points and submissions in aligned windows.
        type UnixTime: UnixTime;

        /// The weight information of this pallet.
        type WeightInfo: WeightInfo;

        /// How to send messages via Snowbridge Outbound Queue V2.
        type SendMessage: SendMessage;

        /// Hook for minting inflation tokens.
        type HandleInflation: HandleInflation<Self::AccountId>;

        /// Origin for governance calls (e.g., retrying unsent reward messages).
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        #[cfg(feature = "runtime-benchmarks")]
        type BenchmarkHelper: types::BenchmarkHelper;
    }
    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    #[pallet::hooks]
    impl<T: Config> Hooks<frame_system::pallet_prelude::BlockNumberFor<T>> for Pallet<T> {
        fn on_initialize(_n: frame_system::pallet_prelude::BlockNumberFor<T>) -> Weight {
            Self::process_unsent_reward_eras()
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Governance escape hatch: manually retry sending a rewards message for
        /// a closed window that is stuck in the unsent queue.
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::retry_unsent_reward_era())]
        pub fn retry_unsent_reward_window(
            origin: OriginFor<T>,
            window_start: u32,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;

            // Scan the ring buffer for the requested window
            let head = UnsentRewardHead::<T>::get();
            let tail = UnsentRewardTail::<T>::get();
            let mut found = None;
            let mut slot = head;
            while slot != tail {
                if let Some(entry) = UnsentRewardWindow::<T>::get(slot) {
                    if entry.window_start == window_start {
                        found = Some((slot, entry));
                        break;
                    }
                }
                slot = (slot + 1) % UNSENT_QUEUE_CAPACITY;
            }
            let (slot, window) = found.ok_or(Error::<T>::WindowNotInUnsentQueue)?;

            let info = Self::window_rewards_info(
                window.window_start,
                window.window_index,
                window.duration,
            )
            .ok_or(Error::<T>::WindowRewardsMissing)?;

            let message_id =
                Self::send_rewards_message(&info).ok_or(Error::<T>::MessageSendFailed)?;

            Self::clear_window(window.window_start);
            Self::unsent_queue_remove_slot(slot);

            Self::deposit_event(Event::RewardsWindowRetried {
                message_id,
                window_start: window.window_start,
                window_index: window.window_index,
                total_points: info.total_points,
                inflation_amount: info.inflation_amount,
            });

            Ok(())
        }
    }

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// The rewards window submission was sent correctly.
        RewardsWindowSubmitted {
            message_id: H256,
            window_start: u32,
            window_index: u32,
            total_points: u128,
            inflation_amount: u128,
        },
        /// Window submission failed on the initial attempt.
        RewardsWindowSubmissionFailed {
            window_start: u32,
            window_index: u32,
        },
        /// Closed window had no distributable rewards and was skipped.
        RewardsWindowSkipped {
            window_start: u32,
            window_index: u32,
        },
        /// A previously failed rewards window was retried and sent successfully.
        RewardsWindowRetried {
            message_id: H256,
            window_start: u32,
            window_index: u32,
            total_points: u128,
            inflation_amount: u128,
        },
        /// A queued window was dropped because its stored rewards data is no longer available.
        UnsentWindowExpired {
            window_start: u32,
            window_index: u32,
        },
        /// The unsent queue is full; this failed window could not be enqueued for retry.
        UnsentWindowQueueFull {
            window_start: u32,
            window_index: u32,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// The specified window is not in the unsent queue.
        WindowNotInUnsentQueue,
        /// Rewards data for the window is no longer available.
        WindowRewardsMissing,
        /// The message delivery still failed on retry.
        MessageSendFailed,
    }

    /// Keep tracks of distributed points per validator and total.
    #[derive(RuntimeDebug, Encode, Decode, PartialEq, Eq, TypeInfo)]
    pub struct EraRewardPoints<AccountId> {
        pub total: RewardPoints,
        pub individual: BTreeMap<AccountId, RewardPoints>,
    }

    impl<AccountId> Default for EraRewardPoints<AccountId> {
        fn default() -> Self {
            EraRewardPoints {
                total: Default::default(),
                individual: BTreeMap::new(),
            }
        }
    }

    /// Store reward points per era.
    /// Note: EraRewardPoints is actually bounded by the amount of validators.
    #[pallet::storage]
    #[pallet::unbounded]
    pub type RewardPointsForEra<T: Config> =
        StorageMap<_, Twox64Concat, EraIndex, EraRewardPoints<T::AccountId>, ValueQuery>;

    /// Track the number of blocks authored by each validator in the current session.
    /// Cleared at the end of each session.
    #[pallet::storage]
    #[pallet::unbounded]
    pub type BlocksAuthoredInSession<T: Config> =
        StorageMap<_, Twox64Concat, T::AccountId, u32, ValueQuery>;

    /// Track the total number of blocks produced in each era.
    /// Used to scale inflation based on network performance.
    #[pallet::storage]
    pub type BlocksProducedInEra<T: Config> =
        StorageMap<_, Twox64Concat, EraIndex, u32, ValueQuery>;

    /// Per-window operator points accumulated from session-end rewards.
    #[pallet::storage]
    #[pallet::unbounded]
    pub type WindowOperatorPoints<T: Config> =
        StorageMap<_, Twox64Concat, u32, BTreeMap<H160, RewardPoints>, ValueQuery>;

    /// Total inflation allocated to a given aligned window.
    #[pallet::storage]
    pub type WindowInflationAmount<T: Config> = StorageMap<_, Twox64Concat, u32, u128, ValueQuery>;

    /// Pointer to the next window start to submit.
    #[pallet::storage]
    pub type NextWindowToSubmit<T: Config> = StorageValue<_, u32, ValueQuery>;

    /// Maximum number of unsent reward entries in the ring buffer.
    pub const UNSENT_QUEUE_CAPACITY: u32 = 64;

    /// Metadata for a failed rewards window kept in the retry ring buffer.
    #[derive(RuntimeDebug, Encode, Decode, MaxEncodedLen, PartialEq, Eq, TypeInfo, Clone, Copy)]
    pub struct QueuedRewardsWindow {
        pub window_start: u32,
        pub window_index: u32,
        pub duration: u32,
    }

    /// Ring buffer of windows whose rewards messages failed to send.
    /// Keyed by slot index [0, UNSENT_QUEUE_CAPACITY).
    #[pallet::storage]
    pub type UnsentRewardWindow<T: Config> = StorageMap<_, Twox64Concat, u32, QueuedRewardsWindow>;

    /// Ring buffer head: next slot to be processed by `on_initialize`.
    #[pallet::storage]
    pub type UnsentRewardHead<T: Config> = StorageValue<_, u32, ValueQuery>;

    /// Ring buffer tail: next slot to write a new entry into.
    /// When head == tail the buffer is empty.
    #[pallet::storage]
    pub type UnsentRewardTail<T: Config> = StorageValue<_, u32, ValueQuery>;

    impl<T: Config> Pallet<T> {
        fn now_seconds() -> u32 {
            T::UnixTime::now().as_secs().saturated_into::<u32>()
        }

        fn rewards_window_config() -> (u32, u32) {
            (
                T::RewardsWindowGenesisTimestamp::get(),
                T::RewardsWindowDuration::get(),
            )
        }

        fn window_start_for(timestamp: u32, genesis: u32, interval: u32) -> u32 {
            genesis + (timestamp.saturating_sub(genesis) / interval) * interval
        }

        fn window_index_for(window_start: u32, genesis: u32, interval: u32) -> u32 {
            window_start.saturating_sub(genesis) / interval
        }

        fn account_to_h160(account_id: &T::AccountId) -> H160 {
            H160::from_slice(&account_id.encode()[..20])
        }

        fn clear_window(window_start: u32) {
            WindowInflationAmount::<T>::remove(window_start);
            WindowOperatorPoints::<T>::remove(window_start);
        }

        fn earliest_window_with_state() -> Option<u32> {
            let mut earliest = None;

            for window in WindowOperatorPoints::<T>::iter_keys() {
                earliest = Some(earliest.map_or(window, |current: u32| current.min(window)));
            }
            for window in WindowInflationAmount::<T>::iter_keys() {
                earliest = Some(earliest.map_or(window, |current: u32| current.min(window)));
            }

            earliest
        }

        fn window_rewards_info(
            window_start: u32,
            window_index: u32,
            duration: u32,
        ) -> Option<RewardsPeriodUtils> {
            let inflation_amount = WindowInflationAmount::<T>::get(window_start);
            let operator_points = WindowOperatorPoints::<T>::get(window_start);
            let total_points: u128 = operator_points.values().map(|p| *p as u128).sum();

            if total_points == 0 || inflation_amount == 0 {
                return None;
            }

            Some(RewardsPeriodUtils {
                period_index: window_index,
                period_start: window_start,
                duration,
                total_points,
                individual_points: operator_points.into_iter().collect(),
                inflation_amount,
            })
        }

        fn allocate_era_inflation_to_windows(
            era_start: u32,
            era_end: u32,
            inflation_amount: u128,
            genesis: u32,
            interval: u32,
        ) {
            if inflation_amount == 0 || era_end <= era_start {
                return;
            }

            let era_duration = era_end.saturating_sub(era_start).max(1);
            let mut window_start = Self::window_start_for(era_start, genesis, interval);
            let mut allocated = 0u128;
            let mut last_window = None;

            while window_start < era_end {
                let window_end = window_start.saturating_add(interval);
                let overlap_start = era_start.max(window_start);
                let overlap_end = era_end.min(window_end);

                if overlap_end > overlap_start {
                    let overlap = overlap_end.saturating_sub(overlap_start);
                    let portion =
                        inflation_amount.saturating_mul(overlap as u128) / (era_duration as u128);

                    if portion > 0 {
                        WindowInflationAmount::<T>::mutate(window_start, |current| {
                            *current = current.saturating_add(portion);
                        });
                        allocated = allocated.saturating_add(portion);
                    }
                    last_window = Some(window_start);
                }

                window_start = window_start.saturating_add(interval);
            }

            let remainder = inflation_amount.saturating_sub(allocated);
            if remainder > 0 {
                if let Some(last_window) = last_window {
                    WindowInflationAmount::<T>::mutate(last_window, |current| {
                        *current = current.saturating_add(remainder);
                    });
                }
            }
        }

        fn process_closed_windows(now: u32, genesis: u32, interval: u32) {
            let mut next_window = NextWindowToSubmit::<T>::get();

            if next_window == 0 {
                next_window = Self::earliest_window_with_state().unwrap_or_else(|| {
                    Self::window_start_for(now.saturating_sub(interval), genesis, interval)
                });
            }

            while next_window.saturating_add(interval) <= now {
                let inflation_amount = WindowInflationAmount::<T>::get(next_window);
                let operator_points = WindowOperatorPoints::<T>::get(next_window);
                let total_points: u128 = operator_points.values().map(|p| *p as u128).sum();
                let window_index = Self::window_index_for(next_window, genesis, interval);

                if total_points == 0 || inflation_amount == 0 {
                    Self::clear_window(next_window);
                    Self::deposit_event(Event::RewardsWindowSkipped {
                        window_start: next_window,
                        window_index,
                    });
                    next_window = next_window.saturating_add(interval);
                    continue;
                }

                let utils = RewardsPeriodUtils {
                    period_index: window_index,
                    period_start: next_window,
                    duration: interval,
                    total_points,
                    individual_points: operator_points.into_iter().collect(),
                    inflation_amount,
                };

                match Self::send_rewards_message(&utils) {
                    Some(message_id) => {
                        Self::deposit_event(Event::RewardsWindowSubmitted {
                            message_id,
                            window_start: next_window,
                            window_index,
                            total_points,
                            inflation_amount,
                        });
                    }
                    None => {
                        Self::deposit_event(Event::RewardsWindowSubmissionFailed {
                            window_start: next_window,
                            window_index,
                        });

                        let queued_window = QueuedRewardsWindow {
                            window_start: next_window,
                            window_index,
                            duration: interval,
                        };

                        if Self::unsent_queue_push(queued_window) {
                            next_window = next_window.saturating_add(interval);
                            continue;
                        }

                        log::error!(
                            target: "ext_validators_rewards",
                            "Unsent reward queue full, cannot enqueue window {}",
                            next_window,
                        );
                        Self::deposit_event(Event::UnsentWindowQueueFull {
                            window_start: next_window,
                            window_index,
                        });
                        break;
                    }
                }

                Self::clear_window(next_window);
                next_window = next_window.saturating_add(interval);
            }

            NextWindowToSubmit::<T>::put(next_window);
        }

        /// Reward validators. Does not check if the validators are valid, caller needs to make sure of that.
        pub fn reward_by_ids(points: impl IntoIterator<Item = (T::AccountId, RewardPoints)>) {
            let active_era = T::EraIndexProvider::active_era();
            let now = Self::now_seconds();
            let (genesis, interval) = Self::rewards_window_config();
            let window_start = Self::window_start_for(now, genesis, interval);

            RewardPointsForEra::<T>::mutate(active_era.index, |era_rewards| {
                for (validator, points) in points.into_iter() {
                    (*era_rewards.individual.entry(validator.clone()).or_default())
                        .saturating_accrue(points);
                    era_rewards.total.saturating_accrue(points);

                    let operator = Self::account_to_h160(&validator);
                    WindowOperatorPoints::<T>::mutate(window_start, |operators| {
                        operators
                            .entry(operator)
                            .and_modify(|existing| *existing = existing.saturating_add(points))
                            .or_insert(points);
                    });
                }
            })
        }

        /// Helper to build, validate and deliver an outbound message.
        /// Logs any error and returns None on failure.
        fn send_rewards_message(utils: &RewardsPeriodUtils) -> Option<H256> {
            let outbound = T::SendMessage::build(utils).or_else(|| {
                log::error!(target: "ext_validators_rewards", "Failed to build outbound message");
                None
            })?;

            let ticket = T::SendMessage::validate(outbound)
                .map_err(|e| {
                    log::error!(
                        target: "ext_validators_rewards",
                        "Failed to validate outbound message: {:?}",
                        e
                    );
                })
                .ok()?;

            T::SendMessage::deliver(ticket)
                .map_err(|e| {
                    log::error!(
                        target: "ext_validators_rewards",
                        "Failed to deliver outbound message: {:?}",
                        e
                    );
                })
                .ok()
        }

        // ── Ring-buffer helpers ──────────────────────────────────────────

        /// Returns true when the ring buffer is empty (head == tail).
        #[allow(dead_code)]
        pub(crate) fn unsent_queue_is_empty() -> bool {
            UnsentRewardHead::<T>::get() == UnsentRewardTail::<T>::get()
        }

        /// Number of entries currently in the ring buffer.
        #[allow(dead_code)]
        pub(crate) fn unsent_queue_len() -> u32 {
            let head = UnsentRewardHead::<T>::get();
            let tail = UnsentRewardTail::<T>::get();
            tail.wrapping_sub(head) % UNSENT_QUEUE_CAPACITY
        }

        /// Push a new window into the ring buffer.
        /// Returns `true` on success, `false` if the buffer is full.
        pub(crate) fn unsent_queue_push(entry: QueuedRewardsWindow) -> bool {
            let head = UnsentRewardHead::<T>::get();
            let tail = UnsentRewardTail::<T>::get();
            let next_tail = (tail + 1) % UNSENT_QUEUE_CAPACITY;
            if next_tail == head {
                // Buffer full
                return false;
            }
            UnsentRewardWindow::<T>::insert(tail, entry);
            UnsentRewardTail::<T>::put(next_tail);
            true
        }

        /// Remove the entry at a given slot and compact the buffer by shifting
        /// subsequent entries back. Used by the extrinsic and `on_era_start`.
        fn unsent_queue_remove_slot(slot: u32) {
            let tail = UnsentRewardTail::<T>::get();
            // Shift entries after `slot` backward to fill the gap
            let mut cur = slot;
            loop {
                let next = (cur + 1) % UNSENT_QUEUE_CAPACITY;
                if next == tail {
                    break;
                }
                // Move next → cur
                if let Some(entry) = UnsentRewardWindow::<T>::get(next) {
                    UnsentRewardWindow::<T>::insert(cur, entry);
                }
                cur = next;
            }
            // Remove the now-duplicate last entry and shrink tail
            UnsentRewardWindow::<T>::remove(cur);
            let new_tail = if tail == 0 {
                UNSENT_QUEUE_CAPACITY - 1
            } else {
                tail - 1
            };
            UnsentRewardTail::<T>::put(new_tail);

            // If head was after the removed slot, adjust it too
            let head = UnsentRewardHead::<T>::get();
            // We also need to handle head potentially pointing past the buffer
            // after a removal. Since we shifted everything between slot..tail back,
            // the head only needs adjustment if it was == tail (now new_tail) — but
            // that means the buffer just became empty, which is fine (head == new_tail).
            // However, if head was pointing *at* a slot beyond the removed one, the
            // entry it pointed to slid back by one, so head should also slide back.
            // In practice, removal only happens when we know the slot, so we can
            // simply recalculate emptiness.
            if head == tail {
                // Was already at tail, buffer must be empty now
                UnsentRewardHead::<T>::put(new_tail);
            }
        }

        // ── Core retry logic ──────────────────────────────────────────────

        /// Process at most one unsent reward window per block.
        /// On failure the head pointer advances to the next entry so a single
        /// stuck window does not block retries for subsequent windows.
        pub(crate) fn process_unsent_reward_eras() -> Weight {
            let head = UnsentRewardHead::<T>::get();
            let tail = UnsentRewardTail::<T>::get();

            if head == tail {
                return T::WeightInfo::process_unsent_reward_eras_empty();
            }

            let Some(window) = UnsentRewardWindow::<T>::get(head) else {
                // Slot unexpectedly empty — advance head past it
                UnsentRewardHead::<T>::put((head + 1) % UNSENT_QUEUE_CAPACITY);
                return T::WeightInfo::process_unsent_reward_eras_empty();
            };

            let info = match Self::window_rewards_info(
                window.window_start,
                window.window_index,
                window.duration,
            ) {
                Some(info) => info,
                None => {
                    log::warn!(
                        target: "ext_validators_rewards",
                        "Unsent window {} expired: rewards state missing",
                        window.window_start,
                    );
                    Self::clear_window(window.window_start);
                    UnsentRewardWindow::<T>::remove(head);
                    UnsentRewardHead::<T>::put((head + 1) % UNSENT_QUEUE_CAPACITY);
                    Self::deposit_event(Event::UnsentWindowExpired {
                        window_start: window.window_start,
                        window_index: window.window_index,
                    });
                    return T::WeightInfo::process_unsent_reward_eras_expired();
                }
            };

            // Attempt to resend
            match Self::send_rewards_message(&info) {
                Some(message_id) => {
                    Self::clear_window(window.window_start);
                    UnsentRewardWindow::<T>::remove(head);
                    UnsentRewardHead::<T>::put((head + 1) % UNSENT_QUEUE_CAPACITY);
                    Self::deposit_event(Event::RewardsWindowRetried {
                        message_id,
                        window_start: window.window_start,
                        window_index: window.window_index,
                        total_points: info.total_points,
                        inflation_amount: info.inflation_amount,
                    });
                    T::WeightInfo::process_unsent_reward_eras_success()
                }
                None => {
                    // Move the failed entry to the back of the queue so the
                    // next block tries a different window (avoids head-of-line
                    // blocking). The entry is not lost — it will be retried
                    // after all other pending entries.
                    UnsentRewardWindow::<T>::remove(head);
                    UnsentRewardHead::<T>::put((head + 1) % UNSENT_QUEUE_CAPACITY);
                    UnsentRewardWindow::<T>::insert(tail, window);
                    UnsentRewardTail::<T>::put((tail + 1) % UNSENT_QUEUE_CAPACITY);
                    log::warn!(
                        target: "ext_validators_rewards",
                        "Retry for unsent window {} still failing, moved to back of queue",
                        window.window_start,
                    );
                    T::WeightInfo::process_unsent_reward_eras_failed()
                }
            }
        }

        /// Track a block authored by a validator
        pub fn note_block_author(author: T::AccountId) {
            // Track per-session authorship for performance points
            BlocksAuthoredInSession::<T>::mutate(&author, |count| {
                *count = count.saturating_add(1);
            });

            // Track total blocks in current era for inflation scaling
            let active_era = T::EraIndexProvider::active_era();
            BlocksProducedInEra::<T>::mutate(active_era.index, |count| {
                *count = count.saturating_add(1);
            });
        }

        /// Calculate performance-scaled inflation based on blocks produced in the era.
        ///
        /// # Formula
        ///
        /// Scales base inflation from MinInflationPercent to MaxInflationPercent based on:
        /// - Blocks produced vs expected blocks per era
        /// - Capped at expected blocks (no bonus for overproduction)
        ///
        /// `scaled_inflation = base_inflation × (min% + (performance_ratio × (max% - min%)))`
        ///
        /// # Parameters
        ///
        /// - `era_index`: The era to check blocks for
        /// - `base_inflation`: The maximum inflation amount (at 100% performance)
        ///
        /// # Returns
        ///
        /// The scaled inflation amount based on network performance
        pub fn calculate_scaled_inflation(era_index: EraIndex, base_inflation: u128) -> u128 {
            use sp_runtime::Perbill;

            let blocks_produced = BlocksProducedInEra::<T>::get(era_index);
            let expected_blocks = T::ExpectedBlocksPerEra::get();
            let min_percent = T::MinInflationPercent::get();
            let max_percent = T::MaxInflationPercent::get();

            // Calculate performance ratio (capped at 100%)
            let performance_ratio = if expected_blocks > 0 {
                Perbill::from_rational(blocks_produced.min(expected_blocks), expected_blocks)
            } else {
                // If no expected blocks configured, use full inflation
                Perbill::one()
            };

            // Scale from min to max based on performance
            // inflation_percent = min + (performance_ratio × (max - min))
            let inflation_percent = min_percent.saturating_add(
                performance_ratio.mul_floor(max_percent.saturating_sub(min_percent)),
            );

            // Apply percentage to base inflation
            let scaled_inflation =
                Perbill::from_percent(inflation_percent).mul_floor(base_inflation);

            log::debug!(
                target: "ext_validators_rewards",
                "Era {} inflation scaling: {} blocks / {} expected = {}% performance → {}% inflation ({} tokens)",
                era_index,
                blocks_produced,
                expected_blocks,
                performance_ratio.deconstruct() * 100 / 1_000_000_000,
                inflation_percent,
                scaled_inflation
            );

            scaled_inflation
        }

        /// Awards performance-based points at session end using a configurable weighted formula.
        ///
        /// # Reward Formula
        ///
        /// Each validator receives points based on configurable weights (default 60/30/10):
        /// - **BlockAuthoringWeight**: Block production score with soft cap allowing over-performance
        /// - **LivenessWeight**: Liveness score (1.0 if online, 0.0 otherwise)
        /// - **Base guarantee**: Remainder (100% - block - liveness) always awarded
        ///
        /// Final points = BASE_POINTS × (block_weight × block_score + liveness_weight × liveness_score + base_weight)
        ///
        /// # Block Production Scoring
        ///
        /// - Fair share = total_blocks / total_validator_count
        /// - Soft cap allows earning credit up to (1 + FairShareCap) × fair_share
        /// - Block score = credited_blocks / fair_share (can exceed 100% with over-performance)
        /// - Example: With 50% cap and fair share of 10 blocks, producing 15 blocks → 150% score
        ///
        /// # Liveness Scoring
        ///
        /// Uses block authorship as proof of liveness. A validator is considered online if
        /// they authored at least one block in the current session. This is simpler and more
        /// reliable than ImOnline heartbeats, which have timing issues with session rotation.
        ///
        /// # Weight Validation
        ///
        /// If BlockAuthoringWeight + LivenessWeight > 100%, values are proportionally scaled down
        /// to ensure the sum does not exceed 100%. This prevents configuration errors from
        /// breaking the reward system.
        ///
        /// # Whitelisted Validators
        ///
        /// Whitelisted validators are excluded from rewards AND from fair share calculation.
        /// This ensures regular validators' fair share isn't diluted by whitelisted validators.
        pub fn award_session_performance_points(
            session_index: SessionIndex,
            validators: Vec<T::AccountId>,
            whitelisted_validators: Vec<T::AccountId>,
        ) {
            // Calculate total blocks for the session
            let total_blocks: u32 = BlocksAuthoredInSession::<T>::iter()
                .map(|(_, count)| count)
                .sum();

            // Count non-whitelisted validators for fair share calculation
            let non_whitelisted_count = validators
                .iter()
                .filter(|v| !whitelisted_validators.contains(v))
                .count() as u32;

            if non_whitelisted_count == 0 {
                log::warn!(
                    target: "ext_validators_rewards",
                    "No non-whitelisted validators in session {}, skipping performance rewards",
                    session_index
                );
                // Clear session tracking storage even if no rewards
                let _ = BlocksAuthoredInSession::<T>::clear(u32::MAX, None);
                return;
            }

            // Fair share: expected blocks per validator (including whitelisted).
            // Whitelisted validators still produce blocks (they just don't receive rewards),
            // so block production slots are distributed among ALL validators.
            // This ensures non-whitelisted validators aren't penalized for not producing
            // blocks that were assigned to whitelisted validators.
            // Note: We use floor division here which is appropriate for the soft cap
            // (we don't want to give bonus credit for fractional blocks).
            // Ensure minimum of 1 to prevent division issues when total_blocks < validator_count.
            let total_validator_count = validators.len() as u32;
            let fair_share = total_blocks
                .checked_div(total_validator_count)
                .unwrap_or(1)
                .max(1);

            // Get soft cap for over-performance rewards
            let fair_share_cap = T::FairShareCap::get();

            // Calculate max credited blocks based on soft cap
            // max_credited = fair_share + cap × fair_share = fair_share × (1 + cap)
            let max_credited_blocks =
                fair_share.saturating_add(fair_share_cap.mul_floor(fair_share));

            // Get and validate reward weights with defensive scaling
            let (block_weight, liveness_weight, base_weight) = {
                let raw_block = T::BlockAuthoringWeight::get();
                let raw_liveness = T::LivenessWeight::get();
                let sum = raw_block.saturating_add(raw_liveness);

                if sum > Perbill::one() {
                    // Proportionally scale down to fit within 100%
                    log::warn!(
                        target: "ext_validators_rewards",
                        "Reward weights exceed 100% (block={}%, liveness={}%), scaling proportionally",
                        raw_block.deconstruct() * 100 / Perbill::ACCURACY,
                        raw_liveness.deconstruct() * 100 / Perbill::ACCURACY
                    );
                    let scale =
                        Perbill::from_rational(Perbill::one().deconstruct(), sum.deconstruct());
                    let scaled_block = scale.saturating_mul(raw_block);
                    let scaled_liveness = scale.saturating_mul(raw_liveness);
                    (scaled_block, scaled_liveness, Perbill::zero())
                } else {
                    let base = Perbill::one()
                        .saturating_sub(raw_block)
                        .saturating_sub(raw_liveness);
                    (raw_block, raw_liveness, base)
                }
            };

            log::debug!(
                target: "ext_validators_rewards",
                "Session {} performance: {} total validators, {} non-whitelisted, {} blocks, fair_share={}, max_credited={}, weights={}%/{}%/{}%",
                session_index,
                total_validator_count,
                non_whitelisted_count,
                total_blocks,
                fair_share,
                max_credited_blocks,
                block_weight.deconstruct() * 100 / Perbill::ACCURACY,
                liveness_weight.deconstruct() * 100 / Perbill::ACCURACY,
                base_weight.deconstruct() * 100 / Perbill::ACCURACY
            );

            let mut rewards = Vec::new();

            // Calculate points for each validator
            for validator in validators.iter() {
                // Skip whitelisted validators - they don't participate in performance rewards
                if whitelisted_validators.contains(validator) {
                    continue;
                }

                // NOTE: Slashing check is disabled for now but hook is retained for future use.
                // Slashed validators will still be slashed financially via the slashing pallet;
                // they just won't lose their era rewards. This allows governance to cancel
                // erroneous slashes without also losing the validator's rewards.
                //
                // To re-enable, uncomment the following block:
                // let active_era = T::EraIndexProvider::active_era();
                // if T::SlashingCheck::is_slashed(active_era.index, validator) {
                //     log::warn!(
                //         target: "ext_validators_rewards",
                //         "Validator {:?} has slash in era {}, nullifying rewards",
                //         validator,
                //         active_era.index
                //     );
                //     continue;
                // }

                let blocks_authored = BlocksAuthoredInSession::<T>::get(validator);

                // Block production with soft cap allowing over-performance
                // credited_blocks = min(blocks_authored, max_credited_blocks)
                let credited_blocks = blocks_authored.min(max_credited_blocks);

                // Liveness score: Use block authorship as proof of liveness.
                // A validator who authored at least one block is definitively online.
                // This is simpler and more reliable than trying to cache ImOnline state
                // which has timing issues with session rotation.
                let is_online = blocks_authored > 0;
                let liveness_score = if is_online {
                    Perbill::one()
                } else {
                    Perbill::zero()
                };

                // Calculate points using direct computation to avoid Perbill capping.
                // Perbill::from_rational caps at 100% when numerator > denominator,
                // which would prevent over-performers from getting bonus points.
                //
                // Formula breakdown:
                // - Block contribution: block_weight × credited_blocks × base_points
                //   This directly rewards blocks authored, allowing over-performers to
                //   exceed 100% of fair share (up to the soft cap).
                //
                // - Liveness + Base contribution: (liveness_weight × liveness + base_weight) × total_blocks × base_points / count
                //   Uses total_blocks instead of fair_share to ensure no points are lost due to
                //   integer division truncation. The division by count happens at the end to
                //   distribute the full pool evenly.
                //
                // Total: block_contribution + liveness_base_contribution
                let base_points = T::BasePointsPerBlock::get();

                // Block contribution: block_weight × credited_blocks × base_points
                // This can exceed fair_share × base_points for over-performers
                let block_contribution =
                    block_weight.mul_floor(credited_blocks.saturating_mul(base_points));

                // Liveness + Base contribution: other_weight × effective_total × base_points / total_validators
                // Using max(total_blocks, total_validators) ensures:
                // 1. No points are lost from fair_share truncation when total_blocks > validator_count
                // 2. Minimum guaranteed potential when total_blocks < validator_count
                //
                // We divide by total_validator_count (not non_whitelisted_count) because:
                // - Whitelisted validators still occupy block production slots
                // - Each non-whitelisted validator should get their "fair share" of the liveness pool
                // - Otherwise liveness would disproportionately outweigh block authoring
                let other_weight = liveness_weight
                    .saturating_mul(liveness_score)
                    .saturating_add(base_weight);
                let effective_total_for_other = total_blocks.max(total_validator_count);
                let total_other_pool =
                    other_weight.mul_floor(effective_total_for_other.saturating_mul(base_points));
                let liveness_base_contribution = total_other_pool / total_validator_count;

                // Total points = block contribution + liveness/base contribution
                let points = block_contribution.saturating_add(liveness_base_contribution);

                if points > 0 {
                    log::debug!(
                        target: "ext_validators_rewards",
                        "Validator {:?}: blocks={}/{} (credited={}), online={}, block_pts={}, liveness_base_pts={}, total={}",
                        validator,
                        blocks_authored,
                        fair_share,
                        credited_blocks,
                        if is_online { "yes" } else { "no" },
                        block_contribution,
                        liveness_base_contribution,
                        points
                    );

                    rewards.push((validator.clone(), points));
                }
            }

            if !rewards.is_empty() {
                Self::reward_by_ids(rewards.into_iter());
            }

            // Clear session tracking storage
            let _ = BlocksAuthoredInSession::<T>::clear(u32::MAX, None);
        }
    }

    impl<T: Config> OnEraStart for Pallet<T> {
        fn on_era_start(era_index: EraIndex, _session_start: u32, _external_idx: u64) {
            let Some(era_index_to_delete) = era_index.checked_sub(T::HistoryDepth::get()) else {
                return;
            };

            RewardPointsForEra::<T>::remove(era_index_to_delete);
            BlocksProducedInEra::<T>::remove(era_index_to_delete);

            // Proactively clean up any unsent entries whose window state has
            // been removed while they were waiting for retry.
            let head = UnsentRewardHead::<T>::get();
            let mut tail = UnsentRewardTail::<T>::get();
            let mut slot = head;
            while slot != tail {
                if let Some(window) = UnsentRewardWindow::<T>::get(slot) {
                    if Self::window_rewards_info(
                        window.window_start,
                        window.window_index,
                        window.duration,
                    )
                    .is_none()
                    {
                        Self::clear_window(window.window_start);
                        Self::unsent_queue_remove_slot(slot);
                        tail = UnsentRewardTail::<T>::get();
                        Self::deposit_event(Event::UnsentWindowExpired {
                            window_start: window.window_start,
                            window_index: window.window_index,
                        });
                        // Don't advance slot — next entry slid into this position
                        continue;
                    }
                }
                slot = (slot + 1) % UNSENT_QUEUE_CAPACITY;
            }
        }
    }

    impl<T: Config> OnEraEnd for Pallet<T> {
        fn on_era_end(era_index: EraIndex) {
            // Calculate performance-scaled inflation based on blocks produced.
            let base_inflation = T::EraInflationProvider::get();
            let scaled_inflation = Self::calculate_scaled_inflation(era_index, base_inflation);

            // Check that there are reward points before minting.
            // This prevents minting inflation when no validators have earned rewards.
            let era_reward_points = RewardPointsForEra::<T>::get(&era_index);
            let total_points: u128 = era_reward_points
                .individual
                .values()
                .map(|pts| *pts as u128)
                .sum();

            if total_points.is_zero() {
                log::error!(
                    target: "ext_validators_rewards",
                    "No reward points in era {}, skipping inflation minting",
                    era_index
                );
                return;
            }

            let ethereum_sovereign_account = T::RewardsEthereumSovereignAccount::get();

            // Mint scaled inflation tokens using the configurable handler.
            // Returns an InflationMintResult with the rewards/treasury split.
            let mint_result = match T::HandleInflation::mint_inflation(
                &ethereum_sovereign_account,
                scaled_inflation,
            ) {
                Ok(result) => result,
                Err(err) => {
                    log::error!(target: "ext_validators_rewards", "Failed to handle inflation: {err:?}");
                    log::error!(target: "ext_validators_rewards", "Not sending message since there are no rewards to distribute");
                    return;
                }
            };

            // Get era start timestamp from the active era (still the ending era at this point).
            // Convert from milliseconds to seconds for EigenLayer compatibility.
            let era_start_timestamp = T::EraIndexProvider::active_era()
                .start
                .map(|ms| (ms / 1000) as u32)
                .unwrap_or(0);

            let (genesis, interval) = Self::rewards_window_config();
            let now = Self::now_seconds();

            // Allocate the rewards amount (post-treasury split) to aligned windows.
            Self::allocate_era_inflation_to_windows(
                era_start_timestamp,
                now,
                mint_result.rewards_amount,
                genesis,
                interval,
            );

            frame_system::Pallet::<T>::register_extra_weight_unchecked(
                T::WeightInfo::on_era_end(),
                DispatchClass::Mandatory,
            );

            Self::process_closed_windows(now, genesis, interval);
        }
    }
}

/// Wrapper for pallet_session::SessionManager that awards performance-based points at session end.
///
/// This implements the 60/30/10 performance formula for solochain validators:
/// - 60% weight: Block production (credited blocks vs fair share)
/// - 30% weight: Liveness (1.0 if authored at least one block, 0.0 otherwise)
/// - 10% weight: Base guarantee (always awarded)
///
/// Wraps an inner SessionManager (typically `NoteHistoricalRoot<ExternalValidators>`) and calls
/// the performance tracking logic at session end before forwarding to the inner manager.
pub struct SessionPerformanceManager<T, Inner>(core::marker::PhantomData<(T, Inner)>);

impl<T, Inner> pallet_session::SessionManager<T::AccountId> for SessionPerformanceManager<T, Inner>
where
    T: pallet::Config,
    Inner: pallet_session::SessionManager<T::AccountId>,
    <T as pallet::Config>::ValidatorSet: ValidatorSet<T::AccountId, ValidatorId = T::AccountId>,
{
    fn new_session(new_index: SessionIndex) -> Option<Vec<T::AccountId>> {
        <Inner as pallet_session::SessionManager<T::AccountId>>::new_session(new_index)
    }

    fn new_session_genesis(new_index: SessionIndex) -> Option<Vec<T::AccountId>> {
        <Inner as pallet_session::SessionManager<T::AccountId>>::new_session_genesis(new_index)
    }

    fn start_session(start_index: SessionIndex) {
        <Inner as pallet_session::SessionManager<T::AccountId>>::start_session(start_index)
    }

    fn end_session(end_index: SessionIndex) {
        // Award performance-based points before ending the session
        let validators = <T as pallet::Config>::ValidatorSet::validators();
        let whitelisted = T::GetWhitelistedValidators::get();

        pallet::Pallet::<T>::award_session_performance_points(end_index, validators, whitelisted);

        <Inner as pallet_session::SessionManager<T::AccountId>>::end_session(end_index)
    }
}

impl<T, Inner> pallet_session::historical::SessionManager<T::AccountId, ()>
    for SessionPerformanceManager<T, Inner>
where
    T: pallet::Config,
    Inner: pallet_session::historical::SessionManager<T::AccountId, ()>,
    <T as pallet::Config>::ValidatorSet: ValidatorSet<T::AccountId, ValidatorId = T::AccountId>,
{
    fn new_session(new_index: SessionIndex) -> Option<Vec<(T::AccountId, ())>> {
        <Inner as pallet_session::historical::SessionManager<T::AccountId, ()>>::new_session(
            new_index,
        )
    }

    fn start_session(start_index: SessionIndex) {
        <Inner as pallet_session::historical::SessionManager<T::AccountId, ()>>::start_session(
            start_index,
        )
    }

    fn end_session(end_index: SessionIndex) {
        // Award performance-based points before ending the session
        let validators = <T as pallet::Config>::ValidatorSet::validators();
        let whitelisted = T::GetWhitelistedValidators::get();

        pallet::Pallet::<T>::award_session_performance_points(end_index, validators, whitelisted);

        <Inner as pallet_session::historical::SessionManager<T::AccountId, ()>>::end_session(
            end_index,
        )
    }
}

/// Implementation of EventHandler for tracking block authorship
impl<T: Config>
    pallet_authorship::EventHandler<T::AccountId, frame_system::pallet_prelude::BlockNumberFor<T>>
    for Pallet<T>
{
    fn note_author(author: T::AccountId) {
        // Track block authorship for performance-based rewards (60/30/10 formula)
        Self::note_block_author(author);
    }
}
