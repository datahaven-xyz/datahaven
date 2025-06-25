#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::pallet_prelude::*;
use parity_scale_codec::DecodeAll;
use snowbridge_inbound_queue_primitives::v2::{Message as SnowbridgeMessage, MessageProcessor};
use sp_std::vec::Vec;

// Message ID. This is not expected to change and its arbitrary bytes defined here.
// It should match the EL_MESSAGE_ID in DataHavenSnowbridgeMessages.sol
pub const EL_MESSAGE_ID: [u8; 4] = [112, 21, 0, 56]; // 0x70150038

#[derive(Encode, Decode)]
pub struct Payload<T>
where
    T: pallet_external_validators::Config,
{
    pub message: Message<T>,
    pub message_id: [u8; 4],
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
            payload.message_id == EL_MESSAGE_ID
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
        let decode_result = Self::decode_message(payload.as_slice());
        let message = if let Ok(payload) = decode_result {
            payload.message
        } else {
            return Err(DispatchError::Other("unable to parse the message payload"));
        };

        match message {
            Message::V1(InboundCommand::ReceiveValidators {
                validators,
                external_index,
            }) => {
                pallet_external_validators::Pallet::<T>::set_external_validators_inner(
                    validators,
                    external_index,
                )?;
                let mut id = [0u8; 32];
                id[..EL_MESSAGE_ID.len()].copy_from_slice(&EL_MESSAGE_ID);
                Ok(id)
            }
        }
    }
}
