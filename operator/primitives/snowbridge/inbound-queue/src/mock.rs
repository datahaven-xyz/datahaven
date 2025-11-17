// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

use crate::{MessageToXcm, TokenId};
use frame_support::parameter_types;
use sp_runtime::{
	traits::{IdentifyAccount, MaybeEquivalence, Verify},
	MultiSignature,
};
use xcm::{latest::WESTEND_GENESIS_HASH, prelude::*};

pub const CHAIN_ID: u64 = 11155111;
pub const NETWORK: NetworkId = Ethereum { chain_id: CHAIN_ID };

parameter_types! {
	pub EthereumNetwork: NetworkId = NETWORK;

	pub const CreateAssetCall: [u8;2] = [53, 0];
	pub const CreateAssetExecutionFee: u128 = 2_000_000_000;
	pub const CreateAssetDeposit: u128 = 100_000_000_000;
	pub const SendTokenExecutionFee: u128 = 1_000_000_000;
	pub const InboundQueuePalletInstance: u8 = 80;
	pub UniversalLocation: InteriorLocation =
		[GlobalConsensus(ByGenesis(WESTEND_GENESIS_HASH)), Parachain(1002)].into();
	pub AssetHubFromEthereum: Location = Location::new(1,[GlobalConsensus(ByGenesis(WESTEND_GENESIS_HASH)),Parachain(1000)]);
}

type Signature = MultiSignature;
type AccountId = <<Signature as Verify>::Signer as IdentifyAccount>::AccountId;
type Balance = u128;

pub(crate) struct MockTokenIdConvert;
impl MaybeEquivalence<TokenId, Location> for MockTokenIdConvert {
	fn convert(_id: &TokenId) -> Option<Location> {
		Some(Location::parent())
	}
	fn convert_back(_loc: &Location) -> Option<TokenId> {
		None
	}
}

pub(crate) type MessageConverter = MessageToXcm<
	CreateAssetCall,
	CreateAssetDeposit,
	InboundQueuePalletInstance,
	AccountId,
	Balance,
	MockTokenIdConvert,
	UniversalLocation,
	AssetHubFromEthereum,
>;
