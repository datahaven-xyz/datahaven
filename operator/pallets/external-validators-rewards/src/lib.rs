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
    crate::types::{EraRewardsUtils, HandleInflation, SendMessage},
    frame_support::traits::{Contains, Defensive, Get, ValidatorSet},
    pallet_external_validators::traits::{ExternalIndexProvider, OnEraEnd, OnEraStart},
    parity_scale_codec::Encode,
    polkadot_primitives::ValidatorIndex,
    runtime_parachains::session_info,
    snowbridge_merkle_tree::{merkle_proof, merkle_root, verify_proof, MerkleProof},
    sp_core::H256,
    sp_runtime::{
        traits::{Hash, Zero},
        Perbill,
    },
    sp_staking::SessionIndex,
    sp_std::{collections::btree_set::BTreeSet, vec::Vec},
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
        super::*, frame_support::pallet_prelude::*,
        pallet_external_validators::traits::EraIndexProvider, sp_runtime::Saturating,
        sp_std::collections::btree_map::BTreeMap,
    };

    /// The current storage version.
    const STORAGE_VERSION: StorageVersion = StorageVersion::new(0);

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

        /// The amount of era points given by backing a candidate that is included.
        #[pallet::constant]
        type BackingPoints: Get<u32>;

        /// The amount of era points given by dispute voting on a candidate.
        #[pallet::constant]
        type DisputeStatementPoints: Get<u32>;

        /// Provider to know how may tokens were inflated (added) in a specific era.
        type EraInflationProvider: Get<u128>;

        /// Provider to retrieve the current external index indetifying the validators
        type ExternalIndexProvider: ExternalIndexProvider;

        type GetWhitelistedValidators: Get<Vec<Self::AccountId>>;

        /// Validator set provider for performance tracking
        type ValidatorSet: frame_support::traits::ValidatorSet<Self::AccountId>;

        /// Provider to check if validators are online (sent heartbeat this session)
        type LivenessCheck: frame_support::traits::Contains<Self::AccountId>;

        /// Check if a validator has been slashed in a given era
        type SlashingCheck: SlashingCheck<Self::AccountId>;

        /// Base points awarded per validator per session (before applying performance multiplier)
        type AuthorBaseRewardPoints: Get<u32>;

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

        /// The weight information of this pallet.
        type WeightInfo: WeightInfo;

        /// How to send messages via Snowbridge Outbound Queue V2.
        type SendMessage: SendMessage;

        /// Hook for minting inflation tokens.
        type HandleInflation: HandleInflation<Self::AccountId>;

        #[cfg(feature = "runtime-benchmarks")]
        type BenchmarkHelper: types::BenchmarkHelper;
    }
    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// The rewards message was sent correctly.
        RewardsMessageSent {
            message_id: H256,
            era_index: EraIndex,
            total_points: u128,
            inflation_amount: u128,
            rewards_merkle_root: H256,
        },
    }

    /// Keep tracks of distributed points per validator and total.
    #[derive(RuntimeDebug, Encode, Decode, PartialEq, Eq, TypeInfo)]
    pub struct EraRewardPoints<AccountId> {
        pub total: RewardPoints,
        pub individual: BTreeMap<AccountId, RewardPoints>,
    }

    impl<AccountId: Ord + sp_runtime::traits::Debug + Parameter> EraRewardPoints<AccountId> {
        // Helper function used to generate the following utils:
        //  - rewards_merkle_root: merkle root corresponding [(validatorId, rewardPoints)]
        //      for the era_index specified.
        //  - leaves: that were used to generate the previous merkle root.
        //  - leaf_index: index of the validatorId's leaf in the previous leaves array (if any).
        //  - total_points: number of total points of the era_index specified.
        pub fn generate_era_rewards_utils<Hasher: sp_runtime::traits::Hash<Output = H256>>(
            &self,
            era_index: EraIndex,
            maybe_account_id_check: Option<AccountId>,
        ) -> Option<EraRewardsUtils> {
            let total_points: u128 = self.total as u128;
            let mut leaves = Vec::with_capacity(self.individual.len());
            let mut leaf_index = None;

            if let Some(account) = &maybe_account_id_check {
                if !self.individual.contains_key(account) {
                    log::error!(
                        target: "ext_validators_rewards",
                        "AccountId {:?} not found for era {:?}!",
                        account,
                        era_index
                    );
                    return None;
                }
            }

            for (index, (account_id, reward_points)) in self.individual.iter().enumerate() {
                let encoded = (account_id, reward_points).encode();
                let hashed = <Hasher as sp_runtime::traits::Hash>::hash(&encoded);

                leaves.push(hashed);

                if let Some(ref check_account_id) = maybe_account_id_check {
                    if account_id == check_account_id {
                        leaf_index = Some(index as u64);
                    }
                }
            }

            let rewards_merkle_root = merkle_root::<Hasher, _>(leaves.iter().cloned());

            Some(EraRewardsUtils {
                rewards_merkle_root,
                leaves,
                leaf_index,
                total_points,
            })
        }
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

    impl<T: Config> Pallet<T> {
        /// Reward validators. Does not check if the validators are valid, caller needs to make sure of that.
        pub fn reward_by_ids(points: impl IntoIterator<Item = (T::AccountId, RewardPoints)>) {
            let active_era = T::EraIndexProvider::active_era();

            RewardPointsForEra::<T>::mutate(active_era.index, |era_rewards| {
                for (validator, points) in points.into_iter() {
                    (*era_rewards.individual.entry(validator.clone()).or_default())
                        .saturating_accrue(points);
                    era_rewards.total.saturating_accrue(points);
                }
            })
        }

        pub fn generate_rewards_merkle_proof(
            account_id: T::AccountId,
            era_index: EraIndex,
        ) -> Option<MerkleProof> {
            let era_rewards = RewardPointsForEra::<T>::get(&era_index);
            let utils = era_rewards.generate_era_rewards_utils::<<T as Config>::Hashing>(
                era_index,
                Some(account_id),
            )?;
            utils.leaf_index.map(|index| {
                merkle_proof::<<T as Config>::Hashing, _>(utils.leaves.into_iter(), index)
            })
        }

        pub fn verify_rewards_merkle_proof(merkle_proof: MerkleProof) -> bool {
            verify_proof::<<T as Config>::Hashing, _, _>(
                &merkle_proof.root,
                merkle_proof.proof,
                merkle_proof.number_of_leaves,
                merkle_proof.leaf_index,
                merkle_proof.leaf,
            )
        }

        /// Helper to build, validate and deliver an outbound message.
        /// Logs any error and returns None on failure.
        fn send_rewards_message(utils: &EraRewardsUtils) -> Option<H256> {
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
                Perbill::from_rational(
                    blocks_produced.min(expected_blocks),
                    expected_blocks
                )
            } else {
                // If no expected blocks configured, use full inflation
                Perbill::one()
            };

            // Scale from min to max based on performance
            // inflation_percent = min + (performance_ratio × (max - min))
            let inflation_percent = min_percent.saturating_add(
                performance_ratio.mul_floor(max_percent.saturating_sub(min_percent))
            );

            // Apply percentage to base inflation
            let scaled_inflation = Perbill::from_percent(inflation_percent).mul_floor(base_inflation);

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

        /// Awards performance-based points at session end using a 50/30/20 weighted formula.
        ///
        /// # Reward Formula
        ///
        /// Each validator receives points based on:
        /// - **50% weight**: Block production (blocks produced / expected fair share, capped at 100%)
        /// - **30% weight**: Liveness (1.0 if heartbeat received, 0.0 otherwise)
        /// - **20% weight**: Base guarantee (always awarded to all active validators)
        ///
        /// Final points = BASE_POINTS × (50% × block_score + 30% × liveness_score + 20%)
        ///
        /// # Scoring Details
        ///
        /// - **Block production**: Measures BABE block authorship. Capped at fair share to avoid
        ///   over-rewarding validators who produce more than their expected share.
        /// - **Liveness**: Based on ImOnline heartbeats, indicating validator connectivity and
        ///   network participation. Complements block production by tracking uptime.
        /// - **Base guarantee**: Ensures all active validators receive minimum rewards.
        ///
        /// # Equivocation Handling
        ///
        /// Validators with slashes in the current era receive zero points (rewards nullified).
        ///
        /// # Whitelisted Validators
        ///
        /// Whitelisted validators are excluded from rewards to avoid conflicts with
        /// other reward mechanisms.
        pub fn award_session_performance_points(
            session_index: SessionIndex,
            validators: Vec<T::AccountId>,
            whitelisted_validators: Vec<T::AccountId>,
        ) {
            // Calculate total blocks for the session
            let total_blocks: u32 = BlocksAuthoredInSession::<T>::iter()
                .map(|(_, count)| count)
                .sum();

            let active_validator_count = validators.len() as u32;
            if active_validator_count == 0 {
                log::warn!(
                    target: "ext_validators_rewards",
                    "No active validators in session {}",
                    session_index
                );
                return;
            }

            // Fair share: expected blocks per validator using checked math
            let expected_blocks_per_validator = if total_blocks > 0 {
                total_blocks
                    .checked_div(active_validator_count)
                    .unwrap_or(1)
            } else {
                1 // Default to 1 when no blocks were produced
            };

            log::debug!(
                target: "ext_validators_rewards",
                "Session {} performance: {} validators, {} total blocks ({} expected/validator)",
                session_index,
                active_validator_count,
                total_blocks,
                expected_blocks_per_validator
            );

            // Get current era for equivocation checking
            let active_era = T::EraIndexProvider::active_era();
            let current_era_index = active_era.index;

            // Calculate and award points for each validator
            for validator in validators.iter() {
                // Skip whitelisted validators
                if whitelisted_validators.contains(validator) {
                    continue;
                }

                // Check for equivocation: if validator has been slashed this era, nullify all rewards
                if T::SlashingCheck::is_slashed(current_era_index, validator) {
                    log::warn!(
                        target: "ext_validators_rewards",
                        "Validator {:?} has equivocation slash in era {}, nullifying rewards",
                        validator,
                        current_era_index
                    );
                    continue; // Skip reward calculation entirely
                }

                let blocks_authored = BlocksAuthoredInSession::<T>::get(validator);

                // Block production score: capped at 100% (don't reward over-performance)
                let block_score = Perbill::from_rational(
                    blocks_authored.min(expected_blocks_per_validator),
                    expected_blocks_per_validator,
                );

                // Liveness score: based on ImOnline heartbeats for this session

                let is_online = T::LivenessCheck::contains(validator);
                let liveness_score = if is_online {
                    Perbill::one()
                } else {
                    Perbill::zero()
                };

                // Apply 50/30/20 weighting formula
                let weighted_score = Perbill::from_percent(50)
                    .saturating_mul(block_score)
                    .saturating_add(Perbill::from_percent(30).saturating_mul(liveness_score))
                    .saturating_add(Perbill::from_percent(20)); // 20% base guarantee

                // Calculate final points
                let points = weighted_score.mul_floor(T::AuthorBaseRewardPoints::get());

                if points > 0 {
                    log::debug!(
                        target: "ext_validators_rewards",
                        "Validator {:?}: blocks={}/{} (block_score={}%), online={}, weighted_score={}%, points={}",
                        validator,
                        blocks_authored,
                        expected_blocks_per_validator,
                        block_score.deconstruct() * 100 / Perbill::ACCURACY,
                        if is_online { "yes" } else { "no" },
                        weighted_score.deconstruct() * 100 / Perbill::ACCURACY,
                        points
                    );

                    Self::reward_by_ids([(validator.clone(), points)].into_iter());
                }
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
        }
    }

    impl<T: Config> OnEraEnd for Pallet<T> {
        fn on_era_end(era_index: EraIndex) {
            let utils = match RewardPointsForEra::<T>::get(&era_index)
                .generate_era_rewards_utils::<<T as Config>::Hashing>(era_index, None)
            {
                Some(utils) if !utils.total_points.is_zero() => utils,
                Some(_) => {
                    log::error!(
                        target: "ext_validators_rewards",
                        "Not sending message because total_points is 0"
                    );
                    return;
                }
                None => {
                    log::error!(
                        target: "ext_validators_rewards",
                        "Failed to generate era rewards utils"
                    );
                    return;
                }
            };

            // Calculate performance-scaled inflation based on blocks produced
            let ethereum_sovereign_account = T::RewardsEthereumSovereignAccount::get();
            let base_inflation = T::EraInflationProvider::get();
            let scaled_inflation = Self::calculate_scaled_inflation(era_index, base_inflation);

            // Mint scaled inflation tokens using the configurable handler
            if let Err(err) =
                T::HandleInflation::mint_inflation(&ethereum_sovereign_account, scaled_inflation)
            {
                log::error!(target: "ext_validators_rewards", "Failed to handle inflation: {err:?}");
                log::error!(target: "ext_validators_rewards", "Not sending message since there are no rewards to distribute");
                return;
            }

            frame_system::Pallet::<T>::register_extra_weight_unchecked(
                T::WeightInfo::on_era_end(),
                DispatchClass::Mandatory,
            );

            if let Some(message_id) = Self::send_rewards_message(&utils) {
                Self::deposit_event(Event::RewardsMessageSent {
                    message_id,
                    era_index,
                    total_points: utils.total_points,
                    inflation_amount: scaled_inflation,
                    rewards_merkle_root: utils.rewards_merkle_root,
                });
            }
        }
    }
}

/// Rewards validators for participating in parachains with era points in pallet-staking.
pub struct RewardValidatorsWithEraPoints<C>(core::marker::PhantomData<C>);

impl<C> RewardValidatorsWithEraPoints<C>
where
    C: pallet::Config
        + session_info::Config<
            ValidatorSet: frame_support::traits::ValidatorSet<
                C::AccountId,
                ValidatorId = C::AccountId,
            >,
        >,
    <C as pallet::Config>::ValidatorSet:
        frame_support::traits::ValidatorSet<C::AccountId, ValidatorId = C::AccountId>,
    C::AccountId: Ord,
{
    /// Reward validators in session with points, but only if they are in the active set.
    fn reward_only_active(
        session_index: SessionIndex,
        indices: impl IntoIterator<Item = ValidatorIndex>,
        points: u32,
    ) {
        let validators = session_info::AccountKeys::<C>::get(&session_index);
        let validators = match validators
            .defensive_proof("account_keys are present for dispute_period sessions")
        {
            Some(validators) => validators,
            None => return,
        };
        // limit rewards to the active validator set
        let mut active_set: BTreeSet<C::AccountId> =
            <C as pallet::Config>::ValidatorSet::validators()
                .into_iter()
                .collect();

        // Remove whitelisted validators, we don't want to reward them
        let whitelisted_validators = C::GetWhitelistedValidators::get();
        for validator in whitelisted_validators {
            active_set.remove(&validator);
        }

        let rewards = indices
            .into_iter()
            .filter_map(|i| validators.get(i.0 as usize).cloned())
            .filter(|v| active_set.contains(v))
            .map(|v| (v, points));

        pallet::Pallet::<C>::reward_by_ids(rewards);
    }
}

impl<C> runtime_parachains::inclusion::RewardValidators for RewardValidatorsWithEraPoints<C>
where
    C: pallet::Config
        + runtime_parachains::shared::Config
        + session_info::Config<
            ValidatorSet: frame_support::traits::ValidatorSet<
                C::AccountId,
                ValidatorId = C::AccountId,
            >,
        >,
    <C as pallet::Config>::ValidatorSet:
        frame_support::traits::ValidatorSet<C::AccountId, ValidatorId = C::AccountId>,
    C::AccountId: Ord,
{
    fn reward_backing(indices: impl IntoIterator<Item = ValidatorIndex>) {
        let session_index = runtime_parachains::shared::CurrentSessionIndex::<C>::get();
        Self::reward_only_active(session_index, indices, C::BackingPoints::get());
    }

    fn reward_bitfields(_validators: impl IntoIterator<Item = ValidatorIndex>) {}
}

impl<C> runtime_parachains::disputes::RewardValidators for RewardValidatorsWithEraPoints<C>
where
    C: pallet::Config
        + session_info::Config<
            ValidatorSet: frame_support::traits::ValidatorSet<
                C::AccountId,
                ValidatorId = C::AccountId,
            >,
        >,
    <C as pallet::Config>::ValidatorSet:
        frame_support::traits::ValidatorSet<C::AccountId, ValidatorId = C::AccountId>,
    C::AccountId: Ord,
{
    fn reward_dispute_statement(
        session: SessionIndex,
        validators: impl IntoIterator<Item = ValidatorIndex>,
    ) {
        Self::reward_only_active(session, validators, C::DisputeStatementPoints::get());
    }
}

/// Wrapper for pallet_session::SessionManager that awards performance-based points at session end.
///
/// This implements the 50/30/20 performance formula for solochain validators:
/// - 50% weight: Block production (BABE participation)
/// - 30% weight: Heartbeat/liveness (ImOnline participation)
/// - 20% weight: Base guarantee (always awarded)
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
        // Track block authorship for performance-based rewards (50/30/20 formula)
        Self::note_block_author(author);
    }
}
