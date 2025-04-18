// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use super::*;
use frame_support::traits::Get;
use sp_runtime::DispatchError;
use sp_std::marker::PhantomData;
use xcm::prelude::{Location, Parachain, SendError, XcmHash};

pub struct DefaultMessageProcessor<T>(pub PhantomData<T>);

impl<AccountId, T> MessageProcessor<AccountId> for DefaultMessageProcessor<T>
where
    T: crate::Config<AccountId = AccountId>,
{
    fn can_process_message(_who: &AccountId, message: &Message) -> bool {
        T::MessageConverter::convert(message.clone()).is_ok()
    }

    fn process_message(_who: AccountId, message: Message) -> Result<[u8; 32], DispatchError> {
        // Simply convert the message and return a dummy ID
        T::MessageConverter::convert(message.clone())
            .map(|_| [0u8; 32])
            .map_err(|_| DispatchError::Other("Failed to convert message"))
    }
}

/// A message processor that converts messages to XCM and forwards them to AssetHub
pub struct XcmMessageProcessor<T>(pub PhantomData<T>);

impl<AccountId, T> MessageProcessor<AccountId> for XcmMessageProcessor<T>
where
    T: crate::Config<AccountId = AccountId>,
{
    fn can_process_message(_who: &AccountId, message: &Message) -> bool {
        // Check if the message can be converted to XCM
        T::MessageConverter::convert(message.clone()).is_ok()
    }

    fn process_message(who: AccountId, message: Message) -> Result<[u8; 32], DispatchError> {
        // Convert the message to XCM
        let xcm = T::MessageConverter::convert(message).map_err(|error| Error::<T>::from(error))?;

        // Forward XCM to AssetHub
        let dest = Location::new(1, [Parachain(T::AssetHubParaId::get())]);
        let message_id = Self::send_xcm(dest.clone(), &who, xcm.clone()).map_err(|error| {
            tracing::error!(target: LOG_TARGET, ?error, ?dest, ?xcm, "XCM send failed with error");
            Error::<T>::from(error)
        })?;

        // Return the message_id
        Ok(message_id)
    }
}

impl<T: crate::Config> XcmMessageProcessor<T> {
    fn send_xcm(
        dest: Location,
        fee_payer: &T::AccountId,
        xcm: Xcm<()>,
    ) -> Result<XcmHash, SendError> {
        let (ticket, fee) = validate_send::<T::XcmSender>(dest, xcm)?;
        let fee_payer = T::AccountToLocation::try_convert(fee_payer).map_err(|err| {
            tracing::error!(
                target: LOG_TARGET,
                ?err,
                "Failed to convert account to XCM location",
            );
            SendError::NotApplicable
        })?;
        T::XcmExecutor::charge_fees(fee_payer.clone(), fee.clone()).map_err(|error| {
            tracing::error!(
                target: LOG_TARGET,
                ?error,
                "Charging fees failed with error",
            );
            SendError::Fees
        })?;
        T::XcmSender::deliver(ticket)
    }
}
