// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Converts XCM messages into simpler commands that can be processed by the Gateway contract

#[cfg(test)]
mod tests;

pub mod convert;
pub use convert::XcmConverter;

use super::message::SendMessage;
use codec::{Decode, Encode};
use frame_support::{
	ensure,
	traits::{Contains, Get, ProcessMessageError},
};
use snowbridge_core::{ParaId, TokenId};
use sp_core::H256;
use sp_runtime::traits::MaybeEquivalence;
use sp_std::{marker::PhantomData, ops::ControlFlow, prelude::*};
use xcm::prelude::*;
use xcm_builder::{CreateMatcher, ExporterFor, MatchXcm};
use xcm_executor::traits::{ConvertLocation, ExportXcm};

pub const TARGET: &'static str = "xcm::ethereum_blob_exporter::v2";

/// Used to process ExportMessages where the destination is Ethereum. It takes an ExportMessage
/// and converts it into a simpler message that the Ethereum gateway contract can understand.
pub struct EthereumBlobExporter<
	UniversalLocation,
	EthereumNetwork,
	OutboundQueue,
	AgentHashedDescription,
	ConvertAssetId,
	AssetHubParaId,
>(
	PhantomData<(
		UniversalLocation,
		EthereumNetwork,
		OutboundQueue,
		AgentHashedDescription,
		ConvertAssetId,
		AssetHubParaId,
	)>,
);

impl<
		UniversalLocation,
		EthereumNetwork,
		OutboundQueue,
		AgentHashedDescription,
		ConvertAssetId,
		AssetHubParaId,
	> ExportXcm
	for EthereumBlobExporter<
		UniversalLocation,
		EthereumNetwork,
		OutboundQueue,
		AgentHashedDescription,
		ConvertAssetId,
		AssetHubParaId,
	>
where
	UniversalLocation: Get<InteriorLocation>,
	EthereumNetwork: Get<NetworkId>,
	OutboundQueue: SendMessage,
	AgentHashedDescription: ConvertLocation<H256>,
	ConvertAssetId: MaybeEquivalence<TokenId, Location>,
	AssetHubParaId: Get<ParaId>,
{
	type Ticket = (Vec<u8>, XcmHash);

	fn validate(
		network: NetworkId,
		_channel: u32,
		universal_source: &mut Option<InteriorLocation>,
		destination: &mut Option<InteriorLocation>,
		message: &mut Option<Xcm<()>>,
	) -> SendResult<Self::Ticket> {
		log::debug!(target: TARGET, "message route through bridge {message:?}.");

		let expected_network = EthereumNetwork::get();
		let universal_location = UniversalLocation::get();

		if network != expected_network {
			log::trace!(target: TARGET, "skipped due to unmatched bridge network {network:?}.");
			return Err(SendError::NotApplicable)
		}

		// Cloning destination to avoid modifying the value so subsequent exporters can use it.
		let dest = destination.clone().ok_or(SendError::MissingArgument)?;
		if dest != Here {
			log::trace!(target: TARGET, "skipped due to unmatched remote destination {dest:?}.");
			return Err(SendError::NotApplicable)
		}

		// Cloning universal_source to avoid modifying the value so subsequent exporters can use it.
		let (local_net, local_sub) = universal_source.clone()
            .ok_or_else(|| {
                log::error!(target: TARGET, "universal source not provided.");
                SendError::MissingArgument
            })?
            .split_global()
            .map_err(|()| {
                log::error!(target: TARGET, "could not get global consensus from universal source '{universal_source:?}'.");
                SendError::NotApplicable
            })?;

		if Ok(local_net) != universal_location.global_consensus() {
			log::trace!(target: TARGET, "skipped due to unmatched relay network {local_net:?}.");
			return Err(SendError::NotApplicable)
		}

		let para_id = match local_sub.as_slice() {
			[Parachain(para_id)] => *para_id,
			_ => {
				log::error!(target: TARGET, "could not get parachain id from universal source '{local_sub:?}'.");
				return Err(SendError::NotApplicable)
			},
		};

		if ParaId::from(para_id) != AssetHubParaId::get() {
			log::error!(target: TARGET, "is not from asset hub '{para_id:?}'.");
			return Err(SendError::NotApplicable)
		}

		let message = message.clone().ok_or_else(|| {
			log::error!(target: TARGET, "xcm message not provided.");
			SendError::MissingArgument
		})?;

		// Inspect `AliasOrigin` as V2 message. This exporter should only process Snowbridge V2
		// messages. We use the presence of an `AliasOrigin` instruction to distinguish between
		// Snowbridge V2 and Snowbridge V1 messages, since XCM V5 came after Snowbridge V1 and
		// so it's not supported in Snowbridge V1. Snowbridge V1 messages are processed by the
		// snowbridge-outbound-queue-primitives v1 exporter.
		let mut instructions = message.clone().0;
		let result = instructions.matcher().match_next_inst_while(
			|_| true,
			|inst| {
				return match inst {
					AliasOrigin(..) => Err(ProcessMessageError::Yield),
					_ => Ok(ControlFlow::Continue(())),
				}
			},
		);
		ensure!(result.is_err(), SendError::NotApplicable);

		let mut converter = XcmConverter::<ConvertAssetId, ()>::new(&message, expected_network);
		let message = converter.convert().map_err(|err| {
			log::error!(target: TARGET, "unroutable due to pattern matching error '{err:?}'.");
			SendError::Unroutable
		})?;

		// validate the message
		let ticket = OutboundQueue::validate(&message).map_err(|err| {
			log::error!(target: TARGET, "OutboundQueue validation of message failed. {err:?}");
			SendError::Unroutable
		})?;

		Ok(((ticket.encode(), XcmHash::from(message.id)), Assets::default()))
	}

	fn deliver(blob: (Vec<u8>, XcmHash)) -> Result<XcmHash, SendError> {
		let ticket: OutboundQueue::Ticket = OutboundQueue::Ticket::decode(&mut blob.0.as_ref())
			.map_err(|_| {
				log::trace!(target: TARGET, "undeliverable due to decoding error");
				SendError::NotApplicable
			})?;

		let message_id = OutboundQueue::deliver(ticket).map_err(|_| {
			log::error!(target: TARGET, "OutboundQueue submit of message failed");
			SendError::Transport("other transport error")
		})?;

		log::info!(target: TARGET, "message delivered {message_id:#?}.");
		Ok(message_id.into())
	}
}

/// An adapter for the implementation of `ExporterFor`, which attempts to find the
/// `(bridge_location, payment)` for the requested `network` and `remote_location` and `xcm`
/// in the provided `T` table containing various exporters.
pub struct XcmFilterExporter<T, M>(core::marker::PhantomData<(T, M)>);
impl<T: ExporterFor, M: Contains<Xcm<()>>> ExporterFor for XcmFilterExporter<T, M> {
	fn exporter_for(
		network: &NetworkId,
		remote_location: &InteriorLocation,
		xcm: &Xcm<()>,
	) -> Option<(Location, Option<Asset>)> {
		// check the XCM
		if !M::contains(xcm) {
			return None
		}
		// check `network` and `remote_location`
		T::exporter_for(network, remote_location, xcm)
	}
}

/// Xcm for SnowbridgeV2 which requires XCMV5
pub struct XcmForSnowbridgeV2;
impl Contains<Xcm<()>> for XcmForSnowbridgeV2 {
	fn contains(xcm: &Xcm<()>) -> bool {
		let mut instructions = xcm.clone().0;
		let result = instructions.matcher().match_next_inst_while(
			|_| true,
			|inst| {
				return match inst {
					AliasOrigin(..) => Err(ProcessMessageError::Yield),
					_ => Ok(ControlFlow::Continue(())),
				}
			},
		);
		result.is_err()
	}
}
