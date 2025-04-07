#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::pallet_prelude::*;
use frame_system::RawOrigin;
use parity_scale_codec::DecodeAll;
use snowbridge_core::Channel;
use snowbridge_router_primitives::inbound::{envelope::Envelope, MessageProcessor};

pub const EL_MESSAGE_ID: [u8; 4] = [112, 21, 0, 56];

#[derive(Encode, Decode)]
pub struct Payload<T>
where
    T: pallet_validator_set::Config,
{
    message: Message<T>,
    message_id: [u8; 4],
}

#[derive(Encode, Decode)]
pub enum Message<T>
where
    T: pallet_validator_set::Config,
{
    V1(InboundCommand<T>),
}

#[derive(Encode, Decode)]
pub enum InboundCommand<T>
where
    T: pallet_validator_set::Config,
{
    SetValidators(Vec<T::AccountId>),
}

pub struct ELMessageProcessor<T>(PhantomData<T>);

impl<T> MessageProcessor for ELMessageProcessor<T>
where
    T: pallet_validator_set::Config,
{
    fn can_process_message(_channel: &Channel, envelope: &Envelope) -> bool {
        let decode_result = Payload::<T>::decode_all(&mut envelope.payload.as_slice());
        if let Ok(payload) = decode_result {
            payload.message_id == EL_MESSAGE_ID
        } else {
            false
        }
    }

    fn process_message(_channel: Channel, envelope: Envelope) -> Result<(), DispatchError> {
        let decode_result = Payload::<T>::decode_all(&mut envelope.payload.as_slice());
        let message = if let Ok(payload) = decode_result {
            payload.message
        } else {
            return Err(DispatchError::Other("unable to parse the envelope payload"));
        };

        match message {
            Message::V1(InboundCommand::SetValidators(validators)) => {
                pallet_validator_set::Pallet::<T>::set_validators(
                    RawOrigin::Root.into(),
                    validators,
                )?;
                Ok(())
            }
        }
    }
}
