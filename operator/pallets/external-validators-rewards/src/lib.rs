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
    frame_support::traits::{Defensive, Get, ValidatorSet},
    pallet_external_validators::traits::{ExternalIndexProvider, OnEraEnd, OnEraStart},
    parity_scale_codec::Encode,
    polkadot_primitives::ValidatorIndex,
    runtime_parachains::session_info,
    snowbridge_merkle_tree::{merkle_proof, merkle_root, verify_proof, MerkleProof},
    sp_core::{H160, H256},
    sp_runtime::traits::{Hash, Zero},
    sp_staking::SessionIndex,
    sp_std::{collections::btree_set::BTreeSet, vec::Vec},
};

#[frame_support::pallet]
pub mod pallet {
    use frame_support::traits::fungible;

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
        //  - individual_points: (address, points) tuples for each validator.
        //  - inflation_amount: total inflation tokens to distribute.
        pub fn generate_era_rewards_utils<Hasher: sp_runtime::traits::Hash<Output = H256>>(
            &self,
            era_index: EraIndex,
            maybe_account_id_check: Option<AccountId>,
            inflation_amount: u128,
        ) -> Option<EraRewardsUtils> {
            let total_points: u128 = self.total as u128;
            let mut leaves = Vec::with_capacity(self.individual.len());
            let mut leaf_index = None;
            let mut individual_points = Vec::with_capacity(self.individual.len());

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

                // Convert AccountId to H160 for EigenLayer rewards submission.
                // In DataHaven, AccountId is H160, so encode() produces exactly 20 bytes.
                let account_encoded = account_id.encode();
                if account_encoded.len() >= 20 {
                    let mut bytes = [0u8; 20];
                    bytes.copy_from_slice(&account_encoded[..20]);
                    individual_points.push((H160::from(bytes), *reward_points));
                } else {
                    log::error!(
                        target: "ext_validators_rewards",
                        "Validator {:?} has unexpected AccountId encoding length {} (expected >= 20). \
                         Skipping from EigenLayer rewards submission for era {:?}. \
                         Points: {}, Total era points: {}",
                        account_id,
                        account_encoded.len(),
                        era_index,
                        reward_points,
                        self.total
                    );
                }

                if let Some(ref check_account_id) = maybe_account_id_check {
                    if account_id == check_account_id {
                        leaf_index = Some(index as u64);
                    }
                }
            }

            let rewards_merkle_root = merkle_root::<Hasher, _>(leaves.iter().cloned());

            // Validate that we have operators to distribute rewards to.
            // If total_points > 0 but individual_points is empty, all validators failed
            // H160 extraction (AccountId encoding < 20 bytes). In this case, we must
            // return None to prevent inflation from being minted with no way to distribute it.
            if !total_points.is_zero() && individual_points.is_empty() {
                log::error!(
                    target: "ext_validators_rewards",
                    "Era {:?} has {} total points but no valid operators for EigenLayer rewards. \
                     All validators failed H160 extraction. Skipping era to prevent token loss.",
                    era_index,
                    total_points
                );
                return None;
            }

            Some(EraRewardsUtils {
                rewards_merkle_root,
                leaves,
                leaf_index,
                total_points,
                individual_points,
                inflation_amount,
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
            // Pass 0 for inflation_amount as it's not needed for merkle proof generation
            let utils = era_rewards.generate_era_rewards_utils::<<T as Config>::Hashing>(
                era_index,
                Some(account_id),
                0,
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
            // Get inflation amount first - needed for both minting and EraRewardsUtils
            let inflation_amount = T::EraInflationProvider::get();

            let utils = match RewardPointsForEra::<T>::get(&era_index)
                .generate_era_rewards_utils::<<T as Config>::Hashing>(
                    era_index,
                    None,
                    inflation_amount,
                ) {
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

            // Mint tokens using the configurable handler
            let ethereum_sovereign_account = T::RewardsEthereumSovereignAccount::get();
            if let Err(err) =
                T::HandleInflation::mint_inflation(&ethereum_sovereign_account, inflation_amount)
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
                    inflation_amount,
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
    C: pallet::Config + session_info::Config,
    C::ValidatorSet: ValidatorSet<C::AccountId, ValidatorId = C::AccountId>,
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
        let mut active_set: BTreeSet<_> = C::ValidatorSet::validators().into_iter().collect();

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
    C: pallet::Config + runtime_parachains::shared::Config + session_info::Config,
    C::ValidatorSet: ValidatorSet<C::AccountId, ValidatorId = C::AccountId>,
{
    fn reward_backing(indices: impl IntoIterator<Item = ValidatorIndex>) {
        let session_index = runtime_parachains::shared::CurrentSessionIndex::<C>::get();
        Self::reward_only_active(session_index, indices, C::BackingPoints::get());
    }

    fn reward_bitfields(_validators: impl IntoIterator<Item = ValidatorIndex>) {}
}

impl<C> runtime_parachains::disputes::RewardValidators for RewardValidatorsWithEraPoints<C>
where
    C: pallet::Config + session_info::Config,
    C::ValidatorSet: ValidatorSet<C::AccountId, ValidatorId = C::AccountId>,
{
    fn reward_dispute_statement(
        session: SessionIndex,
        validators: impl IntoIterator<Item = ValidatorIndex>,
    ) {
        Self::reward_only_active(session, validators, C::DisputeStatementPoints::get());
    }
}
