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
    assert_event_emitted, hash, log_closed, log_executed, log_proposed, log_voted,
    mock::{ExtBuilder, PCall, Precompiles, PrecompilesValue, Runtime, RuntimeOrigin},
};
use frame_support::{assert_ok, instances::Instance1};
use parity_scale_codec::Encode;
use precompile_utils::{solidity::codec::Address, testing::*};
use sp_core::{H160, H256};
use sp_runtime::DispatchError;

fn precompiles() -> Precompiles<Runtime> {
    PrecompilesValue::get()
}

#[test]
fn test_solidity_interface_has_all_function_selectors_documented_and_implemented() {
    check_precompile_implements_solidity_interfaces(&["Collective.sol"], PCall::supports_selector)
}

#[test]
fn selector_less_than_four_bytes() {
    ExtBuilder::default().build().execute_with(|| {
        // This selector is only three bytes long when four are required.
        precompiles()
            .prepare_test(Alice, Precompile1, vec![1u8, 2u8, 3u8])
            .execute_reverts(|output| output == b"Tried to read selector out of bounds");
    });
}

#[test]
fn no_selector_exists_but_length_is_right() {
    ExtBuilder::default().build().execute_with(|| {
        precompiles()
            .prepare_test(Alice, Precompile1, vec![1u8, 2u8, 3u8, 4u8])
            .execute_reverts(|output| output == b"Unknown selector");
    });
}

#[test]
fn selectors() {
    assert!(PCall::execute_selectors().contains(&0x09c5eabe));
    assert!(PCall::propose_selectors().contains(&0xc57f3260));
    assert!(PCall::vote_selectors().contains(&0x73e37688));
    assert!(PCall::close_selectors().contains(&0x638d9d47));
    assert!(PCall::proposal_hash_selectors().contains(&0xfc379417));
    assert!(PCall::proposals_selectors().contains(&0x55ef20e6));
    assert!(PCall::members_selectors().contains(&0xbdd4d18d));
    assert!(PCall::is_member_selectors().contains(&0xa230c524));
    assert!(PCall::prime_selectors().contains(&0xc7ee005e));
}

#[test]
fn modifiers() {
    ExtBuilder::default()
        .with_balances(vec![(Alice.into(), 1000)])
        .build()
        .execute_with(|| {
            let mut tester = PrecompilesModifierTester::new(precompiles(), Alice, Precompile1);

            tester.test_default_modifier(PCall::execute_selectors());
            tester.test_default_modifier(PCall::propose_selectors());
            tester.test_default_modifier(PCall::vote_selectors());
            tester.test_default_modifier(PCall::close_selectors());
            tester.test_view_modifier(PCall::proposal_hash_selectors());
            tester.test_view_modifier(PCall::proposals_selectors());
            tester.test_view_modifier(PCall::members_selectors());
            tester.test_view_modifier(PCall::is_member_selectors());
            tester.test_view_modifier(PCall::prime_selectors());
        });
}

#[test]
fn non_member_cannot_propose() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = pallet_treasury::Call::<Runtime>::spend_local {
            amount: 1,
            beneficiary: Alice.into(),
        };
        let proposal: <Runtime as frame_system::Config>::RuntimeCall = proposal.into();
        let proposal = proposal.encode();

        precompiles()
            .prepare_test(
                Alice,
                Precompile1,
                PCall::propose {
                    threshold: 1,
                    proposal: proposal.into(),
                },
            )
            .expect_no_logs()
            .execute_reverts(|output| output.ends_with(b"NotMember\") })"));
    });
}

#[test]
fn non_member_cannot_vote() {
    ExtBuilder::default().build().execute_with(|| {
        precompiles()
            .prepare_test(
                Alice,
                Precompile1,
                PCall::vote {
                    proposal_hash: H256::zero(),
                    proposal_index: 1,
                    approve: false,
                },
            )
            .expect_no_logs()
            .execute_reverts(|output| output.ends_with(b"NotMember\") })"));
    });
}

#[test]
fn non_member_cannot_execute() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = pallet_treasury::Call::<Runtime>::spend_local {
            amount: 1,
            beneficiary: Alice.into(),
        };
        let proposal: <Runtime as frame_system::Config>::RuntimeCall = proposal.into();
        let proposal = proposal.encode();

        precompiles()
            .prepare_test(
                Alice,
                Precompile1,
                PCall::execute {
                    proposal: proposal.into(),
                },
            )
            .expect_no_logs()
            .execute_reverts(|output| output.ends_with(b"NotMember\") })"));
    });
}

#[test]
fn cannot_vote_for_unknown_proposal() {
    ExtBuilder::default().build().execute_with(|| {
        precompiles()
            .prepare_test(
                Bob,
                Precompile1,
                PCall::vote {
                    proposal_hash: H256::zero(),
                    proposal_index: 1,
                    approve: false,
                },
            )
            .expect_no_logs()
            .execute_reverts(|output| output.ends_with(b"ProposalMissing\") })"));
    });
}

#[test]
fn cannot_close_unknown_proposal() {
    ExtBuilder::default().build().execute_with(|| {
        precompiles()
            .prepare_test(
                Bob,
                Precompile1,
                PCall::close {
                    proposal_hash: H256::zero(),
                    proposal_index: 1,
                    proposal_weight_bound: 0,
                    length_bound: 0,
                },
            )
            .expect_no_logs()
            .execute_reverts(|output| output.ends_with(b"ProposalMissing\") })"));
    });
}

#[test]
fn member_can_make_instant_proposal() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = pallet_treasury::Call::<Runtime>::spend_local {
            amount: 1,
            beneficiary: Alice.into(),
        };
        let proposal: <Runtime as frame_system::Config>::RuntimeCall = proposal.into();
        let proposal = proposal.encode();
        let proposal_hash: H256 = hash::<Runtime>(&proposal);

        // Proposal is executed. The proposal call will itself fail but it
        // still counts as a success according to pallet_collective.
        precompiles()
            .prepare_test(
                Bob,
                Precompile1,
                PCall::propose {
                    threshold: 1,
                    proposal: proposal.into(),
                },
            )
            .expect_log(log_executed(Precompile1, proposal_hash))
            .execute_returns(0u32);

        assert_event_emitted!(pallet_collective::Event::Executed {
            proposal_hash,
            result: Err(DispatchError::BadOrigin)
        }
        .into());
    });
}

#[test]
fn member_can_make_delayed_proposal() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = pallet_treasury::Call::<Runtime>::spend_local {
            amount: 1,
            beneficiary: Alice.into(),
        };
        let proposal: <Runtime as frame_system::Config>::RuntimeCall = proposal.into();
        let proposal = proposal.encode();
        let proposal_hash: H256 = hash::<Runtime>(&proposal);

        precompiles()
            .prepare_test(
                Bob,
                Precompile1,
                PCall::propose {
                    threshold: 2,
                    proposal: proposal.into(),
                },
            )
            .expect_log(log_proposed(Precompile1, Bob, 0, proposal_hash, 2))
            .execute_returns(0u32);

        assert_event_emitted!(pallet_collective::Event::Proposed {
            account: Bob.into(),
            proposal_index: 0,
            proposal_hash,
            threshold: 2,
        }
        .into());
    });
}

#[test]
fn member_can_vote_on_proposal() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = pallet_treasury::Call::<Runtime>::spend_local {
            amount: 1,
            beneficiary: Alice.into(),
        };
        let proposal: <Runtime as frame_system::Config>::RuntimeCall = proposal.into();
        let proposal = proposal.encode();
        let proposal_hash: H256 = hash::<Runtime>(&proposal);

        precompiles()
            .prepare_test(
                Bob,
                Precompile1,
                PCall::propose {
                    threshold: 2,
                    proposal: proposal.into(),
                },
            )
            .expect_log(log_proposed(Precompile1, Bob, 0, proposal_hash, 2))
            .execute_returns(0u32);

        precompiles()
            .prepare_test(
                Charlie,
                Precompile1,
                PCall::vote {
                    proposal_hash,
                    proposal_index: 0,
                    approve: true,
                },
            )
            .expect_log(log_voted(Precompile1, Charlie, proposal_hash, true))
            .execute_returns(());

        assert_event_emitted!(pallet_collective::Event::Voted {
            account: Charlie.into(),
            proposal_hash,
            voted: true,
            yes: 1,
            no: 0,
        }
        .into());
    });
}

#[test]
fn cannot_close_if_not_enough_votes() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = pallet_treasury::Call::<Runtime>::spend_local {
            amount: 1,
            beneficiary: Alice.into(),
        };
        let proposal: <Runtime as frame_system::Config>::RuntimeCall = proposal.into();
        let proposal = proposal.encode();
        let proposal_hash: H256 = hash::<Runtime>(&proposal);
        let length_bound = proposal.len() as u32;

        precompiles()
            .prepare_test(
                Bob,
                Precompile1,
                PCall::propose {
                    threshold: 2,
                    proposal: proposal.into(),
                },
            )
            .expect_log(log_proposed(Precompile1, Bob, 0, proposal_hash, 2))
            .execute_returns(0u32);

        precompiles()
            .prepare_test(
                Alice,
                Precompile1,
                PCall::close {
                    proposal_hash,
                    proposal_index: 0,
                    proposal_weight_bound: 10_000_000,
                    length_bound,
                },
            )
            .expect_no_logs()
            .execute_reverts(|output| output.ends_with(b"TooEarly\") })"));
    });
}

#[test]
fn can_close_execute_if_enough_votes() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = pallet_treasury::Call::<Runtime>::spend_local {
            amount: 1,
            beneficiary: Alice.into(),
        };
        let proposal: <Runtime as frame_system::Config>::RuntimeCall = proposal.into();
        let proposal = proposal.encode();
        let proposal_hash: H256 = hash::<Runtime>(&proposal);
        let length_bound = proposal.len() as u32;

        precompiles()
            .prepare_test(
                Bob,
                Precompile1,
                PCall::propose {
                    threshold: 2,
                    proposal: proposal.into(),
                },
            )
            .expect_log(log_proposed(Precompile1, Bob, 0, proposal_hash, 2))
            .execute_returns(0u32);

        precompiles()
            .prepare_test(
                Bob,
                Precompile1,
                PCall::vote {
                    proposal_hash,
                    proposal_index: 0,
                    approve: true,
                },
            )
            .expect_log(log_voted(Precompile1, Bob, proposal_hash, true))
            .execute_returns(());

        precompiles()
            .prepare_test(
                Charlie,
                Precompile1,
                PCall::vote {
                    proposal_hash,
                    proposal_index: 0,
                    approve: true,
                },
            )
            .expect_log(log_voted(Precompile1, Charlie, proposal_hash, true))
            .execute_returns(());

        precompiles()
            .prepare_test(
                Alice,
                Precompile1,
                PCall::close {
                    proposal_hash,
                    proposal_index: 0,
                    proposal_weight_bound: 200_000_000,
                    length_bound,
                },
            )
            .expect_log(log_executed(Precompile1, proposal_hash))
            .execute_returns(true);

        assert_event_emitted!(pallet_collective::Event::Closed {
            proposal_hash,
            yes: 2,
            no: 0,
        }
        .into());

        assert_event_emitted!(pallet_collective::Event::Approved { proposal_hash }.into());

        assert_event_emitted!(pallet_collective::Event::Executed {
            proposal_hash,
            result: Ok(())
        }
        .into());

        assert_event_emitted!(pallet_treasury::Event::SpendApproved {
            proposal_index: 0,
            amount: 1,
            beneficiary: Alice.into(),
        }
        .into());
    });
}

#[test]
fn can_close_refuse_if_enough_votes() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = pallet_treasury::Call::<Runtime>::spend_local {
            amount: 1,
            beneficiary: Alice.into(),
        };
        let proposal: <Runtime as frame_system::Config>::RuntimeCall = proposal.into();
        let proposal = proposal.encode();
        let proposal_hash: H256 = hash::<Runtime>(&proposal);
        let length_bound = proposal.len() as u32;

        precompiles()
            .prepare_test(
                Bob,
                Precompile1,
                PCall::propose {
                    threshold: 2,
                    proposal: proposal.into(),
                },
            )
            .expect_log(log_proposed(Precompile1, Bob, 0, proposal_hash, 2))
            .execute_returns(0u32);

        precompiles()
            .prepare_test(
                Bob,
                Precompile1,
                PCall::vote {
                    proposal_hash,
                    proposal_index: 0,
                    approve: false,
                },
            )
            .expect_log(log_voted(Precompile1, Bob, proposal_hash, false))
            .execute_returns(());

        precompiles()
            .prepare_test(
                Charlie,
                Precompile1,
                PCall::vote {
                    proposal_hash,
                    proposal_index: 0,
                    approve: false,
                },
            )
            .expect_log(log_voted(Precompile1, Charlie, proposal_hash, false))
            .execute_returns(());

        precompiles()
            .prepare_test(
                Alice,
                Precompile1,
                PCall::close {
                    proposal_hash,
                    proposal_index: 0,
                    proposal_weight_bound: 100_000_000,
                    length_bound,
                },
            )
            .expect_log(log_closed(Precompile1, proposal_hash))
            .execute_returns(false);

        assert_event_emitted!(pallet_collective::Event::Closed {
            proposal_hash,
            yes: 0,
            no: 2,
        }
        .into());

        assert_event_emitted!(pallet_collective::Event::Disapproved { proposal_hash }.into());
    });
}

#[test]
fn multiple_propose_increase_index() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = pallet_treasury::Call::<Runtime>::spend_local {
            amount: 1,
            beneficiary: Alice.into(),
        };
        let proposal: <Runtime as frame_system::Config>::RuntimeCall = proposal.into();
        let proposal = proposal.encode();
        let proposal_hash: H256 = hash::<Runtime>(&proposal);

        precompiles()
            .prepare_test(
                Bob,
                Precompile1,
                PCall::propose {
                    threshold: 2,
                    proposal: proposal.into(),
                },
            )
            .expect_log(log_proposed(Precompile1, Bob, 0, proposal_hash, 2))
            .execute_returns(0u32);

        let proposal = pallet_treasury::Call::<Runtime>::spend_local {
            amount: 2,
            beneficiary: Alice.into(),
        };
        let proposal: <Runtime as frame_system::Config>::RuntimeCall = proposal.into();
        let proposal = proposal.encode();
        let proposal_hash: H256 = hash::<Runtime>(&proposal);

        precompiles()
            .prepare_test(
                Bob,
                Precompile1,
                PCall::propose {
                    threshold: 2,
                    proposal: proposal.into(),
                },
            )
            .expect_log(log_proposed(Precompile1, Bob, 1, proposal_hash, 2))
            .execute_returns(1u32);
    });
}

#[test]
fn view_members() {
    ExtBuilder::default().build().execute_with(|| {
        precompiles()
            .prepare_test(Bob, Precompile1, PCall::members {})
            .expect_no_logs()
            .execute_returns(vec![Address(Bob.into()), Address(Charlie.into())]);
    });
}

#[test]
fn view_no_prime() {
    ExtBuilder::default().build().execute_with(|| {
        precompiles()
            .prepare_test(Bob, Precompile1, PCall::prime {})
            .expect_no_logs()
            .execute_returns(Address(H160::zero()));
    });
}

#[test]
fn view_some_prime() {
    ExtBuilder::default().build().execute_with(|| {
        assert_ok!(pallet_collective::Pallet::<
            Runtime,
            pallet_collective::Instance1,
        >::set_members(
            RuntimeOrigin::root(),
            vec![Alice.into(), Bob.into()],
            Some(Alice.into()),
            2
        ));

        precompiles()
            .prepare_test(Bob, Precompile1, PCall::prime {})
            .expect_no_logs()
            .execute_returns(Address(Alice.into()));
    });
}

#[test]
fn view_is_member() {
    ExtBuilder::default().build().execute_with(|| {
        precompiles()
            .prepare_test(
                Bob,
                Precompile1,
                PCall::is_member {
                    account: Address(Bob.into()),
                },
            )
            .expect_no_logs()
            .execute_returns(true);

        precompiles()
            .prepare_test(
                Bob,
                Precompile1,
                PCall::is_member {
                    account: Address(Alice.into()),
                },
            )
            .expect_no_logs()
            .execute_returns(false);
    });
}

mod bounded_proposal_decode {
    use super::*;
    use crate::GetProposalLimit;
    use precompile_utils::prelude::BoundedBytes;

    fn scenario<F>(nesting: usize, call: F)
    where
        F: FnOnce(BoundedBytes<GetProposalLimit>) -> PCall,
    {
        ExtBuilder::default().build().execute_with(|| {
            // Some random call.
            let mut proposal = pallet_collective::Call::<Runtime, Instance1>::set_members {
                new_members: Vec::new(),
                prime: None,
                old_count: 0,
            };

            // Nest it.
            for _ in 0..nesting {
                proposal = pallet_collective::Call::<Runtime, Instance1>::propose {
                    threshold: 10,
                    proposal: Box::new(proposal.into()),
                    length_bound: 1,
                };
            }

            let proposal: <Runtime as frame_system::Config>::RuntimeCall = proposal.into();
            let proposal = proposal.encode();

            precompiles()
                .prepare_test(Alice, Precompile1, call(proposal.into()))
                .expect_no_logs()
                .execute_reverts(|output| {
                    if nesting < 8 {
                        output.ends_with(b"NotMember\") })")
                    } else {
                        output == b"proposal: Failed to decode proposal"
                    }
                });
        });
    }

    #[test]
    fn proposal_above_bound() {
        scenario(8, |proposal| PCall::propose {
            threshold: 1,
            proposal,
        });
    }

    #[test]
    fn proposal_below_bound() {
        scenario(7, |proposal| PCall::propose {
            threshold: 1,
            proposal,
        });
    }

    #[test]
    fn execute_above_bound() {
        scenario(8, |proposal| PCall::execute { proposal });
    }

    #[test]
    fn execute_below_bound() {
        scenario(7, |proposal| PCall::execute { proposal });
    }
}
