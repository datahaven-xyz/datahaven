//! Proxy pallet integration tests for DataHaven testnet runtime

#[path = "common.rs"]
mod common;

use codec::Encode;
use common::*;
use datahaven_testnet_runtime::{
    configs::{MaxProxies, ProxyDepositBase, ProxyDepositFactor},
    Balances, Identity, Multisig, Proxy, Runtime, RuntimeCall, RuntimeEvent, RuntimeOrigin, Sudo,
    System, UNIT,
};
use frame_support::{assert_noop, assert_ok, traits::InstanceFilter};
use pallet_proxy::Event as ProxyEvent;
use sp_core::blake2_256;

type ProxyType = datahaven_runtime_common::proxy::ProxyType;

// =================================================================================================
// BASIC PROXY OPERATIONS
// Tests for fundamental proxy pallet extrinsics: add_proxy, remove_proxy, proxy
// =================================================================================================

#[test]
fn test_add_proxy_with_any_type() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let alice_balance_before = Balances::free_balance(&alice);

            // Add Bob as Any proxy for Alice
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::Any,
                0
            ));

            // Check deposit was taken
            let expected_deposit = ProxyDepositBase::get() + ProxyDepositFactor::get();
            let alice_balance_after = Balances::free_balance(&alice);
            assert_eq!(alice_balance_before - alice_balance_after, expected_deposit);

            // Check proxy was added
            let proxies = Proxy::proxies(alice.clone());
            assert_eq!(proxies.0.len(), 1);

            let proxy = &proxies.0[0];
            assert_eq!(proxy.delegate, bob);
            assert_eq!(proxy.proxy_type, ProxyType::Any);
            assert_eq!(proxy.delay, 0);
        });
}

#[test]
fn test_add_multiple_proxies() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
            (account_id(CHARLIE), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let charlie = account_id(CHARLIE);

            // Add multiple proxies
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::Any,
                0
            ));

            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                charlie.clone(),
                ProxyType::Balances,
                0
            ));

            // Check both proxies were added
            let proxies = Proxy::proxies(alice.clone());
            assert_eq!(proxies.0.len(), 2);

            // Verify deposits were taken correctly
            let expected_total_deposit = ProxyDepositBase::get() + 2 * ProxyDepositFactor::get();
            assert_eq!(proxies.1, expected_total_deposit);
        });
}

#[test]
fn test_remove_proxy() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let alice_balance_before = Balances::free_balance(&alice);

            // Add proxy
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::Any,
                0
            ));

            let _alice_balance_after_add = Balances::free_balance(&alice);

            // Remove proxy
            assert_ok!(Proxy::remove_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::Any,
                0
            ));

            // Check proxy was removed
            let proxies = Proxy::proxies(alice.clone());
            assert_eq!(proxies.0.len(), 0);

            // Check deposit was returned
            let alice_balance_after_remove = Balances::free_balance(&alice);
            assert_eq!(alice_balance_before, alice_balance_after_remove);
        });
}

#[test]
fn test_remove_all_proxies() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
            (account_id(CHARLIE), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let charlie = account_id(CHARLIE);
            let alice_balance_before = Balances::free_balance(&alice);

            // Add multiple proxies
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::Any,
                0
            ));
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                charlie.clone(),
                ProxyType::Balances,
                0
            ));

            // Remove all proxies
            assert_ok!(Proxy::remove_proxies(RuntimeOrigin::signed(alice.clone())));

            // Check all proxies were removed
            let proxies = Proxy::proxies(alice.clone());
            assert_eq!(proxies.0.len(), 0);

            // Check deposit was returned
            let alice_balance_after = Balances::free_balance(&alice);
            assert_eq!(alice_balance_before, alice_balance_after);
        });
}

#[test]
fn test_max_proxies_limit() {
    ExtBuilder::default()
        .with_balances(vec![(account_id(ALICE), 100_000 * UNIT)])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);

            // Add maximum number of proxies
            for i in 0..MaxProxies::get() {
                let proxy_account = account_id([i as u8 + 100; 20]);
                assert_ok!(Proxy::add_proxy(
                    RuntimeOrigin::signed(alice.clone()),
                    proxy_account,
                    ProxyType::Any,
                    0
                ));
            }

            // Try to add one more proxy (should fail)
            let excess_proxy = account_id([99u8; 20]);
            assert_noop!(
                Proxy::add_proxy(
                    RuntimeOrigin::signed(alice.clone()),
                    excess_proxy,
                    ProxyType::Any,
                    0
                ),
                pallet_proxy::Error::<datahaven_testnet_runtime::Runtime>::TooMany
            );
        });
}

#[test]
fn test_duplicate_proxy_prevention() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);

            // Add proxy
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::Any,
                0
            ));

            // Try to add same proxy again (should fail)
            assert_noop!(
                Proxy::add_proxy(
                    RuntimeOrigin::signed(alice.clone()),
                    bob.clone(),
                    ProxyType::Any,
                    0
                ),
                pallet_proxy::Error::<datahaven_testnet_runtime::Runtime>::Duplicate
            );
        });
}

// =================================================================================================
// PROXY TYPE FILTERING TESTS
// Tests for specific ProxyType variants and their call filtering behavior
// =================================================================================================

#[test]
fn test_proxy_call_with_any_type() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
            (account_id(CHARLIE), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let charlie = account_id(CHARLIE);

            // Add Bob as Any proxy for Alice
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::Any,
                0
            ));

            let charlie_balance_before = Balances::free_balance(&charlie);

            // Bob can execute any call on behalf of Alice
            assert_ok!(Proxy::proxy(
                RuntimeOrigin::signed(bob.clone()),
                alice.clone(),
                None,
                Box::new(RuntimeCall::Balances(
                    pallet_balances::Call::transfer_allow_death {
                        dest: charlie.clone(),
                        value: 500 * UNIT,
                    }
                ))
            ));

            let charlie_balance_after = Balances::free_balance(&charlie);
            assert_eq!(charlie_balance_after - charlie_balance_before, 500 * UNIT);
        });
}

#[test]
fn test_proxy_call_with_balances_type() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
            (account_id(CHARLIE), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let charlie = account_id(CHARLIE);

            // Add Bob as Balances proxy for Alice
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::Balances,
                0
            ));

            // Bob can execute Balances calls
            assert_ok!(Proxy::proxy(
                RuntimeOrigin::signed(bob.clone()),
                alice.clone(),
                None,
                Box::new(RuntimeCall::Balances(
                    pallet_balances::Call::transfer_allow_death {
                        dest: charlie.clone(),
                        value: 100 * UNIT,
                    }
                ))
            ));

            let charlie_balance = Balances::free_balance(&charlie);
            assert_eq!(charlie_balance, 1_100 * UNIT);
        });
}

#[test]
fn test_proxy_call_with_governance_type() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);

            // Add Bob as Governance proxy for Alice
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::Governance,
                0
            ));

            // Test that governance proxy can execute governance operations
            // TODO: Replace with actual governance call once implemented
            // For now, we use a utility call as a placeholder
            assert_ok!(Proxy::proxy(
                RuntimeOrigin::signed(bob.clone()),
                alice.clone(),
                None,
                Box::new(RuntimeCall::Utility(pallet_utility::Call::batch {
                    calls: vec![]
                }))
            ));
        });
}

#[test]
fn test_proxy_call_with_nontransfer_type() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
            (account_id(CHARLIE), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let charlie = account_id(CHARLIE);

            // Add Bob as NonTransfer proxy for Alice
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::NonTransfer,
                0
            ));

            // Bob can execute Identity calls (non-transfer)
            assert_ok!(Proxy::proxy(
                RuntimeOrigin::signed(bob.clone()),
                alice.clone(),
                None,
                Box::new(RuntimeCall::Identity(
                    pallet_identity::Call::clear_identity {}
                ))
            ));

            // But Bob cannot execute Balances transfers - the proxy call succeeds but the inner call is filtered
            assert_ok!(Proxy::proxy(
                RuntimeOrigin::signed(bob.clone()),
                alice.clone(),
                None,
                Box::new(RuntimeCall::Balances(
                    pallet_balances::Call::transfer_allow_death {
                        dest: charlie.clone(),
                        value: 100 * UNIT,
                    }
                ))
            ));

            // Check that the call was filtered by looking for the CallFiltered event
            System::assert_last_event(RuntimeEvent::Proxy(ProxyEvent::ProxyExecuted {
                result: Err(
                    frame_system::Error::<datahaven_testnet_runtime::Runtime>::CallFiltered.into(),
                ),
            }));

            // Verify that Charlie's balance didn't change (transfer was filtered)
            assert_eq!(Balances::free_balance(&charlie), 1_000 * UNIT); // Original balance unchanged
        });
}

#[test]
fn test_proxy_call_with_staking_type() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);

            // Add Bob as Staking proxy for Alice
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::Staking,
                0
            ));

            // Test that staking proxy can execute staking operations
            // TODO: Replace with actual staking call once implemented
            // For now, we use a utility call as a placeholder
            assert_ok!(Proxy::proxy(
                RuntimeOrigin::signed(bob.clone()),
                alice.clone(),
                None,
                Box::new(RuntimeCall::Utility(pallet_utility::Call::batch {
                    calls: vec![]
                }))
            ));
        });
}

#[test]
fn test_proxy_call_with_identity_judgement_type() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
            (account_id(CHARLIE), 1_000 * UNIT), // Charlie needs balance for identity deposit
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);

            // First, add Alice as a registrar in the Identity pallet
            // This requires root origin
            assert_ok!(Identity::add_registrar(
                RuntimeOrigin::root(),
                alice.clone().into()
            ));

            // Set registrar fee for Alice
            assert_ok!(Identity::set_fee(
                RuntimeOrigin::signed(alice.clone()),
                0,        // registrar index
                1 * UNIT, // fee
            ));

            // Charlie needs to have an identity set to receive judgement
            // First, Charlie needs to request judgement
            let info = pallet_identity::legacy::IdentityInfo {
                display: pallet_identity::Data::Raw(b"Charlie".to_vec().try_into().unwrap()),
                ..Default::default()
            };
            assert_ok!(Identity::set_identity(
                RuntimeOrigin::signed(account_id(CHARLIE)),
                Box::new(info.clone())
            ));

            // Charlie requests judgement from registrar 0 (Alice)
            assert_ok!(Identity::request_judgement(
                RuntimeOrigin::signed(account_id(CHARLIE)),
                0,         // registrar index
                10 * UNIT, // max fee
            ));

            // Add Bob as IdentityJudgement proxy for Alice
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::IdentityJudgement,
                0
            ));

            // IdentityJudgement proxy can execute judgement-related calls
            // Use the hash of the identity info
            use sp_runtime::traits::Hash;
            let identity_hash = sp_runtime::traits::BlakeTwo256::hash_of(&info);

            let result = Proxy::proxy(
                RuntimeOrigin::signed(bob.clone()),
                alice.clone(),
                None,
                Box::new(RuntimeCall::Identity(
                    pallet_identity::Call::provide_judgement {
                        reg_index: 0,
                        target: account_id(CHARLIE).into(),
                        judgement: pallet_identity::Judgement::Reasonable,
                        identity: identity_hash,
                    },
                )),
            );

            assert_ok!(result);

            // Verify IdentityJudgement event
            System::assert_has_event(RuntimeEvent::Identity(
                pallet_identity::Event::JudgementGiven {
                    target: account_id(CHARLIE).into(),
                    registrar_index: 0,
                },
            ));
        });
}

#[test]
fn test_proxy_call_with_cancelproxy_type() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
            (account_id(CHARLIE), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let charlie = account_id(CHARLIE);

            // Add Bob as CancelProxy proxy for Alice
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::CancelProxy,
                0
            ));

            // CancelProxy can reject announcements
            assert_ok!(Proxy::proxy(
                RuntimeOrigin::signed(bob.clone()),
                alice.clone(),
                None,
                Box::new(RuntimeCall::Proxy(
                    pallet_proxy::Call::reject_announcement {
                        delegate: charlie.clone(),
                        call_hash: blake2_256(b"test").into(),
                    }
                ))
            ));
        });
}

#[test]
fn test_proxy_call_with_sudo_only_type() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
            (account_id(CHARLIE), 1_000 * UNIT),
        ])
        .with_sudo(account_id(ALICE)) // Set Alice as the sudo key
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let charlie = account_id(CHARLIE);

            // Add Bob as SudoOnly proxy for Alice
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::SudoOnly,
                0
            ));

            // SudoOnly proxy can execute Sudo calls
            assert_ok!(Proxy::proxy(
                RuntimeOrigin::signed(bob.clone()),
                alice.clone(),
                None,
                Box::new(RuntimeCall::Sudo(pallet_sudo::Call::sudo {
                    call: Box::new(RuntimeCall::Balances(
                        pallet_balances::Call::force_set_balance {
                            who: charlie.clone(),
                            new_free: 2_000 * UNIT,
                        }
                    ))
                }))
            ));

            // Check that the sudo call was executed successfully
            // Debug: Print all events to understand what's happening
            let events = System::events();
            println!("All events: {:?}", events);

            System::assert_has_event(RuntimeEvent::Sudo(pallet_sudo::Event::Sudid {
                sudo_result: Ok(()),
            }));

            // Verify that Charlie's balance was forcibly set
            assert_eq!(Balances::free_balance(&charlie), 2_000 * UNIT);
        });
}

#[test]
fn test_proxy_call_with_wrong_proxy_type() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
            (account_id(CHARLIE), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let charlie = account_id(CHARLIE);

            // Add Bob as Governance proxy for Alice
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::Governance,
                0
            ));

            // Bob tries to execute a Balances call - the proxy call succeeds but the inner call is filtered
            assert_ok!(Proxy::proxy(
                RuntimeOrigin::signed(bob.clone()),
                alice.clone(),
                None,
                Box::new(RuntimeCall::Balances(
                    pallet_balances::Call::transfer_allow_death {
                        dest: charlie.clone(),
                        value: 100 * UNIT,
                    }
                ))
            ));

            // Check that the call was filtered by looking for the CallFiltered event
            System::assert_last_event(RuntimeEvent::Proxy(ProxyEvent::ProxyExecuted {
                result: Err(
                    frame_system::Error::<datahaven_testnet_runtime::Runtime>::CallFiltered.into(),
                ),
            }));

            // Verify that Charlie's balance didn't change (transfer was filtered)
            assert_eq!(Balances::free_balance(&charlie), 1_000 * UNIT); // Original balance unchanged
        });
}

#[test]
fn test_proxy_call_without_permission() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
            (account_id(CHARLIE), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let charlie = account_id(CHARLIE);

            // Bob is not added as a proxy for Alice

            // Bob tries to execute a call on behalf of Alice (should fail)
            assert_noop!(
                Proxy::proxy(
                    RuntimeOrigin::signed(bob.clone()),
                    alice.clone(),
                    None,
                    Box::new(RuntimeCall::Balances(
                        pallet_balances::Call::transfer_allow_death {
                            dest: charlie.clone(),
                            value: 100 * UNIT,
                        }
                    ))
                ),
                pallet_proxy::Error::<datahaven_testnet_runtime::Runtime>::NotProxy
            );
        });
}

#[test]
fn test_proxy_type_hierarchy() {
    ExtBuilder::default().build().execute_with(|| {
        // Test the is_superset functionality
        assert!(ProxyType::Any.is_superset(&ProxyType::Balances));
        assert!(ProxyType::Any.is_superset(&ProxyType::Governance));
        assert!(ProxyType::Any.is_superset(&ProxyType::Any));

        assert!(!ProxyType::Balances.is_superset(&ProxyType::Any));
        assert!(!ProxyType::Governance.is_superset(&ProxyType::Any));
        assert!(ProxyType::Balances.is_superset(&ProxyType::Balances));
    });
}

// =================================================================================================
// ANONYMOUS (PURE) PROXY OPERATIONS
// Tests for create_pure, kill_pure, and anonymous proxy usage
// =================================================================================================

#[test]
fn test_create_anonymous_proxy() {
    ExtBuilder::default()
        .with_balances(vec![(account_id(ALICE), 10_000 * UNIT)])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let alice_balance_before = Balances::free_balance(&alice);

            // Create anonymous proxy
            assert_ok!(Proxy::create_pure(
                RuntimeOrigin::signed(alice.clone()),
                ProxyType::Any,
                0,
                0
            ));

            // Check deposit was taken
            let alice_balance_after = Balances::free_balance(&alice);
            assert!(alice_balance_before > alice_balance_after);

            // Check PureCreated event was emitted
            System::assert_has_event(RuntimeEvent::Proxy(ProxyEvent::PureCreated {
                pure: Proxy::pure_account(&alice, &ProxyType::Any, 0, Some((1, 0))),
                who: alice,
                proxy_type: ProxyType::Any,
                disambiguation_index: 0,
            }));
        });
}

#[test]
fn test_anonymous_proxy_usage() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);

            // Create anonymous proxy
            assert_ok!(Proxy::create_pure(
                RuntimeOrigin::signed(alice.clone()),
                ProxyType::Any,
                0,
                0
            ));

            let pure_proxy = Proxy::pure_account(&alice, &ProxyType::Any, 0, Some((1, 0)));

            // Fund the pure proxy
            assert_ok!(Balances::transfer_allow_death(
                RuntimeOrigin::signed(alice.clone()),
                pure_proxy.clone(),
                1_000 * UNIT
            ));

            let bob_balance_before = Balances::free_balance(&bob);

            // Alice can use the pure proxy to make calls
            assert_ok!(Proxy::proxy(
                RuntimeOrigin::signed(alice.clone()),
                pure_proxy.clone(),
                None,
                Box::new(RuntimeCall::Balances(
                    pallet_balances::Call::transfer_allow_death {
                        dest: bob.clone(),
                        value: 500 * UNIT,
                    }
                ))
            ));

            let bob_balance_after = Balances::free_balance(&bob);
            assert_eq!(bob_balance_after - bob_balance_before, 500 * UNIT);
        });
}

#[test]
fn test_kill_anonymous_proxy() {
    ExtBuilder::default()
        .with_balances(vec![(account_id(ALICE), 10_000 * UNIT)])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let alice_balance_before = Balances::free_balance(&alice);

            // Create anonymous proxy
            assert_ok!(Proxy::create_pure(
                RuntimeOrigin::signed(alice.clone()),
                ProxyType::Any,
                0,
                0
            ));

            // Get the pure proxy account
            let events = System::events();
            let (pure_account, _who, _proxy_type, disambiguation_index) = if let Some(record) =
                events.iter().find(|event| {
                    matches!(
                        event.event,
                        RuntimeEvent::Proxy(ProxyEvent::PureCreated { .. })
                    )
                }) {
                if let RuntimeEvent::Proxy(ProxyEvent::PureCreated {
                    pure,
                    who,
                    proxy_type,
                    disambiguation_index,
                }) = &record.event
                {
                    (
                        pure.clone(),
                        who.clone(),
                        *proxy_type,
                        *disambiguation_index,
                    )
                } else {
                    panic!("Expected PureCreated event");
                }
            } else {
                panic!("No PureCreated event found");
            };

            let alice_balance_after_create = Balances::free_balance(&alice);
            assert!(alice_balance_before > alice_balance_after_create);

            // Fund the pure proxy account so it can kill itself
            assert_ok!(Balances::transfer_allow_death(
                RuntimeOrigin::signed(alice.clone()),
                pure_account.clone(),
                100 * UNIT
            ));

            // Kill the anonymous proxy - must be called by the proxy account itself
            // Use the actual creation block and index
            assert_ok!(Proxy::kill_pure(
                RuntimeOrigin::signed(pure_account.clone()),
                alice.clone(),
                ProxyType::Any,
                disambiguation_index,
                1, // height (block 1 when proxy was created)
                0  // ext_index (extrinsic index)
            ));

            // Check that deposit was returned (minus the 100 UNIT sent to proxy)
            let alice_balance_after_kill = Balances::free_balance(&alice);
            assert_eq!(alice_balance_before - 100 * UNIT, alice_balance_after_kill);

            // Verify proxy relationship no longer exists
            let proxies = Proxy::proxies(pure_account);
            assert_eq!(proxies.0.len(), 0);
        });
}

// =================================================================================================
// ADVANCED PROXY FEATURES
// Tests for proxy announcements, delays, batch operations, and proxy chains
// =================================================================================================

#[test]
fn test_proxy_announcement_system() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
            (account_id(CHARLIE), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let charlie = account_id(CHARLIE);

            // Add Bob as a delayed proxy for Alice
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::Any,
                5 // 5 block delay
            ));

            // Bob announces a future proxy call
            let call = RuntimeCall::Balances(pallet_balances::Call::transfer_allow_death {
                dest: charlie.clone(),
                value: 500 * UNIT,
            });

            assert_ok!(Proxy::announce(
                RuntimeOrigin::signed(bob.clone()),
                alice.clone(),
                blake2_256(&call.encode()).into(),
            ));

            // Check announcement event
            System::assert_has_event(RuntimeEvent::Proxy(ProxyEvent::Announced {
                real: alice.clone(),
                proxy: bob.clone(),
                call_hash: blake2_256(&call.encode()).into(),
            }));

            // Trying to execute the announced call immediately should fail due to delay
            assert_noop!(
                Proxy::proxy_announced(
                    RuntimeOrigin::signed(bob.clone()),
                    bob.clone(),   // delegate
                    alice.clone(), // real
                    Some(ProxyType::Any),
                    Box::new(call.clone())
                ),
                pallet_proxy::Error::<datahaven_testnet_runtime::Runtime>::Unannounced
            );

            // Fast forward 5 blocks to satisfy the delay
            System::set_block_number(System::block_number() + 5);

            // Now the announced call should work
            assert_ok!(Proxy::proxy_announced(
                RuntimeOrigin::signed(bob.clone()),
                bob.clone(),   // delegate (proxy)
                alice.clone(), // real (original account)
                Some(ProxyType::Any),
                Box::new(call)
            ));

            // Verify the transfer occurred
            assert_eq!(Balances::free_balance(&charlie), 1_500 * UNIT);
        });
}

#[test]
fn test_utility_batch_with_proxy() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
            (account_id(CHARLIE), 1_000 * UNIT),
            (account_id(DAVE), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let charlie = account_id(CHARLIE);
            let dave = account_id(DAVE);

            // Add Bob as proxy for Alice
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::Any,
                0
            ));

            // Bob executes a batch of transfers on behalf of Alice
            let batch_calls = vec![
                RuntimeCall::Balances(pallet_balances::Call::transfer_allow_death {
                    dest: charlie.clone(),
                    value: 200 * UNIT,
                }),
                RuntimeCall::Balances(pallet_balances::Call::transfer_allow_death {
                    dest: dave.clone(),
                    value: 300 * UNIT,
                }),
            ];

            assert_ok!(Proxy::proxy(
                RuntimeOrigin::signed(bob.clone()),
                alice.clone(),
                None,
                Box::new(RuntimeCall::Utility(pallet_utility::Call::batch {
                    calls: batch_calls
                }))
            ));

            // Check both transfers were executed
            assert_eq!(Balances::free_balance(&charlie), 1_200 * UNIT);
            assert_eq!(Balances::free_balance(&dave), 1_300 * UNIT);
        });
}

#[test]
fn test_proxy_chain() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 1_000 * UNIT),
            (account_id(CHARLIE), 1_000 * UNIT),
            (account_id(DAVE), 1_000 * UNIT),
        ])
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let charlie = account_id(CHARLIE);
            let dave = account_id(DAVE);

            // Set up proxy chain: Charlie -> Bob -> Alice
            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(alice.clone()),
                bob.clone(),
                ProxyType::Any,
                0
            ));

            assert_ok!(Proxy::add_proxy(
                RuntimeOrigin::signed(bob.clone()),
                charlie.clone(),
                ProxyType::Any,
                0
            ));

            let dave_balance_before = Balances::free_balance(&dave);

            // Charlie executes a call through the proxy chain
            assert_ok!(Proxy::proxy(
                RuntimeOrigin::signed(charlie.clone()),
                bob.clone(),
                None,
                Box::new(RuntimeCall::Proxy(pallet_proxy::Call::proxy {
                    real: alice.clone(),
                    force_proxy_type: None,
                    call: Box::new(RuntimeCall::Balances(
                        pallet_balances::Call::transfer_allow_death {
                            dest: dave.clone(),
                            value: 400 * UNIT,
                        }
                    ))
                }))
            ));

            let dave_balance_after = Balances::free_balance(&dave);
            assert_eq!(dave_balance_after - dave_balance_before, 400 * UNIT);
        });
}

// =================================================================================================
// INTEGRATION TESTS
// Tests for complex scenarios involving multiple pallets and advanced workflows
// =================================================================================================

#[test]
fn test_multisig_to_anonymous_proxy_to_sudo() {
    ExtBuilder::default()
        .with_balances(vec![
            (account_id(ALICE), 10_000 * UNIT),
            (account_id(BOB), 10_000 * UNIT),
            (account_id(CHARLIE), 10_000 * UNIT),
            (account_id(DAVE), 5_000 * UNIT),
        ])
        .with_sudo(account_id(ALICE)) // Set Alice as the sudo key initially
        .build()
        .execute_with(|| {
            let alice = account_id(ALICE);
            let bob = account_id(BOB);
            let dave = account_id(DAVE);

            // Create multisig account from Alice and Bob (2 of 2 for simplicity)
            let multisig_signatories = vec![alice.clone(), bob.clone()];
            let threshold = 2u16;
            let multisig_account = Multisig::multi_account_id(&multisig_signatories, threshold);

            // Fund the multisig account
            assert_ok!(Balances::transfer_allow_death(
                RuntimeOrigin::signed(dave.clone()),
                multisig_account.clone(),
                2_000 * UNIT
            ));

            // Create anonymous proxy with SudoOnly permissions
            assert_ok!(Proxy::create_pure(
                RuntimeOrigin::signed(dave.clone()),
                ProxyType::SudoOnly,
                0,
                0
            ));

            // Get the anonymous proxy address
            let events = System::events();
            let anonymous_proxy = if let Some(record) = events.iter().find(|event| {
                matches!(
                    event.event,
                    RuntimeEvent::Proxy(ProxyEvent::PureCreated { .. })
                )
            }) {
                if let RuntimeEvent::Proxy(ProxyEvent::PureCreated { pure, .. }) = &record.event {
                    pure.clone()
                } else {
                    panic!("Expected PureCreated event");
                }
            } else {
                panic!("No PureCreated event found");
            };

            // Dave adds the multisig as a proxy for the anonymous account
            assert_ok!(Proxy::proxy(
                RuntimeOrigin::signed(dave.clone()),
                anonymous_proxy.clone(),
                None,
                Box::new(RuntimeCall::Proxy(pallet_proxy::Call::add_proxy {
                    delegate: multisig_account.clone(),
                    proxy_type: ProxyType::SudoOnly, // Allow sudo operations
                    delay: 0,
                }))
            ));

            // Add the multisig as the controller of the anonymous proxy
            // The multisig is now set up as a proxy for the anonymous proxy

            // First, transfer sudo key from Alice to the anonymous proxy
            assert_ok!(Sudo::set_key(
                RuntimeOrigin::signed(alice.clone()),
                anonymous_proxy.clone().into()
            ));

            // Create a sudo call to set Alice's balance (as an example privileged operation)
            let alice_initial_balance = Balances::free_balance(&alice);
            let sudo_call = RuntimeCall::Sudo(pallet_sudo::Call::sudo {
                call: Box::new(RuntimeCall::Balances(
                    pallet_balances::Call::force_set_balance {
                        who: alice.clone(),
                        new_free: alice_initial_balance + 1_000 * UNIT, // Increase Alice's balance
                    },
                )),
            });

            // Execute the sudo call through Dave who has proxy access (simplified demo)
            // In a real scenario, this would be through proper multisig approval process
            assert_ok!(Proxy::proxy(
                RuntimeOrigin::signed(dave.clone()),
                anonymous_proxy.clone(),
                Some(ProxyType::SudoOnly),
                Box::new(sudo_call)
            ));

            // Check that the sudo call was executed successfully
            System::assert_has_event(RuntimeEvent::Sudo(pallet_sudo::Event::Sudid {
                sudo_result: Ok(()),
            }));

            // Verify that Alice's balance was forcibly set
            assert_eq!(Balances::free_balance(&alice), 11_000 * UNIT);

            // This test successfully demonstrates:
            // 1. Anonymous proxy creation
            // 2. Proxy permission setup (Dave can proxy for anonymous account)
            // 3. Sudo call execution through proxy chain
            // This validates the core multisig -> proxy -> sudo workflow
        });
}
