// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Converts XCM messages into simpler commands that can be processed by the Gateway contract

#[cfg(test)]
mod tests;

use core::slice::Iter;

use codec::{Decode, Encode};

use frame_support::{ensure, traits::Get};
use snowbridge_core::{
	outbound::{AgentExecuteCommand, Command, Message, SendMessage},
	AgentId, ChannelId, ParaId, TokenId, TokenIdOf,
};
use sp_core::{H160, H256};
use sp_runtime::traits::MaybeEquivalence;
use sp_std::{iter::Peekable, marker::PhantomData, prelude::*};
use xcm::prelude::*;
use xcm_executor::traits::{ConvertLocation, ExportXcm};

pub struct EthereumBlobExporter<
	UniversalLocation,
	EthereumNetwork,
	OutboundQueue,
	AgentHashedDescription,
	ConvertAssetId,
>(
	PhantomData<(
		UniversalLocation,
		EthereumNetwork,
		OutboundQueue,
		AgentHashedDescription,
		ConvertAssetId,
	)>,
);

impl<UniversalLocation, EthereumNetwork, OutboundQueue, AgentHashedDescription, ConvertAssetId>
	ExportXcm
	for EthereumBlobExporter<
		UniversalLocation,
		EthereumNetwork,
		OutboundQueue,
		AgentHashedDescription,
		ConvertAssetId,
	>
where
	UniversalLocation: Get<InteriorLocation>,
	EthereumNetwork: Get<NetworkId>,
	OutboundQueue: SendMessage<Balance = u128>,
	AgentHashedDescription: ConvertLocation<H256>,
	ConvertAssetId: MaybeEquivalence<TokenId, Location>,
{
	type Ticket = (Vec<u8>, XcmHash);

	fn validate(
		network: NetworkId,
		_channel: u32,
		universal_source: &mut Option<InteriorLocation>,
		destination: &mut Option<InteriorLocation>,
		message: &mut Option<Xcm<()>>,
	) -> SendResult<Self::Ticket> {
		let expected_network = EthereumNetwork::get();
		let universal_location = UniversalLocation::get();

		if network != expected_network {
			log::trace!(target: "xcm::ethereum_blob_exporter", "skipped due to unmatched bridge network {network:?}.");
			return Err(SendError::NotApplicable)
		}

		// Cloning destination to avoid modifying the value so subsequent exporters can use it.
		let dest = destination.clone().take().ok_or(SendError::MissingArgument)?;
		if dest != Here {
			log::trace!(target: "xcm::ethereum_blob_exporter", "skipped due to unmatched remote destination {dest:?}.");
			return Err(SendError::NotApplicable)
		}

		// Cloning universal_source to avoid modifying the value so subsequent exporters can use it.
		let (local_net, local_sub) = universal_source.clone()
			.take()
			.ok_or_else(|| {
				log::error!(target: "xcm::ethereum_blob_exporter", "universal source not provided.");
				SendError::MissingArgument
			})?
			.split_global()
			.map_err(|()| {
				log::error!(target: "xcm::ethereum_blob_exporter", "could not get global consensus from universal source '{universal_source:?}'.");
				SendError::NotApplicable
			})?;

		if Ok(local_net) != universal_location.global_consensus() {
			log::trace!(target: "xcm::ethereum_blob_exporter", "skipped due to unmatched relay network {local_net:?}.");
			return Err(SendError::NotApplicable)
		}

		let para_id = match local_sub.as_slice() {
			[Parachain(para_id)] => *para_id,
			_ => {
				log::error!(target: "xcm::ethereum_blob_exporter", "could not get parachain id from universal source '{local_sub:?}'.");
				return Err(SendError::NotApplicable)
			},
		};

		let source_location = Location::new(1, local_sub.clone());

		let agent_id = match AgentHashedDescription::convert_location(&source_location) {
			Some(id) => id,
			None => {
				log::error!(target: "xcm::ethereum_blob_exporter", "unroutable due to not being able to create agent id. '{source_location:?}'");
				return Err(SendError::NotApplicable)
			},
		};

		let message = message.take().ok_or_else(|| {
			log::error!(target: "xcm::ethereum_blob_exporter", "xcm message not provided.");
			SendError::MissingArgument
		})?;

		let mut converter =
			XcmConverter::<ConvertAssetId, ()>::new(&message, expected_network, agent_id);
		let (command, message_id) = converter.convert().map_err(|err|{
			log::error!(target: "xcm::ethereum_blob_exporter", "unroutable due to pattern matching error '{err:?}'.");
			SendError::Unroutable
		})?;

		let channel_id: ChannelId = ParaId::from(para_id).into();

		let outbound_message = Message { id: Some(message_id.into()), channel_id, command };

		// validate the message
		let (ticket, fee) = OutboundQueue::validate(&outbound_message).map_err(|err| {
			log::error!(target: "xcm::ethereum_blob_exporter", "OutboundQueue validation of message failed. {err:?}");
			SendError::Unroutable
		})?;

		// convert fee to Asset
		let fee = Asset::from((Location::parent(), fee.total())).into();

		Ok(((ticket.encode(), message_id), fee))
	}

	fn deliver(blob: (Vec<u8>, XcmHash)) -> Result<XcmHash, SendError> {
		let ticket: OutboundQueue::Ticket = OutboundQueue::Ticket::decode(&mut blob.0.as_ref())
			.map_err(|_| {
				log::trace!(target: "xcm::ethereum_blob_exporter", "undeliverable due to decoding error");
				SendError::NotApplicable
			})?;

		let message_id = OutboundQueue::deliver(ticket).map_err(|_| {
			log::error!(target: "xcm::ethereum_blob_exporter", "OutboundQueue submit of message failed");
			SendError::Transport("other transport error")
		})?;

		log::info!(target: "xcm::ethereum_blob_exporter", "message delivered {message_id:#?}.");
		Ok(message_id.into())
	}
}

/// Errors that can be thrown to the pattern matching step.
#[derive(PartialEq, Debug)]
enum XcmConverterError {
	UnexpectedEndOfXcm,
	EndOfXcmMessageExpected,
	WithdrawAssetExpected,
	DepositAssetExpected,
	NoReserveAssets,
	FilterDoesNotConsumeAllAssets,
	TooManyAssets,
	ZeroAssetTransfer,
	BeneficiaryResolutionFailed,
	AssetResolutionFailed,
	InvalidFeeAsset,
	SetTopicExpected,
	ReserveAssetDepositedExpected,
	InvalidAsset,
	UnexpectedInstruction,
}

macro_rules! match_expression {
	($expression:expr, $(|)? $( $pattern:pat_param )|+ $( if $guard: expr )?, $value:expr $(,)?) => {
		match $expression {
			$( $pattern )|+ $( if $guard )? => Some($value),
			_ => None,
		}
	};
}

struct XcmConverter<'a, ConvertAssetId, Call> {
	iter: Peekable<Iter<'a, Instruction<Call>>>,
	ethereum_network: NetworkId,
	agent_id: AgentId,
	_marker: PhantomData<ConvertAssetId>,
}
impl<'a, ConvertAssetId, Call> XcmConverter<'a, ConvertAssetId, Call>
where
	ConvertAssetId: MaybeEquivalence<TokenId, Location>,
{
	fn new(message: &'a Xcm<Call>, ethereum_network: NetworkId, agent_id: AgentId) -> Self {
		Self {
			iter: message.inner().iter().peekable(),
			ethereum_network,
			agent_id,
			_marker: Default::default(),
		}
	}

	fn convert(&mut self) -> Result<(Command, [u8; 32]), XcmConverterError> {
		let result = match self.peek() {
			Ok(ReserveAssetDeposited { .. }) => self.make_mint_foreign_token_command(),
			// Get withdraw/deposit and make native tokens create message.
			Ok(WithdrawAsset { .. }) => self.make_unlock_native_token_command(),
			Err(e) => Err(e),
			_ => return Err(XcmConverterError::UnexpectedInstruction),
		}?;

		// All xcm instructions must be consumed before exit.
		if self.next().is_ok() {
			return Err(XcmConverterError::EndOfXcmMessageExpected)
		}

		Ok(result)
	}

	fn make_unlock_native_token_command(
		&mut self,
	) -> Result<(Command, [u8; 32]), XcmConverterError> {
		use XcmConverterError::*;

		// Get the reserve assets from WithdrawAsset.
		let reserve_assets =
			match_expression!(self.next()?, WithdrawAsset(reserve_assets), reserve_assets)
				.ok_or(WithdrawAssetExpected)?;

		// Check if clear origin exists and skip over it.
		if match_expression!(self.peek(), Ok(ClearOrigin), ()).is_some() {
			let _ = self.next();
		}

		// Get the fee asset item from BuyExecution or continue parsing.
		let fee_asset = match_expression!(self.peek(), Ok(BuyExecution { fees, .. }), fees);
		if fee_asset.is_some() {
			let _ = self.next();
		}

		let (deposit_assets, beneficiary) = match_expression!(
			self.next()?,
			DepositAsset { assets, beneficiary },
			(assets, beneficiary)
		)
		.ok_or(DepositAssetExpected)?;

		// assert that the beneficiary is AccountKey20.
		let recipient = match_expression!(
			beneficiary.unpack(),
			(0, [AccountKey20 { network, key }])
				if self.network_matches(network),
			H160(*key)
		)
		.ok_or(BeneficiaryResolutionFailed)?;

		// Make sure there are reserved assets.
		if reserve_assets.len() == 0 {
			return Err(NoReserveAssets)
		}

		// Check the the deposit asset filter matches what was reserved.
		if reserve_assets.inner().iter().any(|asset| !deposit_assets.matches(asset)) {
			return Err(FilterDoesNotConsumeAllAssets)
		}

		// We only support a single asset at a time.
		ensure!(reserve_assets.len() == 1, TooManyAssets);
		let reserve_asset = reserve_assets.get(0).ok_or(AssetResolutionFailed)?;

		// Fees are collected on AH, up front and directly from the user, to cover the
		// complete cost of the transfer. Any additional fees provided in the XCM program are
		// refunded to the beneficiary. We only validate the fee here if its provided to make sure
		// the XCM program is well formed. Another way to think about this from an XCM perspective
		// would be that the user offered to pay X amount in fees, but we charge 0 of that X amount
		// (no fee) and refund X to the user.
		if let Some(fee_asset) = fee_asset {
			// The fee asset must be the same as the reserve asset.
			if fee_asset.id != reserve_asset.id || fee_asset.fun > reserve_asset.fun {
				return Err(InvalidFeeAsset)
			}
		}

		let (token, amount) = match reserve_asset {
			Asset { id: AssetId(inner_location), fun: Fungible(amount) } =>
				match inner_location.unpack() {
					(0, [AccountKey20 { network, key }]) if self.network_matches(network) =>
						Some((H160(*key), *amount)),
					_ => None,
				},
			_ => None,
		}
		.ok_or(AssetResolutionFailed)?;

		// transfer amount must be greater than 0.
		ensure!(amount > 0, ZeroAssetTransfer);

		// Check if there is a SetTopic and skip over it if found.
		let topic_id = match_expression!(self.next()?, SetTopic(id), id).ok_or(SetTopicExpected)?;

		Ok((
			Command::AgentExecute {
				agent_id: self.agent_id,
				command: AgentExecuteCommand::TransferToken { token, recipient, amount },
			},
			*topic_id,
		))
	}

	fn next(&mut self) -> Result<&'a Instruction<Call>, XcmConverterError> {
		self.iter.next().ok_or(XcmConverterError::UnexpectedEndOfXcm)
	}

	fn peek(&mut self) -> Result<&&'a Instruction<Call>, XcmConverterError> {
		self.iter.peek().ok_or(XcmConverterError::UnexpectedEndOfXcm)
	}

	fn network_matches(&self, network: &Option<NetworkId>) -> bool {
		if let Some(network) = network {
			*network == self.ethereum_network
		} else {
			true
		}
	}

	/// Convert the xcm for Polkadot-native token from AH into the Command
	/// To match transfers of Polkadot-native tokens, we expect an input of the form:
	/// # ReserveAssetDeposited
	/// # ClearOrigin
	/// # BuyExecution
	/// # DepositAsset
	/// # SetTopic
	fn make_mint_foreign_token_command(
		&mut self,
	) -> Result<(Command, [u8; 32]), XcmConverterError> {
		use XcmConverterError::*;

		// Get the reserve assets.
		let reserve_assets =
			match_expression!(self.next()?, ReserveAssetDeposited(reserve_assets), reserve_assets)
				.ok_or(ReserveAssetDepositedExpected)?;

		// Check if clear origin exists and skip over it.
		if match_expression!(self.peek(), Ok(ClearOrigin), ()).is_some() {
			let _ = self.next();
		}

		// Get the fee asset item from BuyExecution or continue parsing.
		let fee_asset = match_expression!(self.peek(), Ok(BuyExecution { fees, .. }), fees);
		if fee_asset.is_some() {
			let _ = self.next();
		}

		let (deposit_assets, beneficiary) = match_expression!(
			self.next()?,
			DepositAsset { assets, beneficiary },
			(assets, beneficiary)
		)
		.ok_or(DepositAssetExpected)?;

		// assert that the beneficiary is AccountKey20.
		let recipient = match_expression!(
			beneficiary.unpack(),
			(0, [AccountKey20 { network, key }])
				if self.network_matches(network),
			H160(*key)
		)
		.ok_or(BeneficiaryResolutionFailed)?;

		// Make sure there are reserved assets.
		if reserve_assets.len() == 0 {
			return Err(NoReserveAssets)
		}

		// Check the the deposit asset filter matches what was reserved.
		if reserve_assets.inner().iter().any(|asset| !deposit_assets.matches(asset)) {
			return Err(FilterDoesNotConsumeAllAssets)
		}

		// We only support a single asset at a time.
		ensure!(reserve_assets.len() == 1, TooManyAssets);
		let reserve_asset = reserve_assets.get(0).ok_or(AssetResolutionFailed)?;

		// Fees are collected on AH, up front and directly from the user, to cover the
		// complete cost of the transfer. Any additional fees provided in the XCM program are
		// refunded to the beneficiary. We only validate the fee here if its provided to make sure
		// the XCM program is well formed. Another way to think about this from an XCM perspective
		// would be that the user offered to pay X amount in fees, but we charge 0 of that X amount
		// (no fee) and refund X to the user.
		if let Some(fee_asset) = fee_asset {
			// The fee asset must be the same as the reserve asset.
			if fee_asset.id != reserve_asset.id || fee_asset.fun > reserve_asset.fun {
				return Err(InvalidFeeAsset)
			}
		}

		let (asset_id, amount) = match reserve_asset {
			Asset { id: AssetId(inner_location), fun: Fungible(amount) } =>
				Some((inner_location.clone(), *amount)),
			_ => None,
		}
		.ok_or(AssetResolutionFailed)?;

		// transfer amount must be greater than 0.
		ensure!(amount > 0, ZeroAssetTransfer);

		let token_id = TokenIdOf::convert_location(&asset_id).ok_or(InvalidAsset)?;

		let expected_asset_id = ConvertAssetId::convert(&token_id).ok_or(InvalidAsset)?;

		ensure!(asset_id == expected_asset_id, InvalidAsset);

		// Check if there is a SetTopic and skip over it if found.
		let topic_id = match_expression!(self.next()?, SetTopic(id), id).ok_or(SetTopicExpected)?;

		Ok((Command::MintForeignToken { token_id, recipient, amount }, *topic_id))
	}
}
