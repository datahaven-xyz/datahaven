// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Governance API for controlling the Ethereum side of the bridge
//!
//! # Extrinsics
//!
//! ## Governance
//!
//! * [`Call::upgrade`]: Upgrade the Gateway contract on Ethereum.
//! * [`Call::set_operating_mode`]: Set the operating mode of the Gateway contract
//!
//! ## Polkadot-native tokens on Ethereum
//!
//! Tokens deposited on AssetHub pallet can be bridged to Ethereum as wrapped ERC20 tokens. As a
//! prerequisite, the token should be registered first.
//!
//! * [`Call::register_token`]: Register a token location as a wrapped ERC20 contract on Ethereum.
#![cfg_attr(not(feature = "std"), no_std)]
#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

pub mod api;
pub mod weights;
pub use weights::*;

use frame_support::{pallet_prelude::*, traits::EnsureOrigin};
use frame_system::pallet_prelude::*;
use snowbridge_core::{AgentIdOf as LocationHashOf, AssetMetadata, TokenId, TokenIdOf};
use snowbridge_outbound_queue_primitives::{
    v2::{Command, Initializer, Message, SendMessage},
    OperatingMode, SendError,
};
use snowbridge_pallet_system::{ForeignToNativeId, NativeToForeignId};
use sp_core::{H160, H256};
use sp_io::hashing::blake2_256;
use sp_runtime::traits::MaybeEquivalence;
use sp_std::prelude::*;
use xcm::prelude::*;
use xcm_executor::traits::ConvertLocation;

#[cfg(feature = "runtime-benchmarks")]
use frame_support::traits::OriginTrait;

pub use pallet::*;

pub type AccountIdOf<T> = <T as frame_system::Config>::AccountId;
#[cfg(feature = "runtime-benchmarks")]
pub trait BenchmarkHelper<O>
where
    O: OriginTrait,
{
    fn make_xcm_origin(location: Location) -> O;
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config + snowbridge_pallet_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Send messages to Ethereum
        type OutboundQueue: SendMessage;

        /// Origin check for XCM locations that transact with this pallet
        type FrontendOrigin: EnsureOrigin<Self::RuntimeOrigin, Success = Location>;

        /// Origin for governance calls
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin, Success = Location>;

        type WeightInfo: WeightInfo;
        #[cfg(feature = "runtime-benchmarks")]
        type Helper: BenchmarkHelper<Self::RuntimeOrigin>;
    }

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// An Upgrade message was sent to the Gateway
        Upgrade {
            impl_address: H160,
            impl_code_hash: H256,
            initializer_params_hash: H256,
        },
        /// An SetOperatingMode message was sent to the Gateway
        SetOperatingMode { mode: OperatingMode },
        /// Register Polkadot-native token as a wrapped ERC20 token on Ethereum
        RegisterToken {
            /// Location of Polkadot-native token
            location: VersionedLocation,
            /// ID of Polkadot-native token on Ethereum
            foreign_token_id: H256,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// Location could not be reachored
        LocationReanchorFailed,
        /// A token location could not be converted to a token ID.
        LocationConversionFailed,
        /// A `VersionedLocation` could not be converted into a `Location`.
        UnsupportedLocationVersion,
        /// An XCM could not be sent, due to a `SendError`.
        Send(SendError),
        /// The gateway contract upgrade message could not be sent due to invalid upgrade
        /// parameters.
        InvalidUpgradeParameters,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Sends command to the Gateway contract to upgrade itself with a new implementation
        /// contract
        ///
        /// Fee required: No
        ///
        /// - `origin`: Must be `Root`.
        /// - `impl_address`: The address of the implementation contract.
        /// - `impl_code_hash`: The codehash of the implementation contract.
        /// - `initializer`: Optionally call an initializer on the implementation contract.
        #[pallet::call_index(3)]
        #[pallet::weight((<T as pallet::Config>::WeightInfo::upgrade(), DispatchClass::Operational))]
        pub fn upgrade(
            origin: OriginFor<T>,
            impl_address: H160,
            impl_code_hash: H256,
            initializer: Initializer,
        ) -> DispatchResult {
            let origin_location = T::GovernanceOrigin::ensure_origin(origin)?;
            let origin = Self::location_to_message_origin(origin_location)?;

            ensure!(
                !impl_address.eq(&H160::zero()) && !impl_code_hash.eq(&H256::zero()),
                Error::<T>::InvalidUpgradeParameters
            );

            let initializer_params_hash: H256 = blake2_256(initializer.params.as_ref()).into();

            let command = Command::Upgrade {
                impl_address,
                impl_code_hash,
                initializer,
            };
            Self::send(origin, command, 0)?;

            Self::deposit_event(Event::<T>::Upgrade {
                impl_address,
                impl_code_hash,
                initializer_params_hash,
            });
            Ok(())
        }

        /// Sends a message to the Gateway contract to change its operating mode
        ///
        /// Fee required: No
        ///
        /// - `origin`: Must be `GovernanceOrigin`
        #[pallet::call_index(4)]
        #[pallet::weight((<T as pallet::Config>::WeightInfo::set_operating_mode(), DispatchClass::Operational))]
        pub fn set_operating_mode(origin: OriginFor<T>, mode: OperatingMode) -> DispatchResult {
            let origin_location = T::GovernanceOrigin::ensure_origin(origin)?;
            let origin = Self::location_to_message_origin(origin_location)?;

            let command = Command::SetOperatingMode { mode };
            Self::send(origin, command, 0)?;

            Self::deposit_event(Event::<T>::SetOperatingMode { mode });
            Ok(())
        }

        /// Registers a Polkadot-native token as a wrapped ERC20 token on Ethereum.
        ///
        /// The system frontend pallet on AH proxies this call to BH.
        ///
        /// - `sender`: The original sender initiating the call on AH
        /// - `asset_id`: Location of the asset (relative to this chain)
        /// - `metadata`: Metadata to include in the instantiated ERC20 contract on Ethereum
        /// - `fee`: Ether to pay for the execution cost on Ethereum
        #[pallet::call_index(0)]
        #[pallet::weight(<T as pallet::Config>::WeightInfo::register_token())]
        pub fn register_token(
            origin: OriginFor<T>,
            sender: Box<VersionedLocation>,
            asset_id: Box<VersionedLocation>,
            metadata: AssetMetadata,
        ) -> DispatchResult {
            T::FrontendOrigin::ensure_origin(origin)?;

            let sender_location: Location = (*sender)
                .try_into()
                .map_err(|_| Error::<T>::UnsupportedLocationVersion)?;
            let asset_location: Location = (*asset_id)
                .try_into()
                .map_err(|_| Error::<T>::UnsupportedLocationVersion)?;

            let location = Self::reanchor(asset_location)?;
            let token_id = TokenIdOf::convert_location(&location)
                .ok_or(Error::<T>::LocationConversionFailed)?;

            if !ForeignToNativeId::<T>::contains_key(token_id) {
                NativeToForeignId::<T>::insert(location.clone(), token_id);
                ForeignToNativeId::<T>::insert(token_id, location.clone());
            }

            let command = Command::RegisterForeignToken {
                token_id,
                name: metadata.name.into_inner(),
                symbol: metadata.symbol.into_inner(),
                decimals: metadata.decimals,
            };

            let message_origin = Self::location_to_message_origin(sender_location)?;
            Self::send(message_origin, command, 0)?;

            Self::deposit_event(Event::<T>::RegisterToken {
                location: location.into(),
                foreign_token_id: token_id,
            });

            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// Send `command` to the Gateway from a specific origin/agent
        fn send(origin: H256, command: Command, fee: u128) -> DispatchResult {
            let mut message = Message {
                origin,
                id: Default::default(),
                fee,
                commands: BoundedVec::try_from(vec![command]).unwrap(),
            };
            let hash = sp_io::hashing::blake2_256(&message.encode());
            message.id = hash.into();

            let ticket = <T as pallet::Config>::OutboundQueue::validate(&message)
                .map_err(|err| Error::<T>::Send(err))?;

            <T as pallet::Config>::OutboundQueue::deliver(ticket)
                .map_err(|err| Error::<T>::Send(err))?;
            Ok(())
        }

        /// Reanchor the `location` in context of ethereum
        pub fn reanchor(location: Location) -> Result<Location, Error<T>> {
            location
                .reanchored(&T::EthereumLocation::get(), &T::UniversalLocation::get())
                .map_err(|_| Error::<T>::LocationReanchorFailed)
        }

        pub fn location_to_message_origin(location: Location) -> Result<H256, Error<T>> {
            let reanchored_location = Self::reanchor(location)?;
            LocationHashOf::convert_location(&reanchored_location)
                .ok_or(Error::<T>::LocationConversionFailed)
        }
    }

    impl<T: Config> MaybeEquivalence<TokenId, Location> for Pallet<T> {
        fn convert(foreign_id: &TokenId) -> Option<Location> {
            ForeignToNativeId::<T>::get(foreign_id)
        }
        fn convert_back(location: &Location) -> Option<TokenId> {
            NativeToForeignId::<T>::get(location)
        }
    }
}
