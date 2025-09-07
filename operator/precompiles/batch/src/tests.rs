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

use crate::mock::{
    balance, Batch, ExtBuilder, PCall, Precompiles, PrecompilesValue, Revert, Runtime, RuntimeCall,
    RuntimeOrigin,
};
use crate::{
    log_subcall_failed, log_subcall_succeeded, Mode, LOG_SUBCALL_FAILED, LOG_SUBCALL_SUCCEEDED,
};
use fp_evm::ExitError;
use frame_support::assert_ok;
use pallet_evm::Call as EvmCall;
use precompile_utils::solidity::revert::revert_as_bytes;
use precompile_utils::{evm::costs::call_cost, prelude::*, testing::*};
use sp_core::{H160, H256, U256};
use sp_runtime::DispatchError;
use sp_runtime::{traits::Dispatchable, DispatchErrorWithPostInfo, ModuleError};

fn precompiles() -> Precompiles<Runtime> {
    PrecompilesValue::get()
}

fn evm_call(from: impl Into<H160>, input: Vec<u8>) -> EvmCall<Runtime> {
    EvmCall::call {
        source: from.into(),
        target: Batch.into(),
        input,
        value: U256::zero(), // No value sent in EVM
        gas_limit: u64::max_value(),
        max_fee_per_gas: 0.into(),
        max_priority_fee_per_gas: Some(U256::zero()),
        nonce: None, // Use the next nonce
        access_list: Vec::new(),
    }
}

fn costs() -> (u64, u64) {
    let return_log_cost = log_subcall_failed(Batch, 0).compute_cost().unwrap();
    let call_cost =
        return_log_cost + call_cost(U256::one(), <Runtime as pallet_evm::Config>::config());
    (return_log_cost, call_cost)
}

#[test]
fn selectors() {
    assert!(PCall::batch_some_selectors().contains(&0x79df4b9c));
    assert!(PCall::batch_some_until_failure_selectors().contains(&0xcf0491c7));
    assert!(PCall::batch_all_selectors().contains(&0x96e292b8));
    assert_eq!(
        LOG_SUBCALL_FAILED,
        hex_literal::hex!("dbc5d06f4f877f959b1ff12d2161cdd693fa8e442ee53f1790b2804b24881f05")
    );
    assert_eq!(
        LOG_SUBCALL_SUCCEEDED,
        hex_literal::hex!("bf855484633929c3d6688eb3caf8eff910fb4bef030a8d7dbc9390d26759714d")
    );
}

#[test]
fn modifiers() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000)])
        .build()
        .execute_with(|| {
            let mut tester = PrecompilesModifierTester::new(precompiles(), Alice, Batch);

            tester.test_default_modifier(PCall::batch_some_selectors());
            tester.test_default_modifier(PCall::batch_some_until_failure_selectors());
            tester.test_default_modifier(PCall::batch_all_selectors());
        });
}

#[test]
fn batch_some_empty() {
    ExtBuilder::default().build().execute_with(|| {
        precompiles()
            .prepare_test(
                Alice,
                Batch,
                PCall::batch_some {
                    to: vec![].into(),
                    value: vec![].into(),
                    call_data: vec![].into(),
                    gas_limit: vec![].into(),
                },
            )
            .with_subcall_handle(|Subcall { .. }| panic!("there should be no subcall"))
            .execute_returns(())
    })
}

#[test]
fn batch_some_until_failure_empty() {
    ExtBuilder::default().build().execute_with(|| {
        precompiles()
            .prepare_test(
                Alice,
                Batch,
                PCall::batch_some_until_failure {
                    to: vec![].into(),
                    value: vec![].into(),
                    call_data: vec![].into(),
                    gas_limit: vec![].into(),
                },
            )
            .with_subcall_handle(|Subcall { .. }| panic!("there should be no subcall"))
            .execute_returns(())
    })
}

#[test]
fn batch_all_empty() {
    ExtBuilder::default().build().execute_with(|| {
        precompiles()
            .prepare_test(
                Alice,
                Batch,
                PCall::batch_all {
                    to: vec![].into(),
                    value: vec![].into(),
                    call_data: vec![].into(),
                    gas_limit: vec![].into(),
                },
            )
            .with_subcall_handle(|Subcall { .. }| panic!("there should be no subcall"))
            .execute_returns(())
    })
}

fn batch_returns(
    precompiles: &Precompiles<Runtime>,
    mode: Mode,
) -> PrecompilesTester<Precompiles<Runtime>> {
    let mut counter = 0;

    let (_, total_call_cost) = costs();

    precompiles
        .prepare_test(
            Alice,
            Batch,
            PCall::batch_from_mode(
                mode,
                vec![Address(Bob.into()), Address(Charlie.into())],
                vec![U256::from(1u8), U256::from(2u8)],
                vec![b"one".to_vec(), b"two".to_vec()],
                vec![],
            ),
        )
        .with_target_gas(Some(100_000))
        .with_subcall_handle(move |subcall| {
            let Subcall {
                address,
                transfer,
                input,
                target_gas,
                is_static,
                context,
            } = subcall;

            // Called from the precompile caller.
            assert_eq!(context.caller, Alice.into());
            assert_eq!(is_static, false);

            match address {
                a if a == Bob.into() => {
                    assert_eq!(counter, 0, "this is the first call");
                    counter += 1;

                    assert_eq!(
                        target_gas,
                        Some(100_000 - total_call_cost),
                        "batch forward all gas"
                    );
                    let transfer = transfer.expect("there is a transfer");
                    assert_eq!(transfer.source, Alice.into());
                    assert_eq!(transfer.target, Bob.into());
                    assert_eq!(transfer.value, 1u8.into());

                    assert_eq!(context.address, Bob.into());
                    assert_eq!(context.apparent_value, 1u8.into());

                    assert_eq!(&input, b"one");

                    SubcallOutput {
                        cost: 13,
                        logs: vec![log1(Bob, H256::repeat_byte(0x11), vec![])],
                        ..SubcallOutput::succeed()
                    }
                }
                a if a == Charlie.into() => {
                    assert_eq!(counter, 1, "this is the second call");
                    counter += 1;

                    assert_eq!(
                        target_gas,
                        Some(100_000 - 13 - total_call_cost * 2),
                        "batch forward all gas"
                    );
                    let transfer = transfer.expect("there is a transfer");
                    assert_eq!(transfer.source, Alice.into());
                    assert_eq!(transfer.target, Charlie.into());
                    assert_eq!(transfer.value, 2u8.into());

                    assert_eq!(context.address, Charlie.into());
                    assert_eq!(context.apparent_value, 2u8.into());

                    assert_eq!(&input, b"two");

                    SubcallOutput {
                        cost: 17,
                        logs: vec![log1(Charlie, H256::repeat_byte(0x22), vec![])],
                        ..SubcallOutput::succeed()
                    }
                }
                _ => panic!("unexpected subcall"),
            }
        })
        .expect_cost(13 + 17 + total_call_cost * 2)
}

#[test]
fn batch_some_returns() {
    ExtBuilder::default().build().execute_with(|| {
        batch_returns(&precompiles(), Mode::BatchSome)
            .expect_log(log1(Bob, H256::repeat_byte(0x11), vec![]))
            .expect_log(log_subcall_succeeded(Batch, 0))
            .expect_log(log1(Charlie, H256::repeat_byte(0x22), vec![]))
            .expect_log(log_subcall_succeeded(Batch, 1))
            .execute_returns(())
    })
}

#[test]
fn batch_some_until_failure_returns() {
    ExtBuilder::default().build().execute_with(|| {
        batch_returns(&precompiles(), Mode::BatchSomeUntilFailure)
            .expect_log(log1(Bob, H256::repeat_byte(0x11), vec![]))
            .expect_log(log_subcall_succeeded(Batch, 0))
            .expect_log(log1(Charlie, H256::repeat_byte(0x22), vec![]))
            .expect_log(log_subcall_succeeded(Batch, 1))
            .execute_returns(())
    })
}

#[test]
fn batch_all_returns() {
    ExtBuilder::default().build().execute_with(|| {
        batch_returns(&precompiles(), Mode::BatchAll)
            .expect_log(log1(Bob, H256::repeat_byte(0x11), vec![]))
            .expect_log(log_subcall_succeeded(Batch, 0))
            .expect_log(log1(Charlie, H256::repeat_byte(0x22), vec![]))
            .expect_log(log_subcall_succeeded(Batch, 1))
            .execute_returns(())
    })
}

fn batch_out_of_gas(
    precompiles: &Precompiles<Runtime>,
    mode: Mode,
) -> PrecompilesTester<Precompiles<Runtime>> {
    let (_, total_call_cost) = costs();

    precompiles
        .prepare_test(
            Alice,
            Batch,
            PCall::batch_from_mode(
                mode,
                vec![Address(Bob.into())],
                vec![U256::from(1u8)],
                vec![b"one".to_vec()],
                vec![],
            ),
        )
        .with_target_gas(Some(50_000))
        .with_subcall_handle(move |subcall| {
            let Subcall {
                address,
                transfer,
                input,
                target_gas,
                is_static,
                context,
            } = subcall;

            // Called from the precompile caller.
            assert_eq!(context.caller, Alice.into());
            assert_eq!(is_static, false);

            match address {
                a if a == Bob.into() => {
                    assert_eq!(
                        target_gas,
                        Some(50_000 - total_call_cost),
                        "batch forward all gas"
                    );
                    let transfer = transfer.expect("there is a transfer");
                    assert_eq!(transfer.source, Alice.into());
                    assert_eq!(transfer.target, Bob.into());
                    assert_eq!(transfer.value, 1u8.into());

                    assert_eq!(context.address, Bob.into());
                    assert_eq!(context.apparent_value, 1u8.into());

                    assert_eq!(&input, b"one");

                    SubcallOutput {
                        cost: 11_000,
                        ..SubcallOutput::out_of_gas()
                    }
                }
                _ => panic!("unexpected subcall"),
            }
        })
}

#[test]
fn batch_some_out_of_gas() {
    ExtBuilder::default().build().execute_with(|| {
        batch_out_of_gas(&precompiles(), Mode::BatchSome)
            .expect_log(log_subcall_failed(Batch, 0))
            .execute_returns(())
    })
}

#[test]
fn batch_some_until_failure_out_of_gas() {
    ExtBuilder::default().build().execute_with(|| {
        batch_out_of_gas(&precompiles(), Mode::BatchSomeUntilFailure)
            .expect_log(log_subcall_failed(Batch, 0))
            .execute_returns(())
    })
}

#[test]
fn batch_all_out_of_gas() {
    ExtBuilder::default().build().execute_with(|| {
        batch_out_of_gas(&precompiles(), Mode::BatchAll).execute_error(ExitError::OutOfGas)
    })
}

fn batch_incomplete(
    precompiles: &Precompiles<Runtime>,
    mode: Mode,
) -> PrecompilesTester<Precompiles<Runtime>> {
    let mut counter = 0;

    let (_, total_call_cost) = costs();

    precompiles
        .prepare_test(
            Alice,
            Batch,
            PCall::batch_from_mode(
                mode,
                vec![
                    Address(Bob.into()),
                    Address(Charlie.into()),
                    Address(Alice.into()),
                ],
                vec![U256::from(1u8), U256::from(2u8), U256::from(3u8)],
                vec![b"one".to_vec()],
                vec![],
            ),
        )
        .with_target_gas(Some(300_000))
        .with_subcall_handle(move |subcall| {
            let Subcall {
                address,
                transfer,
                input,
                target_gas,
                is_static,
                context,
            } = subcall;

            // Called from the precompile caller.
            assert_eq!(context.caller, Alice.into());
            assert_eq!(is_static, false);

            match address {
                a if a == Bob.into() => {
                    assert_eq!(counter, 0, "this is the first call");
                    counter += 1;

                    assert_eq!(
                        target_gas,
                        Some(300_000 - total_call_cost),
                        "batch forward all gas"
                    );
                    let transfer = transfer.expect("there is a transfer");
                    assert_eq!(transfer.source, Alice.into());
                    assert_eq!(transfer.target, Bob.into());
                    assert_eq!(transfer.value, 1u8.into());

                    assert_eq!(context.address, Bob.into());
                    assert_eq!(context.apparent_value, 1u8.into());

                    assert_eq!(&input, b"one");

                    SubcallOutput {
                        cost: 13,
                        logs: vec![log1(Bob, H256::repeat_byte(0x11), vec![])],
                        ..SubcallOutput::succeed()
                    }
                }
                a if a == Charlie.into() => {
                    assert_eq!(counter, 1, "this is the second call");
                    counter += 1;

                    assert_eq!(
                        target_gas,
                        Some(300_000 - 13 - total_call_cost * 2),
                        "batch forward all gas"
                    );
                    let transfer = transfer.expect("there is a transfer");
                    assert_eq!(transfer.source, Alice.into());
                    assert_eq!(transfer.target, Charlie.into());
                    assert_eq!(transfer.value, 2u8.into());

                    assert_eq!(context.address, Charlie.into());
                    assert_eq!(context.apparent_value, 2u8.into());

                    assert_eq!(&input, b"");

                    SubcallOutput {
                        output: revert_as_bytes("Revert message"),
                        cost: 17,
                        ..SubcallOutput::revert()
                    }
                }
                a if a == Alice.into() => {
                    assert_eq!(counter, 2, "this is the third call");
                    counter += 1;

                    assert_eq!(
                        target_gas,
                        Some(300_000 - 13 - 17 - total_call_cost * 3),
                        "batch forward all gas"
                    );
                    let transfer = transfer.expect("there is a transfer");
                    assert_eq!(transfer.source, Alice.into());
                    assert_eq!(transfer.target, Alice.into());
                    assert_eq!(transfer.value, 3u8.into());

                    assert_eq!(context.address, Alice.into());
                    assert_eq!(context.apparent_value, 3u8.into());

                    assert_eq!(&input, b"");

                    SubcallOutput {
                        cost: 19,
                        logs: vec![log1(Alice, H256::repeat_byte(0x33), vec![])],
                        ..SubcallOutput::succeed()
                    }
                }
                _ => panic!("unexpected subcall"),
            }
        })
}

#[test]
fn batch_some_incomplete() {
    ExtBuilder::default().build().execute_with(|| {
        let (_, total_call_cost) = costs();

        batch_incomplete(&precompiles(), Mode::BatchSome)
            .expect_log(log1(Bob, H256::repeat_byte(0x11), vec![]))
            .expect_log(log_subcall_succeeded(Batch, 0))
            .expect_log(log_subcall_failed(Batch, 1))
            .expect_log(log1(Alice, H256::repeat_byte(0x33), vec![]))
            .expect_log(log_subcall_succeeded(Batch, 2))
            .expect_cost(13 + 17 + 19 + total_call_cost * 3)
            .execute_returns(())
    })
}

#[test]
fn batch_some_until_failure_incomplete() {
    ExtBuilder::default().build().execute_with(|| {
        let (_, total_call_cost) = costs();

        batch_incomplete(&precompiles(), Mode::BatchSomeUntilFailure)
            .expect_log(log1(Bob, H256::repeat_byte(0x11), vec![]))
            .expect_log(log_subcall_succeeded(Batch, 0))
            .expect_log(log_subcall_failed(Batch, 1))
            .expect_cost(13 + 17 + total_call_cost * 2)
            .execute_returns(())
    })
}

#[test]
fn batch_all_incomplete() {
    ExtBuilder::default().build().execute_with(|| {
        batch_incomplete(&precompiles(), Mode::BatchAll)
            .execute_reverts(|output| output == b"Revert message")
    })
}

fn batch_log_out_of_gas(
    precompiles: &Precompiles<Runtime>,
    mode: Mode,
) -> PrecompilesTester<Precompiles<Runtime>> {
    let (log_cost, _) = costs();

    precompiles
        .prepare_test(
            Alice,
            Batch,
            PCall::batch_from_mode(
                mode,
                vec![Address(Bob.into())],
                vec![U256::from(1u8)],
                vec![b"one".to_vec()],
                vec![],
            ),
        )
        .with_target_gas(Some(log_cost - 1))
        .with_subcall_handle(move |_subcall| panic!("there shouldn't be any subcalls"))
}

#[test]
fn batch_all_log_out_of_gas() {
    ExtBuilder::default().build().execute_with(|| {
        batch_log_out_of_gas(&precompiles(), Mode::BatchAll).execute_error(ExitError::OutOfGas);
    })
}

#[test]
fn batch_some_log_out_of_gas() {
    ExtBuilder::default().build().execute_with(|| {
        batch_log_out_of_gas(&precompiles(), Mode::BatchSome)
            .expect_no_logs()
            .execute_returns(());
    })
}

#[test]
fn batch_some_until_failure_log_out_of_gas() {
    ExtBuilder::default().build().execute_with(|| {
        batch_log_out_of_gas(&precompiles(), Mode::BatchSomeUntilFailure)
            .expect_no_logs()
            .execute_returns(());
    })
}

fn batch_call_out_of_gas(
    precompiles: &Precompiles<Runtime>,
    mode: Mode,
) -> PrecompilesTester<Precompiles<Runtime>> {
    let (_, total_call_cost) = costs();

    precompiles
        .prepare_test(
            Alice,
            Batch,
            PCall::batch_from_mode(
                mode,
                vec![Address(Bob.into())],
                vec![U256::from(1u8)],
                vec![b"one".to_vec()],
                vec![],
            ),
        )
        .with_target_gas(Some(total_call_cost - 1))
        .with_subcall_handle(move |_subcall| panic!("there shouldn't be any subcalls"))
}

#[test]
fn batch_all_call_out_of_gas() {
    ExtBuilder::default().build().execute_with(|| {
        batch_call_out_of_gas(&precompiles(), Mode::BatchAll).execute_error(ExitError::OutOfGas);
    })
}

#[test]
fn batch_some_call_out_of_gas() {
    ExtBuilder::default().build().execute_with(|| {
        batch_call_out_of_gas(&precompiles(), Mode::BatchSome)
            .expect_log(log_subcall_failed(Batch, 0))
            .execute_returns(());
    })
}

#[test]
fn batch_some_until_failure_call_out_of_gas() {
    ExtBuilder::default().build().execute_with(|| {
        batch_call_out_of_gas(&precompiles(), Mode::BatchSomeUntilFailure)
            .expect_log(log_subcall_failed(Batch, 0))
            .execute_returns(());
    })
}

fn batch_gas_limit(
    precompiles: &Precompiles<Runtime>,
    mode: Mode,
) -> PrecompilesTester<Precompiles<Runtime>> {
    let (_, total_call_cost) = costs();

    precompiles
        .prepare_test(
            Alice,
            Batch,
            PCall::batch_from_mode(
                mode,
                vec![Address(Bob.into())],
                vec![U256::from(1u8)],
                vec![b"one".to_vec()],
                vec![50_000 - total_call_cost + 1],
            ),
        )
        .with_target_gas(Some(50_000))
        .with_subcall_handle(move |_subcall| panic!("there shouldn't be any subcalls"))
}

#[test]
fn batch_all_gas_limit() {
    ExtBuilder::default().build().execute_with(|| {
        batch_gas_limit(&precompiles(), Mode::BatchAll).execute_error(ExitError::OutOfGas);
    })
}

#[test]
fn batch_some_gas_limit() {
    ExtBuilder::default().build().execute_with(|| {
        let (return_log_cost, _) = costs();

        batch_gas_limit(&precompiles(), Mode::BatchSome)
            .expect_log(log_subcall_failed(Batch, 0))
            .expect_cost(return_log_cost)
            .execute_returns(());
    })
}

#[test]
fn batch_some_until_failure_gas_limit() {
    ExtBuilder::default().build().execute_with(|| {
        batch_gas_limit(&precompiles(), Mode::BatchSomeUntilFailure)
            .expect_log(log_subcall_failed(Batch, 0))
            .execute_returns(());
    })
}

#[test]
fn evm_batch_some_transfers_enough() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Alice,
                PCall::batch_some {
                    to: vec![Address(Bob.into()), Address(Charlie.into())].into(),
                    value: vec![U256::from(1_000u16), U256::from(2_000u16)].into(),
                    call_data: vec![].into(),
                    gas_limit: vec![].into(),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));
        })
}

#[test]
fn evm_batch_some_until_failure_transfers_enough() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Alice,
                PCall::batch_some_until_failure {
                    to: vec![Address(Bob.into()), Address(Charlie.into())].into(),
                    value: vec![U256::from(1_000u16), U256::from(2_000u16)].into(),
                    call_data: vec![].into(),
                    gas_limit: vec![].into(),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));
        })
}

#[test]
fn evm_batch_all_transfers_enough() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Alice,
                PCall::batch_all {
                    to: vec![Address(Bob.into()), Address(Charlie.into())].into(),
                    value: vec![U256::from(1_000u16), U256::from(2_000u16)].into(),
                    call_data: vec![].into(),
                    gas_limit: vec![].into(),
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_eq!(balance(Bob), 1_000);
            assert_eq!(balance(Charlie), 2_000);
        })
}

#[test]
fn evm_batch_some_transfers_too_much() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Alice,
                PCall::batch_some {
                    to: vec![
                        Address(Bob.into()),
                        Address(Charlie.into()),
                        Address(David.into()),
                    ]
                    .into(),
                    value: vec![
                        U256::from(9_000u16),
                        U256::from(2_000u16),
                        U256::from(500u16)
                    ]
                    .into(),
                    call_data: vec![].into(),
                    gas_limit: vec![].into()
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_eq!(balance(Alice), 500); // gasprice = 0
            assert_eq!(balance(Bob), 9_000);
            assert_eq!(balance(Charlie), 0);
            assert_eq!(balance(David), 500);
        })
}

#[test]
fn evm_batch_some_until_failure_transfers_too_much() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Alice,
                PCall::batch_some_until_failure {
                    to: vec![
                        Address(Bob.into()),
                        Address(Charlie.into()),
                        Address(David.into()),
                    ]
                    .into(),
                    value: vec![
                        U256::from(9_000u16),
                        U256::from(2_000u16),
                        U256::from(500u16)
                    ]
                    .into(),
                    call_data: vec![].into(),
                    gas_limit: vec![].into()
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_eq!(balance(Alice), 1_000); // gasprice = 0
            assert_eq!(balance(Bob), 9_000);
            assert_eq!(balance(Charlie), 0);
            assert_eq!(balance(David), 0);
        })
}

#[test]
fn evm_batch_all_transfers_too_much() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Alice,
                PCall::batch_all {
                    to: vec![
                        Address(Bob.into()),
                        Address(Charlie.into()),
                        Address(David.into()),
                    ]
                    .into(),
                    value: vec![
                        U256::from(9_000u16),
                        U256::from(2_000u16),
                        U256::from(500u16)
                    ]
                    .into(),
                    call_data: vec![].into(),
                    gas_limit: vec![].into()
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_eq!(balance(Alice), 10_000); // gasprice = 0
            assert_eq!(balance(Bob), 0);
            assert_eq!(balance(Charlie), 0);
            assert_eq!(balance(David), 0);
        })
}

#[test]
fn evm_batch_some_contract_revert() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Alice,
                PCall::batch_some {
                    to: vec![
                        Address(Bob.into()),
                        Address(Revert.into()),
                        Address(David.into()),
                    ]
                    .into(),
                    value: vec![
                        U256::from(1_000u16),
                        U256::from(2_000),
                        U256::from(3_000u16)
                    ]
                    .into(),
                    call_data: vec![].into(),
                    gas_limit: vec![].into()
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_eq!(balance(Alice), 6_000); // gasprice = 0
            assert_eq!(balance(Bob), 1_000);
            assert_eq!(balance(Revert), 0);
            assert_eq!(balance(David), 3_000);
        })
}

#[test]
fn evm_batch_some_until_failure_contract_revert() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Alice,
                PCall::batch_some_until_failure {
                    to: vec![
                        Address(Bob.into()),
                        Address(Revert.into()),
                        Address(David.into()),
                    ]
                    .into(),
                    value: vec![
                        U256::from(1_000u16),
                        U256::from(2_000),
                        U256::from(3_000u16)
                    ]
                    .into(),
                    call_data: vec![].into(),
                    gas_limit: vec![].into()
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_eq!(balance(Alice), 9_000); // gasprice = 0
            assert_eq!(balance(Bob), 1_000);
            assert_eq!(balance(Revert), 0);
            assert_eq!(balance(David), 0);
        })
}

#[test]
fn evm_batch_all_contract_revert() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10_000)])
        .build()
        .execute_with(|| {
            assert_ok!(RuntimeCall::Evm(evm_call(
                Alice,
                PCall::batch_all {
                    to: vec![
                        Address(Bob.into()),
                        Address(Revert.into()),
                        Address(David.into()),
                    ]
                    .into(),
                    value: vec![
                        U256::from(1_000u16),
                        U256::from(2_000),
                        U256::from(3_000u16)
                    ]
                    .into(),
                    call_data: vec![].into(),
                    gas_limit: vec![].into()
                }
                .into()
            ))
            .dispatch(RuntimeOrigin::root()));

            assert_eq!(balance(Alice), 10_000); // gasprice = 0
            assert_eq!(balance(Bob), 0);
            assert_eq!(balance(Revert), 0);
            assert_eq!(balance(David), 0);
        })
}

#[test]
fn evm_batch_recursion_under_limit() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10_000)])
        .build()
        .execute_with(|| {
            // Mock sets the recursion limit to 2, and we 2 nested batch.
            // Thus it succeeds.

            let input = PCall::batch_all {
                to: vec![Address(Batch.into())].into(),
                value: vec![].into(),
                gas_limit: vec![].into(),
                call_data: vec![PCall::batch_all {
                    to: vec![Address(Bob.into())].into(),
                    value: vec![1000_u32.into()].into(),
                    gas_limit: vec![].into(),
                    call_data: vec![].into(),
                }
                .encode()
                .into()]
                .into(),
            }
            .into();

            assert_ok!(RuntimeCall::Evm(evm_call(Alice, input)).dispatch(RuntimeOrigin::root()));

            assert_eq!(balance(Alice), 9_000); // gasprice = 0
            assert_eq!(balance(Bob), 1_000);
        })
}

#[test]
fn evm_batch_recursion_over_limit() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10_000)])
        .build()
        .execute_with(|| {
            // Mock sets the recursion limit to 2, and we 3 nested batch.
            // Thus it reverts.

            let input = PCall::batch_from_mode(
                Mode::BatchAll,
                vec![Address(Batch.into())],
                vec![],
                vec![PCall::batch_from_mode(
                    Mode::BatchAll,
                    vec![Address(Batch.into())],
                    vec![],
                    vec![PCall::batch_from_mode(
                        Mode::BatchAll,
                        vec![Address(Bob.into())],
                        vec![1000_u32.into()],
                        vec![],
                        vec![].into(),
                    )
                    .into()],
                    vec![].into(),
                )
                .into()],
                vec![],
            )
            .into();

            assert_ok!(RuntimeCall::Evm(evm_call(Alice, input)).dispatch(RuntimeOrigin::root()));

            assert_eq!(balance(Alice), 10_000); // gasprice = 0
            assert_eq!(balance(Bob), 0);
        })
}

#[test]
fn batch_is_not_callable_by_dummy_code() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 10_000)])
        .build()
        .execute_with(|| {
            // "deploy" dummy code to alice address
            let alice_h160: H160 = Alice.into();
            pallet_evm::AccountCodes::<Runtime>::insert(
                alice_h160,
                [0x60, 0x00, 0x60, 0x00, 0xfd].to_vec(),
            );

            // succeeds if called by dummy code, see `evm_batch_recursion_under_limit`
            let input = PCall::batch_all {
                to: vec![Address(Batch.into())].into(),
                value: vec![].into(),
                gas_limit: vec![].into(),
                call_data: vec![PCall::batch_all {
                    to: vec![Address(Bob.into())].into(),
                    value: vec![1000_u32.into()].into(),
                    gas_limit: vec![].into(),
                    call_data: vec![].into(),
                }
                .encode()
                .into()]
                .into(),
            }
            .into();

            match RuntimeCall::Evm(evm_call(Alice, input)).dispatch(RuntimeOrigin::root()) {
                Err(DispatchErrorWithPostInfo {
                    error:
                        DispatchError::Module(ModuleError {
                            message: Some(err_msg),
                            ..
                        }),
                    ..
                }) => println!("MESSAGE {:?}", err_msg),
                _ => println!("expected error 'TransactionMustComeFromEOA'"),
            }
        })
}

#[test]
fn test_solidity_interface_has_all_function_selectors_documented_and_implemented() {
    check_precompile_implements_solidity_interfaces(&["Batch.sol"], PCall::supports_selector)
}
