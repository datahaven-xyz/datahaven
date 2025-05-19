use super::EthereumLocationsConverterFor;
use crate::{
	mock::*, Command, ConvertMessage, Destination, MessageV1, VersionedMessage, H160,
};
use frame_support::{assert_ok, parameter_types};
use hex_literal::hex;
use xcm::prelude::*;
use xcm_builder::ExternalConsensusLocationsConverterFor;
use xcm_executor::traits::ConvertLocation;

parameter_types! {
	pub UniversalLocation: InteriorLocation = [GlobalConsensus(ByGenesis([9; 32])), Parachain(1234)].into();
}

#[test]
fn test_ethereum_network_converts_successfully() {
	let expected_account: [u8; 32] =
		hex!("ce796ae65569a670d0c1cc1ac12515a3ce21b5fbf729d63d7b289baad070139d");
	let contract_location = Location::new(2, [GlobalConsensus(NETWORK)]);

	let account =
		EthereumLocationsConverterFor::<[u8; 32]>::convert_location(&contract_location).unwrap();
	assert_eq!(account, expected_account);
	let account =
		ExternalConsensusLocationsConverterFor::<UniversalLocation, [u8; 32]>::convert_location(
			&contract_location,
		)
		.unwrap();
	assert_eq!(account, expected_account);
}

#[test]
fn test_contract_location_with_network_converts_successfully() {
	let expected_account: [u8; 32] =
		hex!("9038d35aba0e78e072d29b2d65be9df5bb4d7d94b4609c9cf98ea8e66e544052");
	let contract_location = Location::new(
		2,
		[GlobalConsensus(NETWORK), AccountKey20 { network: None, key: [123u8; 20] }],
	);

	let account =
		EthereumLocationsConverterFor::<[u8; 32]>::convert_location(&contract_location).unwrap();
	assert_eq!(account, expected_account);
	let account =
		ExternalConsensusLocationsConverterFor::<UniversalLocation, [u8; 32]>::convert_location(
			&contract_location,
		)
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
		assert_ok!(reanchored_asset_with_ethereum_context.reanchor(&global_ah, &ethereum_context));
		assert_eq!(reanchored_asset_with_ethereum_context, asset.clone());
	}
}

#[test]
fn test_convert_send_token_with_weth() {
	const WETH: H160 = H160([0xff; 20]);
	const AMOUNT: u128 = 1_000_000;
	const FEE: u128 = 1_000;
	const ACCOUNT_ID: [u8; 32] = [0xBA; 32];
	const MESSAGE: VersionedMessage = VersionedMessage::V1(MessageV1 {
		chain_id: CHAIN_ID,
		command: Command::SendToken {
			token: WETH,
			destination: Destination::AccountId32 { id: ACCOUNT_ID },
			amount: AMOUNT,
			fee: FEE,
		},
	});
	let result = MessageConverter::convert([1; 32].into(), MESSAGE);
	assert_ok!(&result);
	let (xcm, fee) = result.unwrap();
	assert_eq!(FEE, fee);

	let expected_assets = ReserveAssetDeposited(
		vec![Asset {
			id: AssetId(Location {
				parents: 2,
				interior: Junctions::X2(
					[GlobalConsensus(NETWORK), AccountKey20 { network: None, key: WETH.into() }]
						.into(),
				),
			}),
			fun: Fungible(AMOUNT),
		}]
		.into(),
	);
	let actual_assets = xcm.into_iter().find(|x| matches!(x, ReserveAssetDeposited(..)));
	assert_eq!(actual_assets, Some(expected_assets))
}

#[test]
fn test_convert_send_token_with_eth() {
	const ETH: H160 = H160([0x00; 20]);
	const AMOUNT: u128 = 1_000_000;
	const FEE: u128 = 1_000;
	const ACCOUNT_ID: [u8; 32] = [0xBA; 32];
	const MESSAGE: VersionedMessage = VersionedMessage::V1(MessageV1 {
		chain_id: CHAIN_ID,
		command: Command::SendToken {
			token: ETH,
			destination: Destination::AccountId32 { id: ACCOUNT_ID },
			amount: AMOUNT,
			fee: FEE,
		},
	});
	let result = MessageConverter::convert([1; 32].into(), MESSAGE);
	assert_ok!(&result);
	let (xcm, fee) = result.unwrap();
	assert_eq!(FEE, fee);

	let expected_assets = ReserveAssetDeposited(
		vec![Asset {
			id: AssetId(Location {
				parents: 2,
				interior: Junctions::X1([GlobalConsensus(NETWORK)].into()),
			}),
			fun: Fungible(AMOUNT),
		}]
		.into(),
	);
	let actual_assets = xcm.into_iter().find(|x| matches!(x, ReserveAssetDeposited(..)));
	assert_eq!(actual_assets, Some(expected_assets))
}
