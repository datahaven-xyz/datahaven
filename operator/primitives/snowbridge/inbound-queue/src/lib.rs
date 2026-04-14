// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
// SPDX-FileCopyrightText: 2021-2022 Parity Technologies (UK) Ltd.
#![cfg_attr(not(feature = "std"), no_std)]
extern crate alloc;

pub mod v1;
pub mod v2;
use codec::Encode;
use core::marker::PhantomData;
use snowbridge_beacon_primitives::BeaconHeader;
use sp_core::{blake2_256, RuntimeDebug, H256};
use xcm::prelude::{AccountKey20, Ethereum, GlobalConsensus, Location};
use xcm_executor::traits::ConvertLocation;

pub use snowbridge_verification_primitives::*;

#[derive(Clone, RuntimeDebug)]
pub struct InboundQueueFixture {
    pub event: EventProof,
    pub finalized_header: BeaconHeader,
    pub block_roots_root: H256,
}

/// A trait defining a reward ledger, which tracks rewards that can be later claimed.
///
/// This ledger allows registering rewards for a relayer, categorized by a specific `Reward`.
/// The registered rewards can be claimed later through an appropriate payment procedure.
pub trait RewardLedger<Relayer, Reward, RewardBalance> {
    /// Registers a reward for a given relayer.
    fn register_reward(relayer: &Relayer, reward: Reward, reward_balance: RewardBalance);
}

/// DEPRECATED in favor of [xcm_builder::ExternalConsensusLocationsConverterFor]
pub struct EthereumLocationsConverterFor<AccountId>(PhantomData<AccountId>);
impl<AccountId> ConvertLocation<AccountId> for EthereumLocationsConverterFor<AccountId>
where
    AccountId: From<[u8; 32]> + Clone,
{
    fn convert_location(location: &Location) -> Option<AccountId> {
        match location.unpack() {
            (2, [GlobalConsensus(Ethereum { chain_id })]) => {
                Some(Self::from_chain_id(chain_id).into())
            }
            (2, [GlobalConsensus(Ethereum { chain_id }), AccountKey20 { network: _, key }]) => {
                Some(Self::from_chain_id_with_key(chain_id, *key).into())
            }
            _ => None,
        }
    }
}

impl<AccountId> EthereumLocationsConverterFor<AccountId> {
    pub fn from_chain_id(chain_id: &u64) -> [u8; 32] {
        (b"ethereum-chain", chain_id).using_encoded(blake2_256)
    }
    pub fn from_chain_id_with_key(chain_id: &u64, key: [u8; 20]) -> [u8; 32] {
        (b"ethereum-chain", chain_id, key).using_encoded(blake2_256)
    }
}

pub type CallIndex = [u8; 2];

#[cfg(test)]
mod tests {
    use crate::{CallIndex, EthereumLocationsConverterFor};
    use frame_support::{assert_ok, parameter_types};
    use hex_literal::hex;
    use xcm::prelude::*;
    use xcm_executor::traits::ConvertLocation;

    const NETWORK: NetworkId = Ethereum { chain_id: 11155111 };

    parameter_types! {
        pub EthereumNetwork: NetworkId = NETWORK;

        pub const CreateAssetCall: CallIndex = [1, 1];
        pub const CreateAssetExecutionFee: u128 = 123;
        pub const CreateAssetDeposit: u128 = 891;
        pub const SendTokenExecutionFee: u128 = 592;
    }

    #[test]
    fn test_contract_location_with_network_converts_successfully() {
        let expected_account: [u8; 32] =
            hex!("ce796ae65569a670d0c1cc1ac12515a3ce21b5fbf729d63d7b289baad070139d");
        let contract_location = Location::new(2, [GlobalConsensus(NETWORK)]);

        let account =
            EthereumLocationsConverterFor::<[u8; 32]>::convert_location(&contract_location)
                .unwrap();

        assert_eq!(account, expected_account);
    }

    #[test]
    fn test_contract_location_with_incorrect_location_fails_convert() {
        let contract_location = Location::new(2, [GlobalConsensus(Polkadot), Parachain(1000)]);

        assert_eq!(
            EthereumLocationsConverterFor::<[u8; 32]>::convert_location(&contract_location),
            None,
        );
    }

    #[test]
    fn test_reanchor_all_assets() {
        let ethereum_context: InteriorLocation = [GlobalConsensus(Ethereum { chain_id: 1 })].into();
        let ethereum = Location::new(2, ethereum_context.clone());
        let ah_context: InteriorLocation = [GlobalConsensus(Polkadot), Parachain(1000)].into();
        let global_ah = Location::new(1, ah_context.clone());
        let assets = vec![
            // DOT
            Location::new(1, []),
            // GLMR (Some Polkadot parachain currency)
            Location::new(1, [Parachain(2004)]),
            // AH asset
            Location::new(0, [PalletInstance(50), GeneralIndex(42)]),
            // KSM
            Location::new(2, [GlobalConsensus(Kusama)]),
            // KAR (Some Kusama parachain currency)
            Location::new(2, [GlobalConsensus(Kusama), Parachain(2000)]),
        ];
        for asset in assets.iter() {
            // reanchor logic in pallet_xcm on AH
            let mut reanchored_asset = asset.clone();
            assert_ok!(reanchored_asset.reanchor(&ethereum, &ah_context));
            // reanchor back to original location in context of Ethereum
            let mut reanchored_asset_with_ethereum_context = reanchored_asset.clone();
            assert_ok!(
                reanchored_asset_with_ethereum_context.reanchor(&global_ah, &ethereum_context)
            );
            assert_eq!(reanchored_asset_with_ethereum_context, asset.clone());
        }
    }
}
