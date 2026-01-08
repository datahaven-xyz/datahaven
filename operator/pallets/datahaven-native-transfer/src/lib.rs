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

//! # DataHaven Native Transfer Pallet
//!
//! This pallet facilitates the transfer of DataHaven native tokens to and from Ethereum.
//!
//! ## Overview
//!
//! The DataHaven Native Transfer Pallet provides the following features:
//! - Transfer DataHaven native tokens to Ethereum via Snowbridge
//! - Lock tokens during outbound transfers
//! - Unlock tokens when they return from Ethereum
//! - Integration with Snowbridge outbound queue for message passing
//!
//! It uses a dedicated Ethereum sovereign account to hold locked tokens during transfers.

#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{
    pallet_prelude::*,
    traits::{
        fungible::{Inspect, Mutate},
        tokens::Preservation,
    },
};
use snowbridge_core::TokenId;
use snowbridge_outbound_queue_primitives::v2::{Command, Message as OutboundMessage, SendMessage};
use sp_core::{H160, H256};
use sp_runtime::{traits::Saturating, BoundedVec};
use sp_std::vec;

pub use pallet::*;

#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

pub mod weights;
pub use weights::WeightInfo;

type BalanceOf<T> =
    <<T as Config>::Currency as Inspect<<T as frame_system::Config>::AccountId>>::Balance;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_system::pallet_prelude::*;
    use frame_system::unique;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// The overarching event type
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// The currency used for reserves
        type Currency: Mutate<Self::AccountId>;

        /// The sovereign account for Ethereum bridge reserves
        /// This should be derived from the Ethereum location using
        /// a location-to-account converter (e.g., HashedDescription)
        #[pallet::constant]
        type EthereumSovereignAccount: Get<Self::AccountId>;

        /// The Snowbridge outbound queue for sending messages to Ethereum
        type OutboundQueue: SendMessage;

        /// Account to receive bridge fees
        type FeeRecipient: Get<Self::AccountId>;

        /// Weight information
        type WeightInfo: WeightInfo;

        /// Origin that can pause/unpause the pallet
        type PauseOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// Provides the native token ID if registered, None if not registered
        type NativeTokenId: Get<Option<TokenId>>;
    }

    #[pallet::storage]
    #[pallet::getter(fn is_paused)]
    /// Whether the pallet is paused
    pub type Paused<T> = StorageValue<_, bool, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// Tokens locked for transfer to Ethereum
        TokensLocked {
            account: T::AccountId,
            amount: BalanceOf<T>,
        },

        /// Tokens unlocked from Ethereum vault
        TokensUnlocked {
            account: T::AccountId,
            amount: BalanceOf<T>,
        },

        /// Tokens transferred to Ethereum
        TokensTransferredToEthereum {
            from: T::AccountId,
            to: H160,
            amount: BalanceOf<T>,
        },

        /// Pallet paused
        Paused,

        /// Pallet unpaused
        Unpaused,
    }

    #[pallet::error]
    pub enum Error<T> {
        /// Insufficient balance to lock
        InsufficientBalance,
        /// Arithmetic overflow in calculation
        Overflow,
        /// Failed to send message to Ethereum
        SendMessageFailed,
        /// Invalid Ethereum address
        InvalidEthereumAddress,
        /// Invalid amount
        InvalidAmount,
        /// Transfers are currently disabled
        TransfersDisabled,
        /// Fee cannot be zero
        ZeroFee,
        /// Native token has not been registered on Ethereum yet
        TokenNotRegistered,
        /// Insufficient balance in Ethereum sovereign account
        InsufficientSovereignBalance,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Transfer DataHaven native tokens to Ethereum
        ///
        /// Locks the tokens in the vault and sends a message through Snowbridge
        /// to mint the equivalent tokens on Ethereum.
        ///
        /// Parameters:
        /// - `origin`: The account initiating the transfer
        /// - `recipient`: The Ethereum address to receive the tokens
        /// - `amount`: The amount of tokens to transfer
        /// - `fee`: The fee to incentivize relayers (in native tokens)
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::transfer_to_ethereum())]
        pub fn transfer_to_ethereum(
            origin: OriginFor<T>,
            recipient: H160,
            amount: BalanceOf<T>,
            fee: BalanceOf<T>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            ensure!(!Paused::<T>::get(), Error::<T>::TransfersDisabled);

            // Get the token ID - fails if not registered
            let token_id = T::NativeTokenId::get().ok_or(Error::<T>::TokenNotRegistered)?;

            ensure!(amount > Zero::zero(), Error::<T>::InvalidAmount);
            ensure!(fee > Zero::zero(), Error::<T>::ZeroFee);
            ensure!(
                recipient != H160::zero(),
                Error::<T>::InvalidEthereumAddress
            );

            // Transfer fee to recipient
            T::Currency::transfer(&who, &T::FeeRecipient::get(), fee, Preservation::Preserve)?;

            // Lock tokens in the sovereign account
            Self::lock_tokens(&who, amount)?;

            // Build and send the message
            let message = Self::build_mint_message(token_id, recipient, amount, fee)?;
            T::OutboundQueue::validate(&message)
                .and_then(|ticket| T::OutboundQueue::deliver(ticket))
                .map_err(|_| Error::<T>::SendMessageFailed)?;

            Self::deposit_event(Event::TokensTransferredToEthereum {
                from: who,
                to: recipient,
                amount,
            });

            Ok(())
        }

        /// Pause the pallet, preventing all transfers
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::pause())]
        pub fn pause(origin: OriginFor<T>) -> DispatchResult {
            T::PauseOrigin::ensure_origin(origin)?;

            Paused::<T>::put(true);

            Self::deposit_event(Event::Paused);

            Ok(())
        }

        /// Unpause the pallet, allowing transfers again
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::unpause())]
        pub fn unpause(origin: OriginFor<T>) -> DispatchResult {
            T::PauseOrigin::ensure_origin(origin)?;

            Paused::<T>::put(false);

            Self::deposit_event(Event::Unpaused);

            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// Build outbound message for Snowbridge
        fn build_mint_message(
            token_id: TokenId,
            recipient: H160,
            amount: BalanceOf<T>,
            fee: BalanceOf<T>,
        ) -> Result<OutboundMessage, Error<T>> {
            // Convert amounts to u128
            let amount_u128: u128 = amount.try_into().map_err(|_| Error::<T>::Overflow)?;
            let fee_u128: u128 = fee.try_into().map_err(|_| Error::<T>::Overflow)?;

            // Create the mint command
            let command = Command::MintForeignToken {
                token_id,
                recipient,
                amount: amount_u128,
            };

            // Create bounded vector of commands
            let commands =
                BoundedVec::try_from(vec![command]).map_err(|_| Error::<T>::SendMessageFailed)?;

            // Build the outbound message
            Ok(OutboundMessage {
                origin: H256::zero(),
                id: unique(commands.encode()).into(),
                fee: fee_u128,
                commands,
            })
        }

        /// Lock tokens for transfer to Ethereum
        ///
        /// Transfers tokens from a user to the Ethereum sovereign account and updates tracking
        pub fn lock_tokens(who: &T::AccountId, amount: BalanceOf<T>) -> DispatchResult {
            // Transfer to Ethereum sovereign account
            T::Currency::transfer(
                who,
                &T::EthereumSovereignAccount::get(),
                amount,
                Preservation::Preserve,
            )?;

            Self::deposit_event(Event::TokensLocked {
                account: who.clone(),
                amount,
            });

            Ok(())
        }

        /// Unlock tokens returning from Ethereum
        ///
        /// Transfers tokens from the Ethereum sovereign account back to user
        pub fn unlock_tokens(who: &T::AccountId, amount: BalanceOf<T>) -> DispatchResult {
            let sovereign = T::EthereumSovereignAccount::get();
            let balance = T::Currency::balance(&sovereign);
            let minimum_balance = T::Currency::minimum_balance();
            let available_balance = balance.saturating_sub(minimum_balance);

            // Allow unlocking only from funds that exceed the existential buffer.
            ensure!(
                available_balance >= amount,
                Error::<T>::InsufficientSovereignBalance
            );

            // Transfer from the Ethereum sovereign account
            T::Currency::transfer(&sovereign, who, amount, Preservation::Preserve)?;

            Self::deposit_event(Event::TokensUnlocked {
                account: who.clone(),
                amount,
            });

            Ok(())
        }

        /// Get the balance of locked tokens in the Ethereum sovereign account
        /// This represents the total amount of tokens locked for transfers to Ethereum
        pub fn total_locked_balance() -> BalanceOf<T> {
            <T::Currency as Inspect<T::AccountId>>::balance(&T::EthereumSovereignAccount::get())
        }

        /// Get the Ethereum sovereign account address
        /// Useful for monitoring and debugging
        pub fn ethereum_sovereign_account() -> T::AccountId {
            T::EthereumSovereignAccount::get()
        }
    }
}
