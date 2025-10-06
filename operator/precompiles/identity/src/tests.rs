// Copyright 2019-2025 PureStake Inc.
// This file is part of Moonbeam.

// Moonbeam is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Moonbeam is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Moonbeam.  If not, see <http://www.gnu.org/licenses/>.

use crate::{
    mock::*, SELECTOR_LOG_IDENTITY_CLEARED, SELECTOR_LOG_IDENTITY_SET,
    SELECTOR_LOG_JUDGEMENT_GIVEN, SELECTOR_LOG_JUDGEMENT_REQUESTED,
    SELECTOR_LOG_JUDGEMENT_UNREQUESTED, SELECTOR_LOG_SUB_IDENTITY_ADDED,
    SELECTOR_LOG_SUB_IDENTITY_REMOVED, SELECTOR_LOG_SUB_IDENTITY_REVOKED,
};
use crate::{
    Data, IdentityFields, IdentityInfo, Judgement, Registrar, Registration, SubsOf, SuperOf,
};
use frame_support::assert_ok;
use pallet_evm::{Call as EvmCall, Event as EvmEvent};
use pallet_identity::{
    legacy::IdentityField, Event as IdentityEvent, Pallet as IdentityPallet, RegistrarInfo,
};
use parity_scale_codec::Encode;
use precompile_utils::prelude::*;
use precompile_utils::testing::*;
use sp_core::{H160, U256};
use sp_runtime::traits::{Dispatchable, Hash};

fn precompiles() -> Precompiles<Runtime> {
    PrecompilesValue::get()
}

fn evm_call(source: impl Into<H160>, input: Vec<u8>) -> EvmCall<Runtime> {
    EvmCall::call {
        source: source.into(),
        target: Precompile1.into(),
        input,
        value: U256::zero(),
        gas_limit: u64::max_value(),
        max_fee_per_gas: 0.into(),
        max_priority_fee_per_gas: Some(U256::zero()),
        nonce: None,
        access_list: Vec::new(),
    }
}

#[test]
fn test_solidity_interface_has_all_function_selectors_documented_and_implemented() {
    check_precompile_implements_solidity_interfaces(&["Identity.sol"], PCall::supports_selector)
}

#[test]
fn test_set_fee_on_existing_registrar_index_succeeds() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(<IdentityPallet<Runtime>>::add_registrar(
                RuntimeOrigin::root(),
                Bob.into()
            ));

            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_fee {
                    index: 0,
                    fee: 100.into(),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_eq!(
                pallet_identity::Registrars::<Runtime>::get().to_vec(),
                vec![Some(RegistrarInfo {
                    account: Bob.into(),
                    fee: 100,
                    fields: Default::default(),
                })]
            );
        })
}

#[test]
fn test_set_fee_on_non_existing_registrar_index_fails() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_fee {
                    index: 0,
                    fee: 100.into(),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));
        })
}

#[test]
fn test_set_account_id_on_existing_registrar_index_succeeds() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(<IdentityPallet<Runtime>>::add_registrar(
                RuntimeOrigin::root(),
                Bob.into()
            ));

            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_account_id {
                    index: 0,
                    new: Address(Charlie.into()),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_eq!(
                pallet_identity::Registrars::<Runtime>::get().to_vec(),
                vec![Some(RegistrarInfo {
                    account: Charlie.into(),
                    fee: 0,
                    fields: Default::default(),
                })]
            );
        })
}

#[test]
fn test_set_account_id_on_non_existing_registrar_index_fails() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_account_id {
                    index: 0,
                    new: Address(Charlie.into()),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));
        })
}

#[test]
fn test_set_fields_on_existing_registrar_index_succeeds() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(<IdentityPallet<Runtime>>::add_registrar(
                RuntimeOrigin::root(),
                Bob.into()
            ));

            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_fields {
                    index: 0,
                    fields: IdentityFields {
                        display: true,
                        web: true,
                        ..Default::default()
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_eq!(
                pallet_identity::Registrars::<Runtime>::get().to_vec(),
                vec![Some(RegistrarInfo {
                    account: Bob.into(),
                    fee: 0,
                    fields: IdentityField::Display as u64 | IdentityField::Web as u64,
                })]
            );
        })
}

#[test]
fn test_set_fields_on_non_existing_registrar_index_fails() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_fields {
                    index: 0,
                    fields: IdentityFields {
                        display: true,
                        web: true,
                        ..Default::default()
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));
        })
}

#[test]
fn test_set_identity_works() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_identity {
                    info: IdentityInfo {
                        additional: vec![
                            (
                                Data {
                                    has_data: true,
                                    value: vec![0xa1].try_into().expect("succeeds"),
                                },
                                Data {
                                    has_data: true,
                                    value: vec![0xb1].try_into().expect("succeeds"),
                                },
                            ),
                            (
                                Data {
                                    has_data: true,
                                    value: vec![0xa2].try_into().expect("succeeds"),
                                },
                                Data {
                                    has_data: true,
                                    value: vec![0xb2].try_into().expect("succeeds"),
                                },
                            ),
                        ]
                        .try_into()
                        .expect("succeeds"),
                        display: Data {
                            has_data: true,
                            value: vec![0x01].try_into().expect("succeeds"),
                        },
                        legal: Data {
                            has_data: true,
                            value: vec![0x02].try_into().expect("succeeds"),
                        },
                        web: Data {
                            has_data: true,
                            value: vec![0x03].try_into().expect("succeeds"),
                        },
                        riot: Data {
                            has_data: true,
                            value: vec![0x04].try_into().expect("succeeds"),
                        },
                        email: Data {
                            has_data: true,
                            value: vec![0x05].try_into().expect("succeeds"),
                        },
                        has_pgp_fingerprint: true,
                        pgp_fingerprint: [0x06; 20].try_into().expect("succeeds"),
                        image: Data {
                            has_data: true,
                            value: vec![0x07].try_into().expect("succeeds"),
                        },
                        twitter: Data {
                            has_data: true,
                            value: vec![0x08].try_into().expect("succeeds"),
                        },
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert!(events().contains(&Into::<crate::mock::RuntimeEvent>::into(
                IdentityEvent::IdentitySet { who: Bob.into() }
            )));
            assert!(events().contains(
                &EvmEvent::Log {
                    log: log1(
                        Precompile1,
                        SELECTOR_LOG_IDENTITY_SET,
                        solidity::encode_event_data(
							Address(Bob.into()), // who
						),
                    ),
                }
                .into()
            ));

            let identity =
                pallet_identity::IdentityOf::<Runtime>::get(AccountId::from(Bob)).expect("exists");
            let encoded_byte_size = identity.info.encoded_size() as u32;
            let byte_deposit = ByteDeposit::get().saturating_mul(encoded_byte_size as u64);
            assert_eq!(
                identity,
                pallet_identity::Registration::<Balance, MaxRegistrars, _> {
                    judgements: Default::default(),
                    deposit: (BasicDeposit::get() + byte_deposit).into(),
                    info: pallet_identity::legacy::IdentityInfo::<MaxAdditionalFields> {
                        additional: vec![
                            (
                                pallet_identity::Data::Raw(
                                    vec![0xa1].try_into().expect("succeeds")
                                ),
                                pallet_identity::Data::Raw(
                                    vec![0xb1].try_into().expect("succeeds")
                                )
                            ),
                            (
                                pallet_identity::Data::Raw(
                                    vec![0xa2].try_into().expect("succeeds")
                                ),
                                pallet_identity::Data::Raw(
                                    vec![0xb2].try_into().expect("succeeds")
                                )
                            ),
                        ]
                        .try_into()
                        .expect("succeeds"),
                        display: pallet_identity::Data::Raw(
                            vec![0x01].try_into().expect("succeeds")
                        ),
                        legal: pallet_identity::Data::Raw(vec![0x02].try_into().expect("succeeds")),
                        web: pallet_identity::Data::Raw(vec![0x03].try_into().expect("succeeds")),
                        riot: pallet_identity::Data::Raw(vec![0x04].try_into().expect("succeeds")),
                        email: pallet_identity::Data::Raw(vec![0x05].try_into().expect("succeeds")),
                        pgp_fingerprint: Some([0x06; 20].try_into().expect("succeeds")),
                        image: pallet_identity::Data::Raw(vec![0x07].try_into().expect("succeeds")),
                        twitter: pallet_identity::Data::Raw(
                            vec![0x08].try_into().expect("succeeds")
                        ),
                    }
                },
            );
        })
}

#[test]
fn test_set_identity_works_for_already_set_identity() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_identity {
                    info: IdentityInfo {
                        display: Data {
                            has_data: true,
                            value: vec![0x01].try_into().expect("succeeds"),
                        },
                        legal: Data {
                            has_data: true,
                            value: vec![0x02].try_into().expect("succeeds"),
                        },
                        web: Data {
                            has_data: true,
                            value: vec![0x03].try_into().expect("succeeds"),
                        },
                        riot: Data {
                            has_data: true,
                            value: vec![0x04].try_into().expect("succeeds"),
                        },
                        email: Data {
                            has_data: true,
                            value: vec![0x05].try_into().expect("succeeds"),
                        },
                        has_pgp_fingerprint: true,
                        pgp_fingerprint: [0x06; 20].try_into().expect("succeeds"),
                        image: Data {
                            has_data: true,
                            value: vec![0x07].try_into().expect("succeeds"),
                        },
                        twitter: Data {
                            has_data: true,
                            value: vec![0x08].try_into().expect("succeeds"),
                        },
                        ..Default::default()
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert!(events().contains(&Into::<crate::mock::RuntimeEvent>::into(
                IdentityEvent::IdentitySet { who: Bob.into() }
            )));
            assert!(events().contains(
                &EvmEvent::Log {
                    log: log1(
                        Precompile1,
                        SELECTOR_LOG_IDENTITY_SET,
                        solidity::encode_event_data(
							Address(Bob.into()), // who
						),
                    ),
                }
                .into()
            ));

            let identity =
                pallet_identity::IdentityOf::<Runtime>::get(AccountId::from(Bob)).expect("exists");
            let encoded_byte_size = identity.info.encoded_size() as u32;
            let byte_deposit = ByteDeposit::get().saturating_mul(encoded_byte_size as u64);
            assert_eq!(
                identity,
                pallet_identity::Registration::<Balance, MaxRegistrars, _> {
                    judgements: Default::default(),
                    deposit: (BasicDeposit::get() + byte_deposit) as u128,
                    info: pallet_identity::legacy::IdentityInfo::<MaxAdditionalFields> {
                        additional: Default::default(),
                        display: pallet_identity::Data::Raw(
                            vec![0x01].try_into().expect("succeeds")
                        ),
                        legal: pallet_identity::Data::Raw(vec![0x02].try_into().expect("succeeds")),
                        web: pallet_identity::Data::Raw(vec![0x03].try_into().expect("succeeds")),
                        riot: pallet_identity::Data::Raw(vec![0x04].try_into().expect("succeeds")),
                        email: pallet_identity::Data::Raw(vec![0x05].try_into().expect("succeeds")),
                        pgp_fingerprint: Some([0x06; 20].try_into().expect("succeeds")),
                        image: pallet_identity::Data::Raw(vec![0x07].try_into().expect("succeeds")),
                        twitter: pallet_identity::Data::Raw(
                            vec![0x08].try_into().expect("succeeds")
                        ),
                    }
                },
            );

            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_identity {
                    info: IdentityInfo {
                        display: Data {
                            has_data: true,
                            value: vec![0xff].try_into().expect("succeeds"),
                        },
                        ..Default::default()
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            let identity =
                pallet_identity::IdentityOf::<Runtime>::get(AccountId::from(Bob)).expect("exists");
            let encoded_byte_size = identity.info.encoded_size() as u32;
            let byte_deposit = ByteDeposit::get().saturating_mul(encoded_byte_size as u64);
            assert_eq!(
                identity,
                pallet_identity::Registration::<Balance, MaxRegistrars, _> {
                    judgements: Default::default(),
                    deposit: (BasicDeposit::get() + byte_deposit).into(),
                    info: pallet_identity::legacy::IdentityInfo::<MaxAdditionalFields> {
                        additional: Default::default(),
                        display: pallet_identity::Data::Raw(
                            vec![0xff].try_into().expect("succeeds")
                        ),
                        legal: pallet_identity::Data::None,
                        web: pallet_identity::Data::None,
                        riot: pallet_identity::Data::None,
                        email: pallet_identity::Data::None,
                        pgp_fingerprint: None,
                        image: pallet_identity::Data::None,
                        twitter: pallet_identity::Data::None,
                    }
                },
            );
        })
}

#[test]
fn test_set_subs_works_if_identity_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_identity {
                    info: IdentityInfo {
                        display: Data {
                            has_data: true,
                            value: vec![0x01].try_into().expect("succeeds"),
                        },
                        ..Default::default()
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            let identity =
                pallet_identity::IdentityOf::<Runtime>::get(AccountId::from(Bob)).expect("exists");
            let encoded_byte_size = identity.info.encoded_size() as u32;
            let byte_deposit = ByteDeposit::get().saturating_mul(encoded_byte_size as u64);
            assert_eq!(
                identity,
                pallet_identity::Registration::<Balance, MaxRegistrars, _> {
                    judgements: Default::default(),
                    deposit: (BasicDeposit::get() + byte_deposit).into(),
                    info: pallet_identity::legacy::IdentityInfo::<MaxAdditionalFields> {
                        additional: Default::default(),
                        display: pallet_identity::Data::Raw(
                            vec![0x01].try_into().expect("succeeds")
                        ),
                        legal: pallet_identity::Data::None,
                        web: pallet_identity::Data::None,
                        riot: pallet_identity::Data::None,
                        email: pallet_identity::Data::None,
                        pgp_fingerprint: None,
                        image: pallet_identity::Data::None,
                        twitter: pallet_identity::Data::None,
                    }
                },
            );

            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_subs {
                    subs: vec![
                        (
                            Address(Charlie.into()),
                            Data {
                                has_data: true,
                                value: vec![0x01].try_into().expect("succeeds"),
                            }
                        ),
                        (
                            Address(David.into()),
                            Data {
                                has_data: true,
                                value: vec![0x02].try_into().expect("succeeds"),
                            }
                        )
                    ]
                    .into()
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_eq!(
                <pallet_identity::SubsOf<Runtime>>::get(AccountId::from(Bob)),
                (
                    SubAccountDeposit::get() as u128 * 2,
                    vec![Charlie.into(), David.into(),]
                        .try_into()
                        .expect("succeeds")
                ),
            );
        })
}

#[test]
fn test_set_subs_fails_if_identity_not_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_subs {
                    subs: vec![
                        (
                            Address(Charlie.into()),
                            Data {
                                has_data: true,
                                value: vec![0x01].try_into().expect("succeeds"),
                            }
                        ),
                        (
                            Address(David.into()),
                            Data {
                                has_data: true,
                                value: vec![0x02].try_into().expect("succeeds"),
                            }
                        )
                    ]
                    .into()
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_eq!(
                events(),
                vec![RuntimeEvent::Evm(pallet_evm::Event::ExecutedFailed {
                    address: Precompile1.into()
                }),]
            );
        })
}

#[test]
fn test_clear_identity_works_if_identity_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_identity {
                    info: IdentityInfo {
                        display: Data {
                            has_data: true,
                            value: vec![0x01].try_into().expect("succeeds"),
                        },
                        ..Default::default()
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            let identity =
                pallet_identity::IdentityOf::<Runtime>::get(AccountId::from(Bob)).expect("exists");
            let encoded_byte_size = identity.info.encoded_size() as u32;
            let byte_deposit = ByteDeposit::get().saturating_mul(encoded_byte_size as u64);
            assert_eq!(
                identity,
                pallet_identity::Registration::<Balance, MaxRegistrars, _> {
                    judgements: Default::default(),
                    deposit: (BasicDeposit::get() + byte_deposit).into(),
                    info: pallet_identity::legacy::IdentityInfo::<MaxAdditionalFields> {
                        additional: Default::default(),
                        display: pallet_identity::Data::Raw(
                            vec![0x01].try_into().expect("succeeds")
                        ),
                        legal: pallet_identity::Data::None,
                        web: pallet_identity::Data::None,
                        riot: pallet_identity::Data::None,
                        email: pallet_identity::Data::None,
                        pgp_fingerprint: None,
                        image: pallet_identity::Data::None,
                        twitter: pallet_identity::Data::None,
                    }
                },
            );

            assert_ok!(
                RuntimeCall::Evm(evm_call(Bob, PCall::clear_identity {}.into()))
                    .dispatch(RuntimeOrigin::root())
            );

            assert!(events().contains(&Into::<crate::mock::RuntimeEvent>::into(
                IdentityEvent::IdentityCleared {
                    who: Bob.into(),
                    deposit: (BasicDeposit::get() + byte_deposit).into(),
                }
            )));
            assert!(events().contains(
                &EvmEvent::Log {
                    log: log1(
                        Precompile1,
                        SELECTOR_LOG_IDENTITY_CLEARED,
                        solidity::encode_event_data(
							Address(Bob.into()), // who
						),
                    ),
                }
                .into()
            ));

            assert_eq!(
                pallet_identity::IdentityOf::<Runtime>::get(AccountId::from(Bob)),
                None,
            );
        })
}

#[test]
fn test_clear_identity_fails_if_no_identity_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(
                RuntimeCall::Evm(evm_call(Bob, PCall::clear_identity {}.into()))
                    .dispatch(RuntimeOrigin::root())
            );

            assert_eq!(
                events(),
                vec![RuntimeEvent::Evm(pallet_evm::Event::ExecutedFailed {
                    address: Precompile1.into()
                }),]
            );
        })
}

#[test]
fn test_request_judgement_works_if_identity_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            // add Alice as registrar
            assert_ok!(Identity::add_registrar(
                RuntimeOrigin::signed(RegistrarAndForceOrigin.into()),
                Alice.into(),
            ));
            assert_ok!(RuntimeCall::Evm(evm_call(
                Alice,
                PCall::set_fee {
                    index: 0,
                    fee: 100.into(),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            // Set Bob's identity
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_identity {
                    info: IdentityInfo {
                        display: Data {
                            has_data: true,
                            value: vec![0x01].try_into().expect("succeeds"),
                        },
                        ..Default::default()
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::request_judgement {
                    reg_index: 0,
                    max_fee: 1000u64.into(),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert!(events().contains(&Into::<crate::mock::RuntimeEvent>::into(
                IdentityEvent::JudgementRequested {
                    who: Bob.into(),
                    registrar_index: 0,
                }
            )));
            assert!(events().contains(
                &EvmEvent::Log {
                    log: log1(
                        Precompile1,
                        SELECTOR_LOG_JUDGEMENT_REQUESTED,
                        solidity::encode_event_data((
                            Address(Bob.into()), // who
                            0u32,                // registrar_index
                        )),
                    ),
                }
                .into()
            ));

            assert_eq!(
                pallet_identity::IdentityOf::<Runtime>::get(AccountId::from(Bob))
                    .expect("exists")
                    .judgements
                    .to_vec(),
                vec![(0, pallet_identity::Judgement::FeePaid(100))],
            );
        })
}

#[test]
fn test_cancel_request_works_if_identity_judgement_requested() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            // add Alice as registrar
            assert_ok!(Identity::add_registrar(
                RuntimeOrigin::signed(RegistrarAndForceOrigin.into()),
                Alice.into(),
            ));
            assert_ok!(RuntimeCall::Evm(evm_call(
                Alice,
                PCall::set_fee {
                    index: 0,
                    fee: 100.into(),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            // Set Bob's identity
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_identity {
                    info: IdentityInfo {
                        display: Data {
                            has_data: true,
                            value: vec![0x01].try_into().expect("succeeds"),
                        },
                        ..Default::default()
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            // Request judgement
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::request_judgement {
                    reg_index: 0,
                    max_fee: 1000u64.into(),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::cancel_request { reg_index: 0 }.into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert!(events().contains(&Into::<crate::mock::RuntimeEvent>::into(
                IdentityEvent::JudgementUnrequested {
                    who: Bob.into(),
                    registrar_index: 0,
                }
            )));
            assert!(events().contains(
                &EvmEvent::Log {
                    log: log1(
                        Precompile1,
                        SELECTOR_LOG_JUDGEMENT_UNREQUESTED,
                        solidity::encode_event_data((
                            Address(Bob.into()), // who
                            0u32,                // registrar_index
                        )),
                    ),
                }
                .into()
            ));

            assert_eq!(
                pallet_identity::IdentityOf::<Runtime>::get(AccountId::from(Bob))
                    .expect("exists")
                    .judgements
                    .to_vec(),
                vec![],
            );
        })
}

#[test]
fn test_provide_judgement_works_if_identity_judgement_requested() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            // add Alice as registrar
            assert_ok!(Identity::add_registrar(
                RuntimeOrigin::signed(RegistrarAndForceOrigin.into()),
                Alice.into(),
            ));
            assert_ok!(RuntimeCall::Evm(evm_call(
                Alice,
                PCall::set_fee {
                    index: 0,
                    fee: 100.into(),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            // Set Bob's identity
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_identity {
                    info: IdentityInfo {
                        display: Data {
                            has_data: true,
                            value: vec![0x01].try_into().expect("succeeds"),
                        },
                        ..Default::default()
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            // Request judgement
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::request_judgement {
                    reg_index: 0,
                    max_fee: 1000u64.into(),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            let identity = pallet_identity::Registration::<Balance, MaxRegistrars, _> {
                judgements: Default::default(),
                deposit: BasicDeposit::get() as u128,
                info: pallet_identity::legacy::IdentityInfo::<MaxAdditionalFields> {
                    additional: Default::default(),
                    display: pallet_identity::Data::Raw(vec![0x01].try_into().expect("succeeds")),
                    legal: pallet_identity::Data::None,
                    web: pallet_identity::Data::None,
                    riot: pallet_identity::Data::None,
                    email: pallet_identity::Data::None,
                    pgp_fingerprint: None,
                    image: pallet_identity::Data::None,
                    twitter: pallet_identity::Data::None,
                },
            };

            assert_eq!(
                pallet_identity::IdentityOf::<Runtime>::get(AccountId::from(Bob))
                    .expect("exists")
                    .info,
                identity.info
            );

            assert_ok!(RuntimeCall::Evm(evm_call(
                Alice,
                PCall::provide_judgement {
                    reg_index: 0,
                    target: Address(Bob.into()),
                    judgement: Judgement {
                        is_reasonable: true,
                        ..Default::default()
                    },
                    identity: <Runtime as frame_system::Config>::Hashing::hash_of(&identity.info),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert!(events().contains(&Into::<crate::mock::RuntimeEvent>::into(
                IdentityEvent::JudgementGiven {
                    target: Bob.into(),
                    registrar_index: 0,
                }
            )));
            assert!(events().contains(
                &EvmEvent::Log {
                    log: log1(
                        Precompile1,
                        SELECTOR_LOG_JUDGEMENT_GIVEN,
                        solidity::encode_event_data((
                            Address(Bob.into()), // target
                            0u32,                // registrar_index
                        )),
                    ),
                }
                .into()
            ));

            assert_eq!(
                pallet_identity::IdentityOf::<Runtime>::get(AccountId::from(Bob))
                    .expect("exists")
                    .judgements
                    .to_vec(),
                vec![(0, pallet_identity::Judgement::Reasonable)],
            );
        })
}

#[test]
fn test_add_sub_works_if_identity_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            // Set Bob's identity
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_identity {
                    info: IdentityInfo {
                        display: Data {
                            has_data: true,
                            value: vec![0x01].try_into().expect("succeeds"),
                        },
                        ..Default::default()
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::add_sub {
                    sub: Address(Charlie.into()),
                    data: Data {
                        has_data: true,
                        value: vec![0x01].try_into().expect("succeeds"),
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert!(events().contains(&Into::<crate::mock::RuntimeEvent>::into(
                IdentityEvent::SubIdentityAdded {
                    sub: Charlie.into(),
                    main: Bob.into(),
                    deposit: SubAccountDeposit::get() as u128,
                }
            )));
            assert!(events().contains(
                &EvmEvent::Log {
                    log: log1(
                        Precompile1,
                        SELECTOR_LOG_SUB_IDENTITY_ADDED,
                        solidity::encode_event_data((
                            Address(Charlie.into()), // sub
                            Address(Bob.into()),     // main
                        )),
                    ),
                }
                .into()
            ));

            assert_eq!(
                <pallet_identity::SubsOf<Runtime>>::get(AccountId::from(Bob)),
                (
                    SubAccountDeposit::get() as u128,
                    vec![Charlie.into()].try_into().expect("succeeds")
                ),
            );
        })
}

#[test]
fn test_rename_sub_works_if_identity_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            // Set Bob's identity
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_identity {
                    info: IdentityInfo {
                        display: Data {
                            has_data: true,
                            value: vec![0x01].try_into().expect("succeeds"),
                        },
                        ..Default::default()
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::add_sub {
                    sub: Address(Charlie.into()),
                    data: Data {
                        has_data: true,
                        value: vec![0xff].try_into().expect("succeeds"),
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::rename_sub {
                    sub: Address(Charlie.into()),
                    data: Data {
                        has_data: true,
                        value: vec![0xaa].try_into().expect("succeeds"),
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_eq!(
                pallet_identity::SuperOf::<Runtime>::get(AccountId::from(Charlie)),
                Some((
                    AccountId::from(Bob),
                    pallet_identity::Data::Raw(vec![0xaa].try_into().expect("succeeds"))
                )),
            );
        })
}

#[test]
fn test_remove_sub_works_if_identity_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            // Set Bob's identity
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_identity {
                    info: IdentityInfo {
                        display: Data {
                            has_data: true,
                            value: vec![0x01].try_into().expect("succeeds"),
                        },
                        ..Default::default()
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::add_sub {
                    sub: Address(Charlie.into()),
                    data: Data {
                        has_data: true,
                        value: vec![0xff].try_into().expect("succeeds"),
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::remove_sub {
                    sub: Address(Charlie.into()),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert!(events().contains(&Into::<crate::mock::RuntimeEvent>::into(
                IdentityEvent::SubIdentityRemoved {
                    sub: Charlie.into(),
                    main: Bob.into(),
                    deposit: SubAccountDeposit::get() as u128,
                }
            )));
            assert!(events().contains(
                &EvmEvent::Log {
                    log: log1(
                        Precompile1,
                        SELECTOR_LOG_SUB_IDENTITY_REMOVED,
                        solidity::encode_event_data((
                            Address(Charlie.into()), // sub
                            Address(Bob.into()),     // main
                        )),
                    ),
                }
                .into()
            ));

            assert_eq!(
                pallet_identity::SuperOf::<Runtime>::get(AccountId::from(Charlie)),
                None,
            );
        })
}

#[test]
fn test_quit_sub_works_if_identity_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            // Set Bob's identity
            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::set_identity {
                    info: IdentityInfo {
                        display: Data {
                            has_data: true,
                            value: vec![0x01].try_into().expect("succeeds"),
                        },
                        ..Default::default()
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_ok!(RuntimeCall::Evm(evm_call(
                Bob,
                PCall::add_sub {
                    sub: Address(Charlie.into()),
                    data: Data {
                        has_data: true,
                        value: vec![0xff].try_into().expect("succeeds"),
                    },
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_ok!(
                RuntimeCall::Evm(evm_call(Charlie, PCall::quit_sub {}.into()))
                    .dispatch(RuntimeOrigin::root())
            );

            assert!(events().contains(&Into::<crate::mock::RuntimeEvent>::into(
                IdentityEvent::SubIdentityRevoked {
                    sub: Charlie.into(),
                    main: Bob.into(),
                    deposit: SubAccountDeposit::get() as u128,
                }
            )));
            assert!(events().contains(
                &EvmEvent::Log {
                    log: log1(
                        Precompile1,
                        SELECTOR_LOG_SUB_IDENTITY_REVOKED,
                        solidity::encode_event_data(
							Address(Charlie.into()), // sub
						),
                    ),
                }
                .into()
            ));

            assert_eq!(
                pallet_identity::SuperOf::<Runtime>::get(AccountId::from(Charlie)),
                None,
            );
        })
}

#[test]
fn test_identity_returns_none_if_not_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::identity {
                        who: H160::from(Alice).into(),
                    },
                )
                .expect_no_logs()
                .execute_returns(Registration::<MaxAdditionalFields>::default());
        })
}

#[test]
fn test_identity_returns_valid_data_for_identity_info() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            let identity = pallet_identity::legacy::IdentityInfo::<MaxAdditionalFields> {
                additional: vec![
                    (
                        pallet_identity::Data::Raw(vec![0xa1].try_into().expect("succeeds")),
                        pallet_identity::Data::Raw(vec![0xb1].try_into().expect("succeeds")),
                    ),
                    (
                        pallet_identity::Data::Raw(vec![0xa2].try_into().expect("succeeds")),
                        pallet_identity::Data::Raw(vec![0xb2].try_into().expect("succeeds")),
                    ),
                ]
                .try_into()
                .expect("succeeds"),
                display: pallet_identity::Data::Raw(vec![0x01].try_into().expect("succeeds")),
                legal: pallet_identity::Data::Raw(vec![0x02].try_into().expect("succeeds")),
                web: pallet_identity::Data::Raw(vec![0x03].try_into().expect("succeeds")),
                riot: pallet_identity::Data::Raw(vec![0x04].try_into().expect("succeeds")),
                email: pallet_identity::Data::Raw(vec![0x05].try_into().expect("succeeds")),
                pgp_fingerprint: Some([0x06; 20].try_into().expect("succeeds")),
                image: pallet_identity::Data::Raw(vec![0x07].try_into().expect("succeeds")),
                twitter: pallet_identity::Data::Raw(vec![0x08].try_into().expect("succeeds")),
            };
            assert_ok!(Identity::set_identity(
                RuntimeOrigin::signed(Bob.into()),
                Box::new(identity.clone())
            ));

            let encoded_byte_size = identity.encoded_size() as u32;
            let byte_deposit = ByteDeposit::get().saturating_mul(encoded_byte_size as u64);
            precompiles()
                .prepare_test(
                    Bob,
                    Precompile1,
                    PCall::identity {
                        who: H160::from(Bob).into(),
                    },
                )
                .expect_no_logs()
                .execute_returns(Registration {
                    is_valid: true,
                    judgements: vec![],
                    deposit: (BasicDeposit::get() + byte_deposit).into(),
                    info: IdentityInfo::<MaxAdditionalFields> {
                        additional: vec![
                            (
                                Data {
                                    has_data: true,
                                    value: vec![0xa1].try_into().expect("succeeds"),
                                },
                                Data {
                                    has_data: true,
                                    value: vec![0xb1].try_into().expect("succeeds"),
                                },
                            ),
                            (
                                Data {
                                    has_data: true,
                                    value: vec![0xa2].try_into().expect("succeeds"),
                                },
                                Data {
                                    has_data: true,
                                    value: vec![0xb2].try_into().expect("succeeds"),
                                },
                            ),
                        ]
                        .try_into()
                        .expect("succeeds"),
                        display: Data {
                            has_data: true,
                            value: vec![0x01].try_into().expect("succeeds"),
                        },
                        legal: Data {
                            has_data: true,
                            value: vec![0x02].try_into().expect("succeeds"),
                        },
                        web: Data {
                            has_data: true,
                            value: vec![0x03].try_into().expect("succeeds"),
                        },
                        riot: Data {
                            has_data: true,
                            value: vec![0x04].try_into().expect("succeeds"),
                        },
                        email: Data {
                            has_data: true,
                            value: vec![0x05].try_into().expect("succeeds"),
                        },
                        has_pgp_fingerprint: true,
                        pgp_fingerprint: [0x06; 20].try_into().expect("succeeds"),
                        image: Data {
                            has_data: true,
                            value: vec![0x07].try_into().expect("succeeds"),
                        },
                        twitter: Data {
                            has_data: true,
                            value: vec![0x08].try_into().expect("succeeds"),
                        },
                    },
                });
        })
}

#[test]
fn test_identity_returns_valid_data_for_requested_judgement() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(Identity::add_registrar(
                RuntimeOrigin::signed(RegistrarAndForceOrigin.into()),
                Alice.into(),
            ));
            assert_ok!(Identity::set_fee(
                RuntimeOrigin::signed(Alice.into()),
                0,
                100,
            ));

            let identity = pallet_identity::legacy::IdentityInfo::<MaxAdditionalFields> {
                additional: Default::default(),
                display: pallet_identity::Data::Raw(vec![0x01].try_into().expect("succeeds")),
                legal: pallet_identity::Data::None,
                web: pallet_identity::Data::None,
                riot: pallet_identity::Data::None,
                email: pallet_identity::Data::None,
                pgp_fingerprint: None,
                image: pallet_identity::Data::None,
                twitter: pallet_identity::Data::None,
            };

            assert_ok!(Identity::set_identity(
                RuntimeOrigin::signed(Bob.into()),
                Box::new(identity.clone()),
            ));
            assert_ok!(Identity::request_judgement(
                RuntimeOrigin::signed(Bob.into()),
                0,
                1000,
            ));

            let encoded_byte_size = identity.encoded_size() as u32;
            let byte_deposit = ByteDeposit::get().saturating_mul(encoded_byte_size as u64);
            precompiles()
                .prepare_test(
                    Bob,
                    Precompile1,
                    PCall::identity {
                        who: H160::from(Bob).into(),
                    },
                )
                .expect_no_logs()
                .execute_returns(Registration {
                    is_valid: true,
                    judgements: vec![(
                        0,
                        Judgement {
                            is_fee_paid: true,
                            fee_paid_deposit: 100.into(),
                            ..Default::default()
                        },
                    )],
                    deposit: (BasicDeposit::get() + byte_deposit).into(),
                    info: IdentityInfo::<MaxAdditionalFields> {
                        additional: Default::default(),
                        display: Data {
                            has_data: true,
                            value: vec![0x01].try_into().expect("succeeds"),
                        },
                        legal: Default::default(),
                        web: Default::default(),
                        riot: Default::default(),
                        email: Default::default(),
                        has_pgp_fingerprint: Default::default(),
                        pgp_fingerprint: Default::default(),
                        image: Default::default(),
                        twitter: Default::default(),
                    },
                });
        })
}

#[test]
fn test_identity_returns_valid_data_for_judged_identity() {
    struct TestCase {
        input_judgement: pallet_identity::Judgement<crate::BalanceOf<Runtime>>,
        expected_judgement: Judgement,
    }
    for test_case in [
        TestCase {
            input_judgement: pallet_identity::Judgement::Unknown,
            expected_judgement: Judgement {
                is_unknown: true,
                ..Default::default()
            },
        },
        TestCase {
            input_judgement: pallet_identity::Judgement::Reasonable,
            expected_judgement: Judgement {
                is_reasonable: true,
                ..Default::default()
            },
        },
        TestCase {
            input_judgement: pallet_identity::Judgement::KnownGood,
            expected_judgement: Judgement {
                is_known_good: true,
                ..Default::default()
            },
        },
        TestCase {
            input_judgement: pallet_identity::Judgement::OutOfDate,
            expected_judgement: Judgement {
                is_out_of_date: true,
                ..Default::default()
            },
        },
        TestCase {
            input_judgement: pallet_identity::Judgement::LowQuality,
            expected_judgement: Judgement {
                is_low_quality: true,
                ..Default::default()
            },
        },
        TestCase {
            input_judgement: pallet_identity::Judgement::Erroneous,
            expected_judgement: Judgement {
                is_erroneous: true,
                ..Default::default()
            },
        },
    ] {
        println!("Test Case - judgement {:?}", test_case.input_judgement);

        ExtBuilder::default()
            .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
            .build()
            .execute_with(|| {
                assert_ok!(Identity::add_registrar(
                    RuntimeOrigin::signed(RegistrarAndForceOrigin.into()),
                    Alice.into(),
                ));
                let identity = pallet_identity::legacy::IdentityInfo::<MaxAdditionalFields> {
                    additional: Default::default(),
                    display: pallet_identity::Data::Raw(vec![0x01].try_into().expect("succeeds")),
                    legal: pallet_identity::Data::None,
                    web: pallet_identity::Data::None,
                    riot: pallet_identity::Data::None,
                    email: pallet_identity::Data::None,
                    pgp_fingerprint: None,
                    image: pallet_identity::Data::None,
                    twitter: pallet_identity::Data::None,
                };
                let identity_hash = <Runtime as frame_system::Config>::Hashing::hash_of(&identity);

                assert_ok!(Identity::set_identity(
                    RuntimeOrigin::signed(Bob.into()),
                    Box::new(identity.clone()),
                ));
                assert_ok!(Identity::request_judgement(
                    RuntimeOrigin::signed(Bob.into()),
                    0,
                    1000,
                ));
                assert_ok!(Identity::provide_judgement(
                    RuntimeOrigin::signed(Alice.into()),
                    0,
                    Bob.into(),
                    test_case.input_judgement,
                    identity_hash,
                ));

                let encoded_byte_size = identity.encoded_size() as u32;
                let byte_deposit = ByteDeposit::get().saturating_mul(encoded_byte_size as u64);
                precompiles()
                    .prepare_test(
                        Bob,
                        Precompile1,
                        PCall::identity {
                            who: H160::from(Bob).into(),
                        },
                    )
                    .expect_no_logs()
                    .execute_returns(Registration {
                        is_valid: true,
                        judgements: vec![(0, test_case.expected_judgement)],
                        deposit: (BasicDeposit::get() + byte_deposit).into(),
                        info: IdentityInfo::<MaxAdditionalFields> {
                            additional: Default::default(),
                            display: Data {
                                has_data: true,
                                value: vec![0x01].try_into().expect("succeeds"),
                            },
                            legal: Default::default(),
                            web: Default::default(),
                            riot: Default::default(),
                            email: Default::default(),
                            has_pgp_fingerprint: Default::default(),
                            pgp_fingerprint: Default::default(),
                            image: Default::default(),
                            twitter: Default::default(),
                        },
                    });
            })
    }
}

#[test]
fn test_super_of_returns_empty_if_not_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(Identity::set_identity(
                RuntimeOrigin::signed(Bob.into()),
                Box::new(
                    pallet_identity::legacy::IdentityInfo::<MaxAdditionalFields> {
                        additional: Default::default(),
                        display: pallet_identity::Data::Raw(
                            vec![0x01].try_into().expect("succeeds")
                        ),
                        legal: pallet_identity::Data::None,
                        web: pallet_identity::Data::None,
                        riot: pallet_identity::Data::None,
                        email: pallet_identity::Data::None,
                        pgp_fingerprint: None,
                        image: pallet_identity::Data::None,
                        twitter: pallet_identity::Data::None,
                    }
                ),
            ));

            precompiles()
                .prepare_test(
                    Bob,
                    Precompile1,
                    PCall::super_of {
                        who: H160::from(Charlie).into(),
                    },
                )
                .expect_no_logs()
                .execute_returns(SuperOf {
                    is_valid: false,
                    ..Default::default()
                });
        })
}

#[test]
fn test_super_of_returns_account_if_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(Identity::set_identity(
                RuntimeOrigin::signed(Bob.into()),
                Box::new(
                    pallet_identity::legacy::IdentityInfo::<MaxAdditionalFields> {
                        additional: Default::default(),
                        display: pallet_identity::Data::Raw(
                            vec![0x01].try_into().expect("succeeds")
                        ),
                        legal: pallet_identity::Data::None,
                        web: pallet_identity::Data::None,
                        riot: pallet_identity::Data::None,
                        email: pallet_identity::Data::None,
                        pgp_fingerprint: None,
                        image: pallet_identity::Data::None,
                        twitter: pallet_identity::Data::None,
                    }
                ),
            ));
            assert_ok!(Identity::add_sub(
                RuntimeOrigin::signed(Bob.into()),
                Charlie.into(),
                pallet_identity::Data::Raw(vec![0x01].try_into().expect("succeeds")),
            ));

            precompiles()
                .prepare_test(
                    Bob,
                    Precompile1,
                    PCall::super_of {
                        who: H160::from(Charlie).into(),
                    },
                )
                .expect_no_logs()
                .execute_returns(SuperOf {
                    is_valid: true,
                    account: H160::from(Bob).into(),
                    data: Data {
                        has_data: true,
                        value: vec![0x01].try_into().expect("succeeds"),
                    },
                });
        })
}

#[test]
fn test_subs_of_returns_empty_if_not_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(Identity::set_identity(
                RuntimeOrigin::signed(Bob.into()),
                Box::new(
                    pallet_identity::legacy::IdentityInfo::<MaxAdditionalFields> {
                        additional: Default::default(),
                        display: pallet_identity::Data::Raw(
                            vec![0x01].try_into().expect("succeeds")
                        ),
                        legal: pallet_identity::Data::None,
                        web: pallet_identity::Data::None,
                        riot: pallet_identity::Data::None,
                        email: pallet_identity::Data::None,
                        pgp_fingerprint: None,
                        image: pallet_identity::Data::None,
                        twitter: pallet_identity::Data::None,
                    }
                ),
            ));

            precompiles()
                .prepare_test(
                    Bob,
                    Precompile1,
                    PCall::subs_of {
                        who: H160::from(Bob).into(),
                    },
                )
                .expect_no_logs()
                .execute_returns(SubsOf {
                    deposit: 0.into(),
                    accounts: vec![],
                });
        })
}

#[test]
fn test_subs_of_returns_account_if_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(Identity::set_identity(
                RuntimeOrigin::signed(Bob.into()),
                Box::new(
                    pallet_identity::legacy::IdentityInfo::<MaxAdditionalFields> {
                        additional: Default::default(),
                        display: pallet_identity::Data::Raw(
                            vec![0x01].try_into().expect("succeeds")
                        ),
                        legal: pallet_identity::Data::None,
                        web: pallet_identity::Data::None,
                        riot: pallet_identity::Data::None,
                        email: pallet_identity::Data::None,
                        pgp_fingerprint: None,
                        image: pallet_identity::Data::None,
                        twitter: pallet_identity::Data::None,
                    }
                ),
            ));
            assert_ok!(Identity::add_sub(
                RuntimeOrigin::signed(Bob.into()),
                Charlie.into(),
                pallet_identity::Data::Raw(vec![0x01].try_into().expect("succeeds")),
            ));

            precompiles()
                .prepare_test(
                    Bob,
                    Precompile1,
                    PCall::subs_of {
                        who: H160::from(Bob).into(),
                    },
                )
                .expect_no_logs()
                .execute_returns(SubsOf {
                    deposit: SubAccountDeposit::get().into(),
                    accounts: vec![H160::from(Charlie).into()],
                });
        })
}

#[test]
fn test_registrars_returns_empty_if_none_present() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(Bob, Precompile1, PCall::registrars {})
                .expect_no_logs()
                .execute_returns(Vec::<Registrar>::new());
        })
}

#[test]
fn test_registrars_returns_account_if_set() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100_000), (Bob.into(), 100_000)])
        .build()
        .execute_with(|| {
            assert_ok!(Identity::add_registrar(
                RuntimeOrigin::signed(RegistrarAndForceOrigin.into()),
                Alice.into(),
            ));

            precompiles()
                .prepare_test(Bob, Precompile1, PCall::registrars {})
                .expect_no_logs()
                .execute_returns(vec![Registrar {
                    index: 0,
                    is_valid: true,
                    account: H160::from(Alice).into(),
                    fee: 0u128.into(),
                    fields: Default::default(),
                }]);
        })
}
