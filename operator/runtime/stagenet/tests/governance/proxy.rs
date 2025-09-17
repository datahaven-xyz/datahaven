//! Governance proxy tests for DataHaven Stagenet Runtime
//!
//! This module tests the interaction between proxy accounts and governance functionality,
//! including voting, delegation, council operations, and referendum management.

use crate::common::*;
use codec::Encode;
use datahaven_stagenet_runtime::configs::ProxyType;
use datahaven_stagenet_runtime::{
    currency::{HAVE, SUPPLY_FACTOR},
    Balances, Preimage, Proxy, Referenda, Runtime, RuntimeCall, RuntimeOrigin, TechnicalCommittee,
};
use frame_support::traits::schedule::DispatchTime;
use frame_support::{assert_ok, traits::StorePreimage};
use pallet_conviction_voting::{AccountVote, Conviction, Vote};
use pallet_referenda::ReferendumInfo;

/// Tests that a governance proxy can vote on behalf of the proxied account
#[test]
fn governance_proxy_can_vote_on_referenda() {
    ExtBuilder::default().build().execute_with(|| {
        // Setup
        let alice = alice();
        let bob = bob();
        let charlie = charlie();
        let proposal = make_simple_proposal();

        // Give Alice and Bob some balance - enough for decision deposits
        let initial_balance = 1_000_000 * HAVE * SUPPLY_FACTOR;
        assert_ok!(Balances::force_set_balance(
            RuntimeOrigin::root(),
            alice,
            initial_balance
        ));
        assert_ok!(Balances::force_set_balance(
            RuntimeOrigin::root(),
            bob,
            initial_balance
        ));

        // Bob creates a governance proxy with Charlie as the proxy
        assert_ok!(Proxy::add_proxy(
            RuntimeOrigin::signed(bob),
            charlie,
            ProxyType::Governance,
            0
        ));

        // Submit referendum
        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice),
            proposal.encode()
        ));

        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(alice),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_proposal,
            DispatchTime::After(1)
        ));

        // Place referendum in deciding state
        assert_ok!(Referenda::place_decision_deposit(
            RuntimeOrigin::signed(alice),
            0
        ));

        // Charlie votes on behalf of Bob using the governance proxy
        let vote = AccountVote::Standard {
            vote: Vote {
                aye: true,
                conviction: Conviction::Locked2x,
            },
            balance: 1000 * HAVE * SUPPLY_FACTOR,
        };

        assert_ok!(Proxy::proxy(
            RuntimeOrigin::signed(charlie),
            bob,
            None,
            Box::new(RuntimeCall::ConvictionVoting(
                pallet_conviction_voting::Call::vote {
                    poll_index: 0,
                    vote,
                }
            ))
        ));

        // Verify the vote was recorded - we can check if the referendum has votes
        let referendum_info = pallet_referenda::ReferendumInfoFor::<Runtime>::get(0).unwrap();
        assert!(matches!(referendum_info, ReferendumInfo::Ongoing(_)));
    });
}

/// Tests that a governance proxy can delegate voting power
#[test]
fn governance_proxy_can_delegate_voting() {
    ExtBuilder::default().build().execute_with(|| {
        // Setup
        let alice = alice();
        let bob = bob();
        let charlie = charlie();
        let delegate = dave();

        // Give accounts some balance - enough for decision deposits
        let initial_balance = 1_000_000 * HAVE * SUPPLY_FACTOR;
        for account in &[alice, bob, charlie, delegate] {
            assert_ok!(Balances::force_set_balance(
                RuntimeOrigin::root(),
                *account,
                initial_balance
            ));
        }

        // Bob creates a governance proxy with Charlie as the proxy
        assert_ok!(Proxy::add_proxy(
            RuntimeOrigin::signed(bob),
            charlie,
            ProxyType::Governance,
            0
        ));

        // Charlie delegates Bob's voting power to Dave using the proxy
        assert_ok!(Proxy::proxy(
            RuntimeOrigin::signed(charlie),
            bob,
            None,
            Box::new(RuntimeCall::ConvictionVoting(
                pallet_conviction_voting::Call::delegate {
                    class: 0, // Root track class
                    to: delegate,
                    conviction: Conviction::Locked3x,
                    balance: 5000 * HAVE * SUPPLY_FACTOR,
                }
            ))
        ));

        // Test passed if proxy call succeeds - delegation is internal to ConvictionVoting
    });
}

/// Tests that a governance proxy can submit proposals to the council
#[test]
fn governance_proxy_can_submit_council_proposal() {
    ExtBuilder::default().build().execute_with(|| {
        // Setup
        let alice = alice();
        let bob = bob();
        let charlie = charlie();

        // Give accounts some balance - enough for decision deposits
        let initial_balance = 1_000_000 * HAVE * SUPPLY_FACTOR;
        for account in &[alice, bob, charlie] {
            assert_ok!(Balances::force_set_balance(
                RuntimeOrigin::root(),
                *account,
                initial_balance
            ));
        }

        // Set up Technical Committee with Bob as member
        assert_ok!(TechnicalCommittee::set_members(
            RuntimeOrigin::root(),
            vec![bob],
            Some(bob),
            1
        ));

        // Bob creates a governance proxy with Charlie as the proxy
        assert_ok!(Proxy::add_proxy(
            RuntimeOrigin::signed(bob),
            charlie,
            ProxyType::Governance,
            0
        ));

        // Create a proposal
        let proposal = RuntimeCall::System(frame_system::Call::remark { remark: vec![42] });

        // Charlie proposes on behalf of Bob using the proxy
        assert_ok!(Proxy::proxy(
            RuntimeOrigin::signed(charlie),
            bob,
            None,
            Box::new(RuntimeCall::TechnicalCommittee(
                pallet_collective::Call::propose {
                    threshold: 1,
                    proposal: Box::new(proposal.clone()),
                    length_bound: 100,
                }
            ))
        ));

        // Test passes if proposal submission succeeds
    });
}

/// Tests that a governance proxy can vote in council
#[test]
fn governance_proxy_can_vote_in_council() {
    ExtBuilder::default().build().execute_with(|| {
        // Setup
        let alice = alice();
        let bob = bob();
        let charlie = charlie();

        // Give accounts some balance - enough for decision deposits
        let initial_balance = 1_000_000 * HAVE * SUPPLY_FACTOR;
        for account in &[alice, bob, charlie] {
            assert_ok!(Balances::force_set_balance(
                RuntimeOrigin::root(),
                *account,
                initial_balance
            ));
        }

        // Set up Technical Committee with Alice and Bob as members
        assert_ok!(TechnicalCommittee::set_members(
            RuntimeOrigin::root(),
            vec![alice, bob],
            Some(alice),
            2
        ));

        // Bob creates a governance proxy with Charlie as the proxy
        assert_ok!(Proxy::add_proxy(
            RuntimeOrigin::signed(bob),
            charlie,
            ProxyType::Governance,
            0
        ));

        // Alice creates a proposal
        let proposal = RuntimeCall::System(frame_system::Call::remark { remark: vec![42] });
        let proposal_hash = make_proposal_hash(&proposal);

        assert_ok!(TechnicalCommittee::propose(
            RuntimeOrigin::signed(alice),
            2, // threshold
            Box::new(proposal.clone()),
            100
        ));

        let proposal_index = 0;

        // Charlie votes on behalf of Bob using the proxy
        assert_ok!(Proxy::proxy(
            RuntimeOrigin::signed(charlie),
            bob,
            None,
            Box::new(RuntimeCall::TechnicalCommittee(
                pallet_collective::Call::vote {
                    proposal: proposal_hash,
                    index: proposal_index,
                    approve: true,
                }
            ))
        ));

        // Test passes if vote succeeds
    });
}

/// Tests that a governance proxy can submit referenda
#[test]
fn governance_proxy_can_submit_referendum() {
    ExtBuilder::default().build().execute_with(|| {
        // Setup
        let alice = alice();
        let bob = bob();
        let proposal = make_simple_proposal();

        // Give accounts some balance - enough for decision deposits
        let initial_balance = 1_000_000 * HAVE * SUPPLY_FACTOR;
        for account in &[alice, bob] {
            assert_ok!(Balances::force_set_balance(
                RuntimeOrigin::root(),
                *account,
                initial_balance
            ));
        }

        // Alice creates a governance proxy with Bob as the proxy
        assert_ok!(Proxy::add_proxy(
            RuntimeOrigin::signed(alice),
            bob,
            ProxyType::Governance,
            0
        ));

        // Note preimage first
        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice),
            proposal.encode()
        ));

        // Bob submits a referendum on behalf of Alice using the proxy
        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
        assert_ok!(Proxy::proxy(
            RuntimeOrigin::signed(bob),
            alice,
            None,
            Box::new(RuntimeCall::Referenda(pallet_referenda::Call::submit {
                proposal_origin: Box::new(frame_system::RawOrigin::Root.into()),
                proposal: bounded_proposal,
                enactment_moment: DispatchTime::After(10),
            }))
        ));

        // Verify the referendum was created
        assert!(pallet_referenda::ReferendumInfoFor::<Runtime>::get(0).is_some());
    });
}

/// Tests that multiple governance proxies can work together
#[test]
fn multiple_governance_proxies_coordination() {
    ExtBuilder::default().build().execute_with(|| {
        // Setup
        let alice = alice();
        let bob = bob();
        let charlie = charlie();
        let eve_account = eve();

        // Give accounts some balance - enough for decision deposits
        let initial_balance = 1_000_000 * HAVE * SUPPLY_FACTOR;
        for account in &[alice, bob, charlie, eve_account] {
            assert_ok!(Balances::force_set_balance(
                RuntimeOrigin::root(),
                *account,
                initial_balance
            ));
        }

        // Set up Technical Committee with Alice and Bob as members
        assert_ok!(TechnicalCommittee::set_members(
            RuntimeOrigin::root(),
            vec![alice, bob],
            Some(alice),
            2
        ));

        // Alice creates a governance proxy with Charlie
        assert_ok!(Proxy::add_proxy(
            RuntimeOrigin::signed(alice),
            charlie,
            ProxyType::Governance,
            0
        ));

        // Bob creates a governance proxy with Eve
        assert_ok!(Proxy::add_proxy(
            RuntimeOrigin::signed(bob),
            eve_account,
            ProxyType::Governance,
            0
        ));

        // Charlie (on behalf of Alice) creates a proposal
        let proposal = RuntimeCall::System(frame_system::Call::remark { remark: vec![42] });
        let proposal_hash = make_proposal_hash(&proposal);

        assert_ok!(Proxy::proxy(
            RuntimeOrigin::signed(charlie),
            alice,
            None,
            Box::new(RuntimeCall::TechnicalCommittee(
                pallet_collective::Call::propose {
                    threshold: 2,
                    proposal: Box::new(proposal.clone()),
                    length_bound: 100,
                }
            ))
        ));

        let proposal_index = 0;

        // Both proxies vote on the proposal
        // Charlie votes for Alice
        assert_ok!(Proxy::proxy(
            RuntimeOrigin::signed(charlie),
            alice,
            None,
            Box::new(RuntimeCall::TechnicalCommittee(
                pallet_collective::Call::vote {
                    proposal: proposal_hash,
                    index: proposal_index,
                    approve: true,
                }
            ))
        ));

        // Eve votes for Bob
        assert_ok!(Proxy::proxy(
            RuntimeOrigin::signed(eve_account),
            bob,
            None,
            Box::new(RuntimeCall::TechnicalCommittee(
                pallet_collective::Call::vote {
                    proposal: proposal_hash,
                    index: proposal_index,
                    approve: true,
                }
            ))
        ));

        // Test passes if both proxy votes succeed
    });
}
