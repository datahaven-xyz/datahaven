// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

use snowbridge_outbound_queue_primitives::{
    v1::{Fee, Message as MessageV1, SendMessage as SendMessageV1},
    v2::{Message, SendMessage},
    SendMessageFeeProvider,
};
use sp_core::H256;

pub struct MockOkOutboundQueue;
impl SendMessage for MockOkOutboundQueue {
    type Ticket = ();

    fn validate(
        _: &Message,
    ) -> Result<Self::Ticket, snowbridge_outbound_queue_primitives::SendError> {
        Ok(())
    }

    fn deliver(_: Self::Ticket) -> Result<H256, snowbridge_outbound_queue_primitives::SendError> {
        Ok(H256::zero())
    }
}

impl SendMessageFeeProvider for MockOkOutboundQueue {
    type Balance = u128;

    fn local_fee() -> Self::Balance {
        0
    }
}

pub struct MockOkOutboundQueueV1;
impl SendMessageV1 for MockOkOutboundQueueV1 {
    type Ticket = ();

    fn validate(
        _: &MessageV1,
    ) -> Result<
        (Self::Ticket, Fee<<Self as SendMessageFeeProvider>::Balance>),
        snowbridge_outbound_queue_primitives::SendError,
    > {
        Ok(((), Fee::from((0, 0))))
    }

    fn deliver(_: Self::Ticket) -> Result<H256, snowbridge_outbound_queue_primitives::SendError> {
        Ok(H256::zero())
    }
}

impl SendMessageFeeProvider for MockOkOutboundQueueV1 {
    type Balance = u128;

    fn local_fee() -> Self::Balance {
        0
    }
}