use crate::{Error, Event, LOG_TARGET};
use codec::DecodeAll;
use core::marker::PhantomData;
use snowbridge_core::Channel;
use snowbridge_router_primitives::inbound::envelope::Envelope;
use snowbridge_router_primitives::inbound::{MessageProcessor, VersionedXcmMessage};
use sp_runtime::DispatchError;

pub struct XcmMessageProcessor<T>(PhantomData<T>);

impl<T> MessageProcessor for XcmMessageProcessor<T>
where
    T: crate::Config,
{
    fn can_process_message(_channel: &Channel, envelope: &Envelope) -> bool {
        VersionedXcmMessage::decode_all(&mut envelope.payload.as_ref()).is_ok()
    }

    fn process_message(channel: Channel, envelope: Envelope) -> Result<(), DispatchError> {
        // Decode message into XCM
        let (xcm, fee) = match VersionedXcmMessage::decode_all(&mut envelope.payload.as_ref()) {
            Ok(message) => crate::Pallet::<T>::do_convert(envelope.message_id, message)?,
            Err(_) => return Err(Error::<T>::InvalidPayload.into()),
        };

        log::info!(
            target: LOG_TARGET,
            "💫 xcm decoded as {:?} with fee {:?}",
            xcm,
            fee
        );

        // Burning fees for teleport
        crate::Pallet::<T>::burn_fees(channel.para_id, fee)?;

        // Attempt to send XCM to a dest parachain
        let message_id = crate::Pallet::<T>::send_xcm(xcm, channel.para_id)?;

        crate::Pallet::<T>::deposit_event(Event::MessageReceived {
            channel_id: envelope.channel_id,
            nonce: envelope.nonce,
            message_id,
            fee_burned: fee,
        });

        Ok(())
    }
}
