// Copyright 2025 The DataHaven Team
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
//
use std::str::from_utf8;

use crate::{eip2612::Eip2612, mock::*, *};

use libsecp256k1::{sign, Message, SecretKey};
use precompile_utils::testing::*;
use sha3::{Digest, Keccak256};
use sp_core::{H256, U256};

// No test of invalid selectors since we have a fallback behavior (deposit).
fn precompiles() -> Precompiles<Runtime> {
    PrecompilesValue::get()
}

#[test]
fn selectors() {
    assert!(PCall::balance_of_selectors().contains(&0x70a08231));
    assert!(PCall::total_supply_selectors().contains(&0x18160ddd));
    assert!(PCall::approve_selectors().contains(&0x095ea7b3));
    assert!(PCall::allowance_selectors().contains(&0xdd62ed3e));
    assert!(PCall::transfer_selectors().contains(&0xa9059cbb));
    assert!(PCall::transfer_from_selectors().contains(&0x23b872dd));
    assert!(PCall::name_selectors().contains(&0x06fdde03));
    assert!(PCall::symbol_selectors().contains(&0x95d89b41));
    assert!(PCall::deposit_selectors().contains(&0xd0e30db0));
    assert!(PCall::withdraw_selectors().contains(&0x2e1a7d4d));
    assert!(PCall::eip2612_nonces_selectors().contains(&0x7ecebe00));
    assert!(PCall::eip2612_permit_selectors().contains(&0xd505accf));
    assert!(PCall::eip2612_domain_separator_selectors().contains(&0x3644e515));

    assert_eq!(
        crate::SELECTOR_LOG_TRANSFER,
        &Keccak256::digest(b"Transfer(address,address,uint256)")[..]
    );

    assert_eq!(
        crate::SELECTOR_LOG_APPROVAL,
        &Keccak256::digest(b"Approval(address,address,uint256)")[..]
    );

    assert_eq!(
        crate::SELECTOR_LOG_DEPOSIT,
        &Keccak256::digest(b"Deposit(address,uint256)")[..]
    );

    assert_eq!(
        crate::SELECTOR_LOG_WITHDRAWAL,
        &Keccak256::digest(b"Withdrawal(address,uint256)")[..]
    );
}

#[test]
fn modifiers() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            let mut tester =
                PrecompilesModifierTester::new(precompiles(), CryptoAlith, Precompile1);

            tester.test_view_modifier(PCall::balance_of_selectors());
            tester.test_view_modifier(PCall::total_supply_selectors());
            tester.test_default_modifier(PCall::approve_selectors());
            tester.test_view_modifier(PCall::allowance_selectors());
            tester.test_default_modifier(PCall::transfer_selectors());
            tester.test_default_modifier(PCall::transfer_from_selectors());
            tester.test_view_modifier(PCall::name_selectors());
            tester.test_view_modifier(PCall::symbol_selectors());
            tester.test_view_modifier(PCall::decimals_selectors());
            tester.test_payable_modifier(PCall::deposit_selectors());
            tester.test_default_modifier(PCall::withdraw_selectors());
            tester.test_view_modifier(PCall::eip2612_nonces_selectors());
            tester.test_default_modifier(PCall::eip2612_permit_selectors());
            tester.test_view_modifier(PCall::eip2612_domain_separator_selectors());
        });
}

#[test]
fn get_total_supply() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000), (Bob.into(), 2500)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(CryptoAlith, Precompile1, PCall::total_supply {})
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(3500u64));
        });
}

#[test]
fn get_balances_known_user() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(1000u64));
        });
}

#[test]
fn get_balances_unknown_user() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(Bob.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0u64));
        });
}

#[test]
fn approve() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::approve {
                        spender: Address(Bob.into()),
                        value: 500.into(),
                    },
                )
                .expect_cost(1756)
                .expect_log(log3(
                    Precompile1,
                    SELECTOR_LOG_APPROVAL,
                    CryptoAlith,
                    Bob,
                    solidity::encode_event_data(U256::from(500)),
                ))
                .execute_returns(true);
        });
}

#[test]
fn approve_saturating() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::approve {
                        spender: Address(Bob.into()),
                        value: U256::MAX,
                    },
                )
                .expect_cost(1756u64)
                .expect_log(log3(
                    Precompile1,
                    SELECTOR_LOG_APPROVAL,
                    CryptoAlith,
                    Bob,
                    solidity::encode_event_data(U256::MAX),
                ))
                .execute_returns(true);

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::allowance {
                        owner: Address(CryptoAlith.into()),
                        spender: Address(Bob.into()),
                    },
                )
                .expect_cost(0)
                .expect_no_logs()
                .execute_returns(U256::from(u128::MAX));
        });
}

#[test]
fn check_allowance_existing() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::approve {
                        spender: Address(Bob.into()),
                        value: 500.into(),
                    },
                )
                .execute_some();

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::allowance {
                        owner: Address(CryptoAlith.into()),
                        spender: Address(Bob.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(500u64));
        });
}

#[test]
fn check_allowance_not_existing() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::allowance {
                        owner: Address(CryptoAlith.into()),
                        spender: Address(Bob.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0u64));
        });
}

#[test]
fn transfer() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::transfer {
                        to: Address(Bob.into()),
                        value: 400.into(),
                    },
                )
                .expect_cost(176106756) // 1 weight => 1 gas in mock
                .expect_log(log3(
                    Precompile1,
                    SELECTOR_LOG_TRANSFER,
                    CryptoAlith,
                    Bob,
                    solidity::encode_event_data(U256::from(400)),
                ))
                .execute_returns(true);

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(600));

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(Bob.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(400));
        });
}

#[test]
fn transfer_not_enough_funds() {
    ExtBuilder::default()
        .with_balances(vec![
            (CryptoAlith.into(), 1000),
            (CryptoBaltathar.into(), 1000),
        ])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::transfer {
                        to: Address(Bob.into()),
                        value: 1400.into(),
                    },
                )
                .execute_reverts(|output| {
                    from_utf8(&output)
                        .unwrap()
                        .contains("Dispatched call failed with error: ")
                        && from_utf8(&output).unwrap().contains("FundsUnavailable")
                });
        });
}

#[test]
fn transfer_from() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::approve {
                        spender: Address(Bob.into()),
                        value: 500.into(),
                    },
                )
                .execute_some();

            precompiles()
                .prepare_test(
                    Bob,
                    Precompile1,
                    PCall::transfer_from {
                        from: Address(CryptoAlith.into()),
                        to: Address(Bob.into()),
                        value: 400.into(),
                    },
                )
                .expect_cost(176106756) // 1 weight => 1 gas in mock
                .expect_log(log3(
                    Precompile1,
                    SELECTOR_LOG_TRANSFER,
                    CryptoAlith,
                    Bob,
                    solidity::encode_event_data(U256::from(400)),
                ))
                .execute_returns(true);

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(600));

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(Bob.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(400));

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::allowance {
                        owner: Address(CryptoAlith.into()),
                        spender: Address(Bob.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(100u64));
        });
}

#[test]
fn transfer_from_above_allowance() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::approve {
                        spender: Address(Bob.into()),
                        value: 300.into(),
                    },
                )
                .execute_some();

            precompiles()
                .prepare_test(
                    Bob, // Bob is the one sending transferFrom!
                    Precompile1,
                    PCall::transfer_from {
                        from: Address(CryptoAlith.into()),
                        to: Address(Bob.into()),
                        value: 400.into(),
                    },
                )
                .execute_reverts(|output| output == b"trying to spend more than allowed");
        });
}

#[test]
fn transfer_from_self() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(
                    CryptoAlith, // CryptoAlith sending transferFrom herself, no need for allowance.
                    Precompile1,
                    PCall::transfer_from {
                        from: Address(CryptoAlith.into()),
                        to: Address(Bob.into()),
                        value: 400.into(),
                    },
                )
                .expect_cost(176106756) // 1 weight => 1 gas in mock
                .expect_log(log3(
                    Precompile1,
                    SELECTOR_LOG_TRANSFER,
                    CryptoAlith,
                    Bob,
                    solidity::encode_event_data(U256::from(400)),
                ))
                .execute_returns(true);

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(600));

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(Bob.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(400));
        });
}

#[test]
fn get_metadata_name() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000), (Bob.into(), 2500)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(CryptoAlith, Precompile1, PCall::name {})
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(UnboundedBytes::from("Mock token"));
        });
}

#[test]
fn get_metadata_symbol() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000), (Bob.into(), 2500)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(CryptoAlith, Precompile1, PCall::symbol {})
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(UnboundedBytes::from("MOCK"));
        });
}

#[test]
fn get_metadata_decimals() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000), (Bob.into(), 2500)])
        .build()
        .execute_with(|| {
            precompiles()
                .prepare_test(CryptoAlith, Precompile1, PCall::decimals {})
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(18u8);
        });
}

fn deposit(data: Vec<u8>) {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            // Check precompile balance is 0.
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(Precompile1.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0));

            // Deposit
            // We need to call using EVM pallet so we can check the EVM correctly sends the amount
            // to the precompile.
            EVM::call(
                RuntimeOrigin::root(),
                CryptoAlith.into(),
                Precompile1.into(),
                data,
                From::from(500), // amount sent
                u64::MAX,        // gas limit
                0u32.into(),     // gas price
                None,            // max priority
                None,            // nonce
                vec![],          // access list
            )
            .expect("it works");

            assert_eq!(
                events(),
                vec![
                    RuntimeEvent::System(frame_system::Event::NewAccount {
                        account: Precompile1.into()
                    }),
                    RuntimeEvent::Balances(pallet_balances::Event::Endowed {
                        account: Precompile1.into(),
                        free_balance: 500
                    }),
                    // EVM make a transfer because some value is provided.
                    RuntimeEvent::Balances(pallet_balances::Event::Transfer {
                        from: CryptoAlith.into(),
                        to: Precompile1.into(),
                        amount: 500
                    }),
                    // Precompile1 send it back since deposit should be a no-op.
                    RuntimeEvent::Balances(pallet_balances::Event::Transfer {
                        from: Precompile1.into(),
                        to: CryptoAlith.into(),
                        amount: 500
                    }),
                    // Log is correctly emited.
                    RuntimeEvent::EVM(pallet_evm::Event::Log {
                        log: log2(
                            Precompile1,
                            SELECTOR_LOG_DEPOSIT,
                            CryptoAlith,
                            solidity::encode_event_data(U256::from(500)),
                        )
                    }),
                    RuntimeEvent::EVM(pallet_evm::Event::Executed {
                        address: Precompile1.into()
                    }),
                ]
            );

            // Check precompile balance is still 0.
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(Precompile1.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0));

            // Check CryptoAlith balance is still 1000.
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(1000));
        });
}

#[test]
fn deposit_function() {
    deposit(PCall::deposit {}.into())
}

#[test]
fn deposit_fallback() {
    deposit(solidity::encode_with_selector(0x01234567u32, ()))
}

#[test]
fn deposit_receive() {
    deposit(vec![])
}

#[test]
fn deposit_zero() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            // Check precompile balance is 0.
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(Precompile1.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0));

            // Deposit
            // We need to call using EVM pallet so we can check the EVM correctly sends the amount
            // to the precompile.
            EVM::call(
                RuntimeOrigin::root(),
                CryptoAlith.into(),
                Precompile1.into(),
                PCall::deposit {}.into(),
                From::from(0), // amount sent
                u64::MAX,      // gas limit
                0u32.into(),   // gas price
                None,          // max priority
                None,          // nonce
                vec![],        // access list
            )
            .expect("it works");

            assert_eq!(
                events(),
                vec![RuntimeEvent::EVM(pallet_evm::Event::ExecutedFailed {
                    address: Precompile1.into()
                }),]
            );

            // Check precompile balance is still 0.
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(Precompile1.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0));

            // Check CryptoAlith balance is still 1000.
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(1000));
        });
}

#[test]
fn withdraw() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            // Check precompile balance is 0.
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(Precompile1.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0));

            // Withdraw
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::withdraw { value: 500.into() },
                )
                .expect_cost(1381)
                .expect_log(log2(
                    Precompile1,
                    SELECTOR_LOG_WITHDRAWAL,
                    CryptoAlith,
                    solidity::encode_event_data(U256::from(500)),
                ))
                .execute_returns(());

            // Check CryptoAlith balance is still 1000.
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(1000));
        });
}

#[test]
fn withdraw_more_than_owned() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            // Check precompile balance is 0.
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(Precompile1.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0));

            // Withdraw
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::withdraw { value: 1001.into() },
                )
                .execute_reverts(|output| output == b"Trying to withdraw more than owned");

            // Check CryptoAlith balance is still 1000.
            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::balance_of {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(1000));
        });
}

#[test]
fn permit_valid() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            let owner: H160 = CryptoAlith.into();
            let spender: H160 = Bob.into();
            let value: U256 = 500u16.into();
            let deadline: U256 = 0u8.into(); // todo: proper timestamp

            let permit = Eip2612::<Runtime, NativeErc20Metadata>::generate_permit(
                Precompile1.into(),
                owner,
                spender,
                value,
                0u8.into(), // nonce
                deadline,
            );

            let secret_key = SecretKey::parse(&alith_secret_key()).unwrap();
            let message = Message::parse(&permit);
            let (rs, v) = sign(&message, &secret_key);

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::eip2612_nonces {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0u8));

            precompiles()
                .prepare_test(
                    Charlie, // can be anyone
                    Precompile1,
                    PCall::eip2612_permit {
                        owner: Address(owner),
                        spender: Address(spender),
                        value,
                        deadline,
                        v: v.serialize(),
                        r: rs.r.b32().into(),
                        s: rs.s.b32().into(),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_log(log3(
                    Precompile1,
                    SELECTOR_LOG_APPROVAL,
                    CryptoAlith,
                    Bob,
                    solidity::encode_event_data(U256::from(value)),
                ))
                .execute_returns(());

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::allowance {
                        owner: Address(CryptoAlith.into()),
                        spender: Address(Bob.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(500u16));

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::eip2612_nonces {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(1u8));
        });
}

#[test]
fn permit_invalid_nonce() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            let owner: H160 = CryptoAlith.into();
            let spender: H160 = Bob.into();
            let value: U256 = 500u16.into();
            let deadline: U256 = 0u8.into();

            let permit = Eip2612::<Runtime, NativeErc20Metadata>::generate_permit(
                Precompile1.into(),
                owner,
                spender,
                value,
                1u8.into(), // nonce
                deadline,
            );

            let secret_key = SecretKey::parse(&alith_secret_key()).unwrap();
            let message = Message::parse(&permit);
            let (rs, v) = sign(&message, &secret_key);

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::eip2612_nonces {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0u8));

            precompiles()
                .prepare_test(
                    Charlie, // can be anyone
                    Precompile1,
                    PCall::eip2612_permit {
                        owner: Address(owner),
                        spender: Address(spender),
                        value,
                        deadline,
                        v: v.serialize(),
                        r: rs.r.b32().into(),
                        s: rs.s.b32().into(),
                    },
                )
                .execute_reverts(|output| output == b"Invalid permit");

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::allowance {
                        owner: Address(CryptoAlith.into()),
                        spender: Address(Bob.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0u16));

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::eip2612_nonces {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0u8));
        });
}

#[test]
fn permit_invalid_signature() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            let owner: H160 = CryptoAlith.into();
            let spender: H160 = Bob.into();
            let value: U256 = 500u16.into();
            let deadline: U256 = 0u8.into();

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::eip2612_nonces {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0u8));

            precompiles()
                .prepare_test(
                    Charlie, // can be anyone
                    Precompile1,
                    PCall::eip2612_permit {
                        owner: Address(owner),
                        spender: Address(spender),
                        value,
                        deadline,
                        v: 0,
                        r: H256::repeat_byte(0x11),
                        s: H256::repeat_byte(0x11),
                    },
                )
                .execute_reverts(|output| output == b"Invalid permit");

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::allowance {
                        owner: Address(CryptoAlith.into()),
                        spender: Address(Bob.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0u16));

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::eip2612_nonces {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0u8));
        });
}

#[test]
fn permit_invalid_deadline() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            pallet_timestamp::Pallet::<Runtime>::set_timestamp(10_000);

            let owner: H160 = CryptoAlith.into();
            let spender: H160 = Bob.into();
            let value: U256 = 500u16.into();
            let deadline: U256 = 5u8.into(); // deadline < timestamp => expired

            let permit = Eip2612::<Runtime, NativeErc20Metadata>::generate_permit(
                Precompile1.into(),
                owner,
                spender,
                value,
                0u8.into(), // nonce
                deadline,
            );

            let secret_key = SecretKey::parse(&alith_secret_key()).unwrap();
            let message = Message::parse(&permit);
            let (rs, v) = sign(&message, &secret_key);

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::eip2612_nonces {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0u8));

            precompiles()
                .prepare_test(
                    Charlie, // can be anyone
                    Precompile1,
                    PCall::eip2612_permit {
                        owner: Address(owner),
                        spender: Address(spender),
                        value,
                        deadline,
                        v: v.serialize(),
                        r: rs.r.b32().into(),
                        s: rs.s.b32().into(),
                    },
                )
                .execute_reverts(|output| output == b"Permit expired");

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::allowance {
                        owner: Address(CryptoAlith.into()),
                        spender: Address(Bob.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0u16));

            precompiles()
                .prepare_test(
                    CryptoAlith,
                    Precompile1,
                    PCall::eip2612_nonces {
                        owner: Address(CryptoAlith.into()),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_no_logs()
                .execute_returns(U256::from(0u8));
        });
}

// This test checks the validity of a metamask signed message against the permit precompile
// The code used to generate the signature is the following.
// You will need to import ALICE_PRIV_KEY in metamask.
// If you put this code in the developer tools console, it will log the signature
/*
await window.ethereum.enable();
const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });

const value = 1000;

const fromAddress = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac";
const deadline = 1;
const nonce = 0;
const spender = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const from = accounts[0];

const createPermitMessageData = function () {
    const message = {
    owner: from,
    spender: spender,
    value: value,
    nonce: nonce,
    deadline: deadline,
    };

    const typedData = JSON.stringify({
    types: {
        EIP712Domain: [
        {
            name: "name",
            type: "string",
        },
        {
            name: "version",
            type: "string",
        },
        {
            name: "chainId",
            type: "uint256",
        },
        {
            name: "verifyingContract",
            type: "address",
        },
        ],
        Permit: [
        {
            name: "owner",
            type: "address",
        },
        {
            name: "spender",
            type: "address",
        },
        {
            name: "value",
            type: "uint256",
        },
        {
            name: "nonce",
            type: "uint256",
        },
        {
            name: "deadline",
            type: "uint256",
        },
        ],
    },
    primaryType: "Permit",
    domain: {
        name: "Mock token",
        version: "1",
        chainId: 0,
        verifyingContract: "0x0000000000000000000000000000000000000001",
    },
    message: message,
    });

    return {
        typedData,
        message,
    };
};

const method = "eth_signTypedData_v4"
const messageData = createPermitMessageData();
const params = [from, messageData.typedData];

web3.currentProvider.sendAsync(
    {
        method,
        params,
        from,
    },
    function (err, result) {
        if (err) return console.dir(err);
        if (result.error) {
            alert(result.error.message);
        }
        if (result.error) return console.error('ERROR', result);
        console.log('TYPED SIGNED:' + JSON.stringify(result.result));

        const recovered = sigUtil.recoverTypedSignature_v4({
            data: JSON.parse(msgParams),
            sig: result.result,
        });

        if (
            ethUtil.toChecksumAddress(recovered) === ethUtil.toChecksumAddress(from)
        ) {
            alert('Successfully recovered signer as ' + from);
        } else {
            alert(
                'Failed to verify signer when comparing ' + result + ' to ' + from
            );
        }
    }
);
*/

#[test]
fn permit_valid_with_metamask_signed_data() {
    ExtBuilder::default()
        .with_balances(vec![(CryptoAlith.into(), 1000)])
        .build()
        .execute_with(|| {
            let owner: H160 = CryptoAlith.into();
            let spender: H160 = Bob.into();
            let value: U256 = 1000u16.into();
            let deadline: U256 = 1u16.into(); // todo: proper timestamp

            let rsv = hex_literal::hex!(
                "612960858951e133d05483804be5456a030be4ce6c000a855d865c0be75a8fc11d89ca96d5a153e8c
				7155ab1147f0f6d3326388b8d866c2406ce34567b7501a01b"
            )
            .as_slice();
            let (r, sv) = rsv.split_at(32);
            let (s, v) = sv.split_at(32);
            let v_real = v[0];
            let r_real: [u8; 32] = r.try_into().unwrap();
            let s_real: [u8; 32] = s.try_into().unwrap();

            precompiles()
                .prepare_test(
                    Charlie, // can be anyone,
                    Precompile1,
                    PCall::eip2612_permit {
                        owner: Address(owner),
                        spender: Address(spender),
                        value,
                        deadline,
                        v: v_real,
                        r: r_real.into(),
                        s: s_real.into(),
                    },
                )
                .expect_cost(0) // TODO: Test db read/write costs
                .expect_log(log3(
                    Precompile1,
                    SELECTOR_LOG_APPROVAL,
                    CryptoAlith,
                    Bob,
                    solidity::encode_event_data(U256::from(1000)),
                ))
                .execute_returns(());
        });
}

#[test]
fn test_solidity_interface_has_all_function_selectors_documented_and_implemented() {
    check_precompile_implements_solidity_interfaces(
        &["ERC20.sol", "Permit.sol"],
        PCall::supports_selector,
    )
}
