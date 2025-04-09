// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use crate::{
	config::{EXTRA_DATA_SIZE, FEE_RECIPIENT_SIZE, LOGS_BLOOM_SIZE, PUBKEY_SIZE, SIGNATURE_SIZE},
	types::{
		BeaconHeader, ExecutionPayloadHeader, ForkData, SigningData, SyncAggregate, SyncCommittee,
	},
};
use byte_slice_cast::AsByteSlice;
use sp_core::H256;
use sp_std::{vec, vec::Vec};
use ssz_rs::{
	prelude::{List, Vector},
	Bitvector, Deserialize, DeserializeError, SimpleSerialize, SimpleSerializeError, Sized, U256,
};
use ssz_rs_derive::SimpleSerialize as SimpleSerializeDerive;

#[derive(Default, SimpleSerializeDerive, Clone, Debug)]
pub struct SSZBeaconBlockHeader {
	pub slot: u64,
	pub proposer_index: u64,
	pub parent_root: [u8; 32],
	pub state_root: [u8; 32],
	pub body_root: [u8; 32],
}

impl From<BeaconHeader> for SSZBeaconBlockHeader {
	fn from(beacon_header: BeaconHeader) -> Self {
		SSZBeaconBlockHeader {
			slot: beacon_header.slot,
			proposer_index: beacon_header.proposer_index,
			parent_root: beacon_header.parent_root.to_fixed_bytes(),
			state_root: beacon_header.state_root.to_fixed_bytes(),
			body_root: beacon_header.body_root.to_fixed_bytes(),
		}
	}
}

#[derive(Default, SimpleSerializeDerive, Clone)]
pub struct SSZSyncCommittee<const COMMITTEE_SIZE: usize> {
	pub pubkeys: Vector<Vector<u8, PUBKEY_SIZE>, COMMITTEE_SIZE>,
	pub aggregate_pubkey: Vector<u8, PUBKEY_SIZE>,
}

impl<const COMMITTEE_SIZE: usize> From<SyncCommittee<COMMITTEE_SIZE>>
	for SSZSyncCommittee<COMMITTEE_SIZE>
{
	fn from(sync_committee: SyncCommittee<COMMITTEE_SIZE>) -> Self {
		let mut pubkeys_vec = Vec::new();

		for pubkey in sync_committee.pubkeys.iter() {
			// The only thing that can go wrong in the conversion from vec to Vector (ssz type) is
			// that the Vector size is 0, or that the given data to create the Vector from does not
			// match the expected size N. Because these sizes are statically checked (i.e.
			// PublicKey's size is 48, and const PUBKEY_SIZE is 48, it is impossible for "try_from"
			// to return an error condition.
			let conv_pubkey = Vector::<u8, PUBKEY_SIZE>::try_from(pubkey.0.to_vec())
				.expect("checked statically; qed");

			pubkeys_vec.push(conv_pubkey);
		}

		let pubkeys = Vector::<Vector<u8, PUBKEY_SIZE>, { COMMITTEE_SIZE }>::try_from(pubkeys_vec)
			.expect("checked statically; qed");

		let aggregate_pubkey =
			Vector::<u8, PUBKEY_SIZE>::try_from(sync_committee.aggregate_pubkey.0.to_vec())
				.expect("checked statically; qed");

		SSZSyncCommittee { pubkeys, aggregate_pubkey }
	}
}

#[derive(Default, Debug, SimpleSerializeDerive, Clone)]
pub struct SSZSyncAggregate<const COMMITTEE_SIZE: usize> {
	pub sync_committee_bits: Bitvector<COMMITTEE_SIZE>,
	pub sync_committee_signature: Vector<u8, SIGNATURE_SIZE>,
}

impl<const COMMITTEE_SIZE: usize, const COMMITTEE_BITS_SIZE: usize>
	From<SyncAggregate<COMMITTEE_SIZE, COMMITTEE_BITS_SIZE>> for SSZSyncAggregate<COMMITTEE_SIZE>
{
	fn from(sync_aggregate: SyncAggregate<COMMITTEE_SIZE, COMMITTEE_BITS_SIZE>) -> Self {
		SSZSyncAggregate {
			sync_committee_bits: Bitvector::<COMMITTEE_SIZE>::deserialize(
				&sync_aggregate.sync_committee_bits,
			)
			.expect("checked statically; qed"),
			sync_committee_signature: Vector::<u8, SIGNATURE_SIZE>::try_from(
				sync_aggregate.sync_committee_signature.0.to_vec(),
			)
			.expect("checked statically; qed"),
		}
	}
}

#[derive(Default, SimpleSerializeDerive, Clone)]
pub struct SSZForkData {
	pub current_version: [u8; 4],
	pub genesis_validators_root: [u8; 32],
}

impl From<ForkData> for SSZForkData {
	fn from(fork_data: ForkData) -> Self {
		SSZForkData {
			current_version: fork_data.current_version,
			genesis_validators_root: fork_data.genesis_validators_root,
		}
	}
}

#[derive(Default, SimpleSerializeDerive, Clone)]
pub struct SSZSigningData {
	pub object_root: [u8; 32],
	pub domain: [u8; 32],
}

impl From<SigningData> for SSZSigningData {
	fn from(signing_data: SigningData) -> Self {
		SSZSigningData {
			object_root: signing_data.object_root.into(),
			domain: signing_data.domain.into(),
		}
	}
}

#[derive(Default, SimpleSerializeDerive, Clone, Debug)]
pub struct SSZExecutionPayloadHeader {
	pub parent_hash: [u8; 32],
	pub fee_recipient: Vector<u8, FEE_RECIPIENT_SIZE>,
	pub state_root: [u8; 32],
	pub receipts_root: [u8; 32],
	pub logs_bloom: Vector<u8, LOGS_BLOOM_SIZE>,
	pub prev_randao: [u8; 32],
	pub block_number: u64,
	pub gas_limit: u64,
	pub gas_used: u64,
	pub timestamp: u64,
	pub extra_data: List<u8, EXTRA_DATA_SIZE>,
	pub base_fee_per_gas: U256,
	pub block_hash: [u8; 32],
	pub transactions_root: [u8; 32],
	pub withdrawals_root: [u8; 32],
}

impl TryFrom<ExecutionPayloadHeader> for SSZExecutionPayloadHeader {
	type Error = SimpleSerializeError;

	fn try_from(payload: ExecutionPayloadHeader) -> Result<Self, Self::Error> {
		Ok(SSZExecutionPayloadHeader {
			parent_hash: payload.parent_hash.to_fixed_bytes(),
			fee_recipient: Vector::<u8, FEE_RECIPIENT_SIZE>::try_from(
				payload.fee_recipient.to_fixed_bytes().to_vec(),
			)
			.expect("checked statically; qed"),
			state_root: payload.state_root.to_fixed_bytes(),
			receipts_root: payload.receipts_root.to_fixed_bytes(),
			// Logs bloom bytes size is not constrained, so here we do need to check the try_from
			// error
			logs_bloom: Vector::<u8, LOGS_BLOOM_SIZE>::try_from(payload.logs_bloom)
				.map_err(|(_, err)| err)?,
			prev_randao: payload.prev_randao.to_fixed_bytes(),
			block_number: payload.block_number,
			gas_limit: payload.gas_limit,
			gas_used: payload.gas_used,
			timestamp: payload.timestamp,
			// Extra data bytes size is not constrained, so here we do need to check the try_from
			// error
			extra_data: List::<u8, EXTRA_DATA_SIZE>::try_from(payload.extra_data)
				.map_err(|(_, err)| err)?,
			base_fee_per_gas: U256::from_bytes_le(
				payload
					.base_fee_per_gas
					.as_byte_slice()
					.try_into()
					.expect("checked in prep; qed"),
			),
			block_hash: payload.block_hash.to_fixed_bytes(),
			transactions_root: payload.transactions_root.to_fixed_bytes(),
			withdrawals_root: payload.withdrawals_root.to_fixed_bytes(),
		})
	}
}

pub fn hash_tree_root<T: SimpleSerialize>(mut object: T) -> Result<H256, SimpleSerializeError> {
	match object.hash_tree_root() {
		Ok(node) => {
			let fixed_bytes: [u8; 32] =
				node.as_ref().try_into().expect("Node is a newtype over [u8; 32]; qed");
			Ok(fixed_bytes.into())
		},
		Err(err) => Err(err.into()),
	}
}

pub mod deneb {
	use crate::{
		config::{EXTRA_DATA_SIZE, FEE_RECIPIENT_SIZE, LOGS_BLOOM_SIZE},
		ssz::hash_tree_root,
		types::deneb::ExecutionPayloadHeader,
	};
	use byte_slice_cast::AsByteSlice;
	use sp_core::H256;
	use sp_std::{vec, vec::Vec};
	use ssz_rs::{
		prelude::{List, Vector},
		Deserialize, DeserializeError, SimpleSerializeError, Sized, U256,
	};
	use ssz_rs_derive::SimpleSerialize as SimpleSerializeDerive;

	#[derive(Default, SimpleSerializeDerive, Clone, Debug)]
	pub struct SSZExecutionPayloadHeader {
		pub parent_hash: [u8; 32],
		pub fee_recipient: Vector<u8, FEE_RECIPIENT_SIZE>,
		pub state_root: [u8; 32],
		pub receipts_root: [u8; 32],
		pub logs_bloom: Vector<u8, LOGS_BLOOM_SIZE>,
		pub prev_randao: [u8; 32],
		pub block_number: u64,
		pub gas_limit: u64,
		pub gas_used: u64,
		pub timestamp: u64,
		pub extra_data: List<u8, EXTRA_DATA_SIZE>,
		pub base_fee_per_gas: U256,
		pub block_hash: [u8; 32],
		pub transactions_root: [u8; 32],
		pub withdrawals_root: [u8; 32],
		pub blob_gas_used: u64,
		pub excess_blob_gas: u64,
	}

	impl TryFrom<ExecutionPayloadHeader> for SSZExecutionPayloadHeader {
		type Error = SimpleSerializeError;

		fn try_from(payload: ExecutionPayloadHeader) -> Result<Self, Self::Error> {
			Ok(SSZExecutionPayloadHeader {
				parent_hash: payload.parent_hash.to_fixed_bytes(),
				fee_recipient: Vector::<u8, FEE_RECIPIENT_SIZE>::try_from(
					payload.fee_recipient.to_fixed_bytes().to_vec(),
				)
				.expect("checked statically; qed"),
				state_root: payload.state_root.to_fixed_bytes(),
				receipts_root: payload.receipts_root.to_fixed_bytes(),
				// Logs bloom bytes size is not constrained, so here we do need to check the
				// try_from error
				logs_bloom: Vector::<u8, LOGS_BLOOM_SIZE>::try_from(payload.logs_bloom)
					.map_err(|(_, err)| err)?,
				prev_randao: payload.prev_randao.to_fixed_bytes(),
				block_number: payload.block_number,
				gas_limit: payload.gas_limit,
				gas_used: payload.gas_used,
				timestamp: payload.timestamp,
				// Extra data bytes size is not constrained, so here we do need to check the
				// try_from error
				extra_data: List::<u8, EXTRA_DATA_SIZE>::try_from(payload.extra_data)
					.map_err(|(_, err)| err)?,
				base_fee_per_gas: U256::from_bytes_le(
					payload
						.base_fee_per_gas
						.as_byte_slice()
						.try_into()
						.expect("checked in prep; qed"),
				),
				block_hash: payload.block_hash.to_fixed_bytes(),
				transactions_root: payload.transactions_root.to_fixed_bytes(),
				withdrawals_root: payload.withdrawals_root.to_fixed_bytes(),
				blob_gas_used: payload.blob_gas_used,
				excess_blob_gas: payload.excess_blob_gas,
			})
		}
	}

	impl ExecutionPayloadHeader {
		pub fn hash_tree_root(&self) -> Result<H256, SimpleSerializeError> {
			hash_tree_root::<SSZExecutionPayloadHeader>(self.clone().try_into()?)
		}
	}
}
