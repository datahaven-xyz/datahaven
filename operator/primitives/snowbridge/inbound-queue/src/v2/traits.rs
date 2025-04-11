// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025 Snowfork <hello@snowfork.com>
// SPDX-FileCopyrightText: 2021-2025 Parity Technologies (UK) Ltd.
use super::Message;
use sp_core::RuntimeDebug;
use sp_runtime::{DispatchError, DispatchResult};
use xcm::latest::Xcm;

/// Converts an inbound message from Ethereum to an XCM message that can be
/// executed on a parachain.
pub trait ConvertMessage {
    fn convert(message: Message) -> Result<Xcm<()>, ConvertMessageError>;
}

/// Reason why a message conversion failed.
#[derive(Copy, Clone, RuntimeDebug, PartialEq)]
pub enum ConvertMessageError {
    /// Invalid foreign ERC-20 token ID
    InvalidAsset,
    /// Cannot reachor a foreign ERC-20 asset location.
    CannotReanchor,
    /// Invalid network specified (not from Ethereum)
    InvalidNetwork,
}

pub trait MessageProcessor<AccountId> {
    /// Lightweight function to check if this processor can handle the message
    fn can_process_message(who: &AccountId, message: &Message) -> bool;
    /// Process the message
    fn process_message(who: AccountId, message: Message) -> DispatchResult;
}

#[impl_trait_for_tuples::impl_for_tuples(10)]
impl<AccountId> MessageProcessor<AccountId> for Tuple {
    fn can_process_message(who: &AccountId, message: &Message) -> bool {
        for_tuples!( #(
 			match Tuple::can_process_message(&who, &message) {
				true => {
					return true;
				},
				_ => {}
			}
		)* );

        false
    }

    fn process_message(who: AccountId, message: Message) -> DispatchResult {
        for_tuples!( #(
 			match Tuple::can_process_message(&who, &message) {
				true => {
					return Tuple::process_message(who, message)
				},
				_ => {}
			}
		)* );

        Err(DispatchError::Other("No handler found for message!"))
    }
}
