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

//! Randomness precompile unit tests
use crate::{
	assert_event_emitted, mock::*, prepare_and_finish_fulfillment_gas_cost,
	subcall_overhead_gas_costs,
};
use fp_evm::FeeCalculator;
use pallet_randomness::{Event as RandomnessEvent, RandomnessResults, RequestType};
use precompile_utils::{prelude::*, testing::*};
use sp_core::{H160, H256, U256};

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
	assert!(PCall::relay_epoch_index_selectors().contains(&0x81797566));
	assert!(PCall::required_deposit_selectors().contains(&0xfb7cfdd7));
	assert!(PCall::get_request_status_selectors().contains(&0xd8a4676f));
	assert!(PCall::get_request_selectors().contains(&0xc58343ef));
	assert!(PCall::request_local_randomness_selectors().contains(&0x9478430c));
	assert!(PCall::request_babe_randomness_selectors().contains(&0x33c14a63));
	assert!(PCall::fulfill_request_selectors().contains(&0x9a91eb0d));
	assert!(PCall::increase_request_fee_selectors().contains(&0xd0408a7f));
	assert!(PCall::purge_expired_request_selectors().contains(&0x1d26cbab));
}

#[test]
fn modifiers() {
	ExtBuilder::default().build().execute_with(|| {
		let mut tester =
			PrecompilesModifierTester::new(PrecompilesValue::get(), Alice, Precompile1);

		tester.test_view_modifier(PCall::relay_epoch_index_selectors());
		tester.test_view_modifier(PCall::required_deposit_selectors());
		tester.test_view_modifier(PCall::get_request_status_selectors());
		tester.test_view_modifier(PCall::get_request_selectors());
		tester.test_default_modifier(PCall::request_local_randomness_selectors());
		tester.test_default_modifier(PCall::request_babe_randomness_selectors());
		tester.test_default_modifier(PCall::fulfill_request_selectors());
		tester.test_default_modifier(PCall::purge_expired_request_selectors());
	});
}

#[test]
fn test_solidity_interface_has_all_function_selectors_documented_and_implemented() {
	check_precompile_implements_solidity_interfaces(&["Randomness.sol"], PCall::supports_selector)
}

#[test]
fn relay_epoch_index_works() {
	ExtBuilder::default().build().execute_with(|| {
		pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);

		PrecompilesValue::get()
			.prepare_test(Alice, Precompile1, PCall::relay_epoch_index {})
			.execute_returns(1u64);
	})
}

#[test]
fn required_deposit_works() {
	ExtBuilder::default().build().execute_with(|| {
		pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);

		PrecompilesValue::get()
			.prepare_test(Alice, Precompile1, PCall::required_deposit {})
			.execute_returns(U256::from(10));
	})
}

#[test]
fn get_dne_request_status() {
	ExtBuilder::default().build().execute_with(|| {
		pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);

		PrecompilesValue::get()
			.prepare_test(
				Alice,
				Precompile1,
				PCall::get_request_status {
					request_id: 1.into(),
				},
			)
			.execute_returns(0u8);
	})
}

#[test]
fn get_pending_request_status() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 1000)])
		.build()
		.execute_with(|| {
			pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);

			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::request_babe_randomness {
						refund_address: Address(Bob.into()),
						fee: U256::one(),
						gas_limit: 100u64,
						salt: H256::default(),
						num_words: 1u8,
					},
				)
				.execute_returns(U256::zero());

			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::get_request_status {
						request_id: 0.into(),
					},
				)
				.execute_returns(1u8);
		})
}

#[test]
fn get_ready_request_status() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 1000)])
		.build()
		.execute_with(|| {
			pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);
			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::request_local_randomness {
						refund_address: Address(Bob.into()),
						fee: U256::one(),
						gas_limit: 10u64,
						salt: H256::default(),
						num_words: 1u8,
						delay: 2.into(),
					},
				)
				.execute_returns(U256::zero());
			// run to ready block
			System::set_block_number(3);
			// ready status
			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::get_request_status {
						request_id: 0.into(),
					},
				)
				.execute_returns(2u8);
		})
}

#[test]
fn get_expired_request_status() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 1000)])
		.build()
		.execute_with(|| {
			pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);
			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::request_local_randomness {
						refund_address: Address(Bob.into()),
						fee: U256::one(),
						gas_limit: 10u64,
						salt: H256::default(),
						num_words: 1u8,
						delay: 2.into(),
					},
				)
				.execute_returns(U256::zero());
			// run to expired block
			System::set_block_number(21);
			// ready status
			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::get_request_status {
						request_id: 0.into(),
					},
				)
				.execute_returns(3u8);
		})
}

#[test]
fn get_request_works() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 1000)])
		.build()
		.execute_with(|| {
			pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);
			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::request_local_randomness {
						refund_address: Address(Bob.into()),
						fee: U256::one(),
						gas_limit: 100u64,
						salt: H256::default(),
						num_words: 1u8,
						delay: 2.into(),
					},
				)
				.execute_returns(U256::zero());
			// run to expired block
			System::set_block_number(21);
			// ready status
			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::get_request {
						request_id: 0.into(),
					},
				)
				.execute_returns((
					U256::zero(),
					Address(Bob.into()),
					Address(Alice.into()),
					U256::one(),
					U256::from(100),
					H256::default(),
					1u8,
					0u8,
					3u32,
					0u64,
					21u32,
					0u64,
					3u8,
				));
		})
}

#[test]
fn request_babe_randomness_works() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 1000)])
		.build()
		.execute_with(|| {
			pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);

			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::request_babe_randomness {
						refund_address: Address(H160::from(Bob)),
						fee: U256::one(),
						gas_limit: 100u64,
						salt: H256::default(),
						num_words: 1u8,
					},
				)
				.execute_returns(U256::zero());
			assert_event_emitted!(RuntimeEvent::Randomness(
				RandomnessEvent::RandomnessRequestedBabeEpoch {
					id: 0,
					refund_address: H160::from(Bob),
					contract_address: H160::from(Alice),
					fee: 1,
					gas_limit: 100u64,
					num_words: 1u8,
					salt: H256::default(),
					earliest_epoch: 3,
				}
			));
		})
}

#[test]
fn request_local_randomness_works() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 1000)])
		.build()
		.execute_with(|| {
			pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);

			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::request_local_randomness {
						refund_address: Address(H160::from(Bob)),
						fee: U256::one(),
						gas_limit: 100u64,
						salt: H256::default(),
						num_words: 1u8,
						delay: 2.into(),
					},
				)
				.execute_returns(U256::zero());
			assert_event_emitted!(RuntimeEvent::Randomness(
				RandomnessEvent::RandomnessRequestedLocal {
					id: 0,
					refund_address: H160::from(Bob),
					contract_address: H160::from(Alice),
					fee: 1,
					gas_limit: 100u64,
					num_words: 1u8,
					salt: H256::default(),
					earliest_block: 3,
				}
			));
		});
}

#[test]
fn fulfill_request_reverts_if_not_enough_gas() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 1000)])
		.build()
		.execute_with(|| {
			pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);
			let request_gas_limit = 100u64;
			let total_cost = request_gas_limit
				+ subcall_overhead_gas_costs::<Runtime>().unwrap()
				+ prepare_and_finish_fulfillment_gas_cost::<Runtime>(1);

			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::request_local_randomness {
						refund_address: Address(H160::from(Bob)),
						fee: U256::one(),
						gas_limit: request_gas_limit,
						salt: H256::default(),
						num_words: 1u8,
						delay: 2.into(),
					},
				)
				.execute_returns(U256::zero());

			// run to ready block
			System::set_block_number(3);

			// fill randomness results
			let mut filled_results =
				RandomnessResults::<Runtime>::get(RequestType::Local(3)).unwrap();
			filled_results.randomness = Some(H256::default());
			RandomnessResults::<Runtime>::insert(RequestType::Local(3), filled_results);

			// fulfill request
			PrecompilesValue::get()
				.prepare_test(
					Charlie,
					Precompile1,
					PCall::fulfill_request {
						request_id: 0.into(),
					},
				)
				.with_target_gas(Some(total_cost - 1))
				.with_subcall_handle(|_| panic!("should not perform subcall"))
				.expect_no_logs()
				.execute_reverts(|revert| revert == b"not enough gas to perform the call");

			// no refund
			assert_eq!(Balances::free_balance(&AccountId::from(Charlie)), 0);
		})
}

#[test]
fn fulfill_request_works() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 1000)])
		.build()
		.execute_with(|| {
			pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);

			let request_gas_limit = 100u64;
			let subcall_used_gas = 50u64;
			let total_cost = request_gas_limit
				+ subcall_overhead_gas_costs::<Runtime>().unwrap()
				+ prepare_and_finish_fulfillment_gas_cost::<Runtime>(1);
			let refunded_amount = U256::from(
				subcall_used_gas
					+ subcall_overhead_gas_costs::<Runtime>().unwrap()
					+ prepare_and_finish_fulfillment_gas_cost::<Runtime>(1),
			)
				* <Runtime as pallet_evm::Config>::FeeCalculator::min_gas_price().0;

			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::request_local_randomness {
						refund_address: Address(H160::from(Bob)),
						fee: U256::one(),
						gas_limit: request_gas_limit,
						salt: H256::default(),
						num_words: 1u8,
						delay: 2.into(),
					},
				)
				.execute_returns(U256::zero());
			// run to ready block
			System::set_block_number(3);
			// fill randomness results
			let mut filled_results =
				RandomnessResults::<Runtime>::get(RequestType::Local(3)).unwrap();
			filled_results.randomness = Some(H256::default());
			RandomnessResults::<Runtime>::insert(RequestType::Local(3), filled_results);

			let pallet_randomness::FulfillArgs {
				randomness: random_words,
				..
			} = pallet_randomness::Pallet::<Runtime>::prepare_fulfillment(0)
				.expect("can prepare values");

			let random_words: Vec<H256> = random_words.into_iter().map(|x| x.into()).collect();

			// fulfill request
			PrecompilesValue::get()
				.prepare_test(
					Charlie,
					Precompile1,
					PCall::fulfill_request {
						request_id: 0.into(),
					},
				)
				.with_subcall_handle(move |subcall| {
					let Subcall {
						address,
						transfer,
						input,
						target_gas,
						is_static,
						context,
					} = subcall;

					assert_eq!(context.caller, Precompile1.into());
					assert_eq!(address, Alice.into());
					assert_eq!(is_static, false);
					assert_eq!(target_gas, Some(request_gas_limit));
					assert!(transfer.is_none());
					assert_eq!(context.address, Alice.into());
					assert_eq!(context.apparent_value, 0u8.into());
					// callback function selector: keccak256("rawFulfillRandomWords(uint256,uint256[])")
					assert_eq!(
						&input,
						&solidity::encode_with_selector(
							0x1fe543e3_u32,
							(
								0u64, // request id
								random_words.clone()
							)
						)
					);

					SubcallOutput {
						output: b"TEST".to_vec(),
						cost: subcall_used_gas,
						..SubcallOutput::succeed()
					}
				})
				.with_target_gas(Some(total_cost))
				.expect_log(crate::log_fulfillment_succeeded(Precompile1))
				.execute_returns(());

			// correctly refunded
			assert_eq!(
				U256::from(Balances::free_balance(&AccountId::from(Charlie))),
				refunded_amount
			);
		})
}

#[test]
fn fulfill_request_works_with_higher_gas() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 1000)])
		.build()
		.execute_with(|| {
			pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);

			let request_gas_limit = 100u64;
			let subcall_used_gas = 50u64;
			let total_cost = request_gas_limit
				+ subcall_overhead_gas_costs::<Runtime>().unwrap()
				+ prepare_and_finish_fulfillment_gas_cost::<Runtime>(1);
			let refunded_amount = U256::from(
				subcall_used_gas
					+ subcall_overhead_gas_costs::<Runtime>().unwrap()
					+ prepare_and_finish_fulfillment_gas_cost::<Runtime>(1),
			)
				* <Runtime as pallet_evm::Config>::FeeCalculator::min_gas_price().0;

			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::request_local_randomness {
						refund_address: Address(H160::from(Bob)),
						fee: U256::one(),
						gas_limit: request_gas_limit,
						salt: H256::default(),
						num_words: 1u8,
						delay: 2.into(),
					},
				)
				.execute_returns(U256::zero());

			// run to ready block
			System::set_block_number(3);

			// fill randomness results
			let mut filled_results =
				RandomnessResults::<Runtime>::get(RequestType::Local(3)).unwrap();
			filled_results.randomness = Some(H256::default());
			RandomnessResults::<Runtime>::insert(RequestType::Local(3), filled_results);

			let pallet_randomness::FulfillArgs {
				randomness: random_words,
				..
			} = pallet_randomness::Pallet::<Runtime>::prepare_fulfillment(0)
				.expect("can prepare values");

			let random_words: Vec<H256> = random_words.into_iter().map(|x| x.into()).collect();

			// fulfill request
			PrecompilesValue::get()
				.prepare_test(
					Charlie,
					Precompile1,
					PCall::fulfill_request {
						request_id: 0.into(),
					},
				)
				.with_subcall_handle(move |subcall| {
					let Subcall {
						address,
						transfer,
						input,
						target_gas,
						is_static,
						context,
					} = subcall;

					assert_eq!(context.caller, Precompile1.into());
					assert_eq!(address, Alice.into());
					assert_eq!(is_static, false);
					assert_eq!(target_gas, Some(request_gas_limit));
					assert!(transfer.is_none());
					assert_eq!(context.address, Alice.into());
					assert_eq!(context.apparent_value, 0u8.into());
					// callback function selector: keccak256("rawFulfillRandomWords(uint256,uint256[])")
					assert_eq!(
						&input,
						&solidity::encode_with_selector(
							0x1fe543e3_u32,
							(
								0u64, // request id
								random_words.clone(),
							)
						)
					);

					SubcallOutput {
						output: b"TEST".to_vec(),
						cost: subcall_used_gas,
						..SubcallOutput::succeed()
					}
				})
				.with_target_gas(Some(total_cost + 10_000))
				.expect_log(crate::log_fulfillment_succeeded(Precompile1))
				.execute_returns(());

			// correctly refunded
			assert_eq!(
				U256::from(Balances::free_balance(&AccountId::from(Charlie))),
				refunded_amount
			);
		})
}

#[test]
fn fulfill_request_works_with_subcall_revert() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 1000)])
		.build()
		.execute_with(|| {
			pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);

			let request_gas_limit = 100u64;
			let subcall_used_gas = 50u64;
			let total_cost = request_gas_limit
				+ subcall_overhead_gas_costs::<Runtime>().unwrap()
				+ prepare_and_finish_fulfillment_gas_cost::<Runtime>(1);
			let refunded_amount = U256::from(
				subcall_used_gas
					+ subcall_overhead_gas_costs::<Runtime>().unwrap()
					+ prepare_and_finish_fulfillment_gas_cost::<Runtime>(1),
			)
				* <Runtime as pallet_evm::Config>::FeeCalculator::min_gas_price().0;

			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::request_local_randomness {
						refund_address: Address(H160::from(Bob)),
						fee: U256::one(),
						gas_limit: request_gas_limit,
						salt: H256::default(),
						num_words: 1u8,
						delay: 2.into(),
					},
				)
				.execute_returns(U256::zero());

			// run to ready block
			System::set_block_number(3);

			// fill randomness results
			let mut filled_results =
				RandomnessResults::<Runtime>::get(RequestType::Local(3)).unwrap();
			filled_results.randomness = Some(H256::default());
			RandomnessResults::<Runtime>::insert(RequestType::Local(3), filled_results);

			let pallet_randomness::FulfillArgs {
				randomness: random_words,
				..
			} = pallet_randomness::Pallet::<Runtime>::prepare_fulfillment(0)
				.expect("can prepare values");

			let random_words: Vec<H256> = random_words.into_iter().map(|x| x.into()).collect();

			// fulfill request
			PrecompilesValue::get()
				.prepare_test(
					Charlie,
					Precompile1,
					PCall::fulfill_request {
						request_id: 0.into(),
					},
				)
				.with_subcall_handle(move |subcall| {
					let Subcall {
						address,
						transfer,
						input,
						target_gas,
						is_static,
						context,
					} = subcall;

					assert_eq!(context.caller, Precompile1.into());
					assert_eq!(address, Alice.into());
					assert_eq!(is_static, false);
					assert_eq!(target_gas, Some(request_gas_limit));
					assert!(transfer.is_none());
					assert_eq!(context.address, Alice.into());
					assert_eq!(context.apparent_value, 0u8.into());
					// callback function selector: keccak256("rawFulfillRandomWords(uint256,uint256[])")
					assert_eq!(
						&input,
						&solidity::encode_with_selector(
							0x1fe543e3_u32,
							(
								0u64, // request id
								random_words.clone()
							)
						)
					);

					SubcallOutput {
						cost: subcall_used_gas,
						..SubcallOutput::revert()
					}
				})
				.with_target_gas(Some(total_cost))
				.expect_log(crate::log_fulfillment_failed(Precompile1))
				.execute_returns(());

			// correctly refunded
			assert_eq!(
				U256::from(Balances::free_balance(&AccountId::from(Charlie))),
				refunded_amount
			);
		})
}

#[test]
fn increase_request_fee_works() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 1000)])
		.build()
		.execute_with(|| {
			pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);
			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::request_local_randomness {
						refund_address: Address(H160::from(Bob)),
						fee: U256::one(),
						gas_limit: 100u64,
						salt: H256::default(),
						num_words: 1u8,
						delay: 2.into(),
					},
				)
				.execute_returns(U256::zero());
			// increase request fee
			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::increase_request_fee {
						request_id: 0.into(),
						fee_increase: 10.into(),
					},
				)
				.execute_returns(());
			assert_event_emitted!(RuntimeEvent::Randomness(
				RandomnessEvent::RequestFeeIncreased { id: 0, new_fee: 11 }
			));
		})
}

#[test]
fn purge_expired_request_works() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 1000)])
		.build()
		.execute_with(|| {
			pallet_evm::AccountCodes::<Runtime>::insert(H160::from(Alice), vec![10u8]);
			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::request_local_randomness {
						refund_address: Address(H160::from(Bob)),
						fee: U256::one(),
						gas_limit: 100u64,
						salt: H256::default(),
						num_words: 1u8,
						delay: 2.into(),
					},
				)
				.execute_returns(U256::zero());
			System::set_block_number(21);
			// purge expired request
			PrecompilesValue::get()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::purge_expired_request {
						request_id: 0.into(),
					},
				)
				.execute_returns(());
			assert_event_emitted!(RuntimeEvent::Randomness(
				RandomnessEvent::RequestExpirationExecuted { id: 0 }
			));
		})
}
