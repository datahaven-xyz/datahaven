// Copyright 2025 DataHaven
// This file is part of DataHaven.

// DataHaven is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// DataHaven is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with DataHaven.  If not, see <http://www.gnu.org/licenses/>.

#![cfg_attr(not(feature = "std"), no_std)]
extern crate alloc;

use alloc::vec::Vec;
use frame_support::pallet_prelude::*;
use parity_scale_codec::DecodeAll;
use snowbridge_inbound_queue_primitives::v2::{
    EthereumAsset, Message as SnowbridgeMessage, MessageProcessor,
};
use sp_core::H160;

// Message ID. This is not expected to change and its arbitrary bytes defined here.
// It should match the EL_MESSAGE_ID in DataHavenSnowbridgeMessages.sol
pub const EL_MESSAGE_ID: [u8; 4] = [112, 21, 0, 56]; // 0x70150038

// Message ID for native token transfers
pub const NATIVE_TRANSFER_MESSAGE_ID: [u8; 4] = [112, 21, 0, 57]; // 0x70150039

#[derive(Encode, Decode)]
pub struct Payload<T>
where
    T: pallet_external_validators::Config,
{
    pub message_id: [u8; 4],
    pub message: Message<T>,
}

#[derive(Encode, Decode)]
pub enum Message<T>
where
    T: pallet_external_validators::Config,
{
    V1(InboundCommand<T>),
}

#[derive(Encode, Decode)]
pub enum InboundCommand<T>
where
    T: pallet_external_validators::Config,
{
    ReceiveValidators {
        validators: Vec<<T as pallet_external_validators::Config>::ValidatorId>,
        external_index: u64,
    },
}

/// EigenLayer Message Processor
pub struct EigenLayerMessageProcessor<T>(PhantomData<T>);

impl<T> EigenLayerMessageProcessor<T>
where
    T: pallet_external_validators::Config,
{
    pub fn decode_message(mut payload: &[u8]) -> Result<Payload<T>, DispatchError> {
        let decode_result = Payload::<T>::decode_all(&mut payload);
        if let Ok(payload) = decode_result {
            Ok(payload)
        } else {
            Err(DispatchError::Other("unable to parse the message payload"))
        }
    }
}

impl<T, AccountId> MessageProcessor<AccountId> for EigenLayerMessageProcessor<T>
where
    T: pallet_external_validators::Config,
{
    fn can_process_message(_who: &AccountId, message: &SnowbridgeMessage) -> bool {
        let payload = match &message.xcm {
            snowbridge_inbound_queue_primitives::v2::Payload::Raw(payload) => payload,
            snowbridge_inbound_queue_primitives::v2::Payload::CreateAsset {
                token: _,
                network: _,
            } => return false,
        };
        let decode_result = Self::decode_message(payload.as_slice());
        if let Ok(payload) = decode_result {
            payload.message_id == EL_MESSAGE_ID && message.origin == T::AuthorizedOrigin::get()
        } else {
            false
        }
    }

    fn process_message(
        _who: AccountId,
        snow_msg: SnowbridgeMessage,
    ) -> Result<[u8; 32], DispatchError> {
        // Defensively re-check the Ethereum origin before mutating the validator set.
        if snow_msg.origin != T::AuthorizedOrigin::get() {
            return Err(DispatchError::Other("unauthorized validator-set origin"));
        }

        // Extract and decode the raw payload that came from Ethereum
        let payload = match &snow_msg.xcm {
            snowbridge_inbound_queue_primitives::v2::Payload::Raw(payload) => payload,
            snowbridge_inbound_queue_primitives::v2::Payload::CreateAsset {
                token: _,
                network: _,
            } => return Err(DispatchError::Other("Invalid Message")),
        };
        let decode_result = Self::decode_message(payload.as_slice());
        let inner_message = if let Ok(payload) = decode_result {
            payload.message
        } else {
            return Err(DispatchError::Other("unable to parse the message payload"));
        };

        match inner_message {
            Message::V1(InboundCommand::ReceiveValidators {
                validators,
                external_index,
            }) => {
                pallet_external_validators::Pallet::<T>::set_external_validators_inner(
                    validators,
                    external_index,
                )?;
                // Return a 32-byte identifier using the message type ID
                let mut id = [0u8; 32];
                id[..EL_MESSAGE_ID.len()].copy_from_slice(&EL_MESSAGE_ID);
                Ok(id)
            }
        }
    }
}

/// Native Token Transfer Message Processor
/// Handles inbound messages for native token transfers from Ethereum back to DataHaven
pub struct NativeTokenTransferMessageProcessor<T>(PhantomData<T>);

impl<T> NativeTokenTransferMessageProcessor<T>
where
    T: pallet_datahaven_native_transfer::Config + frame_system::Config,
    T::AccountId: From<H160>,
{
    /// Extract account ID from claimer field
    /// For native token transfers, the claimer contains an H160 Ethereum address
    /// that needs to be converted to the runtime's AccountId format
    fn extract_recipient_from_claimer(claimer: &[u8]) -> Result<T::AccountId, DispatchError> {
        // For native token transfers, decode the claimer as an H160 Ethereum address
        let eth_address = H160::decode(&mut &claimer[..])
            .map_err(|_| DispatchError::Other("Invalid Ethereum address in claimer"))?;

        Ok(T::AccountId::from(eth_address))
    }
}

impl<T, AccountId> MessageProcessor<AccountId> for NativeTokenTransferMessageProcessor<T>
where
    T: pallet_datahaven_native_transfer::Config + frame_system::Config,
    T::AccountId: From<H160>,
{
    fn can_process_message(_who: &AccountId, message: &SnowbridgeMessage) -> bool {
        // Check if the native token is registered
        let native_token_id = match T::NativeTokenId::get() {
            Some(id) => id,
            None => return false, // Token not registered
        };

        // Ensure all assets are the native token as ForeignTokenERC20
        !message.assets.is_empty()
            && message.assets.iter().all(|asset| match asset {
                EthereumAsset::ForeignTokenERC20 { token_id, .. } => *token_id == native_token_id,
                _ => false,
            })
    }

    fn process_message(
        _who: AccountId,
        snow_msg: SnowbridgeMessage,
    ) -> Result<[u8; 32], DispatchError> {
        let native_token_id =
            T::NativeTokenId::get().ok_or(DispatchError::Other("Native token not registered"))?;

        // Extract and sum all native token assets
        let token_amount: u128 = snow_msg
            .assets
            .iter()
            .filter_map(|asset| match asset {
                EthereumAsset::ForeignTokenERC20 { token_id, value }
                    if *token_id == native_token_id =>
                {
                    Some(*value)
                }
                _ => None,
            })
            .sum();

        if token_amount == 0 {
            return Err(DispatchError::Other("No native token found in assets"));
        }

        // Extract recipient from claimer field
        let claimer = snow_msg
            .claimer
            .as_ref()
            .ok_or(DispatchError::Other("No claimer specified in message"))?;

        let recipient = Self::extract_recipient_from_claimer(claimer.as_slice())?;

        // Convert amount to balance type
        let balance_amount = token_amount
            .try_into()
            .map_err(|_| DispatchError::Other("Amount conversion failed"))?;

        // Unlock tokens from the sovereign account
        pallet_datahaven_native_transfer::Pallet::<T>::unlock_tokens(&recipient, balance_amount)?;

        // Return a 32-byte identifier using the native transfer message type ID
        let mut id = [0u8; 32];
        id[..NATIVE_TRANSFER_MESSAGE_ID.len()].copy_from_slice(&NATIVE_TRANSFER_MESSAGE_ID);
        Ok(id)
    }
}
