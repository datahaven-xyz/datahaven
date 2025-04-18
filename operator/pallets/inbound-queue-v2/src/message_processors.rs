// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use super::*;
use sp_runtime::DispatchResult;
use sp_std::marker::PhantomData;

pub struct DefaultMessageProcessor<T>(pub PhantomData<T>);

impl<AccountId, T> MessageProcessor<AccountId> for DefaultMessageProcessor<T>
where
    T: crate::Config<AccountId = AccountId>,
{
    fn can_process_message(_who: &AccountId, message: &Message) -> bool {
        T::MessageConverter::convert(message.clone()).is_ok()
    }

    fn process_message(_who: AccountId, message: Message) -> DispatchResult {
        // Simply convert the message and return success
        T::MessageConverter::convert(message.clone())
            .map(|_| ())
            .map_err(|_| sp_runtime::DispatchError::Other("Failed to convert message"))
    }
}
