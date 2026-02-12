// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
extern crate alloc;

use crate::Log;
use alloc::vec::Vec;
use alloy_core::{primitives::B256, sol, sol_types::SolEvent};
use codec::Decode;
use frame_support::pallet_prelude::{Encode, TypeInfo};
use sp_core::{RuntimeDebug, H160, H256};

sol! {
    event InboundMessageDispatched(uint64 indexed nonce, bytes32 topic, bool success, bytes32 reward_address);
}

/// Delivery receipt
#[derive(Clone, RuntimeDebug)]
pub struct DeliveryReceipt<AccountId>
where
    AccountId: From<[u8; 32]> + Clone,
{
    /// The address of the outbound queue on Ethereum that emitted this message as an event log
    pub gateway: H160,
    /// The nonce of the dispatched message
    pub nonce: u64,
    /// Message topic
    pub topic: H256,
    /// Delivery status
    pub success: bool,
    /// The reward address
    pub reward_address: AccountId,
}

#[derive(Copy, Clone, Encode, Decode, Eq, PartialEq, Debug, TypeInfo)]
pub enum DeliveryReceiptDecodeError {
    DecodeLogFailed,
    DecodeAccountFailed,
}

impl<AccountId> TryFrom<&Log> for DeliveryReceipt<AccountId>
where
    AccountId: From<[u8; 32]> + Clone,
{
    type Error = DeliveryReceiptDecodeError;

    fn try_from(log: &Log) -> Result<Self, Self::Error> {
        let topics: Vec<B256> = log
            .topics
            .iter()
            .map(|x| B256::from_slice(x.as_ref()))
            .collect();

        let event = InboundMessageDispatched::decode_raw_log(topics, &log.data, true)
            .map_err(|_| DeliveryReceiptDecodeError::DecodeLogFailed)?;

        let account: AccountId = AccountId::from(event.reward_address.0);

        Ok(Self {
            gateway: log.address,
            nonce: event.nonce,
            topic: H256::from_slice(event.topic.as_ref()),
            success: event.success,
            reward_address: account,
        })
    }
}
