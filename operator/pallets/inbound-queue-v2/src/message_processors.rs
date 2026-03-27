// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use super::*;
use codec::Encode;
use core::marker::PhantomData;
use frame_support::traits::Get;
use sp_runtime::traits::TryConvert;
use sp_runtime::DispatchError;
use xcm::prelude::{ExecuteXcm, Location, Parachain, SendError, SendXcm, XcmHash};

/// A message processor that simply returns the Blake2_256 hash of the SCALE encoded message
pub struct RemarkMessageProcessor<T>(pub PhantomData<T>);

impl<AccountId, T> MessageProcessor<AccountId> for RemarkMessageProcessor<T>
where
    T: crate::Config<AccountId = AccountId>,
{
    fn can_process_message(_who: &AccountId, _message: &Message) -> bool {
        true
    }

    fn process_message(_who: AccountId, _message: Message) -> Result<[u8; 32], DispatchError> {
        // Simply return the Blake2_256 hash of the SCALE encoded message
        let hash = sp_core::hashing::blake2_256(_message.encode().as_slice());
        Ok(hash)
    }
}

/// A message processor that converts messages to XCM and forwards them to AssetHub
/// Generic parameters: T = pallet Config, Sender = XCM sender, Executor = fee handler,
/// Converter = message converter, AccountToLocation = account-to-location converter
pub struct XcmMessageProcessor<T, Sender, Executor, Converter, AccountToLocation, AssetHubParaId>(
    pub  PhantomData<(
        T,
        Sender,
        Executor,
        Converter,
        AccountToLocation,
        AssetHubParaId,
    )>,
);

impl<AccountId, T, Sender, Executor, Converter, AccountToLocation, AssetHubParaId>
    MessageProcessor<AccountId>
    for XcmMessageProcessor<T, Sender, Executor, Converter, AccountToLocation, AssetHubParaId>
where
    T: crate::Config<AccountId = AccountId>,
    Sender: SendXcm,
    Executor: ExecuteXcm<T::RuntimeCall>,
    Converter: ConvertMessage,
    AccountToLocation: for<'a> TryConvert<&'a AccountId, Location>,
    AssetHubParaId: Get<u32>,
{
    fn can_process_message(_who: &AccountId, message: &Message) -> bool {
        // Check if the message can be converted to XCM
        Converter::convert(message.clone()).is_ok()
    }

    fn process_message(who: AccountId, message: Message) -> Result<[u8; 32], DispatchError> {
        // Process the message and return its ID
        let id = Self::process_xcm(who, message)?;
        Ok(id)
    }
}

impl<T, Sender, Executor, Converter, AccountToLocation, AssetHubParaId>
    XcmMessageProcessor<T, Sender, Executor, Converter, AccountToLocation, AssetHubParaId>
where
    T: crate::Config,
    Sender: SendXcm,
    Executor: ExecuteXcm<T::RuntimeCall>,
    Converter: ConvertMessage,
    AccountToLocation: for<'a> TryConvert<&'a T::AccountId, Location>,
    AssetHubParaId: Get<u32>,
{
    /// Process a message and return the message ID
    pub fn process_xcm(who: T::AccountId, message: Message) -> Result<XcmHash, DispatchError> {
        // Convert the message to XCM
        let xcm = Converter::convert(message).map_err(|error| Error::<T>::from(error))?;

        // Forward XCM to AssetHub
        let dest = Location::new(1, [Parachain(AssetHubParaId::get())]);
        let message_id = Self::send_xcm(dest.clone(), &who, xcm.clone()).map_err(|error| {
            tracing::error!(target: LOG_TARGET, ?error, ?dest, ?xcm, "XCM send failed with error");
            Error::<T>::from(error)
        })?;

        // Return the message_id
        Ok(message_id)
    }
}

impl<T, Sender, Executor, Converter, AccountToLocation, AssetHubParaId>
    XcmMessageProcessor<T, Sender, Executor, Converter, AccountToLocation, AssetHubParaId>
where
    T: crate::Config,
    Sender: SendXcm,
    Executor: ExecuteXcm<T::RuntimeCall>,
    Converter: ConvertMessage,
    AccountToLocation: for<'a> TryConvert<&'a T::AccountId, Location>,
    AssetHubParaId: Get<u32>,
{
    fn send_xcm(
        dest: Location,
        fee_payer: &T::AccountId,
        xcm: Xcm<()>,
    ) -> Result<XcmHash, SendError> {
        let (ticket, fee) = validate_send::<Sender>(dest, xcm)?;
        let fee_payer = AccountToLocation::try_convert(fee_payer).map_err(|err| {
            tracing::error!(
                target: LOG_TARGET,
                ?err,
                "Failed to convert account to XCM location",
            );
            SendError::NotApplicable
        })?;
        Executor::charge_fees(fee_payer.clone(), fee.clone()).map_err(|error| {
            tracing::error!(
                target: LOG_TARGET,
                ?error,
                "Charging fees failed with error",
            );
            SendError::Fees
        })?;
        Sender::deliver(ticket)
    }
}
