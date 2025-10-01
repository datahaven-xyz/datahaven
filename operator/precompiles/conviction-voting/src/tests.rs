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
	mock::*, SELECTOR_LOG_DELEGATED, SELECTOR_LOG_UNDELEGATED, SELECTOR_LOG_UNLOCKED,
	SELECTOR_LOG_VOTED, SELECTOR_LOG_VOTE_REMOVED, SELECTOR_LOG_VOTE_REMOVED_FOR_TRACK,
	SELECTOR_LOG_VOTE_REMOVED_OTHER, SELECTOR_LOG_VOTE_SPLIT, SELECTOR_LOG_VOTE_SPLIT_ABSTAINED,
};
use precompile_utils::{prelude::*, testing::*};

use frame_support::assert_ok;
use pallet_evm::{Call as EvmCall, Event as EvmEvent};
use sp_core::{H160, H256, U256};
use sp_runtime::{
	traits::{Dispatchable, PostDispatchInfoOf},
	DispatchResultWithInfo,
};

const ONGOING_POLL_INDEX: u32 = 3;

fn precompiles() -> Precompiles<Runtime> {
	PrecompilesValue::get()
}

fn evm_call(input: Vec<u8>) -> EvmCall<Runtime> {
	EvmCall::call {
		source: Alice.into(),
		target: Precompile1.into(),
		input,
		value: U256::zero(),
		gas_limit: u64::max_value(),
		max_fee_per_gas: 0.into(),
		max_priority_fee_per_gas: Some(U256::zero()),
		nonce: None,
		access_list: Vec::new(),
		authorization_list: Vec::new(),
	}
}

#[test]
fn test_solidity_interface_has_all_function_selectors_documented_and_implemented() {
	check_precompile_implements_solidity_interfaces(
		&["ConvictionVoting.sol"],
		PCall::supports_selector,
	)
}

fn standard_vote(
	direction: bool,
	vote_amount: U256,
	conviction: u8,
) -> DispatchResultWithInfo<PostDispatchInfoOf<RuntimeCall>> {
	let input = match direction {
		// Vote Yes
		true => PCall::vote_yes {
			poll_index: ONGOING_POLL_INDEX,
			vote_amount,
			conviction,
		}
		.into(),
		// Vote No
		false => PCall::vote_no {
			poll_index: ONGOING_POLL_INDEX,
			vote_amount,
			conviction,
		}
		.into(),
	};
	RuntimeCall::Evm(evm_call(input)).dispatch(RuntimeOrigin::root())
}

fn split_vote(
	aye: U256,
	nay: U256,
	maybe_abstain: Option<U256>,
) -> DispatchResultWithInfo<PostDispatchInfoOf<RuntimeCall>> {
	let input = if let Some(abstain) = maybe_abstain {
		// Vote SplitAbstain
		PCall::vote_split_abstain {
			poll_index: ONGOING_POLL_INDEX,
			aye,
			nay,
			abstain,
		}
		.into()
	} else {
		// Vote Split
		PCall::vote_split {
			poll_index: ONGOING_POLL_INDEX,
			aye,
			nay,
		}
		.into()
	};
	RuntimeCall::Evm(evm_call(input)).dispatch(RuntimeOrigin::root())
}

#[test]
fn standard_vote_logs_work() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 100_000)])
		.build()
		.execute_with(|| {
			// Vote Yes
			assert_ok!(standard_vote(true, 100_000.into(), 0.into()));

			// Vote No
			assert_ok!(standard_vote(false, 99_000.into(), 1.into()));

			// Assert vote events are emitted.
			let expected_events = vec![
				EvmEvent::Log {
					log: log2(
						Precompile1,
						SELECTOR_LOG_VOTED,
						H256::from_low_u64_be(ONGOING_POLL_INDEX as u64),
						solidity::encode_event_data((
							Address(Alice.into()), // caller,
							true,                  // vote
							U256::from(100_000),   // amount
							0u8,                   // conviction
						)),
					),
				}
				.into(),
				EvmEvent::Log {
					log: log2(
						Precompile1,
						SELECTOR_LOG_VOTED,
						H256::from_low_u64_be(ONGOING_POLL_INDEX as u64),
						solidity::encode_event_data((
							Address(Alice.into()), // caller
							false,                 // vote,
							U256::from(99_000),    // amount
							1u8,                   // conviction
						)),
					),
				}
				.into(),
			];
			for log in expected_events {
				assert!(
					events().contains(&log),
					"Expected event not found: {:?}\nAll events:\n{:?}",
					log,
					events()
				);
			}
		})
}

#[test]
fn split_vote_logs_work() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 100_000)])
		.build()
		.execute_with(|| {
			// Vote split
			assert_ok!(split_vote(20_000.into(), 30_000.into(), None));

			// Vote split abstain
			assert_ok!(split_vote(
				20_000.into(),
				20_000.into(),
				Some(10_000.into())
			));

			// Assert vote events are emitted.
			let expected_events = vec![
				EvmEvent::Log {
					log: log2(
						Precompile1,
						SELECTOR_LOG_VOTE_SPLIT,
						H256::from_low_u64_be(ONGOING_POLL_INDEX as u64),
						solidity::encode_event_data((
							Address(Alice.into()), // caller
							U256::from(20_000),    // aye vote
							U256::from(30_000),    // nay vote
						)),
					),
				}
				.into(),
				EvmEvent::Log {
					log: log2(
						Precompile1,
						SELECTOR_LOG_VOTE_SPLIT_ABSTAINED,
						H256::from_low_u64_be(ONGOING_POLL_INDEX as u64),
						solidity::encode_event_data((
							Address(Alice.into()), // caller,
							U256::from(20_000),    // aye vote
							U256::from(20_000),    // nay vote
							U256::from(10_000),    // abstain vote
						)),
					),
				}
				.into(),
			];
			for log in expected_events {
				assert!(
					events().contains(&log),
					"Expected event not found: {:?}\nAll events:\n{:?}",
					log,
					events()
				);
			}
		})
}

#[test]
fn remove_vote_logs_work() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 100_000)])
		.build()
		.execute_with(|| {
			// Vote..
			assert_ok!(standard_vote(true, 100_000.into(), 0.into()));

			// ..and remove
			let input = PCall::remove_vote {
				poll_index: ONGOING_POLL_INDEX,
			}
			.into();
			assert_ok!(RuntimeCall::Evm(evm_call(input)).dispatch(RuntimeOrigin::root()));

			// Assert remove vote event is emitted.
			assert!(events().contains(
				&EvmEvent::Log {
					log: log2(
						Precompile1,
						SELECTOR_LOG_VOTE_REMOVED,
						H256::from_low_u64_be(ONGOING_POLL_INDEX as u64),
						solidity::encode_event_data(Address(Alice.into())) // caller
					),
				}
				.into()
			));
		})
}

#[test]
fn remove_vote_for_track_logs_work() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 100_000)])
		.build()
		.execute_with(|| {
			// Vote..
			assert_ok!(standard_vote(true, 100_000.into(), 0.into()));

			// ..and remove
			let input = PCall::remove_vote_for_track {
				poll_index: ONGOING_POLL_INDEX,
				track_id: 0u16,
			}
			.into();
			assert_ok!(RuntimeCall::Evm(evm_call(input)).dispatch(RuntimeOrigin::root()));

			// Assert remove vote event is emitted.
			assert!(events().contains(
				&EvmEvent::Log {
					log: log2(
						Precompile1,
						SELECTOR_LOG_VOTE_REMOVED_FOR_TRACK,
						H256::from_low_u64_be(ONGOING_POLL_INDEX as u64),
						solidity::encode_event_data((
							0u16,
							Address(Alice.into()) // caller
						))
					),
				}
				.into()
			));
		})
}

#[test]
fn remove_other_vote_logs_work() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 100_000)])
		.build()
		.execute_with(|| {
			// Vote..
			assert_ok!(standard_vote(true, 100_000.into(), 0.into()));

			// ..and remove other
			let input = PCall::remove_other_vote {
				target: H160::from(Alice).into(),
				track_id: 0u16,
				poll_index: ONGOING_POLL_INDEX,
			}
			.into();
			assert_ok!(RuntimeCall::Evm(evm_call(input)).dispatch(RuntimeOrigin::root()));

			// Assert remove other vote event is emitted.
			assert!(events().contains(
				&EvmEvent::Log {
					log: log2(
						Precompile1,
						SELECTOR_LOG_VOTE_REMOVED_OTHER,
						H256::from_low_u64_be(ONGOING_POLL_INDEX as u64),
						solidity::encode_event_data((
							Address(Alice.into()), // caller
							Address(Alice.into()), // target
							0u16,                  // track id
						))
					),
				}
				.into()
			));
		})
}

#[test]
fn delegate_undelegate_logs_work() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 100_000)])
		.build()
		.execute_with(|| {
			// Delegate
			let input = PCall::delegate {
				track_id: 0u16,
				representative: H160::from(Bob).into(),
				conviction: 0.into(),
				amount: 100_000.into(),
			}
			.into();
			assert_ok!(RuntimeCall::Evm(evm_call(input)).dispatch(RuntimeOrigin::root()));

			// Assert delegate event is emitted.
			assert!(events().contains(
				&EvmEvent::Log {
					log: log2(
						Precompile1,
						SELECTOR_LOG_DELEGATED,
						H256::from_low_u64_be(0 as u64), // track id
						solidity::encode_event_data((
							Address(Alice.into()), // from
							Address(Bob.into()),   // to
							U256::from(100_000),   // amount
							0u8                    // conviction
						))
					),
				}
				.into()
			));

			// Undelegate
			let input = PCall::undelegate { track_id: 0u16 }.into();
			assert_ok!(RuntimeCall::Evm(evm_call(input)).dispatch(RuntimeOrigin::root()));

			// Assert undelegate event is emitted.
			assert!(events().contains(
				&EvmEvent::Log {
					log: log2(
						Precompile1,
						SELECTOR_LOG_UNDELEGATED,
						H256::from_low_u64_be(0 as u64),                    // track id
						solidity::encode_event_data(Address(Alice.into()))  // caller
					),
				}
				.into()
			));
		})
}

#[test]
fn unlock_logs_work() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 100_000)])
		.build()
		.execute_with(|| {
			// Vote
			assert_ok!(standard_vote(true, 100_000.into(), 0.into()));

			// Remove
			let input = PCall::remove_vote {
				poll_index: ONGOING_POLL_INDEX,
			}
			.into();
			assert_ok!(RuntimeCall::Evm(evm_call(input)).dispatch(RuntimeOrigin::root()));

			// Unlock
			let input = PCall::unlock {
				track_id: 0u16,
				target: H160::from(Alice).into(),
			}
			.into();
			assert_ok!(RuntimeCall::Evm(evm_call(input)).dispatch(RuntimeOrigin::root()));

			// Assert unlock event is emitted.
			assert!(events().contains(
				&EvmEvent::Log {
					log: log2(
						Precompile1,
						SELECTOR_LOG_UNLOCKED,
						H256::from_low_u64_be(0 as u64), // track id
						solidity::encode_event_data(Address(Alice.into()))
					),
				}
				.into()
			));
		})
}

#[test]
fn test_voting_for_returns_correct_value_for_standard_vote() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 100_000)])
		.build()
		.execute_with(|| {
			// Vote Yes
			assert_ok!(standard_vote(true, 100_000.into(), 1.into()));

			precompiles()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::voting_for {
						who: H160::from(Alice).into(),
						track_id: 0u16,
					},
				)
				.expect_no_logs()
				.execute_returns(crate::OutputVotingFor {
					is_casting: true,
					casting: crate::OutputCasting {
						votes: vec![crate::PollAccountVote {
							poll_index: 3,
							account_vote: crate::OutputAccountVote {
								is_standard: true,
								standard: crate::StandardVote {
									vote: crate::OutputVote {
										aye: true,
										conviction: 1,
									},
									balance: 100_000.into(),
								},
								..Default::default()
							},
						}],
						delegations: crate::Delegations {
							votes: 0.into(),
							capital: 0.into(),
						},
						prior: crate::PriorLock { balance: 0.into() },
					},
					..Default::default()
				});
		})
}

#[test]
fn test_voting_for_returns_correct_value_for_split_vote() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 100_000)])
		.build()
		.execute_with(|| {
			// Vote Yes
			assert_ok!(split_vote(20_000.into(), 30_000.into(), None));

			precompiles()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::voting_for {
						who: H160::from(Alice).into(),
						track_id: 0u16,
					},
				)
				.expect_no_logs()
				.execute_returns(crate::OutputVotingFor {
					is_casting: true,
					casting: crate::OutputCasting {
						votes: vec![crate::PollAccountVote {
							poll_index: 3,
							account_vote: crate::OutputAccountVote {
								is_split: true,
								split: crate::SplitVote {
									aye: 20_000.into(),
									nay: 30_000.into(),
								},
								..Default::default()
							},
						}],
						delegations: crate::Delegations {
							votes: 0.into(),
							capital: 0.into(),
						},
						prior: crate::PriorLock { balance: 0.into() },
					},
					..Default::default()
				});
		})
}

#[test]
fn test_voting_for_returns_correct_value_for_split_abstain_vote() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 100_000)])
		.build()
		.execute_with(|| {
			// Vote Yes
			assert_ok!(split_vote(
				20_000.into(),
				30_000.into(),
				Some(10_000.into())
			));

			precompiles()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::voting_for {
						who: H160::from(Alice).into(),
						track_id: 0u16,
					},
				)
				.expect_no_logs()
				.execute_returns(crate::OutputVotingFor {
					is_casting: true,
					casting: crate::OutputCasting {
						votes: vec![crate::PollAccountVote {
							poll_index: 3,
							account_vote: crate::OutputAccountVote {
								is_split_abstain: true,
								split_abstain: crate::SplitAbstainVote {
									aye: 20_000.into(),
									nay: 30_000.into(),
									abstain: 10_000.into(),
								},
								..Default::default()
							},
						}],
						delegations: crate::Delegations {
							votes: 0.into(),
							capital: 0.into(),
						},
						prior: crate::PriorLock { balance: 0.into() },
					},
					..Default::default()
				});
		})
}

#[test]
fn test_class_locks_for_returns_correct_value() {
	ExtBuilder::default()
		.with_balances(vec![(Alice.into(), 100_000)])
		.build()
		.execute_with(|| {
			// Vote Yes
			assert_ok!(standard_vote(true, 100_000.into(), 1.into()));

			precompiles()
				.prepare_test(
					Alice,
					Precompile1,
					PCall::class_locks_for {
						who: H160::from(Alice).into(),
					},
				)
				.expect_no_logs()
				.execute_returns(vec![crate::OutputClassLock {
					track: 0u16,
					amount: U256::from(100_000),
				}]);
		})
}
