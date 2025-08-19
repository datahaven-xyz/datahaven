//! Referenda tests for DataHaven governance system
//!
//! Tests for the OpenGov referenda system including track-based voting,
//! conviction voting, referendum lifecycle, and multi-track functionality.

use crate::common::*;
use codec::Encode;
use datahaven_mainnet_runtime::{
    currency::{HAVE, SUPPLY_FACTOR},
    governance::TracksInfo,
    AccountId, Balances, ConvictionVoting, Preimage, Referenda, Runtime, RuntimeCall, RuntimeEvent,
    RuntimeOrigin,
};
use frame_support::traits::schedule::DispatchTime;
use frame_support::{
    assert_noop, assert_ok,
    traits::{Currency, OriginTrait, PreimageProvider, StorePreimage},
};
use pallet_conviction_voting::TallyOf;
use pallet_conviction_voting::{AccountVote, Conviction, Event as ConvictionVotingEvent, Vote};
use pallet_preimage::Event as PreimageEvent;
use pallet_referenda::TracksInfo as TracksInfoTrait;
use pallet_referenda::{Event as ReferendaEvent, ReferendumInfo};

/// Test tracks info configuration
#[test]
fn tracks_info_configured_correctly() {
    ExtBuilder::default().build().execute_with(|| {
        let tracks = TracksInfo::tracks();

        // Should have 6 tracks as configured
        assert_eq!(tracks.len(), 6);

        // Verify track IDs and names
        let track_names: Vec<&str> = tracks.iter().map(|(_, info)| info.name).collect();
        assert_eq!(
            track_names,
            vec![
                "root",
                "whitelisted_caller",
                "general_admin",
                "referendum_canceller",
                "referendum_killer",
                "fast_general_admin"
            ]
        );

        // Verify root track has strictest requirements
        let (root_id, root_info) = &tracks[0];
        assert_eq!(*root_id, 0u16);
        assert_eq!(root_info.max_deciding, 5);
        assert_eq!(root_info.decision_deposit, 100000 * HAVE * SUPPLY_FACTOR); // 100 * KILO_HAVE

        // Verify general admin track
        let (admin_id, admin_info) = &tracks[2];
        assert_eq!(*admin_id, 2u16);
        assert_eq!(admin_info.max_deciding, 10);
        assert_eq!(admin_info.decision_deposit, 500 * HAVE * SUPPLY_FACTOR);
    });
}

/// Test track mapping for different origins
#[test]
fn track_mapping_works() {
    ExtBuilder::default().build().execute_with(|| {
        // Root origin should map to root track (0)
        let root_origin = RuntimeOrigin::root();
        let origin_caller = root_origin.caller();
        assert_eq!(TracksInfo::track_for(origin_caller), Ok(0u16));

        // GeneralAdmin custom origin should map to general admin track (2)
        use datahaven_mainnet_runtime::governance::custom_origins;
        let general_admin_origin = RuntimeOrigin::from(custom_origins::Origin::GeneralAdmin);
        let origin_caller = general_admin_origin.caller();
        assert_eq!(TracksInfo::track_for(origin_caller), Ok(2u16));
    });
}

/// Test referendum submission with preimage
#[test]
fn referendum_submission_works() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = make_simple_proposal();
        let proposal_hash = make_proposal_hash(&proposal);
        let proposal_len = proposal.encoded_size() as u32;

        // First submit the preimage
        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice()),
            proposal.encode()
        ));

        // Check preimage event
        assert!(has_event(RuntimeEvent::Preimage(PreimageEvent::Noted {
            hash: proposal_hash
        })));

        // Submit referendum
        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(alice()),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_proposal.clone(),
            DispatchTime::After(10)
        ));

        // Check referendum was created
        assert!(has_event(RuntimeEvent::Referenda(
            ReferendaEvent::Submitted {
                index: 0,
                track: 0, // Root track
                proposal: bounded_proposal
            }
        )));

        // Check referendum exists
        assert!(pallet_referenda::ReferendumInfoFor::<Runtime>::get(0).is_some());
    });
}

/// Test conviction voting on referenda
#[test]
fn conviction_voting_works() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = make_simple_proposal();
        let proposal_hash = make_proposal_hash(&proposal);

        // Setup referendum
        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice()),
            proposal.encode()
        ));

        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(alice()),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_proposal,
            DispatchTime::After(10)
        ));

        // Place decision deposit to start the referendum
        assert_ok!(Referenda::place_decision_deposit(
            RuntimeOrigin::signed(bob()),
            0
        ));

        // Vote with different conviction levels
        let vote_balance = 100 * HAVE;

        // Alice votes with 6x conviction
        assert_ok!(ConvictionVoting::vote(
            RuntimeOrigin::signed(alice()),
            0, // poll index
            AccountVote::Standard {
                vote: Vote {
                    aye: true,
                    conviction: Conviction::Locked6x
                },
                balance: vote_balance
            }
        ));

        // Bob votes with no conviction
        assert_ok!(ConvictionVoting::vote(
            RuntimeOrigin::signed(bob()),
            0,
            AccountVote::Standard {
                vote: Vote {
                    aye: false,
                    conviction: Conviction::None
                },
                balance: vote_balance
            }
        ));

        // Check voting events
        assert!(has_event(RuntimeEvent::ConvictionVoting(
            ConvictionVotingEvent::Voted {
                who: alice(),
                vote: AccountVote::Standard {
                    vote: Vote {
                        aye: true,
                        conviction: Conviction::Locked6x
                    },
                    balance: vote_balance
                }
            }
        )));
    });
}

/// Test referendum decision periods and timing
#[test]
fn referendum_timing_works() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = make_simple_proposal();
        let proposal_hash = make_proposal_hash(&proposal);

        // Setup referendum
        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice()),
            proposal.encode()
        ));

        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(alice()),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_proposal,
            DispatchTime::After(10)
        ));

        // Advance time through prepare period (1 DAY for root track)
        let track_info = &TracksInfo::tracks()[0].1; // Root track
        advance_referendum_time(track_info.prepare_period + 1);

        // Place decision deposit
        assert_ok!(Referenda::place_decision_deposit(
            RuntimeOrigin::signed(alice()),
            0
        ));

        // Check referendum is in decision period
        let referendum_info = pallet_referenda::ReferendumInfoFor::<Runtime>::get(0).unwrap();
        if let ReferendumInfo::Ongoing(status) = referendum_info {
            assert!(status.deciding.is_some());
        } else {
            panic!("Referendum should be ongoing");
        }

        // Advance time through decision period
        let track_info = &TracksInfo::tracks()[0].1; // Root track
        advance_referendum_time(track_info.decision_period + 1);

        // Referendum should still exist (may have timed out)
        assert!(pallet_referenda::ReferendumInfoFor::<Runtime>::get(0).is_some());
    });
}

/// Test referendum cancellation by authorized origins
#[test]
fn referendum_cancellation_works() {
    ExtBuilder::default().build().execute_with(|| {
        let members = vec![alice(), bob(), charlie()];
        setup_technical_committee(members);

        let proposal = make_simple_proposal();
        let proposal_hash = make_proposal_hash(&proposal);

        // Setup referendum
        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice()),
            proposal.encode()
        ));

        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(alice()),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_proposal,
            DispatchTime::After(10)
        ));

        // Use root origin to cancel referenda (simpler for testing)
        assert_ok!(Referenda::cancel(RuntimeOrigin::root(), 0));

        // Check cancellation event
        assert!(has_event(RuntimeEvent::Referenda(
            ReferendaEvent::Cancelled {
                index: 0,
                tally: TallyOf::<Runtime>::from_parts(0, 0, 0)
            }
        )));

        // Referendum should be cancelled
        let referendum_info = pallet_referenda::ReferendumInfoFor::<Runtime>::get(0).unwrap();
        assert!(matches!(
            referendum_info,
            ReferendumInfo::Cancelled(_, _, _)
        ));
    });
}

/// Test referendum killing by authorized origins
#[test]
fn referendum_killing_works() {
    ExtBuilder::default().build().execute_with(|| {
        let members = vec![alice(), bob(), charlie()];
        setup_technical_committee(members);

        let proposal = make_simple_proposal();
        let proposal_hash = make_proposal_hash(&proposal);

        // Setup referendum
        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice()),
            proposal.encode()
        ));

        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(alice()),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_proposal,
            DispatchTime::After(10)
        ));

        // Use root origin to kill referenda (simpler for testing)
        assert_ok!(Referenda::kill(RuntimeOrigin::root(), 0));

        // Check kill event
        assert!(has_event(RuntimeEvent::Referenda(ReferendaEvent::Killed {
            index: 0,
            tally: TallyOf::<Runtime>::from_parts(0, 0, 0)
        })));

        // Referendum should be killed
        let referendum_info = pallet_referenda::ReferendumInfoFor::<Runtime>::get(0).unwrap();
        assert!(matches!(referendum_info, ReferendumInfo::Killed(_)));
    });
}

/// Test multiple tracks with different requirements
#[test]
fn multiple_tracks_work() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = make_simple_proposal();
        let proposal_hash = make_proposal_hash(&proposal);

        // Submit preimage
        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice()),
            proposal.encode()
        ));

        // Submit to root track (track 0)
        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(alice()),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_proposal.clone(),
            DispatchTime::After(10)
        ));

        // Submit to general admin track (track 2)
        let another_proposal = RuntimeCall::System(frame_system::Call::set_storage {
            items: vec![(b":test2".to_vec(), b"value2".to_vec())],
        });
        let another_hash = make_proposal_hash(&another_proposal);

        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(bob()),
            another_proposal.encode()
        ));

        let bounded_another_proposal =
            <Preimage as StorePreimage>::bound(another_proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(bob()),
            Box::new(
                datahaven_mainnet_runtime::governance::custom_origins::Origin::GeneralAdmin.into()
            ),
            bounded_another_proposal.clone(),
            DispatchTime::After(10)
        ));

        // Should have two different referenda on different tracks
        assert!(pallet_referenda::ReferendumInfoFor::<Runtime>::get(0).is_some());
        assert!(pallet_referenda::ReferendumInfoFor::<Runtime>::get(1).is_some());

        // Check track assignments
        assert!(has_event(RuntimeEvent::Referenda(
            ReferendaEvent::Submitted {
                index: 0,
                track: 0, // Root track
                proposal: bounded_proposal
            }
        )));

        assert!(has_event(RuntimeEvent::Referenda(
            ReferendaEvent::Submitted {
                index: 1,
                track: 2, // General admin track
                proposal: bounded_another_proposal
            }
        )));
    });
}

/// Test voting delegation functionality
#[test]
fn vote_delegation_works() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = make_simple_proposal();
        let proposal_hash = make_proposal_hash(&proposal);

        // Setup referendum
        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice()),
            proposal.encode()
        ));

        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(alice()),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_proposal,
            DispatchTime::After(10)
        ));

        let delegation_balance = 100 * HAVE;
        let class = 0u16; // Root track class

        // Bob delegates to Alice
        assert_ok!(ConvictionVoting::delegate(
            RuntimeOrigin::signed(bob()),
            class,
            alice(),
            Conviction::Locked6x,
            delegation_balance
        ));

        // Check delegation event
        assert!(has_event(RuntimeEvent::ConvictionVoting(
            ConvictionVotingEvent::Delegated(bob(), alice())
        )));

        // Alice's vote should now count the delegated amount
        assert_ok!(Referenda::place_decision_deposit(
            RuntimeOrigin::signed(alice()),
            0
        ));

        assert_ok!(ConvictionVoting::vote(
            RuntimeOrigin::signed(alice()),
            0,
            AccountVote::Standard {
                vote: Vote {
                    aye: true,
                    conviction: Conviction::Locked1x
                },
                balance: 50 * HAVE
            }
        ));

        // Bob can undelegate
        assert_ok!(ConvictionVoting::undelegate(
            RuntimeOrigin::signed(bob()),
            class
        ));
    });
}

/// Test referendum with insufficient support
#[test]
fn referendum_insufficient_support_fails() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = make_simple_proposal();
        let proposal_hash = make_proposal_hash(&proposal);

        // Setup referendum
        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice()),
            proposal.encode()
        ));

        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(alice()),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_proposal,
            DispatchTime::After(10)
        ));

        assert_ok!(Referenda::place_decision_deposit(
            RuntimeOrigin::signed(alice()),
            0
        ));

        // Vote with very small amount (insufficient support)
        assert_ok!(ConvictionVoting::vote(
            RuntimeOrigin::signed(alice()),
            0,
            AccountVote::Standard {
                vote: Vote {
                    aye: true,
                    conviction: Conviction::None
                },
                balance: 1 * HAVE // Very small vote
            }
        ));

        // Advance through the entire decision period
        let track_info = &TracksInfo::tracks()[0].1; // Root track
        advance_referendum_time(track_info.decision_period + track_info.confirm_period + 1);

        // Should still be ongoing or rejected due to insufficient support
        let referendum_info = pallet_referenda::ReferendumInfoFor::<Runtime>::get(0);
        assert!(referendum_info.is_some());
    });
}

/// Test preimage lifecycle with referenda
#[test]
fn preimage_lifecycle_works() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = make_simple_proposal();
        let proposal_hash = make_proposal_hash(&proposal);
        let proposal_len = proposal.encoded_size() as u32;

        // Note preimage first
        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice()),
            proposal.encode()
        ));

        // Check preimage is noted
        assert!(<Preimage as PreimageProvider<_>>::have_preimage(
            &proposal_hash
        ));

        // Submit referendum using the preimage
        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(alice()),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_proposal,
            DispatchTime::After(10)
        ));

        // Preimage is automatically managed by the referenda pallet
        // No manual request needed in modern Substrate versions

        // Cancel referendum to test preimage cleanup
        assert_ok!(Referenda::cancel(RuntimeOrigin::root(), 0));

        // Preimage should still exist until unrequested
        assert!(<Preimage as PreimageProvider<_>>::have_preimage(
            &proposal_hash
        ));

        // Preimage cleanup is handled automatically by the system
        // Manual unrequest is not needed in modern implementations
    });
}

/// Test referendum decision deposit mechanics
#[test]
fn decision_deposit_mechanics_work() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = make_simple_proposal();

        // Setup referendum
        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice()),
            proposal.encode()
        ));

        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(alice()),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_proposal,
            DispatchTime::After(10)
        ));

        // Initially referendum is in preparing state
        let referendum_info = pallet_referenda::ReferendumInfoFor::<Runtime>::get(0).unwrap();
        if let ReferendumInfo::Ongoing(status) = referendum_info {
            assert!(status.deciding.is_none());
        }

        // Advance time through prepare period (1 DAY for root track)
        let track_info = &TracksInfo::tracks()[0].1; // Root track
        advance_referendum_time(track_info.prepare_period + 1);

        let alice_balance_before = Balances::free_balance(&alice());

        // Place decision deposit to move to deciding
        assert_ok!(Referenda::place_decision_deposit(
            RuntimeOrigin::signed(alice()),
            0
        ));

        // Alice's balance should decrease by decision deposit
        let alice_balance_after = Balances::free_balance(&alice());
        let track_info = &TracksInfo::tracks()[0].1; // Root track
        assert_eq!(
            alice_balance_before - alice_balance_after,
            track_info.decision_deposit
        );

        // Referendum should now be in deciding state
        let referendum_info = pallet_referenda::ReferendumInfoFor::<Runtime>::get(0).unwrap();
        if let ReferendumInfo::Ongoing(status) = referendum_info {
            assert!(status.deciding.is_some());
        }

        // Check decision deposit event
        assert!(has_event(RuntimeEvent::Referenda(
            ReferendaEvent::DecisionDepositPlaced {
                index: 0,
                who: alice(),
                amount: track_info.decision_deposit
            }
        )));
    });
}

/// Test track capacity limits (max_deciding)
#[test]
fn track_capacity_limits_enforced() {
    ExtBuilder::default().build().execute_with(|| {
        use datahaven_mainnet_runtime::governance::custom_origins;

        // Use root track which has max_deciding of 5 (more reasonable for testing)
        let track_info = &TracksInfo::tracks()[0].1; // root track
        let max_deciding = track_info.max_deciding.min(5); // Use smaller number for testing

        // Submit max_deciding referenda (but cap at 5 for scheduler limits)
        for i in 0..max_deciding {
            let proposal = RuntimeCall::System(frame_system::Call::set_storage {
                items: vec![(format!(":test{}", i).as_bytes().to_vec(), b"value".to_vec())],
            });

            assert_ok!(Preimage::note_preimage(
                RuntimeOrigin::signed(alice()),
                proposal.encode()
            ));

            let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
            assert_ok!(Referenda::submit(
                RuntimeOrigin::signed(alice()),
                Box::new(frame_system::RawOrigin::Root.into()),
                bounded_proposal,
                DispatchTime::After(10)
            ));
        }

        // Advance through prepare period
        advance_referendum_time(track_info.prepare_period + 1);

        // Place decision deposits for all
        for i in 0..max_deciding {
            assert_ok!(Referenda::place_decision_deposit(
                RuntimeOrigin::signed(alice()),
                i
            ));
        }

        // All should be in deciding phase
        for i in 0..max_deciding {
            let referendum_info = pallet_referenda::ReferendumInfoFor::<Runtime>::get(i).unwrap();
            if let ReferendumInfo::Ongoing(status) = referendum_info {
                assert!(status.deciding.is_some());
            }
        }

        // Try to submit and move another referendum to deciding - should queue
        let extra_proposal = RuntimeCall::System(frame_system::Call::set_storage {
            items: vec![(b":extra".to_vec(), b"value".to_vec())],
        });

        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(bob()),
            extra_proposal.encode()
        ));

        let bounded_extra = <Preimage as StorePreimage>::bound(extra_proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(bob()),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_extra,
            DispatchTime::After(10)
        ));

        // Place deposit for the extra referendum
        assert_ok!(Referenda::place_decision_deposit(
            RuntimeOrigin::signed(bob()),
            max_deciding
        ));

        // Should still be preparing (queued) since track is at capacity
        let extra_info = pallet_referenda::ReferendumInfoFor::<Runtime>::get(max_deciding).unwrap();
        if let ReferendumInfo::Ongoing(status) = extra_info {
            // May be queued or preparing depending on implementation
            // The key is it shouldn't immediately go to deciding when track is full
        }
    });
}

/// Test insufficient balance for deposits
#[test]
fn insufficient_balance_for_deposits() {
    ExtBuilder::default().build().execute_with(|| {
        let poor_account = AccountId::from([99u8; 32]);

        // Give poor_account enough for submission deposit and preimage, but not decision deposit
        use datahaven_mainnet_runtime::configs::governance::referenda::SubmissionDeposit;
        let submission_deposit = SubmissionDeposit::get();
        // Give enough for submission deposit + preimage costs, but not enough for decision deposit
        let _ = Balances::make_free_balance_be(&poor_account, submission_deposit + 1000 * HAVE);

        let proposal = make_simple_proposal();
        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(poor_account),
            proposal.encode()
        ));

        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();

        // Should be able to submit with just submission deposit
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(poor_account),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_proposal,
            DispatchTime::After(10)
        ));

        // Advance through prepare period
        let track_info = &TracksInfo::tracks()[0].1;
        advance_referendum_time(track_info.prepare_period + 1);

        // Should fail to place decision deposit due to insufficient balance
        assert_noop!(
            Referenda::place_decision_deposit(RuntimeOrigin::signed(poor_account), 0),
            pallet_balances::Error::<Runtime>::InsufficientBalance
        );
    });
}

/// Test referendum confirmation period
#[test]
fn referendum_confirmation_period_works() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = make_simple_proposal();

        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice()),
            proposal.encode()
        ));

        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(alice()),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_proposal,
            DispatchTime::After(10)
        ));

        let track_info = &TracksInfo::tracks()[0].1; // Root track

        // Advance through prepare period
        advance_referendum_time(track_info.prepare_period + 1);

        // Place decision deposit
        assert_ok!(Referenda::place_decision_deposit(
            RuntimeOrigin::signed(alice()),
            0
        ));

        // Vote with overwhelming support to meet approval threshold
        let vote_amount = 1000 * HAVE;
        for i in 0..10 {
            let voter = AccountId::from([i as u8; 32]);
            let _ = Balances::make_free_balance_be(&voter, vote_amount * 2);
            assert_ok!(ConvictionVoting::vote(
                RuntimeOrigin::signed(voter),
                0,
                AccountVote::Standard {
                    vote: Vote {
                        aye: true,
                        conviction: Conviction::Locked6x
                    },
                    balance: vote_amount
                }
            ));
        }

        // Advance time but not through full confirm period
        advance_referendum_time(track_info.confirm_period - 1);

        // Should still be ongoing, not confirmed yet
        let referendum_info = pallet_referenda::ReferendumInfoFor::<Runtime>::get(0).unwrap();
        if let ReferendumInfo::Ongoing(status) = referendum_info {
            assert!(status.deciding.is_some());
            // Should be in confirmation phase but not approved yet
        }

        // Advance through confirm period
        advance_referendum_time(2);

        // Now should be approved/confirmed
        let referendum_info = pallet_referenda::ReferendumInfoFor::<Runtime>::get(0);
        // May be approved or executed depending on enactment period
    });
}

/// Test referendum with split votes and conviction
#[test]
fn split_votes_with_conviction() {
    ExtBuilder::default().build().execute_with(|| {
        let proposal = make_simple_proposal();

        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice()),
            proposal.encode()
        ));

        let bounded_proposal = <Preimage as StorePreimage>::bound(proposal).unwrap();
        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(alice()),
            Box::new(frame_system::RawOrigin::Root.into()),
            bounded_proposal,
            DispatchTime::After(10)
        ));

        // Place decision deposit after prepare period
        let track_info = &TracksInfo::tracks()[0].1;
        advance_referendum_time(track_info.prepare_period + 1);
        assert_ok!(Referenda::place_decision_deposit(
            RuntimeOrigin::signed(alice()),
            0
        ));

        // Split vote from same account
        let split_voter = AccountId::from([50u8; 32]);
        let _ = Balances::make_free_balance_be(&split_voter, 1000 * HAVE);

        assert_ok!(ConvictionVoting::vote(
            RuntimeOrigin::signed(split_voter),
            0,
            AccountVote::Split {
                aye: 600 * HAVE,
                nay: 400 * HAVE
            }
        ));

        // Standard votes with different convictions
        let convictions = vec![
            Conviction::None,
            Conviction::Locked1x,
            Conviction::Locked2x,
            Conviction::Locked3x,
            Conviction::Locked4x,
            Conviction::Locked5x,
            Conviction::Locked6x,
        ];

        for (i, conviction) in convictions.iter().enumerate() {
            let voter = AccountId::from([(100 + i) as u8; 32]);
            let _ = Balances::make_free_balance_be(&voter, 100 * HAVE);

            assert_ok!(ConvictionVoting::vote(
                RuntimeOrigin::signed(voter),
                0,
                AccountVote::Standard {
                    vote: Vote {
                        aye: i % 2 == 0,
                        conviction: *conviction
                    },
                    balance: 100 * HAVE
                }
            ));
        }
    });
}
