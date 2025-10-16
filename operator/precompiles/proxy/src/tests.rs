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
    assert_event_emitted, assert_event_not_emitted,
    mock::{
        AccountId, ExtBuilder, PCall, PrecompilesValue, ProxyType, Runtime, RuntimeCall,
        RuntimeEvent, RuntimeOrigin,
    },
};
use frame_support::assert_ok;
use pallet_evm::Call as EvmCall;
use pallet_proxy::{
    Call as ProxyCall, Event as ProxyEvent, Pallet as ProxyPallet, ProxyDefinition,
};
use precompile_utils::{precompile_set::AddressU64, prelude::*, testing::*};
use sp_core::{Get, H160, H256, U256};
use sp_runtime::traits::Dispatchable;
use std::cell::Cell;
use std::rc::Rc;
use std::str::from_utf8;

#[test]
fn test_selector_less_than_four_bytes_reverts() {
    ExtBuilder::default().build().execute_with(|| {
        PrecompilesValue::get()
            .prepare_test(Alice, Precompile1, vec![1u8, 2, 3])
            .execute_reverts(|output| output == b"Tried to read selector out of bounds");
    });
}

#[test]
fn test_unimplemented_selector_reverts() {
    ExtBuilder::default().build().execute_with(|| {
        PrecompilesValue::get()
            .prepare_test(Alice, Precompile1, vec![1u8, 2, 3, 4])
            .execute_reverts(|output| output == b"Unknown selector");
    });
}

#[test]
fn selectors() {
    assert!(PCall::add_proxy_selectors().contains(&0x74a34dd3));
    assert!(PCall::remove_proxy_selectors().contains(&0xfef3f708));
    assert!(PCall::remove_proxies_selectors().contains(&0x14a5b5fa));
    assert!(PCall::proxy_selectors().contains(&0x0d3cff86));
    assert!(PCall::proxy_force_type_selectors().contains(&0x4a36b2cd));
    assert!(PCall::is_proxy_selectors().contains(&0xe26d38ed));
}

#[test]
fn modifiers() {
    ExtBuilder::default().build().execute_with(|| {
        let mut tester =
            PrecompilesModifierTester::new(PrecompilesValue::get(), Alice, Precompile1);

        tester.test_default_modifier(PCall::add_proxy_selectors());
        tester.test_default_modifier(PCall::remove_proxy_selectors());
        tester.test_default_modifier(PCall::remove_proxies_selectors());
        tester.test_payable_modifier(PCall::proxy_selectors());
        tester.test_payable_modifier(PCall::proxy_force_type_selectors());
        tester.test_view_modifier(PCall::is_proxy_selectors());
    });
}

#[test]
fn test_add_proxy_fails_if_invalid_value_for_proxy_type() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::add_proxy {
                        delegate: Address(Bob.into()),
                        proxy_type: 10,
                        delay: 0,
                    },
                )
                .execute_reverts(|o| o == b"proxyType: Failed decoding value to ProxyType");
        })
}

#[test]
fn test_add_proxy_fails_if_duplicate_proxy() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Proxy(ProxyCall::add_proxy {
                delegate: Bob.into(),
                proxy_type: ProxyType::Something,
                delay: 0,
            })
            .dispatch(RuntimeOrigin::signed(Alice.into())));

            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::add_proxy {
                        delegate: Address(Bob.into()),
                        proxy_type: ProxyType::Something as u8,
                        delay: 0,
                    },
                )
                .execute_reverts(|o| o == b"Cannot add more than one proxy");
        })
}

#[test]
fn test_add_proxy_fails_if_less_permissive_proxy() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Proxy(ProxyCall::add_proxy {
                delegate: Bob.into(),
                proxy_type: ProxyType::Something,
                delay: 0,
            })
            .dispatch(RuntimeOrigin::signed(Alice.into())));

            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::add_proxy {
                        delegate: Address(Bob.into()),
                        proxy_type: ProxyType::Nothing as u8,
                        delay: 0,
                    },
                )
                .execute_reverts(|o| o == b"Cannot add more than one proxy");
        })
}

#[test]
fn test_add_proxy_fails_if_more_permissive_proxy() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Proxy(ProxyCall::add_proxy {
                delegate: Bob.into(),
                proxy_type: ProxyType::Something,
                delay: 0,
            })
            .dispatch(RuntimeOrigin::signed(Alice.into())));

            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::add_proxy {
                        delegate: Address(Bob.into()),
                        proxy_type: ProxyType::Any as u8,
                        delay: 0,
                    },
                )
                .execute_reverts(|o| o == b"Cannot add more than one proxy");
        })
}

#[test]
fn test_add_proxy_succeeds() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::add_proxy {
                        delegate: Address(Bob.into()),
                        proxy_type: ProxyType::Something as u8,
                        delay: 1,
                    },
                )
                .execute_returns(());
            assert_event_emitted!(RuntimeEvent::Proxy(ProxyEvent::ProxyAdded {
                delegator: Alice.into(),
                delegatee: Bob.into(),
                proxy_type: ProxyType::Something,
                delay: 1,
            }));

            let proxies = <ProxyPallet<Runtime>>::proxies(AccountId::from(Alice)).0;
            assert_eq!(
                proxies,
                vec![ProxyDefinition {
                    delegate: Bob.into(),
                    proxy_type: ProxyType::Something,
                    delay: 1,
                }],
            )
        })
}

#[test]
fn test_remove_proxy_fails_if_invalid_value_for_proxy_type() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Proxy(ProxyCall::add_proxy {
                delegate: Bob.into(),
                proxy_type: ProxyType::Something,
                delay: 0,
            })
            .dispatch(RuntimeOrigin::signed(Alice.into())));

            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::remove_proxy {
                        delegate: Address(Bob.into()),
                        proxy_type: 10,
                        delay: 0,
                    },
                )
                .execute_reverts(|o| o == b"proxyType: Failed decoding value to ProxyType");
        })
}

#[test]
fn test_remove_proxy_fails_if_proxy_not_exist() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::remove_proxy {
                        delegate: Address(Bob.into()),
                        proxy_type: ProxyType::Something as u8,
                        delay: 0,
                    },
                )
                .execute_reverts(|output| from_utf8(&output).unwrap().contains("NotFound"));
        })
}

#[test]
fn test_remove_proxy_succeeds() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Proxy(ProxyCall::add_proxy {
                delegate: Bob.into(),
                proxy_type: ProxyType::Something,
                delay: 0,
            })
            .dispatch(RuntimeOrigin::signed(Alice.into())));

            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::remove_proxy {
                        delegate: Address(Bob.into()),
                        proxy_type: ProxyType::Something as u8,
                        delay: 0,
                    },
                )
                .execute_returns(());
            assert_event_emitted!(RuntimeEvent::Proxy(ProxyEvent::ProxyRemoved {
                delegator: Alice.into(),
                delegatee: Bob.into(),
                proxy_type: ProxyType::Something,
                delay: 0,
            }));

            let proxies = <ProxyPallet<Runtime>>::proxies(AccountId::from(Alice)).0;
            assert_eq!(proxies, vec![])
        })
}

#[test]
fn test_remove_proxies_succeeds() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Proxy(ProxyCall::add_proxy {
                delegate: Bob.into(),
                proxy_type: ProxyType::Something,
                delay: 0,
            })
            .dispatch(RuntimeOrigin::signed(Alice.into())));
            assert_ok!(RuntimeCall::Proxy(ProxyCall::add_proxy {
                delegate: Charlie.into(),
                proxy_type: ProxyType::Any,
                delay: 0,
            })
            .dispatch(RuntimeOrigin::signed(Alice.into())));

            PrecompilesValue::get()
                .prepare_test(Alice, Precompile1, PCall::remove_proxies {})
                .execute_returns(());

            let proxies = <ProxyPallet<Runtime>>::proxies(AccountId::from(Alice)).0;
            assert_eq!(proxies, vec![])
        })
}

#[test]
fn test_remove_proxies_succeeds_when_no_proxy_exists() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            PrecompilesValue::get()
                .prepare_test(Alice, Precompile1, PCall::remove_proxies {})
                .execute_returns(());

            let proxies = <ProxyPallet<Runtime>>::proxies(AccountId::from(Alice)).0;
            assert_eq!(proxies, vec![])
        })
}

#[test]
fn test_proxy_force_type_fails_if_invalid_value_for_force_proxy_type() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::proxy_force_type {
                        real: Address(Bob.into()),
                        force_proxy_type: 10,
                        call_to: Address(Alice.into()),
                        call_data: BoundedBytes::from([]),
                    },
                )
                .execute_reverts(|o| o == b"forceProxyType: Failed decoding value to ProxyType");
        })
}

#[test]
fn test_proxy_fails_if_not_proxy() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::proxy {
                        real: Address(Bob.into()),
                        call_to: Address(Alice.into()),
                        call_data: BoundedBytes::from([]),
                    },
                )
                .execute_reverts(|o| o == b"Not proxy");
        })
}

#[test]
fn test_proxy_fails_if_call_filtered() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            // add delayed proxy
            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::add_proxy {
                        delegate: Address(Bob.into()),
                        proxy_type: 2,
                        delay: 0,
                    },
                )
                .execute_returns(());

            // Trying to use delayed proxy without any announcement
            PrecompilesValue::get()
                .prepare_test(
                    Bob,
                    Precompile1,
                    PCall::proxy {
                        real: Address(Alice.into()),
                        call_to: Address(Bob.into()),
                        call_data: BoundedBytes::from([]),
                    },
                )
                .execute_reverts(|o| o == b"CallFiltered");
        })
}

#[test]
fn test_is_proxy_returns_false_if_not_proxy() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::is_proxy {
                        real: Address(Alice.into()),
                        delegate: Address(Bob.into()),
                        proxy_type: ProxyType::Something as u8,
                        delay: 0,
                    },
                )
                .execute_returns(false);
        })
}

#[test]
fn test_is_proxy_returns_false_if_proxy_type_incorrect() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Proxy(ProxyCall::add_proxy {
                delegate: Bob.into(),
                proxy_type: ProxyType::Something,
                delay: 0,
            })
            .dispatch(RuntimeOrigin::signed(Alice.into())));

            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::is_proxy {
                        real: Address(Alice.into()),
                        delegate: Address(Bob.into()),
                        proxy_type: ProxyType::Any as u8,
                        delay: 0,
                    },
                )
                .execute_returns(false);
        })
}

#[test]
fn test_is_proxy_returns_false_if_proxy_delay_incorrect() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Proxy(ProxyCall::add_proxy {
                delegate: Bob.into(),
                proxy_type: ProxyType::Something,
                delay: 1,
            })
            .dispatch(RuntimeOrigin::signed(Alice.into())));

            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::is_proxy {
                        real: Address(Alice.into()),
                        delegate: Address(Bob.into()),
                        proxy_type: ProxyType::Any as u8,
                        delay: 0,
                    },
                )
                .execute_returns(false);
        })
}

#[test]
fn test_is_proxy_returns_true_if_proxy() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Proxy(ProxyCall::add_proxy {
                delegate: Bob.into(),
                proxy_type: ProxyType::Something,
                delay: 1,
            })
            .dispatch(RuntimeOrigin::signed(Alice.into())));

            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::is_proxy {
                        real: Address(Alice.into()),
                        delegate: Address(Bob.into()),
                        proxy_type: ProxyType::Something as u8,
                        delay: 1,
                    },
                )
                .execute_returns(true);
        })
}

#[test]
fn test_nested_evm_bypass_proxy_should_allow_elevating_proxy_type() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 100000000), (Bob.into(), 100000000)])
        .build()
        .execute_with(|| {
            // make Bob a ProxyType::Something for Alice
            assert_ok!(RuntimeCall::Proxy(ProxyCall::add_proxy {
                delegate: Bob.into(),
                proxy_type: ProxyType::Something,
                delay: 0,
            })
            .dispatch(RuntimeOrigin::signed(Alice.into())));

            // construct the call wrapping the add_proxy precompile to escalate to ProxyType::Any
            let add_proxy_precompile = PCall::add_proxy {
                delegate: Address(Bob.into()),
                proxy_type: ProxyType::Any as u8,
                delay: 0,
            }
            .into();

            let evm_call = RuntimeCall::EVM(EvmCall::call {
                source: Alice.into(),
                target: Precompile1.into(),
                input: add_proxy_precompile,
                value: U256::zero(),
                gas_limit: u64::max_value(),
                max_fee_per_gas: 0.into(),
                max_priority_fee_per_gas: Some(U256::zero()),
                nonce: None,
                access_list: Vec::new(),
            });

            // call the evm call in a proxy call
            assert_ok!(<ProxyPallet<Runtime>>::proxy(
                RuntimeOrigin::signed(Bob.into()),
                Alice.into(),
                None,
                Box::new(evm_call)
            ));

            // assert Bob was not assigned ProxyType::Any
            assert_event_not_emitted!(RuntimeEvent::Proxy(ProxyEvent::ProxyAdded {
                delegator: Alice.into(),
                delegatee: Bob.into(),
                proxy_type: ProxyType::Any,
                delay: 0,
            }));
        })
}

#[test]
fn fails_if_called_by_smart_contract() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            // Set code to Alice address as it if was a smart contract.
            pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);
            pallet_evm::AccountCodesMetadata::<Runtime>::insert(
                H160::from(Alice),
                pallet_evm::CodeMetadata {
                    size: 10,
                    hash: H256::default(),
                },
            );

            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::add_proxy {
                        delegate: Address(Bob.into()),
                        proxy_type: ProxyType::Something as u8,
                        delay: 1,
                    },
                )
                .execute_reverts(|output| output == b"Function not callable by smart contracts");
        })
}

#[test]
fn succeed_if_called_by_precompile() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            // Set dummy code to Alice address as it if was a precompile.
            pallet_evm::AccountCodes::<Runtime>::insert(
                H160::from(Alice),
                vec![0x60, 0x00, 0x60, 0x00, 0xfd],
            );

            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::add_proxy {
                        delegate: Address(Bob.into()),
                        proxy_type: ProxyType::Something as u8,
                        delay: 1,
                    },
                )
                .execute_returns(());
        })
}

#[test]
fn succeed_if_is_proxy_called_by_smart_contract() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000), (Bob.into(), 1000)])
        .build()
        .execute_with(|| {
            // Set code to Alice address as it if was a smart contract.
            pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);

            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::is_proxy {
                        real: Address(Alice.into()),
                        delegate: Address(Bob.into()),
                        proxy_type: ProxyType::Something as u8,
                        delay: 1,
                    },
                )
                .execute_returns(false);
        })
}

#[test]
fn proxy_proxy_should_fail_if_called_by_precompile() {
    ExtBuilder::default()
        .with_balances(vec![
            (AddressU64::<1>::get().into(), 1000),
            (Bob.into(), 1000),
        ])
        .build()
        .execute_with(|| {
            PrecompilesValue::get()
                .prepare_test(
                    AddressU64::<1>::get(),
                    Precompile1,
                    PCall::proxy {
                        real: Address(Alice.into()),
                        call_to: Address(Bob.into()),
                        call_data: BoundedBytes::from([]),
                    },
                )
                .execute_reverts(|output| output == b"Function not callable by precompiles");
        })
}

#[test]
fn proxy_proxy_should_succeed_if_called_by_allowed_precompile() {
    // "Not proxy" means that the security filter has passed, so the call to proxy.proxy would work
    // if we had done a proxy.add_proxy before.
    ExtBuilder::default()
        .with_balances(vec![
            (AddressU64::<1>::get().into(), 1000),
            (Bob.into(), 1000),
        ])
        .build()
        .execute_with(|| {
            PrecompilesValue::get()
                .prepare_test(
                    // Address<2> allowed in mock.rs
                    AddressU64::<2>::get(),
                    Precompile1,
                    PCall::proxy {
                        real: Address(Alice.into()),
                        call_to: Address(Bob.into()),
                        call_data: BoundedBytes::from([]),
                    },
                )
                .execute_reverts(|output| output == b"Not proxy");
        })
}

#[test]
fn proxy_proxy_should_succeed_if_called_by_smart_contract() {
    ExtBuilder::default()
        .with_balances(vec![
            (AddressU64::<1>::get().into(), 1000),
            (Bob.into(), 1000),
        ])
        .build()
        .execute_with(|| {
            // Set code to Alice address as it if was a smart contract.
            pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);

            // Bob allows Alice to make calls on his behalf
            assert_ok!(RuntimeCall::Proxy(ProxyCall::add_proxy {
                delegate: Alice.into(),
                proxy_type: ProxyType::Any,
                delay: 0,
            })
            .dispatch(RuntimeOrigin::signed(Bob.into())));

            let inside = Rc::new(Cell::new(false));
            let inside2 = inside.clone();

            // The smart contract calls proxy.proxy to call address Charlie as if it was Bob
            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::proxy {
                        real: Address(Bob.into()),
                        call_to: Address(Charlie.into()),
                        call_data: BoundedBytes::from([1]),
                    },
                )
                .with_subcall_handle(move |subcall| {
                    let Subcall {
                        address,
                        transfer,
                        input,
                        target_gas: _,
                        is_static,
                        context,
                    } = subcall;

                    assert_eq!(context.caller, Bob.into());
                    assert_eq!(address, Charlie.into());
                    assert_eq!(is_static, false);

                    assert!(transfer.is_none());

                    assert_eq!(context.address, Charlie.into());
                    assert_eq!(context.apparent_value, 0u8.into());

                    assert_eq!(&input, &[1]);

                    inside2.set(true);

                    SubcallOutput {
                        output: b"TEST".to_vec(),
                        cost: 13,
                        logs: vec![log1(Bob, H256::repeat_byte(0x11), vec![])],
                        ..SubcallOutput::succeed()
                    }
                })
                .execute_returns(());

            // Ensure that the subcall was actually called.
            // proxy.proxy does not propagate the return value, so we cannot check for the return
            // value "TEST"
            assert!(inside.get(), "subcall not called");
        })
}

#[test]
fn proxy_proxy_should_fail_if_called_by_smart_contract_for_a_non_eoa_account() {
    ExtBuilder::default()
        .with_balances(vec![
            (AddressU64::<1>::get().into(), 1000),
            (Bob.into(), 1000),
        ])
        .build()
        .execute_with(|| {
            // Set code to Alice & Bob addresses as if they are smart contracts.
            pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);
            pallet_evm::AccountCodesMetadata::<Runtime>::insert(
                H160::from(Alice),
                pallet_evm::CodeMetadata {
                    size: 10,
                    hash: H256::default(),
                },
            );
            pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Bob), vec![10u8]);
            pallet_evm::AccountCodesMetadata::<Runtime>::insert(
                H160::from(Bob),
                pallet_evm::CodeMetadata {
                    size: 10,
                    hash: H256::default(),
                },
            );

            // Bob allows Alice to make calls on his behalf
            assert_ok!(RuntimeCall::Proxy(ProxyCall::add_proxy {
                delegate: Alice.into(),
                proxy_type: ProxyType::Any,
                delay: 0,
            })
            .dispatch(RuntimeOrigin::signed(Bob.into())));

            let inside = Rc::new(Cell::new(false));
            let inside2 = inside.clone();

            // The smart contract calls proxy.proxy to call address Charlie as if it was Bob
            PrecompilesValue::get()
                .prepare_test(
                    Alice,
                    Precompile1,
                    PCall::proxy {
                        real: Address(Bob.into()),
                        call_to: Address(Charlie.into()),
                        call_data: BoundedBytes::from([1]),
                    },
                )
                .with_subcall_handle(move |subcall| {
                    let Subcall {
                        address,
                        transfer,
                        input,
                        target_gas: _,
                        is_static,
                        context,
                    } = subcall;

                    assert_eq!(context.caller, Bob.into());
                    assert_eq!(address, Charlie.into());
                    assert_eq!(is_static, false);

                    assert!(transfer.is_none());

                    assert_eq!(context.address, Charlie.into());
                    assert_eq!(context.apparent_value, 0u8.into());

                    assert_eq!(&input, &[1]);

                    inside2.set(true);

                    SubcallOutput {
                        output: b"TEST".to_vec(),
                        cost: 13,
                        logs: vec![log1(Bob, H256::repeat_byte(0x11), vec![])],
                        ..SubcallOutput::succeed()
                    }
                })
                .execute_reverts(|output| output == b"real address must be EOA");
        })
}

#[test]
fn test_solidity_interface_has_all_function_selectors_documented_and_implemented() {
    check_precompile_implements_solidity_interfaces(&["Proxy.sol"], PCall::supports_selector)
}
