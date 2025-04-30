// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use crate::{mock::*, DispatchError::BadOrigin, *};
use frame_support::{assert_noop, assert_ok};
use sp_keyring::sr25519::Keyring;
use xcm::{latest::WESTEND_GENESIS_HASH, prelude::*};

#[test]
fn register_tokens_succeeds() {
    new_test_ext(true).execute_with(|| {
        let origin = make_xcm_origin(FrontendLocation::get());
        let versioned_location: VersionedLocation = Location::parent().into();

        assert_ok!(EthereumSystemV2::register_token(
            origin,
            Box::new(versioned_location.clone()),
            Box::new(versioned_location),
            Default::default(),
        ));
    });
}

#[test]
fn agent_id_from_location() {
    new_test_ext(true).execute_with(|| {
        let bob: AccountId = Keyring::Bob.into();
        let origin = Location::new(
            1,
            [
                Parachain(1000),
                AccountId32 {
                    network: Some(NetworkId::ByGenesis(WESTEND_GENESIS_HASH)),
                    id: bob.into(),
                },
            ],
        );
        let agent_id = EthereumSystemV2::location_to_message_origin(origin.clone()).unwrap();
        let expected_agent_id =
            hex_literal::hex!("fa2d646322a1c6db25dd004f44f14f3d39a9556bed9655f372942a84a5b3d93b")
                .into();
        assert_eq!(agent_id, expected_agent_id);
    });
}

#[test]
fn upgrade_as_root() {
    new_test_ext(true).execute_with(|| {
        let origin = RuntimeOrigin::root();
        let address: H160 = [1_u8; 20].into();
        let code_hash: H256 = [1_u8; 32].into();
        let initializer = Initializer {
            params: [0; 256].into(),
            maximum_required_gas: 10000,
        };
        let initializer_params_hash: H256 = blake2_256(initializer.params.as_ref()).into();
        assert_ok!(EthereumSystemV2::upgrade(
            origin,
            address,
            code_hash,
            initializer
        ));

        System::assert_last_event(RuntimeEvent::EthereumSystemV2(crate::Event::Upgrade {
            impl_address: address,
            impl_code_hash: code_hash,
            initializer_params_hash,
        }));
    });
}

#[test]
fn upgrade_as_signed_fails() {
    new_test_ext(true).execute_with(|| {
        let origin = RuntimeOrigin::signed(sp_runtime::AccountId32::new([0; 32]));
        let address: H160 = Default::default();
        let code_hash: H256 = Default::default();
        let initializer = Initializer {
            params: [0; 256].into(),
            maximum_required_gas: 10000,
        };
        assert_noop!(
            EthereumSystemV2::upgrade(origin, address, code_hash, initializer),
            BadOrigin
        );
    });
}

#[test]
fn upgrade_with_params() {
    new_test_ext(true).execute_with(|| {
        let origin = RuntimeOrigin::root();
        let address: H160 = [1_u8; 20].into();
        let code_hash: H256 = [1_u8; 32].into();
        let initializer = Initializer {
            params: [0; 256].into(),
            maximum_required_gas: 10000,
        };
        assert_ok!(EthereumSystemV2::upgrade(
            origin,
            address,
            code_hash,
            initializer
        ));
    });
}

#[test]
fn set_operating_mode() {
    new_test_ext(true).execute_with(|| {
        let origin = RuntimeOrigin::root();
        let mode = OperatingMode::RejectingOutboundMessages;

        assert_ok!(EthereumSystemV2::set_operating_mode(origin, mode));

        System::assert_last_event(RuntimeEvent::EthereumSystemV2(
            crate::Event::SetOperatingMode { mode },
        ));
    });
}

pub struct RegisterTokenTestCase {
    /// Input: Location of Polkadot-native token relative to BH
    pub native: Location,
}

#[test]
fn register_all_tokens_succeeds() {
    let test_cases = vec![
        // DOT
        RegisterTokenTestCase {
            native: Location::parent(),
        },
        // GLMR (Some Polkadot parachain currency)
        RegisterTokenTestCase {
            native: Location::new(1, [Parachain(2004)]),
        },
        // USDT
        RegisterTokenTestCase {
            native: Location::new(1, [Parachain(1000), PalletInstance(50), GeneralIndex(1984)]),
        },
        // KSM
        RegisterTokenTestCase {
            native: Location::new(2, [GlobalConsensus(Kusama)]),
        },
        // KAR (Some Kusama parachain currency)
        RegisterTokenTestCase {
            native: Location::new(2, [GlobalConsensus(Kusama), Parachain(2000)]),
        },
    ];
    for tc in test_cases.iter() {
        new_test_ext(true).execute_with(|| {
            let origin = make_xcm_origin(FrontendLocation::get());
            let versioned_location: VersionedLocation = tc.native.clone().into();

            assert_ok!(EthereumSystemV2::register_token(
                origin,
                Box::new(versioned_location.clone()),
                Box::new(versioned_location),
                Default::default()
            ));

            let reanchored_location = EthereumSystemV2::reanchor(tc.native.clone()).unwrap();
            let foreign_token_id =
                EthereumSystemV2::location_to_message_origin(tc.native.clone()).unwrap();

            assert_eq!(
                NativeToForeignId::<Test>::get(reanchored_location.clone()),
                Some(foreign_token_id)
            );
            assert_eq!(
                ForeignToNativeId::<Test>::get(foreign_token_id),
                Some(reanchored_location.clone())
            );

            System::assert_last_event(RuntimeEvent::EthereumSystemV2(
                Event::<Test>::RegisterToken {
                    location: reanchored_location.into(),
                    foreign_token_id,
                },
            ));
        });
    }
}

#[test]
fn register_ethereum_native_token_fails() {
    new_test_ext(true).execute_with(|| {
        let origin = make_xcm_origin(FrontendLocation::get());
        let location = Location::new(2, [GlobalConsensus(Ethereum { chain_id: 11155111 })]);
        let versioned_location: Box<VersionedLocation> = Box::new(location.clone().into());
        assert_noop!(
            EthereumSystemV2::register_token(
                origin,
                versioned_location.clone(),
                versioned_location.clone(),
                Default::default()
            ),
            Error::<Test>::LocationConversionFailed
        );
    });
}
