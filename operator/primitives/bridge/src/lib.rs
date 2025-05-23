#![cfg_attr(not(feature = "std"), no_std)]

use core::fmt::Debug;
use frame_support::pallet_prelude::*;
use log::info;
use parity_scale_codec::DecodeAll;
use snowbridge_inbound_queue_primitives::v2::{Message as SnowbridgeMessage, MessageProcessor};
use sp_std::vec::Vec;

pub const EL_MESSAGE_ID: [u8; 4] = [112, 21, 0, 56];

#[derive(Encode, Decode, Debug)]
pub struct NewValidatorSet {
    nonce: u64,
    topic: [u8; 32],
    payload: NewValidatorSetPayload,
}

#[derive(Encode, Decode, Debug)]
pub struct NewValidatorSetPayload {
    message_id: [u8; 4],
    message_version: u8,
    command: u8,
    validators: Vec<[u8; 32]>,
    external_index: u64,
}

/// EigenLayer Message Processor
pub struct EigenLayerMessageProcessor<T>(PhantomData<T>);

impl<T, AccountId> MessageProcessor<AccountId> for EigenLayerMessageProcessor<T>
where
    T: pallet_external_validators::Config + Debug,
    <T as pallet_external_validators::Config>::ValidatorId: From<[u8; 32]>,
{
    fn can_process_message(_who: &AccountId, message: &SnowbridgeMessage) -> bool {
        let payload = match &message.xcm {
            snowbridge_inbound_queue_primitives::v2::Payload::Raw(payload) => payload,
            snowbridge_inbound_queue_primitives::v2::Payload::CreateAsset {
                token: _,
                network: _,
            } => return false,
        };
        let decode_result = NewValidatorSet::decode_all(&mut payload.as_slice());
        if let Ok(message) = decode_result {
            message.payload.message_id == EL_MESSAGE_ID
        } else {
            false
        }
    }

    fn process_message(
        _who: AccountId,
        message: SnowbridgeMessage,
    ) -> Result<[u8; 32], DispatchError> {
        let payload = match &message.xcm {
            snowbridge_inbound_queue_primitives::v2::Payload::Raw(payload) => payload,
            snowbridge_inbound_queue_primitives::v2::Payload::CreateAsset {
                token: _,
                network: _,
            } => return Err(DispatchError::Other("Invalid Message")),
        };
        let decode_result = NewValidatorSet::decode_all(&mut payload.as_slice());
        let message = if let Ok(message) = decode_result {
            message
        } else {
            return Err(DispatchError::Other("unable to parse the message payload"));
        };

        let validators: Vec<<T as pallet_external_validators::Config>::ValidatorId> = message
            .payload
            .validators
            .into_iter()
            .map(Into::into)
            .collect();

        pallet_external_validators::Pallet::<T>::set_external_validators_inner(
            validators,
            message.payload.external_index,
        )?;
        let mut id = [0u8; 32];
        id[..EL_MESSAGE_ID.len()].copy_from_slice(&EL_MESSAGE_ID);
        Ok(id)
    }
}
