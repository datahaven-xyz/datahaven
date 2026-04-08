// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Governance API for controlling the Ethereum side of the bridge
//!
//! # Extrinsics
//!
//! ## Governance
//!
//! Only Polkadot governance itself can call these extrinsics. Delivery fees are waived.
//!
//! * [`Call::upgrade`]`: Upgrade the gateway contract
//! * [`Call::set_operating_mode`]: Update the operating mode of the gateway contract
//!
//! ## Polkadot-native tokens on Ethereum
//!
//! Tokens deposited on AssetHub pallet can be bridged to Ethereum as wrapped ERC20 tokens. As a
//! prerequisite, the token should be registered first.
//!
//! * [`Call::register_token`]: Register a token location as a wrapped ERC20 contract on Ethereum.
#![cfg_attr(not(feature = "std"), no_std)]
extern crate alloc;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;
pub mod migration;

pub mod api;
pub mod weights;
pub use weights::*;

use alloc::boxed::Box;
use frame_support::{
    pallet_prelude::*,
    traits::{
        fungible::{Inspect, Mutate},
        tokens::Preservation,
        Contains, EnsureOrigin,
    },
};
use frame_system::pallet_prelude::*;
use snowbridge_core::{
    meth, AgentId, AssetMetadata, Channel, ChannelId, ParaId,
    PricingParameters as PricingParametersRecord, TokenId, TokenIdOf, PRIMARY_GOVERNANCE_CHANNEL,
    SECONDARY_GOVERNANCE_CHANNEL,
};
use snowbridge_outbound_queue_primitives::{
    v1::{Command, Initializer, Message, SendMessage},
    OperatingMode, SendError,
};
use sp_core::{RuntimeDebug, H160, H256};
use sp_io::hashing::blake2_256;
use sp_runtime::{traits::MaybeEquivalence, DispatchError, SaturatedConversion};
use xcm::prelude::*;
use xcm_executor::traits::ConvertLocation;

#[cfg(feature = "runtime-benchmarks")]
use frame_support::traits::OriginTrait;

pub use pallet::*;

pub type BalanceOf<T> =
    <<T as pallet::Config>::Token as Inspect<<T as frame_system::Config>::AccountId>>::Balance;
pub type AccountIdOf<T> = <T as frame_system::Config>::AccountId;
pub type PricingParametersOf<T> = PricingParametersRecord<BalanceOf<T>>;

/// Hash the location to produce an agent id
pub fn agent_id_of<T: Config>(location: &Location) -> Result<H256, DispatchError> {
    T::AgentIdOf::convert_location(location).ok_or(Error::<T>::LocationConversionFailed.into())
}

#[cfg(feature = "runtime-benchmarks")]
pub trait BenchmarkHelper<O>
where
    O: OriginTrait,
{
    fn make_xcm_origin(location: Location) -> O;
}

/// Whether a fee should be withdrawn to an account for sending an outbound message
#[derive(Clone, PartialEq, RuntimeDebug)]
pub enum PaysFee<T>
where
    T: Config,
{
    /// Fully charge includes (local + remote fee)
    Yes(AccountIdOf<T>),
    /// Partially charge includes local fee only
    Partial(AccountIdOf<T>),
    /// No charge
    No,
}

#[frame_support::pallet]
pub mod pallet {
    use frame_support::dispatch::PostDispatchInfo;
    use snowbridge_core::StaticLookup;
    use sp_core::U256;

    use super::*;

    #[pallet::pallet]
    #[pallet::storage_version(migration::STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Send messages to Ethereum
        type OutboundQueue: SendMessage<Balance = BalanceOf<Self>>;

        /// Origin check for XCM locations that can create agents
        type SiblingOrigin: EnsureOrigin<Self::RuntimeOrigin, Success = Location>;

        /// Converts Location to AgentId
        type AgentIdOf: ConvertLocation<AgentId>;

        /// Token reserved for control operations
        type Token: Mutate<Self::AccountId>;

        /// TreasuryAccount to collect fees
        #[pallet::constant]
        type TreasuryAccount: Get<Self::AccountId>;

        /// Number of decimal places of local currency
        type DefaultPricingParameters: Get<PricingParametersOf<Self>>;

        /// Cost of delivering a message from Ethereum
        #[pallet::constant]
        type InboundDeliveryCost: Get<BalanceOf<Self>>;

        type WeightInfo: WeightInfo;

        /// This chain's Universal Location.
        type UniversalLocation: Get<InteriorLocation>;

        // The bridges configured Ethereum location
        type EthereumLocation: Get<Location>;

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
            initializer_params_hash: Option<H256>,
        },
        /// An CreateAgent message was sent to the Gateway
        CreateAgent {
            location: Box<Location>,
            agent_id: AgentId,
        },
        /// An CreateChannel message was sent to the Gateway
        CreateChannel {
            channel_id: ChannelId,
            agent_id: AgentId,
        },
        /// An UpdateChannel message was sent to the Gateway
        UpdateChannel {
            channel_id: ChannelId,
            mode: OperatingMode,
        },
        /// An SetOperatingMode message was sent to the Gateway
        SetOperatingMode {
            mode: OperatingMode,
        },
        /// An TransferNativeFromAgent message was sent to the Gateway
        TransferNativeFromAgent {
            agent_id: AgentId,
            recipient: H160,
            amount: u128,
        },
        /// A SetTokenTransferFees message was sent to the Gateway
        SetTokenTransferFees {
            create_asset_xcm: u128,
            transfer_asset_xcm: u128,
            register_token: U256,
        },
        PricingParametersChanged {
            params: PricingParametersOf<T>,
        },
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
        LocationConversionFailed,
        AgentAlreadyCreated,
        NoAgent,
        ChannelAlreadyCreated,
        NoChannel,
        UnsupportedLocationVersion,
        InvalidLocation,
        Send(SendError),
        InvalidTokenTransferFees,
        InvalidPricingParameters,
        InvalidUpgradeParameters,
    }

    /// The set of registered agents
    #[pallet::storage]
    #[pallet::getter(fn agents)]
    pub type Agents<T: Config> = StorageMap<_, Twox64Concat, AgentId, (), OptionQuery>;

    /// The set of registered channels
    #[pallet::storage]
    #[pallet::getter(fn channels)]
    pub type Channels<T: Config> = StorageMap<_, Twox64Concat, ChannelId, Channel, OptionQuery>;

    #[pallet::storage]
    #[pallet::getter(fn parameters)]
    pub type PricingParameters<T: Config> =
        StorageValue<_, PricingParametersOf<T>, ValueQuery, T::DefaultPricingParameters>;

    /// Lookup table for foreign token ID to native location relative to ethereum
    #[pallet::storage]
    pub type ForeignToNativeId<T: Config> =
        StorageMap<_, Blake2_128Concat, TokenId, xcm::v5::Location, OptionQuery>;

    /// Lookup table for native location relative to ethereum to foreign token ID
    #[pallet::storage]
    pub type NativeToForeignId<T: Config> =
        StorageMap<_, Blake2_128Concat, xcm::v5::Location, TokenId, OptionQuery>;

    #[pallet::genesis_config]
    #[derive(frame_support::DefaultNoBound)]
    pub struct GenesisConfig<T: Config> {
        // Own parachain id
        pub para_id: ParaId,
        // AssetHub's parachain id
        pub asset_hub_para_id: ParaId,
        #[serde(skip)]
        pub _config: PhantomData<T>,
    }

    #[pallet::genesis_build]
    impl<T: Config> BuildGenesisConfig for GenesisConfig<T> {
        fn build(&self) {
            Pallet::<T>::initialize(self.para_id, self.asset_hub_para_id).expect("infallible; qed");
        }
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
        #[pallet::call_index(0)]
        #[pallet::weight((T::WeightInfo::upgrade(), DispatchClass::Operational))]
        pub fn upgrade(
            origin: OriginFor<T>,
            impl_address: H160,
            impl_code_hash: H256,
            initializer: Option<Initializer>,
        ) -> DispatchResult {
            ensure_root(origin)?;

            ensure!(
                !impl_address.eq(&H160::zero()) && !impl_code_hash.eq(&H256::zero()),
                Error::<T>::InvalidUpgradeParameters
            );

            let initializer_params_hash: Option<H256> = initializer
                .as_ref()
                .map(|i| H256::from(blake2_256(i.params.as_ref())));
            let command = Command::Upgrade {
                impl_address,
                impl_code_hash,
                initializer,
            };
            Self::send(PRIMARY_GOVERNANCE_CHANNEL, command, PaysFee::<T>::No)?;

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
        /// - `origin`: Must be `Location`
        #[pallet::call_index(1)]
        #[pallet::weight((T::WeightInfo::set_operating_mode(), DispatchClass::Operational))]
        pub fn set_operating_mode(origin: OriginFor<T>, mode: OperatingMode) -> DispatchResult {
            ensure_root(origin)?;

            let command = Command::SetOperatingMode { mode };
            Self::send(PRIMARY_GOVERNANCE_CHANNEL, command, PaysFee::<T>::No)?;

            Self::deposit_event(Event::<T>::SetOperatingMode { mode });
            Ok(())
        }

        /// Set pricing parameters on both sides of the bridge
        ///
        /// Fee required: No
        ///
        /// - `origin`: Must be root
        #[pallet::call_index(2)]
        #[pallet::weight((T::WeightInfo::set_pricing_parameters(), DispatchClass::Operational))]
        pub fn set_pricing_parameters(
            origin: OriginFor<T>,
            params: PricingParametersOf<T>,
        ) -> DispatchResult {
            ensure_root(origin)?;
            params
                .validate()
                .map_err(|_| Error::<T>::InvalidPricingParameters)?;
            PricingParameters::<T>::put(params.clone());

            let command = Command::SetPricingParameters {
                exchange_rate: params.exchange_rate.into(),
                delivery_cost: T::InboundDeliveryCost::get().saturated_into::<u128>(),
                multiplier: params.multiplier.into(),
            };
            Self::send(PRIMARY_GOVERNANCE_CHANNEL, command, PaysFee::<T>::No)?;

            Self::deposit_event(Event::PricingParametersChanged { params });
            Ok(())
        }

        /// Sends a message to the Gateway contract to update fee related parameters for
        /// token transfers.
        ///
        /// Privileged. Can only be called by root.
        ///
        /// Fee required: No
        ///
        /// - `origin`: Must be root
        /// - `create_asset_xcm`: The XCM execution cost for creating a new asset class on AssetHub,
        ///   in DOT
        /// - `transfer_asset_xcm`: The XCM execution cost for performing a reserve transfer on
        ///   AssetHub, in DOT
        /// - `register_token`: The Ether fee for registering a new token, to discourage spamming
        #[pallet::call_index(9)]
        #[pallet::weight((T::WeightInfo::set_token_transfer_fees(), DispatchClass::Operational))]
        pub fn set_token_transfer_fees(
            origin: OriginFor<T>,
            create_asset_xcm: u128,
            transfer_asset_xcm: u128,
            register_token: U256,
        ) -> DispatchResult {
            ensure_root(origin)?;

            // Basic validation of new costs. Particularly for token registration, we want to ensure
            // its relatively expensive to discourage spamming. Like at least 100 USD.
            ensure!(
                create_asset_xcm > 0 && transfer_asset_xcm > 0 && register_token > meth(100),
                Error::<T>::InvalidTokenTransferFees
            );

            let command = Command::SetTokenTransferFees {
                create_asset_xcm,
                transfer_asset_xcm,
                register_token,
            };
            Self::send(PRIMARY_GOVERNANCE_CHANNEL, command, PaysFee::<T>::No)?;

            Self::deposit_event(Event::<T>::SetTokenTransferFees {
                create_asset_xcm,
                transfer_asset_xcm,
                register_token,
            });
            Ok(())
        }

        /// Registers a Polkadot-native token as a wrapped ERC20 token on Ethereum.
        /// Privileged. Can only be called by root.
        ///
        /// Fee required: No
        ///
        /// - `origin`: Must be root
        /// - `location`: Location of the asset (relative to this chain)
        /// - `metadata`: Metadata to include in the instantiated ERC20 contract on Ethereum
        #[pallet::call_index(10)]
        #[pallet::weight(T::WeightInfo::register_token())]
        pub fn register_token(
            origin: OriginFor<T>,
            location: Box<VersionedLocation>,
            metadata: AssetMetadata,
        ) -> DispatchResultWithPostInfo {
            ensure_root(origin)?;

            let location: Location = (*location)
                .try_into()
                .map_err(|_| Error::<T>::UnsupportedLocationVersion)?;

            Self::do_register_token(&location, metadata, PaysFee::<T>::No)?;

            Ok(PostDispatchInfo {
                actual_weight: Some(T::WeightInfo::register_token()),
                pays_fee: Pays::No,
            })
        }
    }

    impl<T: Config> Pallet<T> {
        /// Send `command` to the Gateway on the Channel identified by `channel_id`
        fn send(channel_id: ChannelId, command: Command, pays_fee: PaysFee<T>) -> DispatchResult {
            let message = Message {
                id: None,
                channel_id,
                command,
            };
            let (ticket, fee) =
                T::OutboundQueue::validate(&message).map_err(|err| Error::<T>::Send(err))?;

            let payment = match pays_fee {
                PaysFee::Yes(account) => Some((account, fee.total())),
                PaysFee::Partial(account) => Some((account, fee.local)),
                PaysFee::No => None,
            };

            if let Some((payer, fee)) = payment {
                T::Token::transfer(
                    &payer,
                    &T::TreasuryAccount::get(),
                    fee,
                    Preservation::Preserve,
                )?;
            }

            T::OutboundQueue::deliver(ticket).map_err(|err| Error::<T>::Send(err))?;
            Ok(())
        }

        /// Initializes agents and channels.
        pub fn initialize(para_id: ParaId, asset_hub_para_id: ParaId) -> Result<(), DispatchError> {
            // Asset Hub
            let asset_hub_location: Location =
                ParentThen(Parachain(asset_hub_para_id.into()).into()).into();
            let asset_hub_agent_id = agent_id_of::<T>(&asset_hub_location)?;
            let asset_hub_channel_id: ChannelId = asset_hub_para_id.into();
            Agents::<T>::insert(asset_hub_agent_id, ());
            Channels::<T>::insert(
                asset_hub_channel_id,
                Channel {
                    agent_id: asset_hub_agent_id,
                    para_id: asset_hub_para_id,
                },
            );

            // Governance channels
            let bridge_hub_agent_id = agent_id_of::<T>(&Location::here())?;
            // Agent for BridgeHub
            Agents::<T>::insert(bridge_hub_agent_id, ());

            // Primary governance channel
            Channels::<T>::insert(
                PRIMARY_GOVERNANCE_CHANNEL,
                Channel {
                    agent_id: bridge_hub_agent_id,
                    para_id,
                },
            );

            // Secondary governance channel
            Channels::<T>::insert(
                SECONDARY_GOVERNANCE_CHANNEL,
                Channel {
                    agent_id: bridge_hub_agent_id,
                    para_id,
                },
            );

            Ok(())
        }

        /// Checks if the pallet has been initialized.
        pub(crate) fn is_initialized() -> bool {
            let primary_exists = Channels::<T>::contains_key(PRIMARY_GOVERNANCE_CHANNEL);
            let secondary_exists = Channels::<T>::contains_key(SECONDARY_GOVERNANCE_CHANNEL);
            primary_exists && secondary_exists
        }

        pub(crate) fn do_register_token(
            location: &Location,
            metadata: AssetMetadata,
            pays_fee: PaysFee<T>,
        ) -> Result<(), DispatchError> {
            let ethereum_location = T::EthereumLocation::get();
            // reanchor to Ethereum context
            let location = location
                .clone()
                .reanchored(&ethereum_location, &T::UniversalLocation::get())
                .map_err(|_| Error::<T>::LocationConversionFailed)?;

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
            Self::send(SECONDARY_GOVERNANCE_CHANNEL, command, pays_fee)?;

            Self::deposit_event(Event::<T>::RegisterToken {
                location: location.clone().into(),
                foreign_token_id: token_id,
            });

            Ok(())
        }
    }

    impl<T: Config> StaticLookup for Pallet<T> {
        type Source = ChannelId;
        type Target = Channel;
        fn lookup(channel_id: Self::Source) -> Option<Self::Target> {
            Channels::<T>::get(channel_id)
        }
    }

    impl<T: Config> Contains<ChannelId> for Pallet<T> {
        fn contains(channel_id: &ChannelId) -> bool {
            Channels::<T>::get(channel_id).is_some()
        }
    }

    impl<T: Config> Get<PricingParametersOf<T>> for Pallet<T> {
        fn get() -> PricingParametersOf<T> {
            PricingParameters::<T>::get()
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
