// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Ethereum Beacon Client
//!
//! A light client that verifies consensus updates signed by the sync committee of the beacon chain.
//!
//! # Extrinsics
//!
//! ## Governance
//!
//! * [`Call::force_checkpoint`]: Set the initial trusted consensus checkpoint.
//! * [`Call::set_operating_mode`]: Set the operating mode of the pallet. Can be used to disable
//!   processing of consensus updates.
//!
//! ## Consensus Updates
//!
//! * [`Call::submit`]: Submit a finalized beacon header with an optional sync committee update
#![cfg_attr(not(feature = "std"), no_std)]

pub mod config;
pub mod functions;
pub mod impls;
pub mod types;
pub mod weights;

#[cfg(any(test, feature = "fuzzing"))]
pub mod mock;

#[cfg(test)]
pub mod mock_electra;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod tests_electra;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

use frame_support::{
    dispatch::{DispatchResult, PostDispatchInfo},
    pallet_prelude::OptionQuery,
    traits::Get,
    transactional,
};
use frame_system::ensure_signed;
use snowbridge_beacon_primitives::{
    fast_aggregate_verify,
    merkle_proof::{generalized_index_length, subtree_index},
    verify_merkle_branch, verify_receipt_proof, BeaconHeader, BlsError, CompactBeaconState,
    ForkData, ForkVersion, ForkVersions, PublicKeyPrepared, SigningData,
};
use snowbridge_core::{BasicOperatingMode, RingBufferMap};
use sp_core::H256;
use sp_std::prelude::*;
pub use weights::WeightInfo;

use functions::{
    compute_epoch, compute_period, decompress_sync_committee_bits, sync_committee_sum,
};
use types::{CheckpointUpdate, FinalizedBeaconStateBuffer, SyncCommitteePrepared, Update};

pub use pallet::*;

pub use config::SLOTS_PER_HISTORICAL_ROOT;

pub const LOG_TARGET: &str = "ethereum-client";

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;

    #[derive(scale_info::TypeInfo, codec::Encode, codec::Decode, codec::MaxEncodedLen)]
    #[codec(mel_bound(T: Config))]
    #[scale_info(skip_type_params(T))]
    pub struct MaxFinalizedHeadersToKeep<T: Config>(PhantomData<T>);
    impl<T: Config> Get<u32> for MaxFinalizedHeadersToKeep<T> {
        fn get() -> u32 {
            const MAX_REDUNDANCY: u32 = 20;
            config::EPOCHS_PER_SYNC_COMMITTEE_PERIOD as u32 * MAX_REDUNDANCY
        }
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        #[pallet::constant]
        type ForkVersions: Get<ForkVersions>;
        /// Minimum gap between finalized headers for an update to be free.
        #[pallet::constant]
        type FreeHeadersInterval: Get<u32>;
        type WeightInfo: WeightInfo;
    }

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        BeaconHeaderImported {
            block_hash: H256,
            slot: u64,
        },
        SyncCommitteeUpdated {
            period: u64,
        },
        /// Set OperatingMode
        OperatingModeChanged {
            mode: BasicOperatingMode,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        SkippedSyncCommitteePeriod,
        SyncCommitteeUpdateRequired,
        /// Attested header is older than latest finalized header.
        IrrelevantUpdate,
        NotBootstrapped,
        SyncCommitteeParticipantsNotSupermajority,
        InvalidHeaderMerkleProof,
        InvalidSyncCommitteeMerkleProof,
        InvalidExecutionHeaderProof,
        InvalidAncestryMerkleProof,
        InvalidBlockRootsRootMerkleProof,
        /// The gap between the finalized headers is larger than the sync committee period,
        /// rendering execution headers unprovable using ancestry proofs (blocks root size is
        /// the same as the sync committee period slots).
        InvalidFinalizedHeaderGap,
        HeaderNotFinalized,
        BlockBodyHashTreeRootFailed,
        HeaderHashTreeRootFailed,
        SyncCommitteeHashTreeRootFailed,
        SigningRootHashTreeRootFailed,
        ForkDataHashTreeRootFailed,
        ExpectedFinalizedHeaderNotStored,
        BLSPreparePublicKeysFailed,
        BLSVerificationFailed(BlsError),
        InvalidUpdateSlot,
        /// The given update is not in the expected period, or the given next sync committee does
        /// not match the next sync committee in storage.
        InvalidSyncCommitteeUpdate,
        ExecutionHeaderTooFarBehind,
        ExecutionHeaderSkippedBlock,
        Halted,
    }

    /// Latest imported checkpoint root
    #[pallet::storage]
    #[pallet::getter(fn initial_checkpoint_root)]
    pub type InitialCheckpointRoot<T: Config> = StorageValue<_, H256, ValueQuery>;

    /// Latest imported finalized block root
    #[pallet::storage]
    #[pallet::getter(fn latest_finalized_block_root)]
    pub type LatestFinalizedBlockRoot<T: Config> = StorageValue<_, H256, ValueQuery>;

    /// Beacon state by finalized block root
    #[pallet::storage]
    #[pallet::getter(fn finalized_beacon_state)]
    pub type FinalizedBeaconState<T: Config> =
        StorageMap<_, Identity, H256, CompactBeaconState, OptionQuery>;

    /// Finalized Headers: Current position in ring buffer
    #[pallet::storage]
    pub type FinalizedBeaconStateIndex<T: Config> = StorageValue<_, u32, ValueQuery>;

    /// Finalized Headers: Mapping of ring buffer index to a pruning candidate
    #[pallet::storage]
    pub type FinalizedBeaconStateMapping<T: Config> =
        StorageMap<_, Identity, u32, H256, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn validators_root)]
    pub type ValidatorsRoot<T: Config> = StorageValue<_, H256, ValueQuery>;

    /// Sync committee for current period
    #[pallet::storage]
    pub type CurrentSyncCommittee<T: Config> = StorageValue<_, SyncCommitteePrepared, ValueQuery>;

    /// Sync committee for next period
    #[pallet::storage]
    pub type NextSyncCommittee<T: Config> = StorageValue<_, SyncCommitteePrepared, ValueQuery>;

    /// The last period where the next sync committee was updated for free.
    #[pallet::storage]
    pub type LatestSyncCommitteeUpdatePeriod<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// The current operating mode of the pallet.
    #[pallet::storage]
    #[pallet::getter(fn operating_mode)]
    pub type OperatingMode<T: Config> = StorageValue<_, BasicOperatingMode, ValueQuery>;

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::force_checkpoint())]
        #[transactional]
        /// Used for pallet initialization and light client resetting. Needs to be called by
        /// the root origin.
        pub fn force_checkpoint(
            origin: OriginFor<T>,
            update: Box<CheckpointUpdate>,
        ) -> DispatchResult {
            ensure_root(origin)?;
            Self::process_checkpoint_update(&update)?;
            Ok(())
        }

        #[pallet::call_index(1)]
        #[pallet::weight({
			match update.next_sync_committee_update {
				None => T::WeightInfo::submit(),
				Some(_) => T::WeightInfo::submit_with_sync_committee(),
			}
		})]
        #[transactional]
        /// Submits a new finalized beacon header update. The update may contain the next
        /// sync committee.
        pub fn submit(origin: OriginFor<T>, update: Box<Update>) -> DispatchResultWithPostInfo {
            ensure_signed(origin)?;
            ensure!(!Self::operating_mode().is_halted(), Error::<T>::Halted);
            Self::process_update(&update)
        }

        /// Halt or resume all pallet operations. May only be called by root.
        #[pallet::call_index(3)]
        #[pallet::weight((T::DbWeight::get().reads_writes(1, 1), DispatchClass::Operational))]
        pub fn set_operating_mode(
            origin: OriginFor<T>,
            mode: BasicOperatingMode,
        ) -> DispatchResult {
            ensure_root(origin)?;
            OperatingMode::<T>::set(mode);
            Self::deposit_event(Event::OperatingModeChanged { mode });
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// Forces a finalized beacon header checkpoint update. The current sync committee,
        /// with a header attesting to the current sync committee, should be provided.
        /// An `block_roots` proof should also be provided. This is used for ancestry proofs
        /// for execution header updates.
        pub(crate) fn process_checkpoint_update(update: &CheckpointUpdate) -> DispatchResult {
            let sync_committee_root = update
                .current_sync_committee
                .hash_tree_root()
                .map_err(|_| Error::<T>::SyncCommitteeHashTreeRootFailed)?;

            let fork_versions = T::ForkVersions::get();
            let sync_committee_gindex = Self::current_sync_committee_gindex_at_slot(
                update.header.slot,
                fork_versions.clone(),
            );
            // Verifies the sync committee in the Beacon state.
            ensure!(
                verify_merkle_branch(
                    sync_committee_root,
                    &update.current_sync_committee_branch,
                    subtree_index(sync_committee_gindex),
                    generalized_index_length(sync_committee_gindex),
                    update.header.state_root
                ),
                Error::<T>::InvalidSyncCommitteeMerkleProof
            );

            let header_root: H256 = update
                .header
                .hash_tree_root()
                .map_err(|_| Error::<T>::HeaderHashTreeRootFailed)?;

            // This is used for ancestry proofs in ExecutionHeader updates. This verifies the
            // BeaconState: the beacon state root is the tree root; the `block_roots` hash is the
            // tree leaf.
            let block_roots_gindex =
                Self::block_roots_gindex_at_slot(update.header.slot, fork_versions);
            ensure!(
                verify_merkle_branch(
                    update.block_roots_root,
                    &update.block_roots_branch,
                    subtree_index(block_roots_gindex),
                    generalized_index_length(block_roots_gindex),
                    update.header.state_root
                ),
                Error::<T>::InvalidBlockRootsRootMerkleProof
            );

            let sync_committee_prepared: SyncCommitteePrepared = (&update.current_sync_committee)
                .try_into()
                .map_err(|_| <Error<T>>::BLSPreparePublicKeysFailed)?;
            <CurrentSyncCommittee<T>>::set(sync_committee_prepared);
            <NextSyncCommittee<T>>::kill();
            InitialCheckpointRoot::<T>::set(header_root);

            Self::store_validators_root(update.validators_root);
            Self::store_finalized_header(update.header, update.block_roots_root)?;

            Ok(())
        }

        pub(crate) fn process_update(update: &Update) -> DispatchResultWithPostInfo {
            Self::verify_update(update)?;
            Self::apply_update(update)
        }

        /// References and strictly follows <https://github.com/ethereum/consensus-specs/blob/dev/specs/altair/light-client/sync-protocol.md#validate_light_client_update>
        /// Verifies that provided next sync committee is valid through a series of checks
        /// (including checking that a sync committee period isn't skipped and that the header is
        /// signed by the current sync committee.
        fn verify_update(update: &Update) -> DispatchResult {
            // Verify sync committee has sufficient participants.
            let participation =
                decompress_sync_committee_bits(update.sync_aggregate.sync_committee_bits);
            Self::sync_committee_participation_is_supermajority(&participation)?;

            // Verify update does not skip a sync committee period.
            ensure!(
                update.signature_slot > update.attested_header.slot
                    && update.attested_header.slot >= update.finalized_header.slot,
                Error::<T>::InvalidUpdateSlot
            );
            // Retrieve latest finalized state.
            let latest_finalized_state =
                FinalizedBeaconState::<T>::get(LatestFinalizedBlockRoot::<T>::get())
                    .ok_or(Error::<T>::NotBootstrapped)?;
            let store_period = compute_period(latest_finalized_state.slot);
            let signature_period = compute_period(update.signature_slot);
            if <NextSyncCommittee<T>>::exists() {
                ensure!(
                    (store_period..=store_period + 1).contains(&signature_period),
                    Error::<T>::SkippedSyncCommitteePeriod
                )
            } else {
                ensure!(
                    signature_period == store_period,
                    Error::<T>::SkippedSyncCommitteePeriod
                )
            }

            // Verify update is relevant.
            let update_attested_period = compute_period(update.attested_header.slot);
            let update_finalized_period = compute_period(update.finalized_header.slot);
            let update_has_next_sync_committee = !<NextSyncCommittee<T>>::exists()
                && (update.next_sync_committee_update.is_some()
                    && update_attested_period == store_period);
            ensure!(
                update.attested_header.slot > latest_finalized_state.slot
                    || update_has_next_sync_committee,
                Error::<T>::IrrelevantUpdate
            );

            // Verify the finalized header gap between the current finalized header and new imported
            // header is not larger than the sync committee period, otherwise we cannot do
            // ancestry proofs for execution headers in the gap.
            ensure!(
                latest_finalized_state
                    .slot
                    .saturating_add(config::SLOTS_PER_HISTORICAL_ROOT as u64)
                    >= update.finalized_header.slot,
                Error::<T>::InvalidFinalizedHeaderGap
            );

            let fork_versions = T::ForkVersions::get();
            let finalized_root_gindex = Self::finalized_root_gindex_at_slot(
                update.attested_header.slot,
                fork_versions.clone(),
            );
            // Verify that the `finality_branch`, if present, confirms `finalized_header` to match
            // the finalized checkpoint root saved in the state of `attested_header`.
            let finalized_block_root: H256 = update
                .finalized_header
                .hash_tree_root()
                .map_err(|_| Error::<T>::HeaderHashTreeRootFailed)?;
            ensure!(
                verify_merkle_branch(
                    finalized_block_root,
                    &update.finality_branch,
                    subtree_index(finalized_root_gindex),
                    generalized_index_length(finalized_root_gindex),
                    update.attested_header.state_root
                ),
                Error::<T>::InvalidHeaderMerkleProof
            );

            // Though following check does not belong to ALC spec we verify block_roots_root to
            // match the finalized checkpoint root saved in the state of `finalized_header` so to
            // cache it for later use in `verify_ancestry_proof`.
            let block_roots_gindex = Self::block_roots_gindex_at_slot(
                update.finalized_header.slot,
                fork_versions.clone(),
            );
            ensure!(
                verify_merkle_branch(
                    update.block_roots_root,
                    &update.block_roots_branch,
                    subtree_index(block_roots_gindex),
                    generalized_index_length(block_roots_gindex),
                    update.finalized_header.state_root
                ),
                Error::<T>::InvalidBlockRootsRootMerkleProof
            );

            // Verify that the `next_sync_committee`, if present, actually is the next sync
            // committee saved in the state of the `attested_header`.
            if let Some(next_sync_committee_update) = &update.next_sync_committee_update {
                let sync_committee_root = next_sync_committee_update
                    .next_sync_committee
                    .hash_tree_root()
                    .map_err(|_| Error::<T>::SyncCommitteeHashTreeRootFailed)?;
                if update_attested_period == store_period && <NextSyncCommittee<T>>::exists() {
                    let next_committee_root = <NextSyncCommittee<T>>::get().root;
                    ensure!(
                        sync_committee_root == next_committee_root,
                        Error::<T>::InvalidSyncCommitteeUpdate
                    );
                }
                let next_sync_committee_gindex = Self::next_sync_committee_gindex_at_slot(
                    update.attested_header.slot,
                    fork_versions,
                );
                ensure!(
                    verify_merkle_branch(
                        sync_committee_root,
                        &next_sync_committee_update.next_sync_committee_branch,
                        subtree_index(next_sync_committee_gindex),
                        generalized_index_length(next_sync_committee_gindex),
                        update.attested_header.state_root
                    ),
                    Error::<T>::InvalidSyncCommitteeMerkleProof
                );
            } else {
                ensure!(
                    update_finalized_period == store_period,
                    Error::<T>::SyncCommitteeUpdateRequired
                );
            }

            // Verify sync committee aggregate signature.
            let sync_committee = if signature_period == store_period {
                <CurrentSyncCommittee<T>>::get()
            } else {
                <NextSyncCommittee<T>>::get()
            };
            let absent_pubkeys =
                Self::find_pubkeys(&participation, (*sync_committee.pubkeys).as_ref(), false);
            let signing_root = Self::signing_root(
                &update.attested_header,
                Self::validators_root(),
                update.signature_slot,
            )?;
            // Improvement here per <https://eth2book.info/capella/part2/building_blocks/signatures/#sync-aggregates>
            // suggested start from the full set aggregate_pubkey then subtracting the absolute
            // minority that did not participate.
            fast_aggregate_verify(
                &sync_committee.aggregate_pubkey,
                &absent_pubkeys,
                signing_root,
                &update.sync_aggregate.sync_committee_signature,
            )
            .map_err(|e| Error::<T>::BLSVerificationFailed(e))?;

            Ok(())
        }

        /// Reference and strictly follows <https://github.com/ethereum/consensus-specs/blob/dev/specs/altair/light-client/sync-protocol.md#apply_light_client_update
        /// Applies a finalized beacon header update to the beacon client. If a next sync committee
        /// is present in the update, verify the sync committee by converting it to a
        /// SyncCommitteePrepared type. Stores the provided finalized header. Updates are free
        /// if the certain conditions specified in `check_refundable` are met.
        fn apply_update(update: &Update) -> DispatchResultWithPostInfo {
            let latest_finalized_state =
                FinalizedBeaconState::<T>::get(LatestFinalizedBlockRoot::<T>::get())
                    .ok_or(Error::<T>::NotBootstrapped)?;

            let pays_fee = Self::check_refundable(update, latest_finalized_state.slot);
            let actual_weight = match update.next_sync_committee_update {
                None => T::WeightInfo::submit(),
                Some(_) => T::WeightInfo::submit_with_sync_committee(),
            };

            if let Some(next_sync_committee_update) = &update.next_sync_committee_update {
                let store_period = compute_period(latest_finalized_state.slot);
                let update_finalized_period = compute_period(update.finalized_header.slot);
                let sync_committee_prepared: SyncCommitteePrepared = (&next_sync_committee_update
                    .next_sync_committee)
                    .try_into()
                    .map_err(|_| <Error<T>>::BLSPreparePublicKeysFailed)?;

                if !<NextSyncCommittee<T>>::exists() {
                    ensure!(
                        update_finalized_period == store_period,
                        <Error<T>>::InvalidSyncCommitteeUpdate
                    );
                    <NextSyncCommittee<T>>::set(sync_committee_prepared);
                } else if update_finalized_period == store_period + 1 {
                    <CurrentSyncCommittee<T>>::set(<NextSyncCommittee<T>>::get());
                    <NextSyncCommittee<T>>::set(sync_committee_prepared);
                }
                log::info!(
                    target: LOG_TARGET,
                    "💫 SyncCommitteeUpdated at period {}.",
                    update_finalized_period
                );
                <LatestSyncCommitteeUpdatePeriod<T>>::set(update_finalized_period);
                Self::deposit_event(Event::SyncCommitteeUpdated {
                    period: update_finalized_period,
                });
            };

            if update.finalized_header.slot > latest_finalized_state.slot {
                Self::store_finalized_header(update.finalized_header, update.block_roots_root)?;
            }

            Ok(PostDispatchInfo {
                actual_weight: Some(actual_weight),
                pays_fee,
            })
        }

        /// Computes the signing root for a given beacon header and domain. The hash tree root
        /// of the beacon header is computed, and then the combination of the beacon header hash
        /// and the domain makes up the signing root.
        pub(super) fn compute_signing_root(
            beacon_header: &BeaconHeader,
            domain: H256,
        ) -> Result<H256, DispatchError> {
            let beacon_header_root = beacon_header
                .hash_tree_root()
                .map_err(|_| Error::<T>::HeaderHashTreeRootFailed)?;

            let hash_root = SigningData {
                object_root: beacon_header_root,
                domain,
            }
            .hash_tree_root()
            .map_err(|_| Error::<T>::SigningRootHashTreeRootFailed)?;

            Ok(hash_root)
        }

        /// Stores a compacted (slot and block roots root (hash of the `block_roots` beacon state
        /// field, used for ancestry proof)) beacon state in a ring buffer map, with the header root
        /// as map key.
        pub fn store_finalized_header(
            header: BeaconHeader,
            block_roots_root: H256,
        ) -> DispatchResult {
            let slot = header.slot;

            let header_root: H256 = header
                .hash_tree_root()
                .map_err(|_| Error::<T>::HeaderHashTreeRootFailed)?;

            <FinalizedBeaconStateBuffer<T>>::insert(
                header_root,
                CompactBeaconState {
                    slot: header.slot,
                    block_roots_root,
                },
            );
            <LatestFinalizedBlockRoot<T>>::set(header_root);

            log::info!(
                target: LOG_TARGET,
                "💫 Updated latest finalized block root {} at slot {}.",
                header_root,
                slot
            );

            Self::deposit_event(Event::BeaconHeaderImported {
                block_hash: header_root,
                slot,
            });

            Ok(())
        }

        /// Stores the validators root in storage. Validators root is the hash tree root of all the
        /// validators at genesis and is used to used to identify the chain that we are on
        /// (used in conjunction with the fork version).
        /// <https://eth2book.info/capella/part3/containers/state/#genesis_validators_root>
        fn store_validators_root(validators_root: H256) {
            <ValidatorsRoot<T>>::set(validators_root);
        }

        /// Returns the domain for the domain_type and fork_version. The domain is used to
        /// distinguish between the different players in the chain (see DomainTypes
        /// <https://eth2book.info/capella/part3/config/constants/#domain-types>) and to ensure we are
        /// addressing the correct chain.
        /// <https://eth2book.info/capella/part3/helper/misc/#compute_domain>
        pub(super) fn compute_domain(
            domain_type: Vec<u8>,
            fork_version: ForkVersion,
            genesis_validators_root: H256,
        ) -> Result<H256, DispatchError> {
            let fork_data_root =
                Self::compute_fork_data_root(fork_version, genesis_validators_root)?;

            let mut domain = [0u8; 32];
            domain[0..4].copy_from_slice(&(domain_type));
            domain[4..32].copy_from_slice(&(fork_data_root.0[..28]));

            Ok(domain.into())
        }

        /// Computes the fork data root. The fork data root is a merkleization of the current
        /// fork version and the genesis validators root.
        fn compute_fork_data_root(
            current_version: ForkVersion,
            genesis_validators_root: H256,
        ) -> Result<H256, DispatchError> {
            let hash_root = ForkData {
                current_version,
                genesis_validators_root: genesis_validators_root.into(),
            }
            .hash_tree_root()
            .map_err(|_| Error::<T>::ForkDataHashTreeRootFailed)?;

            Ok(hash_root)
        }

        /// Checks that the sync committee bits (the votes of the sync committee members,
        /// represented by bits 0 and 1) is more than a supermajority (2/3 of the votes are
        /// positive).
        pub(super) fn sync_committee_participation_is_supermajority(
            sync_committee_bits: &[u8],
        ) -> DispatchResult {
            let sync_committee_sum = sync_committee_sum(sync_committee_bits);
            ensure!(
                ((sync_committee_sum * 3) as usize) >= sync_committee_bits.len() * 2,
                Error::<T>::SyncCommitteeParticipantsNotSupermajority
            );

            Ok(())
        }

        /// Returns the fork version based on the current epoch. The hard fork versions
        /// are defined in pallet config.
        pub(super) fn compute_fork_version(epoch: u64) -> ForkVersion {
            Self::select_fork_version(&T::ForkVersions::get(), epoch)
        }

        /// Returns the fork version based on the current epoch.
        pub(super) fn select_fork_version(fork_versions: &ForkVersions, epoch: u64) -> ForkVersion {
            if epoch >= fork_versions.electra.epoch {
                return fork_versions.electra.version;
            }
            if epoch >= fork_versions.deneb.epoch {
                return fork_versions.deneb.version;
            }
            if epoch >= fork_versions.capella.epoch {
                return fork_versions.capella.version;
            }
            if epoch >= fork_versions.bellatrix.epoch {
                return fork_versions.bellatrix.version;
            }
            if epoch >= fork_versions.altair.epoch {
                return fork_versions.altair.version;
            }
            fork_versions.genesis.version
        }

        /// Returns a vector of public keys that participated in the sync committee block signage.
        /// Sync committee bits is an array of 0s and 1s, 0 meaning the corresponding sync committee
        /// member did not participate in the vote, 1 meaning they participated.
        /// This method can find the absent or participating members, based on the participant
        /// parameter. participant = false will return absent participants, participant = true will
        /// return participating members.
        pub fn find_pubkeys(
            sync_committee_bits: &[u8],
            sync_committee_pubkeys: &[PublicKeyPrepared],
            participant: bool,
        ) -> Vec<PublicKeyPrepared> {
            let mut pubkeys: Vec<PublicKeyPrepared> = Vec::new();
            for (bit, pubkey) in sync_committee_bits
                .iter()
                .zip(sync_committee_pubkeys.iter())
            {
                if *bit == u8::from(participant) {
                    pubkeys.push(pubkey.clone());
                }
            }
            pubkeys
        }

        /// Calculates signing root for BeaconHeader. The signing root is used for the message
        /// value in BLS signature verification.
        pub fn signing_root(
            header: &BeaconHeader,
            validators_root: H256,
            signature_slot: u64,
        ) -> Result<H256, DispatchError> {
            let fork_version = Self::compute_fork_version(compute_epoch(
                signature_slot,
                config::SLOTS_PER_EPOCH as u64,
            ));
            let domain_type = config::DOMAIN_SYNC_COMMITTEE.to_vec();
            // Domains are used for seeds, for signatures, and for selecting aggregators.
            let domain = Self::compute_domain(domain_type, fork_version, validators_root)?;
            // Hash tree root of SigningData - object root + domain
            let signing_root = Self::compute_signing_root(header, domain)?;
            Ok(signing_root)
        }

        /// Updates are free if the update is successful and the interval between the latest
        /// finalized header in storage and the newly imported header is large enough. All
        /// successful sync committee updates are free.
        pub(super) fn check_refundable(update: &Update, latest_slot: u64) -> Pays {
            // If the sync committee was successfully updated, the update may be free.
            let update_period = compute_period(update.finalized_header.slot);
            let latest_free_update_period = LatestSyncCommitteeUpdatePeriod::<T>::get();
            // If the next sync committee is not known and this update sets it, the update is free.
            // If the sync committee update is in a period that we have not received an update for,
            // the update is free.
            let refundable =
                !<NextSyncCommittee<T>>::exists() || update_period > latest_free_update_period;
            if update.next_sync_committee_update.is_some() && refundable {
                return Pays::No;
            }

            // If the latest finalized header is larger than the minimum slot interval, the header
            // import transaction is free.
            if update.finalized_header.slot
                >= latest_slot.saturating_add(T::FreeHeadersInterval::get() as u64)
            {
                return Pays::No;
            }

            Pays::Yes
        }

        pub fn finalized_root_gindex_at_slot(slot: u64, fork_versions: ForkVersions) -> usize {
            let epoch = compute_epoch(slot, config::SLOTS_PER_EPOCH as u64);

            if epoch >= fork_versions.electra.epoch {
                return config::electra::FINALIZED_ROOT_INDEX;
            }

            config::altair::FINALIZED_ROOT_INDEX
        }

        pub fn current_sync_committee_gindex_at_slot(
            slot: u64,
            fork_versions: ForkVersions,
        ) -> usize {
            let epoch = compute_epoch(slot, config::SLOTS_PER_EPOCH as u64);

            if epoch >= fork_versions.electra.epoch {
                return config::electra::CURRENT_SYNC_COMMITTEE_INDEX;
            }

            config::altair::CURRENT_SYNC_COMMITTEE_INDEX
        }

        pub fn next_sync_committee_gindex_at_slot(slot: u64, fork_versions: ForkVersions) -> usize {
            let epoch = compute_epoch(slot, config::SLOTS_PER_EPOCH as u64);

            if epoch >= fork_versions.electra.epoch {
                return config::electra::NEXT_SYNC_COMMITTEE_INDEX;
            }

            config::altair::NEXT_SYNC_COMMITTEE_INDEX
        }

        pub fn block_roots_gindex_at_slot(slot: u64, fork_versions: ForkVersions) -> usize {
            let epoch = compute_epoch(slot, config::SLOTS_PER_EPOCH as u64);

            if epoch >= fork_versions.electra.epoch {
                return config::electra::BLOCK_ROOTS_INDEX;
            }

            config::altair::BLOCK_ROOTS_INDEX
        }

        pub fn execution_header_gindex() -> usize {
            config::altair::EXECUTION_HEADER_INDEX
        }
    }
}
