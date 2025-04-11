// Copyright (C) Parity Technologies (UK) Ltd.
// This file is part of Parity Bridges Common.

// Parity Bridges Common is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Parity Bridges Common is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Parity Bridges Common.  If not, see <http://www.gnu.org/licenses/>.

//! Primitives of messages module.

#![warn(missing_docs)]
#![cfg_attr(not(feature = "std"), no_std)]

pub use extension::{
	BatchCallUnpacker, ExtensionCallData, ExtensionCallInfo, ExtensionConfig,
	RuntimeWithUtilityPallet,
};
pub use registration::{ExplicitOrAccountParams, Registration, StakeAndSlash};

use bp_runtime::{ChainId, StorageDoubleMapKeyProvider};
use frame_support::{traits::tokens::Preservation, Blake2_128Concat, Identity};
use scale_info::TypeInfo;
use sp_runtime::{
	codec::{Codec, Decode, DecodeWithMemTracking, Encode, EncodeLike, MaxEncodedLen},
	traits::AccountIdConversion,
	TypeId,
};
use sp_std::{fmt::Debug, marker::PhantomData};

mod extension;
mod registration;

/// The owner of the sovereign account that should pay the rewards.
///
/// Each of the 2 final points connected by a bridge owns a sovereign account at each end of the
/// bridge. So here, at this end of the bridge there can be 2 sovereign accounts that pay rewards.
#[derive(
	Copy,
	Clone,
	Debug,
	Decode,
	DecodeWithMemTracking,
	Encode,
	Eq,
	PartialEq,
	TypeInfo,
	MaxEncodedLen,
)]
pub enum RewardsAccountOwner {
	/// The sovereign account of the final chain on this end of the bridge.
	ThisChain,
	/// The sovereign account of the final chain on the other end of the bridge.
	BridgedChain,
}

/// Structure used to identify the account that pays a reward to the relayer.
///
/// A bridge connects 2 bridge ends. Each one is located on a separate relay chain. The bridge ends
/// can be the final destinations of the bridge, or they can be intermediary points
/// (e.g. a bridge hub) used to forward messages between pairs of parachains on the bridged relay
/// chains. A pair of such parachains is connected using a bridge lane. Each of the 2 final
/// destinations of a bridge lane must have a sovereign account at each end of the bridge and each
/// of the sovereign accounts will pay rewards for different operations. So we need multiple
/// parameters to identify the account that pays a reward to the relayer.
#[derive(
	Copy,
	Clone,
	Debug,
	Decode,
	DecodeWithMemTracking,
	Encode,
	Eq,
	PartialEq,
	TypeInfo,
	MaxEncodedLen,
)]
pub struct RewardsAccountParams<LaneId> {
	// **IMPORTANT NOTE**: the order of fields here matters - we are using
	// `into_account_truncating` and lane id is already `32` byte, so if other fields are encoded
	// after it, they're simply dropped. So lane id shall be the last field.
	owner: RewardsAccountOwner,
	bridged_chain_id: ChainId,
	lane_id: LaneId,
}

impl<LaneId: Decode + Encode> RewardsAccountParams<LaneId> {
	/// Create a new instance of `RewardsAccountParams`.
	pub const fn new(
		lane_id: LaneId,
		bridged_chain_id: ChainId,
		owner: RewardsAccountOwner,
	) -> Self {
		Self { lane_id, bridged_chain_id, owner }
	}

	/// Getter for `lane_id`.
	pub const fn lane_id(&self) -> &LaneId {
		&self.lane_id
	}
}

impl<LaneId: Decode + Encode> TypeId for RewardsAccountParams<LaneId> {
	const TYPE_ID: [u8; 4] = *b"brap";
}

/// Reward payment procedure.
pub trait PaymentProcedure<Relayer, Reward, RewardBalance> {
	/// Error that may be returned by the procedure.
	type Error: Debug;

	/// Type parameter used to identify the beneficiaries eligible to receive rewards.
	type Beneficiary: Clone + Debug + Decode + Encode + Eq + TypeInfo;

	/// Pay reward to the relayer (or alternative beneficiary if provided) from the account with
	/// provided params.
	fn pay_reward(
		relayer: &Relayer,
		reward: Reward,
		reward_balance: RewardBalance,
		beneficiary: Self::Beneficiary,
	) -> Result<(), Self::Error>;
}

impl<Relayer, Reward, RewardBalance> PaymentProcedure<Relayer, Reward, RewardBalance> for () {
	type Error = &'static str;
	type Beneficiary = ();

	fn pay_reward(
		_: &Relayer,
		_: Reward,
		_: RewardBalance,
		_: Self::Beneficiary,
	) -> Result<(), Self::Error> {
		Ok(())
	}
}

/// Reward payment procedure that executes a `balances::transfer` call from the account
/// derived from the given `RewardsAccountParams` to the relayer or an alternative beneficiary.
pub struct PayRewardFromAccount<T, Relayer, LaneId, RewardBalance>(
	PhantomData<(T, Relayer, LaneId, RewardBalance)>,
);

impl<T, Relayer, LaneId, RewardBalance> PayRewardFromAccount<T, Relayer, LaneId, RewardBalance>
where
	Relayer: Decode + Encode,
	LaneId: Decode + Encode,
{
	/// Return account that pays rewards based on the provided parameters.
	pub fn rewards_account(params: RewardsAccountParams<LaneId>) -> Relayer {
		params.into_sub_account_truncating(b"rewards-account")
	}
}

impl<T, Relayer, LaneId, RewardBalance>
	PaymentProcedure<Relayer, RewardsAccountParams<LaneId>, RewardBalance>
	for PayRewardFromAccount<T, Relayer, LaneId, RewardBalance>
where
	T: frame_support::traits::fungible::Mutate<Relayer>,
	T::Balance: From<RewardBalance>,
	Relayer: Clone + Debug + Decode + Encode + Eq + TypeInfo,
	LaneId: Decode + Encode,
{
	type Error = sp_runtime::DispatchError;
	type Beneficiary = Relayer;

	fn pay_reward(
		_: &Relayer,
		reward_kind: RewardsAccountParams<LaneId>,
		reward: RewardBalance,
		beneficiary: Self::Beneficiary,
	) -> Result<(), Self::Error> {
		T::transfer(
			&Self::rewards_account(reward_kind),
			&beneficiary.into(),
			reward.into(),
			Preservation::Expendable,
		)
		.map(drop)
	}
}

/// Can be used to access the runtime storage key within the `RelayerRewards` map of the relayers
/// pallet.
pub struct RelayerRewardsKeyProvider<AccountId, Reward, RewardBalance>(
	PhantomData<(AccountId, Reward, RewardBalance)>,
);

impl<AccountId, Reward, RewardBalance> StorageDoubleMapKeyProvider
	for RelayerRewardsKeyProvider<AccountId, Reward, RewardBalance>
where
	AccountId: 'static + Codec + EncodeLike + Send + Sync,
	Reward: Codec + EncodeLike + Send + Sync,
	RewardBalance: 'static + Codec + EncodeLike + Send + Sync,
{
	const MAP_NAME: &'static str = "RelayerRewards";

	type Hasher1 = Blake2_128Concat;
	type Key1 = AccountId;
	type Hasher2 = Identity;
	type Key2 = Reward;
	type Value = RewardBalance;
}

/// A trait defining a reward ledger, which tracks rewards that can be later claimed.
///
/// This ledger allows registering rewards for a relayer, categorized by a specific `Reward`.
/// The registered rewards can be claimed later through an appropriate payment procedure.
pub trait RewardLedger<Relayer, Reward, RewardBalance> {
	/// Registers a reward for a given relayer.
	fn register_reward(relayer: &Relayer, reward: Reward, reward_balance: RewardBalance);
}

#[cfg(test)]
mod tests {
	use super::*;
	use bp_messages::{HashedLaneId, LaneIdType, LegacyLaneId};
	use sp_runtime::{app_crypto::Ss58Codec, testing::H256};

	#[test]
	fn different_lanes_are_using_different_accounts() {
		assert_eq!(
			PayRewardFromAccount::<(), H256, HashedLaneId, ()>::rewards_account(
				RewardsAccountParams::new(
					HashedLaneId::try_new(1, 2).unwrap(),
					*b"test",
					RewardsAccountOwner::ThisChain
				)
			),
			hex_literal::hex!("627261700074657374b1d3dccd8b3c3a012afe265f3e3c4432129b8aee50c9dc")
				.into(),
		);

		assert_eq!(
			PayRewardFromAccount::<(), H256, HashedLaneId, ()>::rewards_account(
				RewardsAccountParams::new(
					HashedLaneId::try_new(1, 3).unwrap(),
					*b"test",
					RewardsAccountOwner::ThisChain
				)
			),
			hex_literal::hex!("627261700074657374a43e8951aa302c133beb5f85821a21645f07b487270ef3")
				.into(),
		);
	}

	#[test]
	fn different_directions_are_using_different_accounts() {
		assert_eq!(
			PayRewardFromAccount::<(), H256, HashedLaneId, ()>::rewards_account(
				RewardsAccountParams::new(
					HashedLaneId::try_new(1, 2).unwrap(),
					*b"test",
					RewardsAccountOwner::ThisChain
				)
			),
			hex_literal::hex!("627261700074657374b1d3dccd8b3c3a012afe265f3e3c4432129b8aee50c9dc")
				.into(),
		);

		assert_eq!(
			PayRewardFromAccount::<(), H256, HashedLaneId, ()>::rewards_account(
				RewardsAccountParams::new(
					HashedLaneId::try_new(1, 2).unwrap(),
					*b"test",
					RewardsAccountOwner::BridgedChain
				)
			),
			hex_literal::hex!("627261700174657374b1d3dccd8b3c3a012afe265f3e3c4432129b8aee50c9dc")
				.into(),
		);
	}

	#[test]
	fn pay_reward_from_account_for_legacy_lane_id_works() {
		let test_data = vec![
			// Note: these accounts are used for integration tests within
			// `bridges_rococo_westend.sh`
			(
				LegacyLaneId([0, 0, 0, 1]),
				b"bhks",
				RewardsAccountOwner::ThisChain,
				(0_u16, "13E5fui97x6KTwNnSjaEKZ8s7kJNot5F3aUsy3jUtuoMyUec"),
			),
			(
				LegacyLaneId([0, 0, 0, 1]),
				b"bhks",
				RewardsAccountOwner::BridgedChain,
				(0_u16, "13E5fui9Ka9Vz4JbGN3xWjmwDNxnxF1N9Hhhbeu3VCqLChuj"),
			),
			(
				LegacyLaneId([0, 0, 0, 1]),
				b"bhpd",
				RewardsAccountOwner::ThisChain,
				(2_u16, "EoQBtnwtXqnSnr9cgBEJpKU7NjeC9EnR4D1VjgcvHz9ZYmS"),
			),
			(
				LegacyLaneId([0, 0, 0, 1]),
				b"bhpd",
				RewardsAccountOwner::BridgedChain,
				(2_u16, "EoQBtnx69txxumxSJexVzxYD1Q4LWAuWmRq8LrBWb27nhYN"),
			),
			// Note: these accounts are used for integration tests within
			// `bridges_polkadot_kusama.sh` from fellows.
			(
				LegacyLaneId([0, 0, 0, 2]),
				b"bhwd",
				RewardsAccountOwner::ThisChain,
				(4_u16, "SNihsskf7bFhnHH9HJFMjWD3FJ96ESdAQTFZUAtXudRQbaH"),
			),
			(
				LegacyLaneId([0, 0, 0, 2]),
				b"bhwd",
				RewardsAccountOwner::BridgedChain,
				(4_u16, "SNihsskrjeSDuD5xumyYv9H8sxZEbNkG7g5C5LT8CfPdaSE"),
			),
			(
				LegacyLaneId([0, 0, 0, 2]),
				b"bhro",
				RewardsAccountOwner::ThisChain,
				(4_u16, "SNihsskf7bF2vWogkC6uFoiqPhd3dUX6TGzYZ1ocJdo3xHp"),
			),
			(
				LegacyLaneId([0, 0, 0, 2]),
				b"bhro",
				RewardsAccountOwner::BridgedChain,
				(4_u16, "SNihsskrjeRZ3ScWNfq6SSnw2N3BzQeCAVpBABNCbfmHENB"),
			),
		];

		for (lane_id, bridged_chain_id, owner, (expected_ss58, expected_account)) in test_data {
			assert_eq!(
				expected_account,
				sp_runtime::AccountId32::new(PayRewardFromAccount::<
					[u8; 32],
					[u8; 32],
					LegacyLaneId,
					(),
				>::rewards_account(RewardsAccountParams::new(
					lane_id,
					*bridged_chain_id,
					owner
				)))
				.to_ss58check_with_version(expected_ss58.into())
			);
		}
	}
}
