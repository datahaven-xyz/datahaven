// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Implementation for [`snowbridge_outbound_queue_primitives::v2::SendMessage`]
use super::*;
use bridge_hub_common::AggregateMessageOrigin;
use codec::Encode;
use frame_support::{
    ensure,
    traits::{EnqueueMessage, Get},
};
use snowbridge_outbound_queue_primitives::{
    v2::{Message, SendMessage},
    SendError, SendMessageFeeProvider,
};
use sp_core::H256;
use sp_runtime::BoundedVec;

impl<T> SendMessage for Pallet<T>
where
    T: Config,
{
    type Ticket = Message;

    fn validate(message: &Message) -> Result<Self::Ticket, SendError> {
        // The inner payload should not be too large
        let payload = message.encode();
        ensure!(
            payload.len() < T::MaxMessagePayloadSize::get() as usize,
            SendError::MessageTooLarge
        );

        Ok(message.clone())
    }

    fn deliver(ticket: Self::Ticket) -> Result<H256, SendError> {
        let origin = AggregateMessageOrigin::SnowbridgeV2(ticket.origin);

        let message =
            BoundedVec::try_from(ticket.encode()).map_err(|_| SendError::MessageTooLarge)?;

        T::MessageQueue::enqueue_message(message.as_bounded_slice(), origin);
        Self::deposit_event(Event::MessageQueued {
            message: ticket.clone(),
        });
        Ok(ticket.id)
    }
}

impl<T: Config> SendMessageFeeProvider for Pallet<T> {
    type Balance = T::Balance;

    /// The local component of the message processing fees in native currency
    fn local_fee() -> Self::Balance {
        Self::calculate_local_fee()
    }
}
