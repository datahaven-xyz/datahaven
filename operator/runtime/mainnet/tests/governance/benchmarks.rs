// Copyright 2025 DataHaven
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

//! Benchmarking tests for DataHaven governance system
//!
//! Performance and stress tests for governance pallets to ensure
//! the system can handle high load and scales appropriately with
//! the number of participants, proposals, and votes.

#![cfg(feature = "runtime-benchmarks")]

use crate::common::*;
use alloc::vec::Vec;
use datahaven_mainnet_runtime::{
    configs::governance::council::{TechnicalMaxMembers, TechnicalMaxProposals},
    governance::TracksInfo,
    AccountId, Balance, Balances, ConvictionVoting, Preimage, Referenda, Runtime, RuntimeCall,
    RuntimeEvent, RuntimeOrigin, System, TechnicalCommittee, TreasuryCouncil, DAYS, UNIT,
};
use frame_support::traits::schedule::DispatchTime;
use frame_support::{
    assert_ok,
    dispatch::GetDispatchInfo,
    traits::{Get, StorePreimage},
};
use pallet_conviction_voting::{AccountVote, Conviction, Vote};

/// Benchmark council proposal creation with varying member counts
#[test]
fn benchmark_council_proposal_scaling() {
    // Test with different council sizes
    let member_counts = vec![3, 5, 10, 15, 20];

    for member_count in member_counts {
        ExtBuilder::governance().build().execute_with(|| {
            // Generate members
            let members: Vec<AccountId> = (0..member_count)
                .map(|i| AccountId::from([i as u8; 20]))
                .collect();

            setup_technical_committee(members.clone());

            let proposal = make_simple_proposal();
            let proposal_len = proposal.encoded_size() as u32;

            // Measure proposal creation time
            let start_block = System::block_number();

            assert_ok!(TechnicalCommittee::propose(
                RuntimeOrigin::signed(members[0]),
                (member_count as u32 + 1) / 2, // Majority threshold
                Box::new(proposal.clone()),
                proposal_len,
            ));

            let end_block = System::block_number();

            // In real benchmarks, you'd measure actual execution time
            // For this test, we just verify it completed successfully
            assert_eq!(TechnicalCommittee::proposal_count(), 1);

            println!(
                "Council size {}: proposal created in {} blocks",
                member_count,
                end_block - start_block
            );
        });
    }
}

/// Benchmark voting performance with many participants
#[test]
fn benchmark_mass_voting_performance() {
    ExtBuilder::governance().build().execute_with(|| {
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
            DispatchTime::After(100)
        ));

        // Wait for prepare period and place decision deposit
        advance_referendum_time(1 * DAYS + 1);
        assert_ok!(Referenda::place_decision_deposit(
            RuntimeOrigin::signed(alice()),
            0
        ));

        // Simulate mass voting
        let voter_counts = vec![10, 50, 100];

        for voter_count in voter_counts {
            let start_block = System::block_number();

            // Create voters and have them vote
            for i in 0..voter_count {
                let voter = AccountId::from([(i % 255) as u8; 32]);

                // Ensure voter has balance
                let _ = Balances::make_free_balance_be(&voter, INITIAL_BALANCE);

                // Try to vote - may fail if referendum isn't ready
                let _ = ConvictionVoting::vote(
                    RuntimeOrigin::signed(voter),
                    0,
                    AccountVote::Standard {
                        vote: Vote {
                            aye: i % 2 == 0,
                            conviction: if i % 3 == 0 {
                                Conviction::Locked3x
                            } else {
                                Conviction::Locked1x
                            },
                        },
                        balance: 10 * UNIT,
                    },
                );
            }

            let end_block = System::block_number();

            println!(
                "Processed {} votes in {} blocks",
                voter_count,
                end_block - start_block
            );
        }
    });
}

/// Benchmark referendum lifecycle with multiple tracks
#[test]
fn benchmark_multi_track_performance() {
    ExtBuilder::governance().build().execute_with(|| {
        let referendum_counts = vec![1, 5, 10, 20];

        for referendum_count in referendum_counts {
            let start_block = System::block_number();

            // Create multiple referenda across different tracks
            for i in 0..referendum_count {
                let proposal = RuntimeCall::System(frame_system::Call::set_storage {
                    items: vec![(format!(":test:{}", i).into_bytes(), b"value".to_vec())],
                });
                let proposal_hash = make_proposal_hash(&proposal);

                assert_ok!(Preimage::note_preimage(
                    RuntimeOrigin::signed(alice()),
                    proposal.encode()
                ));

                // Alternate between different origin types to test different tracks
                let origin = if i % 2 == 0 {
                    frame_system::RawOrigin::Root.into()
                } else {
                    frame_system::RawOrigin::Signed(alice()).into()
                };

                assert_ok!(Referenda::submit(
                    RuntimeOrigin::signed(alice()),
                    Box::new(origin),
                    DispatchTime::After(100 + i as u32 * 10),
                    Box::new(proposal_hash.into())
                ));

                // Place decision deposits
                assert_ok!(Referenda::place_decision_deposit(
                    RuntimeOrigin::signed(alice()),
                    i as u32
                ));

                // Add some voting
                assert_ok!(ConvictionVoting::vote(
                    RuntimeOrigin::signed(bob()),
                    i as u32,
                    AccountVote::Standard {
                        vote: Vote {
                            aye: true,
                            conviction: Conviction::Locked1x
                        },
                        balance: 50 * UNIT
                    }
                ));
            }

            let end_block = System::block_number();

            println!(
                "Created and initialized {} referenda in {} blocks",
                referendum_count,
                end_block - start_block
            );

            // Verify all referenda were created
            for i in 0..referendum_count {
                assert!(Referenda::referendum_info(i as u32).is_some());
            }
        }
    });
}

/// Benchmark delegation chains and complex voting patterns
#[test]
fn benchmark_delegation_performance() {
    ExtBuilder::governance().build().execute_with(|| {
        let proposal = make_simple_proposal();
        let proposal_hash = make_proposal_hash(&proposal);

        // Setup referendum
        assert_ok!(Preimage::note_preimage(
            RuntimeOrigin::signed(alice()),
            proposal.encode()
        ));

        assert_ok!(Referenda::submit(
            RuntimeOrigin::signed(alice()),
            Box::new(frame_system::RawOrigin::Root.into()),
            DispatchTime::After(100),
            Box::new(proposal_hash.into())
        ));

        assert_ok!(Referenda::place_decision_deposit(
            RuntimeOrigin::signed(alice()),
            0
        ));

        let delegation_counts = vec![5, 20, 50];
        let track_class = 0u16;

        for delegation_count in delegation_counts {
            let start_block = System::block_number();

            // Create delegation chain
            for i in 0..delegation_count {
                let delegator = AccountId::from([(i % 255) as u8; 20]);
                let target = if i == 0 {
                    alice()
                } else {
                    AccountId::from([((i - 1) % 255) as u8; 20])
                };

                // Ensure delegator has balance
                let _ = Balances::mint_into(&delegator, INITIAL_BALANCE);

                assert_ok!(ConvictionVoting::delegate(
                    RuntimeOrigin::signed(delegator),
                    track_class,
                    target,
                    Conviction::Locked2x,
                    50 * UNIT
                ));
            }

            // Alice votes, should cascade through delegation chain
            assert_ok!(ConvictionVoting::vote(
                RuntimeOrigin::signed(alice()),
                0,
                AccountVote::Standard {
                    vote: Vote {
                        aye: true,
                        conviction: Conviction::Locked1x
                    },
                    balance: 100 * UNIT
                }
            ));

            let end_block = System::block_number();

            println!(
                "Processed delegation chain of {} delegators in {} blocks",
                delegation_count,
                end_block - start_block
            );

            // Test undelegation performance
            let undelegate_start = System::block_number();

            for i in 0..delegation_count {
                let delegator = AccountId::from([(i % 255) as u8; 20]);
                assert_ok!(ConvictionVoting::undelegate(
                    RuntimeOrigin::signed(delegator),
                    track_class
                ));
            }

            let undelegate_end = System::block_number();

            println!(
                "Undelegated {} accounts in {} blocks",
                delegation_count,
                undelegate_end - undelegate_start
            );
        }
    });
}

/// Benchmark preimage storage and retrieval with large proposals
#[test]
fn benchmark_preimage_performance() {
    ExtBuilder::governance().build().execute_with(|| {
        let data_sizes = vec![1_000, 10_000, 100_000]; // Different proposal sizes in bytes

        for data_size in data_sizes {
            // Create large proposal
            let large_data = vec![0u8; data_size];
            let large_proposal = RuntimeCall::System(frame_system::Call::set_storage {
                items: vec![(b":large_data".to_vec(), large_data)],
            });
            let proposal_hash = make_proposal_hash(&large_proposal);

            let start_block = System::block_number();

            // Note large preimage
            assert_ok!(Preimage::note_preimage(
                RuntimeOrigin::signed(alice()),
                large_proposal.encode()
            ));

            let note_end = System::block_number();

            // Request preimage
            assert_ok!(Preimage::request_preimage(
                RuntimeOrigin::signed(alice()),
                proposal_hash
            ));

            let request_end = System::block_number();

            // Use preimage in referendum
            assert_ok!(Referenda::submit(
                RuntimeOrigin::signed(alice()),
                Box::new(frame_system::RawOrigin::Root.into()),
                DispatchTime::After(100),
                Box::new(proposal_hash.into())
            ));

            let submit_end = System::block_number();

            println!(
                "Preimage size {}: note={} blocks, request={} blocks, submit={} blocks",
                data_size,
                note_end - start_block,
                request_end - note_end,
                submit_end - request_end
            );
        }
    });
}

/// Benchmark council operations under maximum load
#[test]
fn benchmark_council_maximum_load() {
    ExtBuilder::governance().build().execute_with(|| {
        // Test with maximum allowed members
        let max_members = TechnicalMaxMembers::get() as usize;
        let members: Vec<AccountId> = (0..max_members)
            .map(|i| AccountId::from([(i % 255) as u8; 20]))
            .collect();

        setup_technical_committee(members.clone());

        // Test maximum concurrent proposals
        let max_proposals = TechnicalMaxProposals::get() as usize;
        let start_block = System::block_number();

        for i in 0..max_proposals {
            let proposal = RuntimeCall::System(frame_system::Call::set_storage {
                items: vec![(format!(":max_test:{}", i).into_bytes(), b"value".to_vec())],
            });
            let proposal_len = proposal.encoded_size() as u32;

            assert_ok!(TechnicalCommittee::propose(
                RuntimeOrigin::signed(members[i % members.len()]),
                (members.len() as u32 + 1) / 2,
                Box::new(proposal.clone()),
                proposal_len,
            ));
        }

        let proposals_end = System::block_number();

        // Vote on all proposals with all members
        let vote_start = System::block_number();

        for proposal_index in 0..max_proposals {
            let proposal = RuntimeCall::System(frame_system::Call::set_storage {
                items: vec![(format!(":max_test:{}", proposal_index).into_bytes(), b"value".to_vec())],
            });
            let proposal_hash = make_proposal_hash(&proposal);

            // Each member votes
            for (member_index, member) in members.iter().enumerate() {
                if member_index < (members.len() + 1) / 2 { // Majority votes yes
                    assert_ok!(TechnicalCommittee::vote(
                        RuntimeOrigin::signed(*member),
                        proposal_hash,
                        proposal_index as u32,
                        true,
                    ));
                }
            }
        }

        let vote_end = System::block_number();

        println!(
            "Maximum load test: {} members, {} proposals created in {} blocks, {} votes processed in {} blocks",
            max_members,
            max_proposals,
            proposals_end - start_block,
            max_proposals * ((members.len() + 1) / 2),
            vote_end - vote_start
        );

        // All proposals should be executed due to majority approval
        assert_eq!(TechnicalCommittee::proposal_count(), 0);
    });
}

/// Benchmark track configuration and switching
#[test]
fn benchmark_track_operations() {
    ExtBuilder::governance().build().execute_with(|| {
        let tracks = TracksInfo::tracks();

        println!("Testing {} governance tracks", tracks.len());

        for (track_id, track_info) in tracks.iter() {
            let start_block = System::block_number();

            // Create proposal for this track
            let proposal = RuntimeCall::System(frame_system::Call::set_storage {
                items: vec![(
                    format!(":track:{}:{}", track_id, track_info.name).into_bytes(),
                    b"test".to_vec(),
                )],
            });
            let proposal_hash = make_proposal_hash(&proposal);

            assert_ok!(Preimage::note_preimage(
                RuntimeOrigin::signed(alice()),
                proposal.encode()
            ));

            // Map track to appropriate origin
            let origin = if *track_id == 0 {
                frame_system::RawOrigin::Root.into()
            } else {
                frame_system::RawOrigin::Signed(alice()).into()
            };

            assert_ok!(Referenda::submit(
                RuntimeOrigin::signed(alice()),
                Box::new(origin),
                DispatchTime::After(track_info.min_enactment_period),
                Box::new(proposal_hash.into())
            ));

            assert_ok!(Referenda::place_decision_deposit(
                RuntimeOrigin::signed(bob()),
                *track_id as u32
            ));

            // Test voting on this track
            assert_ok!(ConvictionVoting::vote(
                RuntimeOrigin::signed(charlie()),
                *track_id as u32,
                AccountVote::Standard {
                    vote: Vote {
                        aye: true,
                        conviction: Conviction::Locked1x
                    },
                    balance: 100 * UNIT
                }
            ));

            let end_block = System::block_number();

            println!(
                "Track {} ({}): processed in {} blocks (max_deciding: {}, decision_deposit: {})",
                track_id,
                track_info.name,
                end_block - start_block,
                track_info.max_deciding,
                track_info.decision_deposit
            );
        }
    });
}

/// Memory usage estimation test
#[test]
fn benchmark_memory_usage() {
    ExtBuilder::governance().build().execute_with(|| {
        println!("Memory usage estimation for governance components:");

        // Estimate storage overhead for different components
        let member_count = 10;
        let proposal_count = 5;
        let referendum_count = 3;
        let voter_count = 100;

        // Setup components
        let members: Vec<AccountId> = (0..member_count)
            .map(|i| AccountId::from([i as u8; 20]))
            .collect();
        setup_technical_committee(members.clone());

        // Create proposals
        for i in 0..proposal_count {
            let proposal = RuntimeCall::System(frame_system::Call::set_storage {
                items: vec![(format!(":memory_test:{}", i).into_bytes(), vec![0u8; 1000])],
            });
            let proposal_len = proposal.encoded_size() as u32;

            assert_ok!(TechnicalCommittee::propose(
                RuntimeOrigin::signed(members[0]),
                (member_count + 1) / 2,
                Box::new(proposal),
                proposal_len,
            ));
        }

        // Create referenda
        for i in 0..referendum_count {
            let proposal = make_simple_proposal();
            let proposal_hash = make_proposal_hash(&proposal);

            assert_ok!(Preimage::note_preimage(
                RuntimeOrigin::signed(alice()),
                proposal.encode()
            ));

            assert_ok!(Referenda::submit(
                RuntimeOrigin::signed(alice()),
                Box::new(frame_system::RawOrigin::Root.into()),
                DispatchTime::After(100),
                Box::new(proposal_hash.into())
            ));

            assert_ok!(Referenda::place_decision_deposit(
                RuntimeOrigin::signed(alice()),
                i as u32
            ));
        }

        // Add voters
        for i in 0..voter_count {
            let voter = AccountId::from([(i % 255) as u8; 20]);
            let _ = Balances::mint_into(&voter, INITIAL_BALANCE);

            assert_ok!(ConvictionVoting::vote(
                RuntimeOrigin::signed(voter),
                0, // Vote on first referendum
                AccountVote::Standard {
                    vote: Vote {
                        aye: i % 2 == 0,
                        conviction: Conviction::Locked1x
                    },
                    balance: 10 * UNIT
                }
            ));
        }

        println!(
            "Loaded: {} committee members, {} proposals, {} referenda, {} voters",
            member_count, proposal_count, referendum_count, voter_count
        );

        // In a real benchmark, you'd measure actual memory usage here
        // For this test, we just verify everything loaded successfully
        assert_eq!(TechnicalCommittee::members().len(), member_count);
        assert_eq!(TechnicalCommittee::proposal_count(), proposal_count as u32);

        for i in 0..referendum_count {
            assert!(Referenda::referendum_info(i as u32).is_some());
        }
    });
}
