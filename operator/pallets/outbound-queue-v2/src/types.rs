// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use super::Pallet;
use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::traits::ProcessMessage;
use scale_info::TypeInfo;
pub use snowbridge_merkle_tree::MerkleProof;
use sp_runtime::RuntimeDebug;
use sp_std::prelude::*;

pub type ProcessMessageOriginOf<T> = <Pallet<T> as ProcessMessage>::Origin;

/// Pending order
#[derive(Encode, Decode, TypeInfo, Clone, Eq, PartialEq, RuntimeDebug, MaxEncodedLen)]
pub struct PendingOrder<BlockNumber> {
	/// The nonce used to identify the message
	pub nonce: u64,
	/// The block number in which the message was committed
	pub block_number: BlockNumber,
	/// The fee in Ether provided by the user to incentivize message delivery
	#[codec(compact)]
	pub fee: u128,
}
