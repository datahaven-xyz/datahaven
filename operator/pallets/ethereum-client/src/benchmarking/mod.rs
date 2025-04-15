// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use super::*;
mod util;

use crate::Pallet as EthereumBeaconClient;
use frame_benchmarking::v2::*;
use frame_system::RawOrigin;
use hex_literal::hex;
use snowbridge_beacon_primitives::{
	fast_aggregate_verify,
	merkle_proof::{generalized_index_length, subtree_index},
	prepare_aggregate_pubkey, prepare_aggregate_signature, verify_merkle_branch, Fork,
};
use snowbridge_pallet_ethereum_client_fixtures::*;
use util::*;

#[benchmarks]
mod benchmarks {
	use super::*;

	#[benchmark]
	fn force_checkpoint() -> Result<(), BenchmarkError> {
		let checkpoint_update = make_checkpoint();
		let block_root: H256 = checkpoint_update.header.hash_tree_root().unwrap();

		#[extrinsic_call]
		_(RawOrigin::Root, Box::new(*checkpoint_update));

		assert!(<LatestFinalizedBlockRoot<T>>::get() == block_root);
		assert!(<FinalizedBeaconState<T>>::get(block_root).is_some());

		Ok(())
	}

	#[benchmark]
	fn submit() -> Result<(), BenchmarkError> {
		let caller: T::AccountId = whitelisted_caller();
		let checkpoint_update = make_checkpoint();
		let finalized_header_update = make_finalized_header_update();
		let block_root: H256 = finalized_header_update.finalized_header.hash_tree_root().unwrap();
		EthereumBeaconClient::<T>::process_checkpoint_update(&checkpoint_update)?;

		#[extrinsic_call]
		submit(RawOrigin::Signed(caller.clone()), Box::new(*finalized_header_update));

		assert!(<LatestFinalizedBlockRoot<T>>::get() == block_root);
		assert!(<FinalizedBeaconState<T>>::get(block_root).is_some());

		Ok(())
	}

	#[benchmark]
	fn submit_with_sync_committee() -> Result<(), BenchmarkError> {
		let caller: T::AccountId = whitelisted_caller();
		let checkpoint_update = make_checkpoint();
		let sync_committee_update = make_sync_committee_update();
		EthereumBeaconClient::<T>::process_checkpoint_update(&checkpoint_update)?;

		#[extrinsic_call]
		submit(RawOrigin::Signed(caller.clone()), Box::new(*sync_committee_update));

		assert!(<NextSyncCommittee<T>>::exists());

		Ok(())
	}

	#[benchmark(extra)]
	fn bls_fast_aggregate_verify_pre_aggregated() -> Result<(), BenchmarkError> {
		EthereumBeaconClient::<T>::process_checkpoint_update(&make_checkpoint())?;
		let update = make_sync_committee_update();
		let participant_pubkeys = participant_pubkeys::<T>(&update)?;
		let signing_root = signing_root::<T>(&update)?;
		let agg_sig =
			prepare_aggregate_signature(&update.sync_aggregate.sync_committee_signature).unwrap();
		let agg_pub_key = prepare_aggregate_pubkey(&participant_pubkeys).unwrap();

		#[block]
		{
			agg_sig.fast_aggregate_verify_pre_aggregated(signing_root.as_bytes(), &agg_pub_key);
		}

		Ok(())
	}

	#[benchmark(extra)]
	fn bls_fast_aggregate_verify() -> Result<(), BenchmarkError> {
		EthereumBeaconClient::<T>::process_checkpoint_update(&make_checkpoint())?;
		let update = make_sync_committee_update();
		let current_sync_committee = <CurrentSyncCommittee<T>>::get();
		let absent_pubkeys = absent_pubkeys::<T>(&update)?;
		let signing_root = signing_root::<T>(&update)?;

		#[block]
		{
			fast_aggregate_verify(
				&current_sync_committee.aggregate_pubkey,
				&absent_pubkeys,
				signing_root,
				&update.sync_aggregate.sync_committee_signature,
			)
			.unwrap();
		}

		Ok(())
	}

	#[benchmark(extra)]
	fn verify_merkle_proof() -> Result<(), BenchmarkError> {
		EthereumBeaconClient::<T>::process_checkpoint_update(&make_checkpoint())?;
		let update = make_sync_committee_update();
		let block_root: H256 = update.finalized_header.hash_tree_root().unwrap();

		let fork_versions = ForkVersions {
			genesis: Fork { version: hex!("00000000"), epoch: 0 },
			altair: Fork { version: hex!("01000000"), epoch: 0 },
			bellatrix: Fork { version: hex!("02000000"), epoch: 0 },
			capella: Fork { version: hex!("03000000"), epoch: 0 },
			deneb: Fork { version: hex!("04000000"), epoch: 0 },
			electra: Fork { version: hex!("05000000"), epoch: 80000000000 },
		};
		let finalized_root_gindex = EthereumBeaconClient::<T>::finalized_root_gindex_at_slot(
			update.attested_header.slot,
			fork_versions,
		);
		#[block]
		{
			verify_merkle_branch(
				block_root,
				&update.finality_branch,
				subtree_index(finalized_root_gindex),
				generalized_index_length(finalized_root_gindex),
				update.attested_header.state_root,
			);
		}

		Ok(())
	}

	impl_benchmark_test_suite!(EthereumBeaconClient, crate::mock::new_tester(), crate::mock::Test);
}
