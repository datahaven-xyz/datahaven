// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use frame_support::{CloneNoBound, PartialEqNoBound, RuntimeDebugNoBound};
use scale_info::TypeInfo;
use sp_core::{H160, H256, U256};
use sp_runtime::RuntimeDebug;
use sp_std::{boxed::Box, iter::repeat, prelude::*};

use crate::config::{PUBKEY_SIZE, SIGNATURE_SIZE};

#[cfg(feature = "std")]
use serde::{Deserialize, Deserializer, Serialize, Serializer};

#[cfg(feature = "std")]
use crate::serde_utils::HexVisitor;

use crate::ssz::{
	hash_tree_root, SSZBeaconBlockHeader, SSZExecutionPayloadHeader, SSZForkData, SSZSigningData,
	SSZSyncAggregate, SSZSyncCommittee,
};
use ssz_rs::SimpleSerializeError;

pub use crate::bits::decompress_sync_committee_bits;

use crate::bls::{prepare_g1_pubkeys, prepare_milagro_pubkey, BlsError};
use milagro_bls::PublicKey as PublicKeyPrepared;

pub type ValidatorIndex = u64;
pub type ForkVersion = [u8; 4];

#[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo)]
pub struct ForkVersions {
	pub genesis: Fork,
	pub altair: Fork,
	pub bellatrix: Fork,
	pub capella: Fork,
	pub deneb: Fork,
	pub electra: Fork,
}

#[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo)]
pub struct Fork {
	pub version: [u8; 4],
	pub epoch: u64,
}

#[derive(Copy, Clone, Encode, Decode, DecodeWithMemTracking, PartialEq, RuntimeDebug, TypeInfo)]
pub struct PublicKey(pub [u8; PUBKEY_SIZE]);

impl Default for PublicKey {
	fn default() -> Self {
		PublicKey([0u8; PUBKEY_SIZE])
	}
}

impl From<[u8; PUBKEY_SIZE]> for PublicKey {
	fn from(v: [u8; PUBKEY_SIZE]) -> Self {
		Self(v)
	}
}

impl MaxEncodedLen for PublicKey {
	fn max_encoded_len() -> usize {
		PUBKEY_SIZE
	}
}

#[cfg(feature = "std")]
impl<'de> Deserialize<'de> for PublicKey {
	fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
	where
		D: Deserializer<'de>,
	{
		deserializer.deserialize_str(HexVisitor::<PUBKEY_SIZE>()).map(|v| v.into())
	}
}

#[cfg(feature = "std")]
impl Serialize for PublicKey {
	fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
	where
		S: Serializer,
	{
		serializer.serialize_bytes(&self.0)
	}
}

#[derive(Copy, Clone, Encode, Decode, DecodeWithMemTracking, PartialEq, RuntimeDebug, TypeInfo)]
pub struct Signature(pub [u8; SIGNATURE_SIZE]);

impl Default for Signature {
	fn default() -> Self {
		Signature([0u8; SIGNATURE_SIZE])
	}
}

impl From<[u8; SIGNATURE_SIZE]> for Signature {
	fn from(v: [u8; SIGNATURE_SIZE]) -> Self {
		Self(v)
	}
}

#[cfg(feature = "std")]
impl<'de> Deserialize<'de> for Signature {
	fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
	where
		D: Deserializer<'de>,
	{
		deserializer.deserialize_str(HexVisitor::<SIGNATURE_SIZE>()).map(|v| v.into())
	}
}

#[derive(Copy, Clone, Default, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct FinalizedHeaderState {
	pub beacon_block_root: H256,
	pub beacon_slot: u64,
}

#[derive(Clone, Default, Encode, Decode, PartialEq, RuntimeDebug)]
pub struct ForkData {
	// 1 or 0 bit, indicates whether a sync committee participated in a vote
	pub current_version: [u8; 4],
	pub genesis_validators_root: [u8; 32],
}

impl ForkData {
	pub fn hash_tree_root(&self) -> Result<H256, SimpleSerializeError> {
		hash_tree_root::<SSZForkData>(self.clone().into())
	}
}

#[derive(Clone, Default, Encode, Decode, PartialEq, RuntimeDebug)]
pub struct SigningData {
	pub object_root: H256,
	pub domain: H256,
}

impl SigningData {
	pub fn hash_tree_root(&self) -> Result<H256, SimpleSerializeError> {
		hash_tree_root::<SSZSigningData>(self.clone().into())
	}
}

/// Sync committee as it is stored in the runtime storage.
#[derive(
	Encode,
	Decode,
	DecodeWithMemTracking,
	PartialEqNoBound,
	CloneNoBound,
	RuntimeDebugNoBound,
	TypeInfo,
	MaxEncodedLen,
)]
#[cfg_attr(
	feature = "std",
	derive(Serialize, Deserialize),
	serde(deny_unknown_fields, bound(serialize = ""), bound(deserialize = ""))
)]
#[codec(mel_bound())]
pub struct SyncCommittee<const COMMITTEE_SIZE: usize> {
	#[cfg_attr(feature = "std", serde(with = "crate::serde_utils::arrays"))]
	pub pubkeys: [PublicKey; COMMITTEE_SIZE],
	pub aggregate_pubkey: PublicKey,
}

impl<const COMMITTEE_SIZE: usize> Default for SyncCommittee<COMMITTEE_SIZE> {
	fn default() -> Self {
		SyncCommittee {
			pubkeys: [Default::default(); COMMITTEE_SIZE],
			aggregate_pubkey: Default::default(),
		}
	}
}

impl<const COMMITTEE_SIZE: usize> SyncCommittee<COMMITTEE_SIZE> {
	pub fn hash_tree_root(&self) -> Result<H256, SimpleSerializeError> {
		hash_tree_root::<SSZSyncCommittee<COMMITTEE_SIZE>>(self.clone().into())
	}
}

/// Prepared G1 public key of sync committee as it is stored in the runtime storage.
#[derive(Clone, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct SyncCommitteePrepared<const COMMITTEE_SIZE: usize> {
	pub root: H256,
	pub pubkeys: Box<[PublicKeyPrepared; COMMITTEE_SIZE]>,
	pub aggregate_pubkey: PublicKeyPrepared,
}

impl<const COMMITTEE_SIZE: usize> Default for SyncCommitteePrepared<COMMITTEE_SIZE> {
	fn default() -> Self {
		let pubkeys: Vec<PublicKeyPrepared> =
			repeat(PublicKeyPrepared::default()).take(COMMITTEE_SIZE).collect();
		let pubkeys: Box<[PublicKeyPrepared; COMMITTEE_SIZE]> =
			Box::new(pubkeys.try_into().map_err(|_| ()).expect("checked statically; qed"));

		SyncCommitteePrepared {
			root: H256::default(),
			pubkeys,
			aggregate_pubkey: PublicKeyPrepared::default(),
		}
	}
}

impl<const COMMITTEE_SIZE: usize> TryFrom<&SyncCommittee<COMMITTEE_SIZE>>
	for SyncCommitteePrepared<COMMITTEE_SIZE>
{
	type Error = BlsError;

	fn try_from(sync_committee: &SyncCommittee<COMMITTEE_SIZE>) -> Result<Self, Self::Error> {
		let g1_pubkeys = prepare_g1_pubkeys(&sync_committee.pubkeys)?;
		let sync_committee_root = sync_committee.hash_tree_root().expect("checked statically; qed");

		Ok(SyncCommitteePrepared::<COMMITTEE_SIZE> {
			pubkeys: g1_pubkeys.try_into().map_err(|_| ()).expect("checked statically; qed"),
			aggregate_pubkey: prepare_milagro_pubkey(&sync_committee.aggregate_pubkey)?,
			root: sync_committee_root,
		})
	}
}

/// Beacon block header as it is stored in the runtime storage. The block root is the
/// Merkleization of a BeaconHeader.
#[derive(
	Copy,
	Clone,
	Default,
	Encode,
	Decode,
	DecodeWithMemTracking,
	PartialEq,
	RuntimeDebug,
	TypeInfo,
	MaxEncodedLen,
)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct BeaconHeader {
	// The slot for which this block is created. Must be greater than the slot of the block defined
	// by parent root.
	pub slot: u64,
	// The index of the validator that proposed the block.
	pub proposer_index: ValidatorIndex,
	// The block root of the parent block, forming a block chain.
	pub parent_root: H256,
	// The hash root of the post state of running the state transition through this block.
	pub state_root: H256,
	// The hash root of the beacon block body
	pub body_root: H256,
}

impl BeaconHeader {
	pub fn hash_tree_root(&self) -> Result<H256, SimpleSerializeError> {
		hash_tree_root::<SSZBeaconBlockHeader>((*self).into())
	}
}

#[derive(
	Encode,
	Decode,
	DecodeWithMemTracking,
	CloneNoBound,
	PartialEqNoBound,
	RuntimeDebugNoBound,
	TypeInfo,
)]
#[cfg_attr(
	feature = "std",
	derive(Deserialize),
	serde(
		try_from = "IntermediateSyncAggregate",
		deny_unknown_fields,
		bound(serialize = ""),
		bound(deserialize = "")
	)
)]
#[codec(mel_bound())]
pub struct SyncAggregate<const COMMITTEE_SIZE: usize, const COMMITTEE_BITS_SIZE: usize> {
	pub sync_committee_bits: [u8; COMMITTEE_BITS_SIZE],
	pub sync_committee_signature: Signature,
}

impl<const COMMITTEE_SIZE: usize, const COMMITTEE_BITS_SIZE: usize> Default
	for SyncAggregate<COMMITTEE_SIZE, COMMITTEE_BITS_SIZE>
{
	fn default() -> Self {
		SyncAggregate {
			sync_committee_bits: [0; COMMITTEE_BITS_SIZE],
			sync_committee_signature: Default::default(),
		}
	}
}

impl<const COMMITTEE_SIZE: usize, const COMMITTEE_BITS_SIZE: usize>
	SyncAggregate<COMMITTEE_SIZE, COMMITTEE_BITS_SIZE>
{
	pub fn hash_tree_root(&self) -> Result<H256, SimpleSerializeError> {
		hash_tree_root::<SSZSyncAggregate<COMMITTEE_SIZE>>(self.clone().into())
	}
}

/// Serde deserialization helper for SyncAggregate
#[cfg(feature = "std")]
#[derive(Deserialize)]
struct IntermediateSyncAggregate {
	#[cfg_attr(feature = "std", serde(deserialize_with = "crate::serde_utils::from_hex_to_bytes"))]
	pub sync_committee_bits: Vec<u8>,
	pub sync_committee_signature: Signature,
}

#[cfg(feature = "std")]
impl<const COMMITTEE_SIZE: usize, const COMMITTEE_BITS_SIZE: usize>
	TryFrom<IntermediateSyncAggregate> for SyncAggregate<COMMITTEE_SIZE, COMMITTEE_BITS_SIZE>
{
	type Error = String;

	fn try_from(other: IntermediateSyncAggregate) -> Result<Self, Self::Error> {
		Ok(Self {
			sync_committee_bits: other
				.sync_committee_bits
				.try_into()
				.map_err(|_| "unexpected length".to_owned())?,
			sync_committee_signature: other.sync_committee_signature,
		})
	}
}

/// ExecutionPayloadHeader
/// <https://github.com/ethereum/annotated-spec/blob/master/capella/beacon-chain.md#executionpayloadheader>
#[derive(
	Default,
	Encode,
	Decode,
	DecodeWithMemTracking,
	CloneNoBound,
	PartialEqNoBound,
	RuntimeDebugNoBound,
	TypeInfo,
)]
#[cfg_attr(
	feature = "std",
	derive(Serialize, Deserialize),
	serde(deny_unknown_fields, bound(serialize = ""), bound(deserialize = ""))
)]
#[codec(mel_bound())]
pub struct ExecutionPayloadHeader {
	pub parent_hash: H256,
	pub fee_recipient: H160,
	pub state_root: H256,
	pub receipts_root: H256,
	#[cfg_attr(feature = "std", serde(deserialize_with = "crate::serde_utils::from_hex_to_bytes"))]
	pub logs_bloom: Vec<u8>,
	pub prev_randao: H256,
	pub block_number: u64,
	pub gas_limit: u64,
	pub gas_used: u64,
	pub timestamp: u64,
	#[cfg_attr(feature = "std", serde(deserialize_with = "crate::serde_utils::from_hex_to_bytes"))]
	pub extra_data: Vec<u8>,
	#[cfg_attr(feature = "std", serde(deserialize_with = "crate::serde_utils::from_int_to_u256"))]
	pub base_fee_per_gas: U256,
	pub block_hash: H256,
	pub transactions_root: H256,
	pub withdrawals_root: H256,
}

impl ExecutionPayloadHeader {
	pub fn hash_tree_root(&self) -> Result<H256, SimpleSerializeError> {
		hash_tree_root::<SSZExecutionPayloadHeader>(self.clone().try_into()?)
	}
}

#[derive(
	Default,
	Encode,
	Decode,
	Copy,
	Clone,
	PartialEqNoBound,
	RuntimeDebugNoBound,
	TypeInfo,
	MaxEncodedLen,
)]
pub struct CompactBeaconState {
	#[codec(compact)]
	pub slot: u64,
	pub block_roots_root: H256,
}

/// VersionedExecutionPayloadHeader
#[derive(
	Encode,
	Decode,
	DecodeWithMemTracking,
	CloneNoBound,
	PartialEqNoBound,
	RuntimeDebugNoBound,
	TypeInfo,
)]
#[cfg_attr(
	feature = "std",
	derive(Serialize, Deserialize),
	serde(deny_unknown_fields, bound(serialize = ""), bound(deserialize = ""))
)]
#[codec(mel_bound())]
pub enum VersionedExecutionPayloadHeader {
	Capella(ExecutionPayloadHeader),
	Deneb(deneb::ExecutionPayloadHeader),
}

impl VersionedExecutionPayloadHeader {
	pub fn hash_tree_root(&self) -> Result<H256, SimpleSerializeError> {
		match self {
			VersionedExecutionPayloadHeader::Capella(execution_payload_header) =>
				hash_tree_root::<SSZExecutionPayloadHeader>(
					execution_payload_header.clone().try_into()?,
				),
			VersionedExecutionPayloadHeader::Deneb(execution_payload_header) =>
				hash_tree_root::<crate::ssz::deneb::SSZExecutionPayloadHeader>(
					execution_payload_header.clone().try_into()?,
				),
		}
	}

	pub fn block_hash(&self) -> H256 {
		match self {
			VersionedExecutionPayloadHeader::Capella(execution_payload_header) =>
				execution_payload_header.block_hash,
			VersionedExecutionPayloadHeader::Deneb(execution_payload_header) =>
				execution_payload_header.block_hash,
		}
	}

	pub fn block_number(&self) -> u64 {
		match self {
			VersionedExecutionPayloadHeader::Capella(execution_payload_header) =>
				execution_payload_header.block_number,
			VersionedExecutionPayloadHeader::Deneb(execution_payload_header) =>
				execution_payload_header.block_number,
		}
	}

	pub fn receipts_root(&self) -> H256 {
		match self {
			VersionedExecutionPayloadHeader::Capella(execution_payload_header) =>
				execution_payload_header.receipts_root,
			VersionedExecutionPayloadHeader::Deneb(execution_payload_header) =>
				execution_payload_header.receipts_root,
		}
	}
}

#[derive(
	Encode,
	Decode,
	DecodeWithMemTracking,
	CloneNoBound,
	PartialEqNoBound,
	RuntimeDebugNoBound,
	TypeInfo,
)]
#[cfg_attr(
	feature = "std",
	derive(serde::Deserialize),
	serde(deny_unknown_fields, bound(serialize = ""), bound(deserialize = ""))
)]
pub struct ExecutionProof {
	/// Header for the beacon block containing the execution payload
	pub header: BeaconHeader,
	/// Proof that `header` is an ancestor of a finalized header
	pub ancestry_proof: Option<AncestryProof>,
	/// The execution header to be verified
	pub execution_header: VersionedExecutionPayloadHeader,
	/// Merkle proof that execution payload is contained within `header`
	pub execution_branch: Vec<H256>,
}

#[derive(
	Encode,
	Decode,
	DecodeWithMemTracking,
	CloneNoBound,
	PartialEqNoBound,
	RuntimeDebugNoBound,
	TypeInfo,
)]
#[cfg_attr(
	feature = "std",
	derive(serde::Deserialize),
	serde(deny_unknown_fields, bound(serialize = ""), bound(deserialize = ""))
)]
pub struct AncestryProof {
	/// Merkle proof that `header` is an ancestor of `finalized_header`
	pub header_branch: Vec<H256>,
	/// Root of a finalized block that has already been imported into the light client
	pub finalized_block_root: H256,
}

#[cfg(test)]
mod tests {
	use super::*;
	use hex_literal::hex;

	#[test]
	pub fn test_hash_beacon_header1() {
		let hash_root = BeaconHeader {
			slot: 3,
			proposer_index: 2,
			parent_root: hex!("796ea53efb534eab7777809cc5ee2d84e7f25024b9d0c4d7e5bcaab657e4bdbd")
				.into(),
			state_root: hex!("ba3ff080912be5c9c158b2e962c1b39a91bc0615762ba6fa2ecacafa94e9ae0a")
				.into(),
			body_root: hex!("a18d7fcefbb74a177c959160e0ee89c23546482154e6831237710414465dcae5")
				.into(),
		}
		.hash_tree_root();

		assert!(hash_root.is_ok());
		assert_eq!(
			hash_root.unwrap(),
			hex!("7d42595818709e805dd2fa710a2d2c1f62576ef1ab7273941ac9130fb94b91f7").into()
		);
	}

	#[test]
	pub fn test_hash_beacon_header2() {
		let hash_root = BeaconHeader {
			slot: 3476424,
			proposer_index: 314905,
			parent_root: hex!("c069d7b49cffd2b815b0fb8007eb9ca91202ea548df6f3db60000f29b2489f28")
				.into(),
			state_root: hex!("444d293e4533501ee508ad608783a7d677c3c566f001313e8a02ce08adf590a3")
				.into(),
			body_root: hex!("6508a0241047f21ba88f05d05b15534156ab6a6f8e029a9a5423da429834e04a")
				.into(),
		}
		.hash_tree_root();

		assert!(hash_root.is_ok());
		assert_eq!(
			hash_root.unwrap(),
			hex!("0aa41166ff01e58e111ac8c42309a738ab453cf8d7285ed8477b1c484acb123e").into()
		);
	}

	#[test]
	pub fn test_hash_fork_data() {
		let hash_root = ForkData {
			current_version: hex!("83f38a34"),
			genesis_validators_root: hex!(
				"22370bbbb358800f5711a10ea9845284272d8493bed0348cab87b8ab1e127930"
			),
		}
		.hash_tree_root();

		assert!(hash_root.is_ok());
		assert_eq!(
			hash_root.unwrap(),
			hex!("57c12c4246bc7152b174b51920506bf943eff9c7ffa50b9533708e9cc1f680fc").into()
		);
	}

	#[test]
	pub fn test_hash_signing_data() {
		let hash_root = SigningData {
			object_root: hex!("63654cbe64fc07853f1198c165dd3d49c54fc53bc417989bbcc66da15f850c54")
				.into(),
			domain: hex!("037da907d1c3a03c0091b2254e1480d9b1783476e228ab29adaaa8f133e08f7a").into(),
		}
		.hash_tree_root();

		assert!(hash_root.is_ok());
		assert_eq!(
			hash_root.unwrap(),
			hex!("b9eb2caf2d691b183c2d57f322afe505c078cd08101324f61c3641714789a54e").into()
		);
	}

	#[test]
	pub fn test_hash_sync_aggregate() {
		let hash_root = SyncAggregate::<512, 64>{
				sync_committee_bits: hex!("cefffffefffffff767fffbedffffeffffeeffdffffdebffffff7f7dbdf7fffdffffbffcfffdff79dfffbbfefff2ffffff7ddeff7ffffc98ff7fbfffffffffff7"),
				sync_committee_signature: hex!("8af1a8577bba419fe054ee49b16ed28e081dda6d3ba41651634685e890992a0b675e20f8d9f2ec137fe9eb50e838aa6117f9f5410e2e1024c4b4f0e098e55144843ce90b7acde52fe7b94f2a1037342c951dc59f501c92acf7ed944cb6d2b5f7").into(),
		}.hash_tree_root();

		assert!(hash_root.is_ok());
		assert_eq!(
			hash_root.unwrap(),
			hex!("e6dcad4f60ce9ff8a587b110facbaf94721f06cd810b6d8bf6cffa641272808d").into()
		);
	}

	#[test]
	pub fn test_hash_execution_payload() {
		let hash_root =
            ExecutionPayloadHeader{
                parent_hash: hex!("eadee5ab098dde64e9fd02ae5858064bad67064070679625b09f8d82dec183f7").into(),
                fee_recipient: hex!("f97e180c050e5ab072211ad2c213eb5aee4df134").into(),
                state_root: hex!("564fa064c2a324c2b5978d7fdfc5d4224d4f421a45388af1ed405a399c845dff").into(),
                receipts_root: hex!("56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421").into(),
                logs_bloom: hex!("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000").to_vec(),
                prev_randao: hex!("6bf538bdfbdf1c96ff528726a40658a91d0bda0f1351448c4c4f3604db2a0ccf").into(),
                block_number: 477434,
                gas_limit: 8154925,
                gas_used: 0,
                timestamp: 1652816940,
                extra_data: vec![],
                base_fee_per_gas: U256::from(7_i16),
                block_hash: hex!("cd8df91b4503adb8f2f1c7a4f60e07a1f1a2cbdfa2a95bceba581f3ff65c1968").into(),
                transactions_root: hex!("7ffe241ea60187fdb0187bfa22de35d1f9bed7ab061d9401fd47e34a54fbede1").into(),
				withdrawals_root: hex!("28ba1834a3a7b657460ce79fa3a1d909ab8828fd557659d4d0554a9bdbc0ec30").into(),
			}.hash_tree_root();
		assert!(hash_root.is_ok());
	}
}

/// Operating modes for beacon client
#[derive(Encode, Decode, Copy, Clone, PartialEq, RuntimeDebug, TypeInfo)]
pub enum Mode {
	Active,
	Blocked,
}

pub mod deneb {
	use codec::{Decode, DecodeWithMemTracking, Encode};
	use frame_support::{CloneNoBound, PartialEqNoBound, RuntimeDebugNoBound};
	use scale_info::TypeInfo;
	#[cfg(feature = "std")]
	use serde::{Deserialize, Serialize};
	use sp_core::{H160, H256, U256};
	use sp_std::prelude::*;

	/// ExecutionPayloadHeader
	/// <https://github.com/ethereum/consensus-specs/blob/dev/specs/deneb/beacon-chain.md#executionpayloadheader>
	#[derive(
		Default,
		Encode,
		Decode,
		DecodeWithMemTracking,
		CloneNoBound,
		PartialEqNoBound,
		RuntimeDebugNoBound,
		TypeInfo,
	)]
	#[cfg_attr(
		feature = "std",
		derive(Serialize, Deserialize),
		serde(deny_unknown_fields, bound(serialize = ""), bound(deserialize = ""))
	)]
	#[codec(mel_bound())]
	pub struct ExecutionPayloadHeader {
		pub parent_hash: H256,
		pub fee_recipient: H160,
		pub state_root: H256,
		pub receipts_root: H256,
		#[cfg_attr(
			feature = "std",
			serde(deserialize_with = "crate::serde_utils::from_hex_to_bytes")
		)]
		pub logs_bloom: Vec<u8>,
		pub prev_randao: H256,
		pub block_number: u64,
		pub gas_limit: u64,
		pub gas_used: u64,
		pub timestamp: u64,
		#[cfg_attr(
			feature = "std",
			serde(deserialize_with = "crate::serde_utils::from_hex_to_bytes")
		)]
		pub extra_data: Vec<u8>,
		#[cfg_attr(
			feature = "std",
			serde(deserialize_with = "crate::serde_utils::from_int_to_u256")
		)]
		pub base_fee_per_gas: U256,
		pub block_hash: H256,
		pub transactions_root: H256,
		pub withdrawals_root: H256,
		pub blob_gas_used: u64,   // [New in Deneb:EIP4844]
		pub excess_blob_gas: u64, // [New in Deneb:EIP4844]
	}
}
