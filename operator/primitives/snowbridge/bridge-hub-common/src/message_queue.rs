// Copyright (C) Parity Technologies (UK) Ltd.
// SPDX-License-Identifier: Apache-2.0

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//! Runtime configuration for MessageQueue pallet
use codec::{Decode, Encode, MaxEncodedLen};
use core::marker::PhantomData;
use cumulus_primitives_core::{AggregateMessageOrigin as CumulusAggregateMessageOrigin, ParaId};
use frame_support::{
    traits::{ProcessMessage, ProcessMessageError, QueueFootprint, QueuePausedQuery},
    weights::WeightMeter,
};
use pallet_message_queue::OnQueueChanged;
use scale_info::TypeInfo;
use snowbridge_core::ChannelId;
use sp_core::H256;
use xcm::latest::prelude::{Junction, Location};

/// The aggregate origin of an inbound message.
/// This is specialized for BridgeHub, as the snowbridge-outbound-queue-pallet is also using
/// the shared MessageQueue pallet.
#[derive(Encode, Decode, Copy, MaxEncodedLen, Clone, Eq, PartialEq, TypeInfo, Debug)]
pub enum AggregateMessageOrigin {
    /// The message came from the para-chain itself.
    Here,
    /// The message came from the relay-chain.
    ///
    /// This is used by the DMP queue.
    Parent,
    /// The message came from a sibling para-chain.
    ///
    /// This is used by the HRMP queue.
    Sibling(ParaId),
    /// The message came from a snowbridge channel.
    ///
    /// This is used by Snowbridge inbound queue.
    Snowbridge(ChannelId),
    SnowbridgeV2(H256),
}

impl From<AggregateMessageOrigin> for Location {
    fn from(origin: AggregateMessageOrigin) -> Self {
        use AggregateMessageOrigin::*;
        match origin {
            Here => Location::here(),
            Parent => Location::parent(),
            Sibling(id) => Location::new(1, Junction::Parachain(id.into())),
            // NOTE: We don't need this conversion for Snowbridge. However, we have to
            // implement it anyway as xcm_builder::ProcessXcmMessage requires it.
            _ => Location::default(),
        }
    }
}

impl From<CumulusAggregateMessageOrigin> for AggregateMessageOrigin {
    fn from(origin: CumulusAggregateMessageOrigin) -> Self {
        match origin {
            CumulusAggregateMessageOrigin::Here => Self::Here,
            CumulusAggregateMessageOrigin::Parent => Self::Parent,
            CumulusAggregateMessageOrigin::Sibling(id) => Self::Sibling(id),
        }
    }
}

#[cfg(feature = "runtime-benchmarks")]
impl From<u32> for AggregateMessageOrigin {
    fn from(x: u32) -> Self {
        match x {
            0 => Self::Here,
            1 => Self::Parent,
            p => Self::Sibling(ParaId::from(p)),
        }
    }
}

/// Routes messages to either the XCMP or Snowbridge processor.
pub struct BridgeHubMessageRouter<XcmpProcessor, SnowbridgeProcessor>(
    PhantomData<(XcmpProcessor, SnowbridgeProcessor)>,
)
where
    XcmpProcessor: ProcessMessage<Origin = AggregateMessageOrigin>,
    SnowbridgeProcessor: ProcessMessage<Origin = AggregateMessageOrigin>;
impl<XcmpProcessor, SnowbridgeProcessor> ProcessMessage
    for BridgeHubMessageRouter<XcmpProcessor, SnowbridgeProcessor>
where
    XcmpProcessor: ProcessMessage<Origin = AggregateMessageOrigin>,
    SnowbridgeProcessor: ProcessMessage<Origin = AggregateMessageOrigin>,
{
    type Origin = AggregateMessageOrigin;
    fn process_message(
        message: &[u8],
        origin: Self::Origin,
        meter: &mut WeightMeter,
        id: &mut [u8; 32],
    ) -> Result<bool, ProcessMessageError> {
        use AggregateMessageOrigin::*;
        match origin {
            Here | Parent | Sibling(_) => {
                XcmpProcessor::process_message(message, origin, meter, id)
            }
            Snowbridge(_) => SnowbridgeProcessor::process_message(message, origin, meter, id),
            SnowbridgeV2(_) => Err(ProcessMessageError::Unsupported),
        }
    }
}

/// Routes messages to either the XCMP|Snowbridge V1 processor|Snowbridge V2 processor
pub struct BridgeHubDualMessageRouter<XcmpProcessor, SnowbridgeProcessor, SnowbridgeProcessorV2>(
    PhantomData<(XcmpProcessor, SnowbridgeProcessor, SnowbridgeProcessorV2)>,
)
where
    XcmpProcessor: ProcessMessage<Origin = AggregateMessageOrigin>,
    SnowbridgeProcessor: ProcessMessage<Origin = AggregateMessageOrigin>;

impl<XcmpProcessor, SnowbridgeProcessor, SnowbridgeProcessorV2> ProcessMessage
    for BridgeHubDualMessageRouter<XcmpProcessor, SnowbridgeProcessor, SnowbridgeProcessorV2>
where
    XcmpProcessor: ProcessMessage<Origin = AggregateMessageOrigin>,
    SnowbridgeProcessor: ProcessMessage<Origin = AggregateMessageOrigin>,
    SnowbridgeProcessorV2: ProcessMessage<Origin = AggregateMessageOrigin>,
{
    type Origin = AggregateMessageOrigin;

    fn process_message(
        message: &[u8],
        origin: Self::Origin,
        meter: &mut WeightMeter,
        id: &mut [u8; 32],
    ) -> Result<bool, ProcessMessageError> {
        use AggregateMessageOrigin::*;
        match origin {
            Here | Parent | Sibling(_) => {
                XcmpProcessor::process_message(message, origin, meter, id)
            }
            Snowbridge(_) => SnowbridgeProcessor::process_message(message, origin, meter, id),
            SnowbridgeV2(_) => SnowbridgeProcessorV2::process_message(message, origin, meter, id),
        }
    }
}

/// Narrow the scope of the `Inner` query from `AggregateMessageOrigin` to `ParaId`.
///
/// All non-`Sibling` variants will be ignored.
pub struct NarrowOriginToSibling<Inner>(PhantomData<Inner>);
impl<Inner: QueuePausedQuery<ParaId>> QueuePausedQuery<AggregateMessageOrigin>
    for NarrowOriginToSibling<Inner>
{
    fn is_paused(origin: &AggregateMessageOrigin) -> bool {
        match origin {
            AggregateMessageOrigin::Sibling(id) => Inner::is_paused(id),
            _ => false,
        }
    }
}

impl<Inner: OnQueueChanged<ParaId>> OnQueueChanged<AggregateMessageOrigin>
    for NarrowOriginToSibling<Inner>
{
    fn on_queue_changed(origin: AggregateMessageOrigin, fp: QueueFootprint) {
        if let AggregateMessageOrigin::Sibling(id) = origin {
            Inner::on_queue_changed(id, fp)
        }
    }
}

/// Convert a sibling `ParaId` to an `AggregateMessageOrigin`.
pub struct ParaIdToSibling;
impl sp_runtime::traits::Convert<ParaId, AggregateMessageOrigin> for ParaIdToSibling {
    fn convert(para_id: ParaId) -> AggregateMessageOrigin {
        AggregateMessageOrigin::Sibling(para_id)
    }
}
