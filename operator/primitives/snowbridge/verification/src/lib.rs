// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Types for representing inbound messages
#![cfg_attr(not(feature = "std"), no_std)]
extern crate alloc;

use alloc::vec::Vec;
use codec::{Decode, DecodeWithMemTracking, Encode};
use frame_support::PalletError;
use scale_info::TypeInfo;
use snowbridge_beacon_primitives::{BeaconHeader, ExecutionProof};
use sp_core::{RuntimeDebug, H160, H256};

/// A trait for verifying inbound messages from Ethereum.
pub trait Verifier {
    fn verify(event: &Log, proof: &Proof) -> Result<(), VerificationError>;
}

#[derive(Clone, Encode, Decode, RuntimeDebug, PalletError, TypeInfo, DecodeWithMemTracking)]
#[cfg_attr(feature = "std", derive(PartialEq))]
pub enum VerificationError {
    /// Execution header is missing
    HeaderNotFound,
    /// Event log was not found in the verified transaction receipt
    LogNotFound,
    /// Event log has an invalid format
    InvalidLog,
    /// Unable to verify the transaction receipt with the provided proof
    InvalidProof,
    /// Unable to verify the execution header with ancestry proof
    InvalidExecutionProof(#[codec(skip)] &'static str),
}

/// A bridge message from the Gateway contract on Ethereum
#[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, DecodeWithMemTracking)]
pub struct EventProof {
    /// Event log emitted by Gateway contract
    pub event_log: Log,
    /// Inclusion proof for a transaction receipt containing the event log
    pub proof: Proof,
}

const MAX_TOPICS: usize = 4;

#[derive(Clone, RuntimeDebug)]
pub enum LogValidationError {
    TooManyTopics,
}

/// Event log
#[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, DecodeWithMemTracking)]
pub struct Log {
    pub address: H160,
    pub topics: Vec<H256>,
    pub data: Vec<u8>,
}

impl Log {
    pub fn validate(&self) -> Result<(), LogValidationError> {
        if self.topics.len() > MAX_TOPICS {
            return Err(LogValidationError::TooManyTopics);
        }
        Ok(())
    }
}

/// Inclusion proof for a transaction receipt
#[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, DecodeWithMemTracking)]
pub struct Proof {
    // Proof keys and values (receipts tree)
    pub receipt_proof: (Vec<Vec<u8>>, Vec<Vec<u8>>),
    // Proof that an execution header was finalized by the beacon chain
    pub execution_proof: ExecutionProof,
}

#[derive(Clone, RuntimeDebug)]
pub struct EventFixture {
    pub event: EventProof,
    pub finalized_header: BeaconHeader,
    pub block_roots_root: H256,
}
