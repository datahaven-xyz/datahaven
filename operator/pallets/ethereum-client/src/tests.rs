// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
pub use crate::mock::*;
use crate::{
    config::{EPOCHS_PER_SYNC_COMMITTEE_PERIOD, SLOTS_PER_EPOCH, SLOTS_PER_HISTORICAL_ROOT},
    functions::compute_period,
    mock::{
        get_message_verification_payload, load_checkpoint_update_fixture,
        load_finalized_header_update_fixture, load_next_finalized_header_update_fixture,
        load_next_sync_committee_update_fixture, load_sync_committee_update_fixture,
    },
    sync_committee_sum, verify_merkle_branch, BeaconHeader, CompactBeaconState, Error,
    FinalizedBeaconState, LatestFinalizedBlockRoot, LatestSyncCommitteeUpdatePeriod,
    NextSyncCommittee, SyncCommitteePrepared,
};
use frame_support::{assert_err, assert_noop, assert_ok, pallet_prelude::Pays};
use hex_literal::hex;
use snowbridge_beacon_primitives::{
    merkle_proof::{generalized_index_length, subtree_index},
    types::deneb,
    Fork, ForkVersions, NextSyncCommitteeUpdate, VersionedExecutionPayloadHeader,
};
use snowbridge_inbound_queue_primitives::{VerificationError, Verifier};
use sp_core::H256;
use sp_runtime::DispatchError;

/// Arbitrary hash used for tests and invalid hashes.
const TEST_HASH: [u8; 32] =
    hex!["5f6f02af29218292d21a69b64a794a7c0873b3e0f54611972863706e8cbdf371"];

/* UNIT TESTS */

#[test]
pub fn sum_sync_committee_participation() {
    new_tester().execute_with(|| {
        assert_eq!(sync_committee_sum(&[0, 1, 0, 1, 1, 0, 1, 0, 1]), 5);
    });
}

#[test]
pub fn compute_domain() {
    new_tester().execute_with(|| {
        let domain = EthereumBeaconClient::compute_domain(
            hex!("07000000").into(),
            hex!("00000001"),
            hex!("5dec7ae03261fde20d5b024dfabce8bac3276c9a4908e23d50ba8c9b50b0adff").into(),
        );

        assert_ok!(&domain);
        assert_eq!(
            domain.unwrap(),
            hex!("0700000046324489ceb6ada6d118eacdbe94f49b1fcb49d5481a685979670c7c").into()
        );
    });
}

#[test]
pub fn compute_signing_root_bls() {
    new_tester().execute_with(|| {
        let signing_root = EthereumBeaconClient::compute_signing_root(
            &BeaconHeader {
                slot: 3529537,
                proposer_index: 192549,
                parent_root: hex!(
                    "1f8dc05ea427f78e84e2e2666e13c3befb7106fd1d40ef8a3f67cf615f3f2a4c"
                )
                .into(),
                state_root: hex!(
                    "0dfb492a83da711996d2d76b64604f9bca9dc08b6c13cf63b3be91742afe724b"
                )
                .into(),
                body_root: hex!("66fba38f7c8c2526f7ddfe09c1a54dd12ff93bdd4d0df6a0950e88e802228bfa")
                    .into(),
            },
            hex!("07000000afcaaba0efab1ca832a15152469bb09bb84641c405171dfa2d3fb45f").into(),
        );

        assert_ok!(&signing_root);
        assert_eq!(
            signing_root.unwrap(),
            hex!("3ff6e9807da70b2f65cdd58ea1b25ed441a1d589025d2c4091182026d7af08fb").into()
        );
    });
}

#[test]
pub fn compute_signing_root() {
    new_tester().execute_with(|| {
        let signing_root = EthereumBeaconClient::compute_signing_root(
            &BeaconHeader {
                slot: 222472,
                proposer_index: 10726,
                parent_root: hex!(
                    "5d481a9721f0ecce9610eab51d400d223683d599b7fcebca7e4c4d10cdef6ebb"
                )
                .into(),
                state_root: hex!(
                    "14eb4575895f996a84528b789ff2e4d5148242e2983f03068353b2c37015507a"
                )
                .into(),
                body_root: hex!("7bb669c75b12e0781d6fa85d7fc2f32d64eafba89f39678815b084c156e46cac")
                    .into(),
            },
            hex!("07000000e7acb21061790987fa1c1e745cccfb358370b33e8af2b2c18938e6c2").into(),
        );

        assert_ok!(&signing_root);
        assert_eq!(
            signing_root.unwrap(),
            hex!("da12b6a6d3516bc891e8a49f82fc1925cec40b9327e06457f695035303f55cd8").into()
        );
    });
}

#[test]
pub fn compute_domain_bls() {
    new_tester().execute_with(|| {
        let domain = EthereumBeaconClient::compute_domain(
            hex!("07000000").into(),
            hex!("01000000"),
            hex!("4b363db94e286120d76eb905340fdd4e54bfe9f06bf33ff6cf5ad27f511bfe95").into(),
        );

        assert_ok!(&domain);
        assert_eq!(
            domain.unwrap(),
            hex!("07000000afcaaba0efab1ca832a15152469bb09bb84641c405171dfa2d3fb45f").into()
        );
    });
}

#[test]
pub fn may_refund_call_fee() {
    let finalized_update = Box::new(load_next_finalized_header_update_fixture());
    let sync_committee_update = Box::new(load_sync_committee_update_fixture());
    new_tester().execute_with(|| {
        let free_headers_interval: u64 = crate::mock::FREE_SLOTS_INTERVAL as u64;
        // Not free, smaller than the allowed free header interval
        assert_eq!(
            EthereumBeaconClient::check_refundable(
                &finalized_update.clone(),
                finalized_update.finalized_header.slot + free_headers_interval
            ),
            Pays::Yes
        );
        // Is free, larger than the minimum interval
        assert_eq!(
            EthereumBeaconClient::check_refundable(
                &finalized_update,
                finalized_update.finalized_header.slot - (free_headers_interval + 2)
            ),
            Pays::No
        );
        // Is free, valid sync committee update
        assert_eq!(
            EthereumBeaconClient::check_refundable(
                &sync_committee_update,
                finalized_update.finalized_header.slot
            ),
            Pays::No
        );
    });
}

#[test]
pub fn verify_merkle_branch_for_finalized_root() {
    new_tester().execute_with(|| {
        assert!(verify_merkle_branch(
            hex!("0000000000000000000000000000000000000000000000000000000000000000").into(),
            &[
                hex!("0000000000000000000000000000000000000000000000000000000000000000").into(),
                hex!("5f6f02af29218292d21a69b64a794a7c0873b3e0f54611972863706e8cbdf371").into(),
                hex!("e7125ff9ab5a840c44bedb4731f440a405b44e15f2d1a89e27341b432fabe13d").into(),
                hex!("002c1fe5bc0bd62db6f299a582f2a80a6d5748ccc82e7ed843eaf0ae0739f74a").into(),
                hex!("d2dc4ba9fd4edff6716984136831e70a6b2e74fca27b8097a820cbbaa5a6e3c3").into(),
                hex!("91f77a19d8afa4a08e81164bb2e570ecd10477b3b65c305566a6d2be88510584").into(),
            ],
            subtree_index(crate::config::altair::FINALIZED_ROOT_INDEX),
            generalized_index_length(crate::config::altair::FINALIZED_ROOT_INDEX),
            hex!("e46559327592741956f6beaa0f52e49625eb85dce037a0bd2eff333c743b287f").into()
        ));
    });
}

#[test]
pub fn verify_merkle_branch_fails_if_depth_and_branch_dont_match() {
    new_tester().execute_with(|| {
        assert!(!verify_merkle_branch(
            hex!("0000000000000000000000000000000000000000000000000000000000000000").into(),
            &[
                hex!("0000000000000000000000000000000000000000000000000000000000000000").into(),
                hex!("5f6f02af29218292d21a69b64a794a7c0873b3e0f54611972863706e8cbdf371").into(),
                hex!("e7125ff9ab5a840c44bedb4731f440a405b44e15f2d1a89e27341b432fabe13d").into(),
            ],
            subtree_index(crate::config::altair::FINALIZED_ROOT_INDEX),
            generalized_index_length(crate::config::altair::FINALIZED_ROOT_INDEX),
            hex!("e46559327592741956f6beaa0f52e49625eb85dce037a0bd2eff333c743b287f").into()
        ));
    });
}

#[test]
pub fn sync_committee_participation_is_supermajority() {
    let bits =
		hex!("bffffffff7f1ffdfcfeffeffbfdffffbfffffdffffefefffdffff7f7ffff77fffdf7bff77ffdf7fffafffffff77fefffeff7effffffff5f7fedfffdfb6ddff7b"
	);
    let participation =
        snowbridge_beacon_primitives::decompress_sync_committee_bits::<512, 64>(bits);
    assert_ok!(EthereumBeaconClient::sync_committee_participation_is_supermajority(&participation));
}

#[test]
pub fn sync_committee_participation_is_supermajority_errors_when_not_supermajority() {
    new_tester().execute_with(|| {
		let participation = hex!("0000000000000000000000000000000000000001010100010100000000000000000000000101010101000100010101010101010101010101010101010100010101000000000001010101010100010101000000000000000000000000000101000101010101010001010101010100010101010101010101010101000101010101010100010101010100000000010101010100000000000000000001010101010101010101010101010101010100010101010101010001010101010101010101010101010101000101010101010101010101010100010101010101010101010101010101010101010101010101010101010101010001010100010101010101010101000101010101010101010001010101010101010101000101010100010101010101010101010100010000000000000000000100000000000001010100000001000100010101010100000000000000000000000000000000000000010101010101010100010101010101010101010100010101010001010101010101010101010101010100000000000000000101010101000000000001000000000000000000010000000000000000000101010101010100010001010101010101000101010101010101010101010101010101000101010101010101010101010101010001010101010101010001010001000000000000000000000000000001000000000000");

		assert_err!(
			EthereumBeaconClient::sync_committee_participation_is_supermajority(&participation),
			Error::<Test>::SyncCommitteeParticipantsNotSupermajority
		);
	});
}

#[test]
fn compute_fork_version() {
    let mock_fork_versions = ForkVersions {
        genesis: Fork {
            version: [0, 0, 0, 0],
            epoch: 0,
        },
        altair: Fork {
            version: [0, 0, 0, 1],
            epoch: 10,
        },
        bellatrix: Fork {
            version: [0, 0, 0, 2],
            epoch: 20,
        },
        capella: Fork {
            version: [0, 0, 0, 3],
            epoch: 30,
        },
        deneb: Fork {
            version: [0, 0, 0, 4],
            epoch: 40,
        },
        electra: Fork {
            version: [0, 0, 0, 5],
            epoch: 50,
        },
    };
    new_tester().execute_with(|| {
        assert_eq!(
            EthereumBeaconClient::select_fork_version(&mock_fork_versions, 0),
            [0, 0, 0, 0]
        );
        assert_eq!(
            EthereumBeaconClient::select_fork_version(&mock_fork_versions, 1),
            [0, 0, 0, 0]
        );
        assert_eq!(
            EthereumBeaconClient::select_fork_version(&mock_fork_versions, 10),
            [0, 0, 0, 1]
        );
        assert_eq!(
            EthereumBeaconClient::select_fork_version(&mock_fork_versions, 21),
            [0, 0, 0, 2]
        );
        assert_eq!(
            EthereumBeaconClient::select_fork_version(&mock_fork_versions, 20),
            [0, 0, 0, 2]
        );
        assert_eq!(
            EthereumBeaconClient::select_fork_version(&mock_fork_versions, 32),
            [0, 0, 0, 3]
        );
        assert_eq!(
            EthereumBeaconClient::select_fork_version(&mock_fork_versions, 40),
            [0, 0, 0, 4]
        );
        assert_eq!(
            EthereumBeaconClient::select_fork_version(&mock_fork_versions, 50),
            [0, 0, 0, 5]
        );
    });
}

#[test]
fn find_absent_keys() {
    let participation: [u8; 32] =
        hex!("0001010101010100010101010101010101010101010101010101010101010101").into();
    let update = load_sync_committee_update_fixture();
    let sync_committee_prepared: SyncCommitteePrepared = (&update
        .next_sync_committee_update
        .unwrap()
        .next_sync_committee)
        .try_into()
        .unwrap();

    new_tester().execute_with(|| {
        let pubkeys = EthereumBeaconClient::find_pubkeys(
            &participation,
            (*sync_committee_prepared.pubkeys).as_ref(),
            false,
        );
        assert_eq!(pubkeys.len(), 2);
        assert_eq!(pubkeys[0], sync_committee_prepared.pubkeys[0]);
        assert_eq!(pubkeys[1], sync_committee_prepared.pubkeys[7]);
    });
}

#[test]
fn find_present_keys() {
    let participation: [u8; 32] =
        hex!("0001000000000000010000000000000000000000000000000000010000000100").into();
    let update = load_sync_committee_update_fixture();
    let sync_committee_prepared: SyncCommitteePrepared = (&update
        .next_sync_committee_update
        .unwrap()
        .next_sync_committee)
        .try_into()
        .unwrap();

    new_tester().execute_with(|| {
        let pubkeys = EthereumBeaconClient::find_pubkeys(
            &participation,
            (*sync_committee_prepared.pubkeys).as_ref(),
            true,
        );
        assert_eq!(pubkeys.len(), 4);
        assert_eq!(pubkeys[0], sync_committee_prepared.pubkeys[1]);
        assert_eq!(pubkeys[1], sync_committee_prepared.pubkeys[8]);
        assert_eq!(pubkeys[2], sync_committee_prepared.pubkeys[26]);
        assert_eq!(pubkeys[3], sync_committee_prepared.pubkeys[30]);
    });
}

/* SYNC PROCESS TESTS */

#[test]
fn process_initial_checkpoint() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::force_checkpoint(
            RuntimeOrigin::root(),
            checkpoint.clone()
        ));
        let block_root: H256 = checkpoint.header.hash_tree_root().unwrap();
        assert!(<FinalizedBeaconState<Test>>::contains_key(block_root));
    });
}

#[test]
fn process_initial_checkpoint_with_invalid_sync_committee_proof() {
    let mut checkpoint = Box::new(load_checkpoint_update_fixture());
    checkpoint.current_sync_committee_branch[0] = TEST_HASH.into();

    new_tester().execute_with(|| {
        assert_err!(
            EthereumBeaconClient::force_checkpoint(RuntimeOrigin::root(), checkpoint),
            Error::<Test>::InvalidSyncCommitteeMerkleProof
        );
    });
}

#[test]
fn process_initial_checkpoint_with_invalid_blocks_root_proof() {
    let mut checkpoint = Box::new(load_checkpoint_update_fixture());
    checkpoint.block_roots_branch[0] = TEST_HASH.into();

    new_tester().execute_with(|| {
        assert_err!(
            EthereumBeaconClient::force_checkpoint(RuntimeOrigin::root(), checkpoint),
            Error::<Test>::InvalidBlockRootsRootMerkleProof
        );
    });
}

#[test]
fn submit_update_in_current_period() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let update = Box::new(load_finalized_header_update_fixture());
    let initial_period = compute_period(checkpoint.header.slot);
    let update_period = compute_period(update.finalized_header.slot);
    assert_eq!(initial_period, update_period);

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        let result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update.clone());
        assert_ok!(result);
        assert_eq!(result.unwrap().pays_fee, Pays::No);
        let block_root: H256 = update.finalized_header.hash_tree_root().unwrap();
        assert!(<FinalizedBeaconState<Test>>::contains_key(block_root));
    });
}

#[test]
fn submit_update_with_sync_committee_in_current_period() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let update = Box::new(load_sync_committee_update_fixture());
    let init_period = compute_period(checkpoint.header.slot);
    let update_period = compute_period(update.finalized_header.slot);
    assert_eq!(init_period, update_period);

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        assert!(!<NextSyncCommittee<Test>>::exists());
        let result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update);
        assert_ok!(result);
        assert_eq!(result.unwrap().pays_fee, Pays::No);
        assert!(<NextSyncCommittee<Test>>::exists());
    });
}

#[test]
fn reject_submit_update_in_next_period() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let sync_committee_update = Box::new(load_sync_committee_update_fixture());
    let update = Box::new(load_next_finalized_header_update_fixture());
    let sync_committee_period = compute_period(sync_committee_update.finalized_header.slot);
    let next_sync_committee_period = compute_period(update.finalized_header.slot);
    assert_eq!(sync_committee_period + 1, next_sync_committee_period);
    let next_sync_committee_update = Box::new(load_next_sync_committee_update_fixture());

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        let result =
            EthereumBeaconClient::submit(RuntimeOrigin::signed(1), sync_committee_update.clone());
        assert_ok!(result);
        assert_eq!(result.unwrap().pays_fee, Pays::No);

        // check an update in the next period is rejected
        let second_result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update.clone());
        assert_err!(second_result, Error::<Test>::SyncCommitteeUpdateRequired);
        assert_eq!(second_result.unwrap_err().post_info.pays_fee, Pays::Yes);

        // submit update with next sync committee
        let third_result =
            EthereumBeaconClient::submit(RuntimeOrigin::signed(1), next_sync_committee_update);
        assert_ok!(third_result);
        assert_eq!(third_result.unwrap().pays_fee, Pays::No);
        // check same header in the next period can now be submitted successfully
        assert_ok!(EthereumBeaconClient::submit(
            RuntimeOrigin::signed(1),
            update.clone()
        ));
        let block_root: H256 = update.finalized_header.clone().hash_tree_root().unwrap();
        assert!(<FinalizedBeaconState<Test>>::contains_key(block_root));
    });
}

#[test]
fn submit_update_with_invalid_header_proof() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let mut update = Box::new(load_sync_committee_update_fixture());
    let init_period = compute_period(checkpoint.header.slot);
    let update_period = compute_period(update.finalized_header.slot);
    assert_eq!(init_period, update_period);
    update.finality_branch[0] = TEST_HASH.into();

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        assert!(!<NextSyncCommittee<Test>>::exists());
        let result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update);
        assert_err!(result, Error::<Test>::InvalidHeaderMerkleProof);
        assert_eq!(result.unwrap_err().post_info.pays_fee, Pays::Yes);
    });
}

#[test]
fn submit_update_with_invalid_block_roots_proof() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let mut update = Box::new(load_sync_committee_update_fixture());
    let init_period = compute_period(checkpoint.header.slot);
    let update_period = compute_period(update.finalized_header.slot);
    assert_eq!(init_period, update_period);
    update.block_roots_branch[0] = TEST_HASH.into();

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        assert!(!<NextSyncCommittee<Test>>::exists());
        let result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update);
        assert_err!(result, Error::<Test>::InvalidBlockRootsRootMerkleProof);
        assert_eq!(result.unwrap_err().post_info.pays_fee, Pays::Yes);
    });
}

#[test]
fn submit_update_with_invalid_next_sync_committee_proof() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let mut update = Box::new(load_sync_committee_update_fixture());
    let init_period = compute_period(checkpoint.header.slot);
    let update_period = compute_period(update.finalized_header.slot);
    assert_eq!(init_period, update_period);
    if let Some(ref mut next_sync_committee_update) = update.next_sync_committee_update {
        next_sync_committee_update.next_sync_committee_branch[0] = TEST_HASH.into();
    }

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        assert!(!<NextSyncCommittee<Test>>::exists());
        let result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update);
        assert_err!(result, Error::<Test>::InvalidSyncCommitteeMerkleProof);
        assert_eq!(result.unwrap_err().post_info.pays_fee, Pays::Yes);
    });
}

#[test]
fn submit_update_with_skipped_period() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let sync_committee_update = Box::new(load_sync_committee_update_fixture());
    let mut update = Box::new(load_next_finalized_header_update_fixture());
    update.signature_slot += (EPOCHS_PER_SYNC_COMMITTEE_PERIOD * SLOTS_PER_EPOCH) as u64;
    update.attested_header.slot = update.signature_slot - 1;

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        let result =
            EthereumBeaconClient::submit(RuntimeOrigin::signed(1), sync_committee_update.clone());
        assert_ok!(result);
        assert_eq!(result.unwrap().pays_fee, Pays::No);

        let second_result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update);
        assert_err!(second_result, Error::<Test>::SkippedSyncCommitteePeriod);
        assert_eq!(second_result.unwrap_err().post_info.pays_fee, Pays::Yes);
    });
}

#[test]
fn submit_update_with_sync_committee_in_next_period() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let update = Box::new(load_sync_committee_update_fixture());
    let next_update = Box::new(load_next_sync_committee_update_fixture());
    let update_period = compute_period(update.finalized_header.slot);
    let next_update_period = compute_period(next_update.finalized_header.slot);
    assert_eq!(update_period + 1, next_update_period);

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        assert!(!<NextSyncCommittee<Test>>::exists());

        let result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update.clone());
        assert_ok!(result);
        assert_eq!(result.unwrap().pays_fee, Pays::No);
        assert!(<NextSyncCommittee<Test>>::exists());

        let second_result =
            EthereumBeaconClient::submit(RuntimeOrigin::signed(1), next_update.clone());
        assert_ok!(second_result);
        assert_eq!(second_result.unwrap().pays_fee, Pays::No);
        let last_finalized_state =
            FinalizedBeaconState::<Test>::get(LatestFinalizedBlockRoot::<Test>::get()).unwrap();
        let last_synced_period = compute_period(last_finalized_state.slot);
        assert_eq!(last_synced_period, next_update_period);
    });
}

#[test]
fn submit_update_with_sync_committee_invalid_signature_slot() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let mut update = Box::new(load_sync_committee_update_fixture());

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));

        // makes an invalid update with signature_slot should be more than attested_slot
        update.signature_slot = update.attested_header.slot;

        let result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update);
        assert_err!(result, Error::<Test>::InvalidUpdateSlot);
        assert_eq!(result.unwrap_err().post_info.pays_fee, Pays::Yes);
    });
}

#[test]
fn submit_update_with_skipped_sync_committee_period() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let finalized_update = Box::new(load_next_finalized_header_update_fixture());
    let checkpoint_period = compute_period(checkpoint.header.slot);
    let next_sync_committee_period = compute_period(finalized_update.finalized_header.slot);
    assert_eq!(checkpoint_period + 1, next_sync_committee_period);

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        let result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), finalized_update);
        assert_err!(result, Error::<Test>::SkippedSyncCommitteePeriod);
        assert_eq!(result.unwrap_err().post_info.pays_fee, Pays::Yes);
    });
}

#[test]
fn submit_irrelevant_update() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let mut update = Box::new(load_next_finalized_header_update_fixture());

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));

        // makes an invalid update where the attested_header slot value should be greater than the
        // checkpoint slot value
        update.finalized_header.slot = checkpoint.header.slot;
        update.attested_header.slot = checkpoint.header.slot;
        update.signature_slot = checkpoint.header.slot + 1;

        let result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update);
        assert_err!(result, Error::<Test>::IrrelevantUpdate);
        assert_eq!(result.unwrap_err().post_info.pays_fee, Pays::Yes);
    });
}

#[test]
fn submit_update_with_missing_bootstrap() {
    let update = Box::new(load_next_finalized_header_update_fixture());

    new_tester().execute_with(|| {
        let result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update);
        assert_err!(result, Error::<Test>::NotBootstrapped);
        assert_eq!(result.unwrap_err().post_info.pays_fee, Pays::Yes);
    });
}

#[test]
fn submit_update_with_invalid_sync_committee_update() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let update = Box::new(load_sync_committee_update_fixture());
    let mut next_update = Box::new(load_next_sync_committee_update_fixture());

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));

        let result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update);
        assert_ok!(result);
        assert_eq!(result.unwrap().pays_fee, Pays::No);

        // makes update with invalid next_sync_committee
        <FinalizedBeaconState<Test>>::mutate(<LatestFinalizedBlockRoot<Test>>::get(), |x| {
            let prev = x.unwrap();
            *x = Some(CompactBeaconState {
                slot: next_update.attested_header.slot,
                ..prev
            });
        });
        next_update.attested_header.slot += 1;
        next_update.signature_slot = next_update.attested_header.slot + 1;
        let next_sync_committee = NextSyncCommitteeUpdate::default();
        next_update.next_sync_committee_update = Some(next_sync_committee);

        let second_result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), next_update);
        assert_err!(second_result, Error::<Test>::InvalidSyncCommitteeUpdate);
        assert_eq!(second_result.unwrap_err().post_info.pays_fee, Pays::Yes);
    });
}

/// Check that a gap of more than 8192 slots between finalized headers is not allowed.
#[test]
fn submit_finalized_header_update_with_too_large_gap() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let update = Box::new(load_sync_committee_update_fixture());
    let mut next_update = Box::new(load_next_sync_committee_update_fixture());

    // Adds 8193 slots, so that the next update is still in the next sync committee, but the
    // gap between the finalized headers is more than 8192 slots.
    let slot_with_large_gap = checkpoint.header.slot + SLOTS_PER_HISTORICAL_ROOT as u64 + 1;

    next_update.finalized_header.slot = slot_with_large_gap;
    // Adding some slots to the attested header and signature slot since they need to be ahead
    // of the finalized header.
    next_update.attested_header.slot = slot_with_large_gap + 33;
    next_update.signature_slot = slot_with_large_gap + 43;

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        let result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update.clone());
        assert_ok!(result);
        assert_eq!(result.unwrap().pays_fee, Pays::No);
        assert!(<NextSyncCommittee<Test>>::exists());

        let second_result =
            EthereumBeaconClient::submit(RuntimeOrigin::signed(1), next_update.clone());
        assert_err!(second_result, Error::<Test>::InvalidFinalizedHeaderGap);
        assert_eq!(second_result.unwrap_err().post_info.pays_fee, Pays::Yes);
    });
}

/// Check that a gap of 8192 slots between finalized headers is allowed.
#[test]
fn submit_finalized_header_update_with_gap_at_limit() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let update = Box::new(load_sync_committee_update_fixture());
    let mut next_update = Box::new(load_next_sync_committee_update_fixture());

    next_update.finalized_header.slot = checkpoint.header.slot + SLOTS_PER_HISTORICAL_ROOT as u64;
    // Adding some slots to the attested header and signature slot since they need to be ahead
    // of the finalized header.
    next_update.attested_header.slot =
        checkpoint.header.slot + SLOTS_PER_HISTORICAL_ROOT as u64 + 33;
    next_update.signature_slot = checkpoint.header.slot + SLOTS_PER_HISTORICAL_ROOT as u64 + 43;

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));

        let result = EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update.clone());
        assert_ok!(result);
        assert_eq!(result.unwrap().pays_fee, Pays::No);
        assert!(<NextSyncCommittee<Test>>::exists());

        let second_result =
            EthereumBeaconClient::submit(RuntimeOrigin::signed(1), next_update.clone());
        assert_err!(
            second_result,
            // The test should pass the InvalidFinalizedHeaderGap check, and will fail at the
            // next check, the merkle proof, because we changed the next_update slots.
            Error::<Test>::InvalidHeaderMerkleProof
        );
        assert_eq!(second_result.unwrap_err().post_info.pays_fee, Pays::Yes);
    });
}

#[test]
fn duplicate_sync_committee_updates_are_not_free() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let sync_committee_update = Box::new(load_sync_committee_update_fixture());

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        let result =
            EthereumBeaconClient::submit(RuntimeOrigin::signed(1), sync_committee_update.clone());
        assert_ok!(result);
        assert_eq!(result.unwrap().pays_fee, Pays::No);

        // Check that if the same update is submitted, the update is not free.
        let second_result =
            EthereumBeaconClient::submit(RuntimeOrigin::signed(1), sync_committee_update);
        assert_ok!(second_result);
        assert_eq!(second_result.unwrap().pays_fee, Pays::Yes);
    });
}

#[test]
fn sync_committee_update_for_sync_committee_already_imported_are_not_free() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let sync_committee_update = Box::new(load_sync_committee_update_fixture()); // slot 129
    let second_sync_committee_update = load_sync_committee_update_period_0(); // slot 128
    let third_sync_committee_update = load_sync_committee_update_period_0_newer_fixture(); // slot 224
    let fourth_sync_committee_update = load_sync_committee_update_period_0_older_fixture(); // slot 96
    let fith_sync_committee_update = Box::new(load_next_sync_committee_update_fixture()); // slot 8259

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        assert_eq!(<LatestSyncCommitteeUpdatePeriod<Test>>::get(), 0);

        // Check that setting the next sync committee for period 0 is free (it is not set yet).
        let result =
            EthereumBeaconClient::submit(RuntimeOrigin::signed(1), sync_committee_update.clone());
        assert_ok!(result);
        assert_eq!(result.unwrap().pays_fee, Pays::No);
        assert_eq!(<LatestSyncCommitteeUpdatePeriod<Test>>::get(), 0);

        // Check that setting the next sync committee for period 0 again is not free.
        let second_result =
            EthereumBeaconClient::submit(RuntimeOrigin::signed(1), second_sync_committee_update);
        assert_eq!(second_result.unwrap().pays_fee, Pays::Yes);
        assert_eq!(<LatestSyncCommitteeUpdatePeriod<Test>>::get(), 0);

        // Check that setting an update with a sync committee that has already been set, but with a
        // newer finalized header, is free.
        let third_result =
            EthereumBeaconClient::submit(RuntimeOrigin::signed(1), third_sync_committee_update);
        assert_eq!(third_result.unwrap().pays_fee, Pays::No);
        assert_eq!(<LatestSyncCommitteeUpdatePeriod<Test>>::get(), 0);

        // Check that setting the next sync committee for period 0 again with an earlier slot is not
        // free.
        let fourth_result =
            EthereumBeaconClient::submit(RuntimeOrigin::signed(1), fourth_sync_committee_update);
        assert_err!(fourth_result, Error::<Test>::IrrelevantUpdate);
        assert_eq!(fourth_result.unwrap_err().post_info.pays_fee, Pays::Yes);

        // Check that setting the next sync committee for period 1 is free.
        let fith_result =
            EthereumBeaconClient::submit(RuntimeOrigin::signed(1), fith_sync_committee_update);
        assert_eq!(fith_result.unwrap().pays_fee, Pays::No);
        assert_eq!(<LatestSyncCommitteeUpdatePeriod<Test>>::get(), 1);
    });
}

/* IMPLS */

#[test]
fn verify_message() {
    let (event_log, proof) = get_message_verification_payload();

    new_tester().execute_with(|| {
        assert_ok!(initialize_storage());
        assert_ok!(EthereumBeaconClient::verify(&event_log, &proof));
    });
}

#[test]
fn verify_message_invalid_proof() {
    let (event_log, mut proof) = get_message_verification_payload();
    proof.receipt_proof.1[0] = TEST_HASH.into();

    new_tester().execute_with(|| {
        assert_ok!(initialize_storage());
        assert_err!(
            EthereumBeaconClient::verify(&event_log, &proof),
            VerificationError::InvalidProof
        );
    });
}

#[test]
fn verify_message_invalid_receipts_root() {
    let (event_log, mut proof) = get_message_verification_payload();
    let mut payload = deneb::ExecutionPayloadHeader::default();
    payload.receipts_root = TEST_HASH.into();
    proof.execution_proof.execution_header = VersionedExecutionPayloadHeader::Deneb(payload);

    new_tester().execute_with(|| {
        assert_ok!(initialize_storage());
        assert_err!(
            EthereumBeaconClient::verify(&event_log, &proof),
            VerificationError::InvalidExecutionProof(
                Error::<Test>::BlockBodyHashTreeRootFailed.into()
            )
        );
    });
}

#[test]
fn verify_message_invalid_log() {
    let (mut event_log, proof) = get_message_verification_payload();
    event_log.topics = vec![H256::zero(); 10];
    new_tester().execute_with(|| {
        assert_ok!(initialize_storage());
        assert_err!(
            EthereumBeaconClient::verify(&event_log, &proof),
            VerificationError::InvalidLog
        );
    });
}

#[test]
fn verify_message_receipt_does_not_contain_log() {
    let (mut event_log, proof) = get_message_verification_payload();
    event_log.data = hex!("f9013c94ee9170abfbf9421ad6dd07f6bdec9d89f2b581e0f863a01b11dcf133cc240f682dab2d3a8e4cd35c5da8c9cf99adac4336f8512584c5ada000000000000000000000000000000000000000000000000000000000000003e8a00000000000000000000000000000000000000000000000000000000000000002b8c000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000068000f000000000000000101d184c103f7acc340847eee82a0b909e3358bc28d440edffa1352b13227e8ee646f3ea37456dec70100000101001cbd2d43530a44705ad088af313e18f80b53ef16b36177cd4b77b846f2a5f07c0000e8890423c78a0000000000000000000000000000000000000000000000000000000000000000").to_vec();

    new_tester().execute_with(|| {
        assert_ok!(initialize_storage());
        assert_err!(
            EthereumBeaconClient::verify(&event_log, &proof),
            VerificationError::LogNotFound
        );
    });
}

#[test]
fn set_operating_mode() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let update = Box::new(load_finalized_header_update_fixture());

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));

        assert_ok!(EthereumBeaconClient::set_operating_mode(
            RuntimeOrigin::root(),
            snowbridge_core::BasicOperatingMode::Halted
        ));

        assert_noop!(
            EthereumBeaconClient::submit(RuntimeOrigin::signed(1), update),
            Error::<Test>::Halted
        );
    });
}

#[test]
fn set_operating_mode_root_only() {
    new_tester().execute_with(|| {
        assert_noop!(
            EthereumBeaconClient::set_operating_mode(
                RuntimeOrigin::signed(1),
                snowbridge_core::BasicOperatingMode::Halted
            ),
            DispatchError::BadOrigin
        );
    });
}

#[test]
fn verify_execution_proof_invalid_ancestry_proof() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let finalized_header_update = Box::new(load_finalized_header_update_fixture());
    let mut execution_header_update = Box::new(load_execution_proof_fixture());
    if let Some(ref mut ancestry_proof) = execution_header_update.ancestry_proof {
        ancestry_proof.header_branch[0] = TEST_HASH.into()
    }

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        assert_ok!(EthereumBeaconClient::submit(
            RuntimeOrigin::signed(1),
            finalized_header_update
        ));
        assert_err!(
            EthereumBeaconClient::verify_execution_proof(&execution_header_update),
            Error::<Test>::InvalidAncestryMerkleProof
        );
    });
}

#[test]
fn verify_execution_proof_invalid_execution_header_proof() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let finalized_header_update = Box::new(load_finalized_header_update_fixture());
    let mut execution_header_update = Box::new(load_execution_proof_fixture());
    execution_header_update.execution_branch[0] = TEST_HASH.into();

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        assert_ok!(EthereumBeaconClient::submit(
            RuntimeOrigin::signed(1),
            finalized_header_update
        ));
        assert_err!(
            EthereumBeaconClient::verify_execution_proof(&execution_header_update),
            Error::<Test>::InvalidExecutionHeaderProof
        );
    });
}

#[test]
fn verify_execution_proof_that_is_also_finalized_header_which_is_not_stored() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let finalized_header_update = Box::new(load_finalized_header_update_fixture());
    let mut execution_header_update = Box::new(load_execution_proof_fixture());
    execution_header_update.ancestry_proof = None;

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        assert_ok!(EthereumBeaconClient::submit(
            RuntimeOrigin::signed(1),
            finalized_header_update
        ));
        assert_err!(
            EthereumBeaconClient::verify_execution_proof(&execution_header_update),
            Error::<Test>::ExpectedFinalizedHeaderNotStored
        );
    });
}

#[test]
fn submit_execution_proof_that_is_also_finalized_header_which_is_stored_but_slots_dont_match() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let finalized_header_update = Box::new(load_finalized_header_update_fixture());
    let mut execution_header_update = Box::new(load_execution_proof_fixture());
    execution_header_update.ancestry_proof = None;

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        assert_ok!(EthereumBeaconClient::submit(
            RuntimeOrigin::signed(1),
            finalized_header_update
        ));

        let block_root: H256 = execution_header_update.header.hash_tree_root().unwrap();

        <FinalizedBeaconState<Test>>::insert(
            block_root,
            CompactBeaconState {
                slot: execution_header_update.header.slot + 1,
                block_roots_root: Default::default(),
            },
        );
        LatestFinalizedBlockRoot::<Test>::set(block_root);

        assert_err!(
            EthereumBeaconClient::verify_execution_proof(&execution_header_update),
            Error::<Test>::ExpectedFinalizedHeaderNotStored
        );
    });
}

#[test]
fn verify_execution_proof_not_finalized() {
    let checkpoint = Box::new(load_checkpoint_update_fixture());
    let finalized_header_update = Box::new(load_finalized_header_update_fixture());
    let update = Box::new(load_execution_proof_fixture());

    new_tester().execute_with(|| {
        assert_ok!(EthereumBeaconClient::process_checkpoint_update(&checkpoint));
        assert_ok!(EthereumBeaconClient::submit(
            RuntimeOrigin::signed(1),
            finalized_header_update
        ));

        <FinalizedBeaconState<Test>>::mutate(<LatestFinalizedBlockRoot<Test>>::get(), |x| {
            let prev = x.unwrap();
            *x = Some(CompactBeaconState {
                slot: update.header.slot - 1,
                ..prev
            });
        });

        assert_err!(
            EthereumBeaconClient::verify_execution_proof(&update),
            Error::<Test>::HeaderNotFinalized
        );
    });
}
