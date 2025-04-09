// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
#![cfg_attr(not(feature = "std"), no_std)]

pub mod bits;
pub mod bls;
pub mod config;
pub mod merkle_proof;
pub mod receipt;
pub mod ssz;
pub mod types;
pub mod updates;

#[cfg(feature = "std")]
mod serde_utils;

pub use types::{
	AncestryProof, BeaconHeader, CompactBeaconState, ExecutionPayloadHeader, ExecutionProof,
	FinalizedHeaderState, Fork, ForkData, ForkVersion, ForkVersions, Mode, PublicKey, Signature,
	SigningData, SyncAggregate, SyncCommittee, SyncCommitteePrepared,
	VersionedExecutionPayloadHeader,
};
pub use updates::{CheckpointUpdate, NextSyncCommitteeUpdate, Update};

pub use bits::decompress_sync_committee_bits;
pub use bls::{
	fast_aggregate_verify, prepare_aggregate_pubkey, prepare_aggregate_pubkey_from_absent,
	prepare_aggregate_signature, prepare_g1_pubkeys, AggregatePublicKey, AggregateSignature,
	BlsError, PublicKeyPrepared, SignaturePrepared,
};
pub use merkle_proof::verify_merkle_branch;
pub use receipt::verify_receipt_proof;
