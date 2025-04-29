// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use crate::{mock::*, *};
use frame_support::{assert_noop, assert_ok};
use hex_literal::hex;
use snowbridge_core::eth;
use sp_core::H256;
use sp_runtime::{AccountId32, DispatchError::BadOrigin};

#[test]
fn test_agent_for_here() {
	new_test_ext(true).execute_with(|| {
		let origin_location = Location::here();
		let agent_id = make_agent_id(origin_location);
		assert_eq!(
			agent_id,
			hex!("03170a2e7597b7b7e3d84c05391d139a62b157e78786d8c082f29dcf4c111314").into(),
		)
	});
}

#[test]
fn upgrade_as_root() {
	new_test_ext(true).execute_with(|| {
		let origin = RuntimeOrigin::root();
		let address: H160 = [1_u8; 20].into();
		let code_hash: H256 = [1_u8; 32].into();

		assert_ok!(EthereumSystem::upgrade(origin, address, code_hash, None));

		System::assert_last_event(RuntimeEvent::EthereumSystem(crate::Event::Upgrade {
			impl_address: address,
			impl_code_hash: code_hash,
			initializer_params_hash: None,
		}));
	});
}

#[test]
fn upgrade_as_signed_fails() {
	new_test_ext(true).execute_with(|| {
		let origin = RuntimeOrigin::signed(AccountId32::new([0; 32]));
		let address: H160 = Default::default();
		let code_hash: H256 = Default::default();

		assert_noop!(EthereumSystem::upgrade(origin, address, code_hash, None), BadOrigin);
	});
}

#[test]
fn upgrade_with_params() {
	new_test_ext(true).execute_with(|| {
		let origin = RuntimeOrigin::root();
		let address: H160 = [1_u8; 20].into();
		let code_hash: H256 = [1_u8; 32].into();
		let initializer: Option<Initializer> =
			Some(Initializer { params: [0; 256].into(), maximum_required_gas: 10000 });
		assert_ok!(EthereumSystem::upgrade(origin, address, code_hash, initializer));
	});
}

#[test]
fn set_operating_mode() {
	new_test_ext(true).execute_with(|| {
		let origin = RuntimeOrigin::root();
		let mode = OperatingMode::RejectingOutboundMessages;

		assert_ok!(EthereumSystem::set_operating_mode(origin, mode));

		System::assert_last_event(RuntimeEvent::EthereumSystem(crate::Event::SetOperatingMode {
			mode,
		}));
	});
}

#[test]
fn set_operating_mode_as_signed_fails() {
	new_test_ext(true).execute_with(|| {
		let origin = RuntimeOrigin::signed([14; 32].into());
		let mode = OperatingMode::RejectingOutboundMessages;

		assert_noop!(EthereumSystem::set_operating_mode(origin, mode), BadOrigin);
	});
}

#[test]
fn set_pricing_parameters() {
	new_test_ext(true).execute_with(|| {
		let origin = RuntimeOrigin::root();
		let mut params = Parameters::get();
		params.rewards.local = 7;

		assert_ok!(EthereumSystem::set_pricing_parameters(origin, params));

		assert_eq!(PricingParameters::<Test>::get().rewards.local, 7);
	});
}

#[test]
fn set_pricing_parameters_as_signed_fails() {
	new_test_ext(true).execute_with(|| {
		let origin = RuntimeOrigin::signed([14; 32].into());
		let params = Parameters::get();

		assert_noop!(EthereumSystem::set_pricing_parameters(origin, params), BadOrigin);
	});
}

#[test]
fn set_pricing_parameters_invalid() {
	new_test_ext(true).execute_with(|| {
		let origin = RuntimeOrigin::root();
		let mut params = Parameters::get();
		params.rewards.local = 0;

		assert_noop!(
			EthereumSystem::set_pricing_parameters(origin.clone(), params),
			Error::<Test>::InvalidPricingParameters
		);

		let mut params = Parameters::get();
		params.exchange_rate = 0u128.into();
		assert_noop!(
			EthereumSystem::set_pricing_parameters(origin.clone(), params),
			Error::<Test>::InvalidPricingParameters
		);
		params = Parameters::get();
		params.fee_per_gas = sp_core::U256::zero();
		assert_noop!(
			EthereumSystem::set_pricing_parameters(origin.clone(), params),
			Error::<Test>::InvalidPricingParameters
		);
		params = Parameters::get();
		params.rewards.local = 0;
		assert_noop!(
			EthereumSystem::set_pricing_parameters(origin.clone(), params),
			Error::<Test>::InvalidPricingParameters
		);
		params = Parameters::get();
		params.rewards.remote = sp_core::U256::zero();
		assert_noop!(
			EthereumSystem::set_pricing_parameters(origin, params),
			Error::<Test>::InvalidPricingParameters
		);
	});
}

#[test]
fn set_token_transfer_fees() {
	new_test_ext(true).execute_with(|| {
		let origin = RuntimeOrigin::root();

		assert_ok!(EthereumSystem::set_token_transfer_fees(origin, 1, 1, eth(1)));
	});
}

#[test]
fn set_token_transfer_fees_root_only() {
	new_test_ext(true).execute_with(|| {
		let origin = RuntimeOrigin::signed([14; 32].into());

		assert_noop!(EthereumSystem::set_token_transfer_fees(origin, 1, 1, 1.into()), BadOrigin);
	});
}

#[test]
fn set_token_transfer_fees_invalid() {
	new_test_ext(true).execute_with(|| {
		let origin = RuntimeOrigin::root();

		assert_noop!(
			EthereumSystem::set_token_transfer_fees(origin, 0, 0, 0.into()),
			Error::<Test>::InvalidTokenTransferFees
		);
	});
}

#[test]
fn genesis_build_initializes_correctly() {
	new_test_ext(true).execute_with(|| {
		assert!(EthereumSystem::is_initialized(), "Ethereum uninitialized.");
	});
}

#[test]
fn no_genesis_build_is_uninitialized() {
	new_test_ext(false).execute_with(|| {
		assert!(!EthereumSystem::is_initialized(), "Ethereum initialized.");
	});
}

#[test]
fn register_token_with_signed_yields_bad_origin() {
	new_test_ext(true).execute_with(|| {
		let origin = RuntimeOrigin::signed([14; 32].into());
		let location = Location::new(1, [Parachain(2000)]);
		let versioned_location: Box<VersionedLocation> = Box::new(location.clone().into());
		assert_noop!(
			EthereumSystem::register_token(origin, versioned_location, Default::default()),
			BadOrigin
		);
	});
}

pub struct RegisterTokenTestCase {
	/// Input: Location of Polkadot-native token relative to BH
	pub native: Location,
	/// Output: Reanchored, canonicalized location
	pub reanchored: Location,
	/// Output: Stable hash of reanchored location
	pub foreign: TokenId,
}

#[test]
fn register_all_tokens_succeeds() {
	let test_cases = vec![
		// DOT
		RegisterTokenTestCase {
			native: Location::parent(),
			reanchored: Location::new(1, GlobalConsensus(Polkadot)),
			foreign: hex!("4e241583d94b5d48a27a22064cd49b2ed6f5231d2d950e432f9b7c2e0ade52b2")
				.into(),
		},
		// GLMR (Some Polkadot parachain currency)
		RegisterTokenTestCase {
			native: Location::new(1, [Parachain(2004)]),
			reanchored: Location::new(1, [GlobalConsensus(Polkadot), Parachain(2004)]),
			foreign: hex!("34c08fc90409b6924f0e8eabb7c2aaa0c749e23e31adad9f6d217b577737fafb")
				.into(),
		},
		// USDT
		RegisterTokenTestCase {
			native: Location::new(1, [Parachain(1000), PalletInstance(50), GeneralIndex(1984)]),
			reanchored: Location::new(
				1,
				[
					GlobalConsensus(Polkadot),
					Parachain(1000),
					PalletInstance(50),
					GeneralIndex(1984),
				],
			),
			foreign: hex!("14b0579be12d7d7f9971f1d4b41f0e88384b9b74799b0150d4aa6cd01afb4444")
				.into(),
		},
		// KSM
		RegisterTokenTestCase {
			native: Location::new(2, [GlobalConsensus(Kusama)]),
			reanchored: Location::new(1, [GlobalConsensus(Kusama)]),
			foreign: hex!("03b6054d0c576dd8391e34e1609cf398f68050c23009d19ce93c000922bcd852")
				.into(),
		},
		// KAR (Some Kusama parachain currency)
		RegisterTokenTestCase {
			native: Location::new(2, [GlobalConsensus(Kusama), Parachain(2000)]),
			reanchored: Location::new(1, [GlobalConsensus(Kusama), Parachain(2000)]),
			foreign: hex!("d3e39ad6ea4cee68c9741181e94098823b2ea34a467577d0875c036f0fce5be0")
				.into(),
		},
	];
	for tc in test_cases.iter() {
		new_test_ext(true).execute_with(|| {
			let origin = RuntimeOrigin::root();
			let versioned_location: VersionedLocation = tc.native.clone().into();

			assert_ok!(EthereumSystem::register_token(
				origin,
				Box::new(versioned_location),
				Default::default()
			));

			assert_eq!(NativeToForeignId::<Test>::get(tc.reanchored.clone()), Some(tc.foreign));
			assert_eq!(ForeignToNativeId::<Test>::get(tc.foreign), Some(tc.reanchored.clone()));

			System::assert_last_event(RuntimeEvent::EthereumSystem(Event::<Test>::RegisterToken {
				location: tc.reanchored.clone().into(),
				foreign_token_id: tc.foreign,
			}));
		});
	}
}

#[test]
fn register_ethereum_native_token_fails() {
	new_test_ext(true).execute_with(|| {
		let origin = RuntimeOrigin::root();
		let location = Location::new(
			2,
			[
				GlobalConsensus(Ethereum { chain_id: 11155111 }),
				AccountKey20 {
					network: None,
					key: hex!("87d1f7fdfEe7f651FaBc8bFCB6E086C278b77A7d"),
				},
			],
		);
		let versioned_location: Box<VersionedLocation> = Box::new(location.clone().into());
		assert_noop!(
			EthereumSystem::register_token(origin, versioned_location, Default::default()),
			Error::<Test>::LocationConversionFailed
		);
	});
}
