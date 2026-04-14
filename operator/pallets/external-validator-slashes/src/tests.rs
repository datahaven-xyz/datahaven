// Copyright (C) Moondance Labs Ltd.
// This file is part of Tanssi.

// Tanssi is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Tanssi is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Tanssi.  If not, see <http://www.gnu.org/licenses/>

use {
    super::*,
    crate::{
        mock::{
            new_test_ext, run_block, DeferPeriodGetter, ExternalValidatorSlashes, MockBabeWrapper,
            MockEraIndexProvider, MockGrandpaWrapper, MockInnerReporter, MockOffence,
            MockOkOutboundQueue, RuntimeEvent, RuntimeOrigin, System, Test,
        },
        OffenceKind, Slash,
    },
    frame_support::{assert_noop, assert_ok, BoundedVec},
    sp_staking::offence::ReportOffence,
};

fn queued_slash_ids() -> Vec<u32> {
    let mut queued = Vec::new();
    let mut slot = UnsentSlashHead::<Test>::get();
    let tail = UnsentSlashTail::<Test>::get();

    while slot != tail {
        if let Some((_, batch)) = UnsentSlashBatch::<Test>::get(slot) {
            queued.extend(batch.into_iter().map(|slash| slash.slash_id));
        }
        slot = (slot + 1) % UNSENT_QUEUE_CAPACITY;
    }

    queued
}

fn queued_batch_eras() -> Vec<u32> {
    let mut queued = Vec::new();
    let mut slot = UnsentSlashHead::<Test>::get();
    let tail = UnsentSlashTail::<Test>::get();

    while slot != tail {
        if let Some((era, _)) = UnsentSlashBatch::<Test>::get(slot) {
            queued.push(era);
        }
        slot = (slot + 1) % UNSENT_QUEUE_CAPACITY;
    }

    queued
}

fn unsent_queue_len() -> u32 {
    ExternalValidatorSlashes::unsent_queue_len()
}

#[test]
fn root_can_inject_manual_offence() {
    new_test_ext().execute_with(|| {
        start_era(0, 0, 0);
        assert_ok!(ExternalValidatorSlashes::force_inject_slash(
            RuntimeOrigin::root(),
            0,
            1u64,
            Perbill::from_percent(75),
            OffenceKind::Custom(BoundedVec::truncate_from(b"Test slash".to_vec())),
        ));
        assert_eq!(
            Slashes::<Test>::get(get_slashing_era(0)),
            vec![Slash {
                validator: 1,
                percentage: Perbill::from_percent(75),
                confirmed: false,
                reporters: vec![],
                slash_id: 0,
                offence_kind: OffenceKind::Custom(BoundedVec::truncate_from(
                    b"Test slash".to_vec()
                )),
            }]
        );
        assert_eq!(NextSlashId::<Test>::get(), 1);
    });
}

#[test]
fn cannot_inject_future_era_offence() {
    new_test_ext().execute_with(|| {
        start_era(0, 0, 0);
        assert_noop!(
            ExternalValidatorSlashes::force_inject_slash(
                RuntimeOrigin::root(),
                1,
                1u64,
                Perbill::from_percent(75),
                OffenceKind::Custom(BoundedVec::truncate_from(b"Test slash".to_vec())),
            ),
            Error::<Test>::ProvidedFutureEra
        );
    });
}

#[test]
fn cannot_inject_era_offence_too_far_in_the_past() {
    new_test_ext().execute_with(|| {
        start_era(10, 0, 10);
        //Bonding period is 5, we cannot inject slash for era 4
        assert_noop!(
            ExternalValidatorSlashes::force_inject_slash(
                RuntimeOrigin::root(),
                1,
                4u64,
                Perbill::from_percent(75),
                OffenceKind::Custom(BoundedVec::truncate_from(b"Test slash".to_vec())),
            ),
            Error::<Test>::ProvidedNonSlashableEra
        );
    });
}

#[test]
fn root_can_cancel_deferred_slash() {
    new_test_ext().execute_with(|| {
        start_era(1, 0, 1);
        assert_ok!(ExternalValidatorSlashes::force_inject_slash(
            RuntimeOrigin::root(),
            0,
            1u64,
            Perbill::from_percent(75),
            OffenceKind::Custom(BoundedVec::truncate_from(b"Test slash".to_vec())),
        ));
        assert_ok!(ExternalValidatorSlashes::cancel_deferred_slash(
            RuntimeOrigin::root(),
            3,
            vec![0]
        ));

        assert_eq!(Slashes::<Test>::get(get_slashing_era(0)), vec![]);
    });
}

#[test]
fn root_cannot_cancel_deferred_slash_if_outside_deferring_period() {
    new_test_ext().execute_with(|| {
        start_era(1, 0, 1);
        assert_ok!(ExternalValidatorSlashes::force_inject_slash(
            RuntimeOrigin::root(),
            0,
            1u64,
            Perbill::from_percent(75),
            OffenceKind::Custom(BoundedVec::truncate_from(b"Test slash".to_vec())),
        ));

        start_era(4, 0, 4);

        assert_noop!(
            ExternalValidatorSlashes::cancel_deferred_slash(RuntimeOrigin::root(), 0, vec![0]),
            Error::<Test>::DeferPeriodIsOver
        );
    });
}

#[test]
fn root_cannot_cancel_out_of_bounds() {
    new_test_ext().execute_with(|| {
        start_era(1, 0, 1);
        assert_ok!(ExternalValidatorSlashes::force_inject_slash(
            RuntimeOrigin::root(),
            0,
            1u64,
            Perbill::from_percent(75),
            OffenceKind::Custom(BoundedVec::truncate_from(b"Test slash".to_vec())),
        ));
        assert_noop!(
            ExternalValidatorSlashes::cancel_deferred_slash(
                RuntimeOrigin::root(),
                3,
                vec![u32::MAX]
            ),
            Error::<Test>::InvalidSlashIndex
        );
    });
}

#[test]
fn root_cannot_cancel_duplicates() {
    new_test_ext().execute_with(|| {
        start_era(1, 0, 1);
        assert_ok!(ExternalValidatorSlashes::force_inject_slash(
            RuntimeOrigin::root(),
            0,
            1u64,
            Perbill::from_percent(75),
            OffenceKind::Custom(BoundedVec::truncate_from(b"Test slash".to_vec())),
        ));
        assert_noop!(
            ExternalValidatorSlashes::cancel_deferred_slash(RuntimeOrigin::root(), 3, vec![0, 0]),
            Error::<Test>::NotSortedAndUnique
        );
    });
}

#[test]
fn root_cannot_cancel_if_not_sorted() {
    new_test_ext().execute_with(|| {
        start_era(1, 0, 1);
        assert_ok!(ExternalValidatorSlashes::force_inject_slash(
            RuntimeOrigin::root(),
            0,
            1u64,
            Perbill::from_percent(75),
            OffenceKind::Custom(BoundedVec::truncate_from(b"Test slash".to_vec())),
        ));
        assert_ok!(ExternalValidatorSlashes::force_inject_slash(
            RuntimeOrigin::root(),
            0,
            2u64,
            Perbill::from_percent(75),
            OffenceKind::Custom(BoundedVec::truncate_from(b"Test slash".to_vec())),
        ));
        assert_noop!(
            ExternalValidatorSlashes::cancel_deferred_slash(RuntimeOrigin::root(), 3, vec![1, 0]),
            Error::<Test>::NotSortedAndUnique
        );
    });
}

#[test]
fn test_after_bonding_period_we_can_remove_slashes() {
    new_test_ext().execute_with(|| {
        start_era(0, 0, 0);
        start_era(1, 1, 1);

        // we are storing a tuple (era index, start_session_block)
        assert_eq!(BondedEras::<Test>::get(), [(0, 0, 0), (1, 1, 1)]);
        assert_ok!(ExternalValidatorSlashes::force_inject_slash(
            RuntimeOrigin::root(),
            0,
            1u64,
            Perbill::from_percent(75),
            OffenceKind::Custom(BoundedVec::truncate_from(b"Test slash".to_vec())),
        ));

        assert_eq!(
            Slashes::<Test>::get(get_slashing_era(0)),
            vec![Slash {
                validator: 1,
                percentage: Perbill::from_percent(75),
                confirmed: false,
                reporters: vec![],
                slash_id: 0,
                offence_kind: OffenceKind::Custom(BoundedVec::truncate_from(
                    b"Test slash".to_vec()
                )),
            }]
        );

        Pallet::<Test>::on_era_start(3, 3, 3);

        start_era(8, 8, 8);

        // whenever we start the 6th era, we can remove everything from era 3
        Pallet::<Test>::on_era_start(9, 9, 9);

        assert_eq!(Slashes::<Test>::get(get_slashing_era(0)), vec![]);
    });
}

#[test]
fn test_on_offence_injects_offences() {
    new_test_ext().execute_with(|| {
        start_era(0, 0, 0);
        start_era(1, 1, 1);
        PendingOffenceKind::<Test>::insert(0, 3u64, OffenceKind::LivenessOffence);
        Pallet::<Test>::on_offence(
            &[OffenceDetails {
                // 1 and 2 are invulnerables
                offender: (3, ()),
                reporters: vec![],
            }],
            &[Perbill::from_percent(75)],
            0,
        );
        assert_eq!(
            Slashes::<Test>::get(get_slashing_era(0)),
            vec![Slash {
                validator: 3,
                percentage: Perbill::from_percent(75),
                confirmed: false,
                reporters: vec![],
                slash_id: 0,
                offence_kind: OffenceKind::LivenessOffence,
            }]
        );
    });
}

#[test]
fn test_on_offence_does_not_work_for_invulnerables() {
    new_test_ext().execute_with(|| {
        start_era(0, 0, 0);
        start_era(1, 1, 1);
        // account 1 invulnerable — populate kind so we test the invulnerable check, not missing kind
        PendingOffenceKind::<Test>::insert(0, 1u64, OffenceKind::LivenessOffence);
        Pallet::<Test>::on_offence(
            &[OffenceDetails {
                offender: (1, ()),
                reporters: vec![],
            }],
            &[Perbill::from_percent(75)],
            0,
        );

        assert_eq!(Slashes::<Test>::get(get_slashing_era(1)), vec![]);
    });
}

#[test]
fn test_on_offence_does_not_work_if_slashing_disabled() {
    new_test_ext().execute_with(|| {
        start_era(0, 0, 0);
        start_era(1, 1, 1);
        assert_ok!(Pallet::<Test>::set_slashing_mode(
            RuntimeOrigin::root(),
            SlashingModeOption::Disabled,
        ));
        PendingOffenceKind::<Test>::insert(0, 3u64, OffenceKind::LivenessOffence);
        let weight = Pallet::<Test>::on_offence(
            &[OffenceDetails {
                // 1 and 2 are invulnerables
                offender: (3, ()),
                reporters: vec![],
            }],
            &[Perbill::from_percent(75)],
            0,
        );

        // on_offence didn't do anything
        assert_eq!(Slashes::<Test>::get(get_slashing_era(0)), vec![]);

        // Weight is not zero
        assert_ne!(weight, Weight::default());
    });
}

#[test]
fn defer_period_of_zero_confirms_immediately_slashes() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);
        start_era(0, 0, 0);
        assert_ok!(ExternalValidatorSlashes::force_inject_slash(
            RuntimeOrigin::root(),
            0,
            1u64,
            Perbill::from_percent(75),
            OffenceKind::Custom(BoundedVec::truncate_from(b"Test slash".to_vec())),
        ));
        assert_eq!(
            Slashes::<Test>::get(get_slashing_era(0)),
            vec![Slash {
                validator: 1,
                percentage: Perbill::from_percent(75),
                confirmed: true,
                reporters: vec![],
                slash_id: 0,
                offence_kind: OffenceKind::Custom(BoundedVec::truncate_from(
                    b"Test slash".to_vec()
                )),
            }]
        );
    });
}

#[test]
fn we_cannot_cancel_anything_with_defer_period_zero() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);
        start_era(0, 0, 0);
        assert_ok!(ExternalValidatorSlashes::force_inject_slash(
            RuntimeOrigin::root(),
            0,
            1u64,
            Perbill::from_percent(75),
            OffenceKind::Custom(BoundedVec::truncate_from(b"Test slash".to_vec())),
        ));
        assert_noop!(
            ExternalValidatorSlashes::cancel_deferred_slash(RuntimeOrigin::root(), 0, vec![0]),
            Error::<Test>::DeferPeriodIsOver
        );
    });
}

#[test]
fn test_on_offence_defer_period_0() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);
        start_era(0, 0, 0);
        start_era(1, 1, 1);
        PendingOffenceKind::<Test>::insert(0, 3u64, OffenceKind::LivenessOffence);
        Pallet::<Test>::on_offence(
            &[OffenceDetails {
                // 1 and 2 are invulnerables
                offender: (3, ()),
                reporters: vec![],
            }],
            &[Perbill::from_percent(75)],
            0,
        );

        assert_eq!(
            Slashes::<Test>::get(get_slashing_era(1)),
            vec![Slash {
                validator: 3,
                percentage: Perbill::from_percent(75),
                confirmed: true,
                reporters: vec![],
                slash_id: 0,
                offence_kind: OffenceKind::LivenessOffence,
            }]
        );
        start_era(2, 2, 2);
        run_block();
    });
}

#[test]
fn test_slashes_command_matches_event() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);
        start_era(0, 0, 0);
        start_era(1, 1, 1);
        PendingOffenceKind::<Test>::insert(0, 3u64, OffenceKind::LivenessOffence);
        Pallet::<Test>::on_offence(
            &[OffenceDetails {
                // 1 and 2 are invulnerables
                offender: (3, ()),
                reporters: vec![],
            }],
            &[Perbill::from_percent(75)],
            0,
        );

        // The slash was inserted properly
        assert_eq!(
            Slashes::<Test>::get(get_slashing_era(1)),
            vec![Slash {
                validator: 3,
                percentage: Perbill::from_percent(75),
                confirmed: true,
                reporters: vec![],
                slash_id: 0,
                offence_kind: OffenceKind::LivenessOffence,
            }]
        );
        start_era(2, 2, 2);
        run_block();

        System::assert_last_event(RuntimeEvent::ExternalValidatorSlashes(
            crate::Event::SlashesMessageSent {
                message_id: Default::default(),
            },
        ));
    });
}

// ── WAD conversion tests ──
// MaxSlashWad in mock = 50_000_000_000_000_000 (5e16 = 5% in WAD format).
// Perbill(100%) = 1_000_000_000 inner.
// Formula: wad = perbill_inner * MaxSlashWad / 1e9

#[test]
fn wad_conversion_100_percent_slash_maps_to_max_slash_wad() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);
        start_era(0, 0, 0);
        start_era(1, 1, 1);

        PendingOffenceKind::<Test>::insert(0, 3u64, OffenceKind::LivenessOffence);
        Pallet::<Test>::on_offence(
            &[OffenceDetails {
                offender: (3, ()),
                reporters: vec![],
            }],
            &[Perbill::from_percent(100)],
            0,
        );

        start_era(2, 2, 2);
        run_block();

        let sent = MockOkOutboundQueue::last_sent_slashes();
        assert_eq!(sent.len(), 1);
        // 100% → full MaxSlashWad = 5e16
        assert_eq!(sent[0].wad_to_slash, 50_000_000_000_000_000u128);
        assert_eq!(sent[0].validator, 3);
    });
}

#[test]
fn wad_conversion_50_percent_slash_maps_to_half_max_slash_wad() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);
        start_era(0, 0, 0);
        start_era(1, 1, 1);

        PendingOffenceKind::<Test>::insert(0, 3u64, OffenceKind::LivenessOffence);
        Pallet::<Test>::on_offence(
            &[OffenceDetails {
                offender: (3, ()),
                reporters: vec![],
            }],
            &[Perbill::from_percent(50)],
            0,
        );

        start_era(2, 2, 2);
        run_block();

        let sent = MockOkOutboundQueue::last_sent_slashes();
        assert_eq!(sent.len(), 1);
        // 50% → MaxSlashWad / 2 = 2.5e16
        assert_eq!(sent[0].wad_to_slash, 25_000_000_000_000_000u128);
    });
}

#[test]
fn wad_conversion_zero_percent_slash_maps_to_zero() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);
        start_era(0, 0, 0);
        start_era(1, 1, 1);

        PendingOffenceKind::<Test>::insert(0, 3u64, OffenceKind::LivenessOffence);
        Pallet::<Test>::on_offence(
            &[OffenceDetails {
                offender: (3, ()),
                reporters: vec![],
            }],
            &[Perbill::from_percent(0)],
            0,
        );

        start_era(2, 2, 2);
        run_block();

        // 0% slash → no slash recorded (compute_slash returns None for 0%)
        let sent = MockOkOutboundQueue::last_sent_slashes();
        assert_eq!(sent.len(), 0);
    });
}

#[test]
fn wad_conversion_carries_offence_kind_description() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);
        start_era(0, 0, 0);
        start_era(1, 1, 1);

        // Pre-populate a BabeEquivocation kind for session 0, validator 3.
        PendingOffenceKind::<Test>::insert(0, 3u64, OffenceKind::BabeEquivocation);

        Pallet::<Test>::on_offence(
            &[OffenceDetails {
                offender: (3, ()),
                reporters: vec![],
            }],
            &[Perbill::from_percent(75)],
            0,
        );

        start_era(2, 2, 2);
        run_block();

        let sent = MockOkOutboundQueue::last_sent_slashes();
        assert_eq!(sent.len(), 1);
        // 75% → 75% of MaxSlashWad = 3.75e16
        assert_eq!(sent[0].wad_to_slash, 37_500_000_000_000_000u128);
        assert_eq!(sent[0].description, "BABE equivocation");
    });
}

#[test]
fn test_on_offence_defer_period_0_messages_get_queued() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);
        start_era(0, 0, 0);
        start_era(1, 1, 1);
        // The limit is 20,
        for i in 0..25 {
            PendingOffenceKind::<Test>::insert(0, 3 + i, OffenceKind::LivenessOffence);
            Pallet::<Test>::on_offence(
                &[OffenceDetails {
                    // 1 and 2 are invulnerables
                    offender: (3 + i, ()),
                    reporters: vec![],
                }],
                &[Perbill::from_percent(75)],
                0,
            );
        }

        assert_eq!(Slashes::<Test>::get(get_slashing_era(1)).len(), 25);
        start_era(2, 2, 2);
        assert_eq!(unsent_queue_len(), 2);
        assert_eq!(queued_batch_eras(), vec![2, 2]);

        // this triggers on_initialize
        run_block();
        assert_eq!(unsent_queue_len(), 1);
        assert_eq!(queued_slash_ids(), (20..25).collect::<Vec<_>>());

        run_block();
        assert!(ExternalValidatorSlashes::unsent_queue_is_empty());
    });
}

#[test]
fn failed_slashes_batch_is_moved_to_back_of_queue() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);
        MockOkOutboundQueue::set_should_fail(true);

        start_era(0, 0, 0);
        start_era(1, 1, 1);

        for i in 0..25 {
            PendingOffenceKind::<Test>::insert(0, 3 + i, OffenceKind::LivenessOffence);
            Pallet::<Test>::on_offence(
                &[OffenceDetails {
                    offender: (3 + i, ()),
                    reporters: vec![],
                }],
                &[Perbill::from_percent(75)],
                0,
            );
        }

        start_era(2, 2, 2);
        assert_eq!(queued_slash_ids(), (0..25).collect::<Vec<_>>());
        assert_eq!(queued_batch_eras(), vec![2, 2]);

        run_block();

        assert_eq!(unsent_queue_len(), 2);
        assert_eq!(
            queued_slash_ids(),
            (20..25).chain(0..20).collect::<Vec<_>>()
        );
        System::assert_has_event(RuntimeEvent::ExternalValidatorSlashes(
            crate::Event::SlashesMessageSendFailed { era: 2, count: 20 },
        ));
    });
}

#[test]
fn failed_slashes_batch_retries_after_send_is_reenabled() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);
        MockOkOutboundQueue::set_should_fail(true);

        start_era(0, 0, 0);
        start_era(1, 1, 1);

        for i in 0..25 {
            PendingOffenceKind::<Test>::insert(0, 3 + i, OffenceKind::LivenessOffence);
            Pallet::<Test>::on_offence(
                &[OffenceDetails {
                    offender: (3 + i, ()),
                    reporters: vec![],
                }],
                &[Perbill::from_percent(75)],
                0,
            );
        }

        start_era(2, 2, 2);
        run_block();
        assert_eq!(
            queued_slash_ids(),
            (20..25).chain(0..20).collect::<Vec<_>>()
        );

        start_era(3, 3, 3);
        MockOkOutboundQueue::set_should_fail(false);

        run_block();
        assert_eq!(unsent_queue_len(), 1);
        assert_eq!(queued_slash_ids(), (0..20).collect::<Vec<_>>());
        assert_eq!(MockOkOutboundQueue::last_sent_slashes().len(), 5);
        assert_eq!(MockOkOutboundQueue::last_built_era(), Some(2));
        System::assert_has_event(RuntimeEvent::ExternalValidatorSlashes(
            crate::Event::SlashesMessageSent {
                message_id: Default::default(),
            },
        ));

        run_block();
        assert!(ExternalValidatorSlashes::unsent_queue_is_empty());
    });
}

#[test]
fn retry_extrinsic_succeeds_for_matching_era() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);

        start_era(0, 0, 0);
        start_era(1, 1, 1);

        for i in 0..25 {
            PendingOffenceKind::<Test>::insert(0, 3 + i, OffenceKind::LivenessOffence);
            Pallet::<Test>::on_offence(
                &[OffenceDetails {
                    offender: (3 + i, ()),
                    reporters: vec![],
                }],
                &[Perbill::from_percent(75)],
                0,
            );
        }

        start_era(2, 2, 2);
        start_era(5, 5, 5);

        assert_ok!(ExternalValidatorSlashes::retry_unsent_slash_era(
            RuntimeOrigin::root(),
            2,
        ));

        assert_eq!(unsent_queue_len(), 1);
        assert_eq!(queued_slash_ids(), (20..25).collect::<Vec<_>>());
        assert_eq!(MockOkOutboundQueue::last_built_era(), Some(2));
    });
}

#[test]
fn retry_extrinsic_errors_when_era_not_queued() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            ExternalValidatorSlashes::retry_unsent_slash_era(RuntimeOrigin::root(), 2),
            Error::<Test>::EraNotInUnsentQueue
        );
    });
}

#[test]
fn retry_extrinsic_requires_root() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            ExternalValidatorSlashes::retry_unsent_slash_era(RuntimeOrigin::signed(1), 2),
            sp_runtime::DispatchError::BadOrigin
        );
    });
}

#[test]
fn retry_extrinsic_preserves_failed_batch_when_send_still_fails() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);
        MockOkOutboundQueue::set_should_fail(true);

        start_era(0, 0, 0);
        start_era(1, 1, 1);

        for i in 0..25 {
            PendingOffenceKind::<Test>::insert(0, 3 + i, OffenceKind::LivenessOffence);
            Pallet::<Test>::on_offence(
                &[OffenceDetails {
                    offender: (3 + i, ()),
                    reporters: vec![],
                }],
                &[Perbill::from_percent(75)],
                0,
            );
        }

        start_era(2, 2, 2);
        let before = queued_slash_ids();

        assert_noop!(
            ExternalValidatorSlashes::retry_unsent_slash_era(RuntimeOrigin::root(), 2),
            Error::<Test>::MessageSendFailed
        );

        assert_eq!(queued_slash_ids(), before);
        assert_eq!(unsent_queue_len(), 2);
    });
}

#[test]
fn unsent_queue_full_emits_event() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);

        for i in 0..63u32 {
            let slash = Slash {
                validator: 1000 + i as u64,
                reporters: vec![],
                slash_id: i,
                percentage: Perbill::from_percent(1),
                confirmed: true,
                offence_kind: OffenceKind::LivenessOffence,
            };
            assert!(ExternalValidatorSlashes::unsent_queue_push((
                1,
                vec![slash]
            )));
        }

        Slashes::<Test>::insert(
            2,
            vec![Slash {
                validator: 5000u64,
                reporters: vec![],
                slash_id: 999,
                percentage: Perbill::from_percent(10),
                confirmed: true,
                offence_kind: OffenceKind::LivenessOffence,
            }],
        );

        start_era(2, 2, 2);

        assert_eq!(unsent_queue_len(), 63);
        assert_eq!(Slashes::<Test>::get(2).len(), 1);
    });
}

#[test]
fn test_account_id_encoding() {
    new_test_ext().execute_with(|| {
        use fp_account::AccountId20;

        let alice_account: [u8; 32] = [4u8; 32];

        let slash = Slash::<AccountId20, u32> {
            validator: AccountId20::from(alice_account),
            reporters: vec![],
            slash_id: 1,
            percentage: Perbill::default(),
            confirmed: true,
            offence_kind: OffenceKind::LivenessOffence,
        };

        let encoded_account = slash.validator.encode();
        // Only has 20 bytes because we are using Ethereum convention for the address
        assert_eq!(alice_account[0..20].to_vec(), encoded_account);
    });
}

#[test]
fn test_on_offence_defer_period_0_messages_get_queued_across_eras() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);
        start_era(0, 0, 0);
        start_era(1, 1, 1);
        // The limit is 20,
        for i in 0..25 {
            PendingOffenceKind::<Test>::insert(0, 3 + i, OffenceKind::LivenessOffence);
            Pallet::<Test>::on_offence(
                &[OffenceDetails {
                    // 1 and 2 are invulnerables
                    offender: (3 + i, ()),
                    reporters: vec![],
                }],
                &[Perbill::from_percent(75)],
                0,
            );
        }
        assert_eq!(Slashes::<Test>::get(get_slashing_era(1)).len(), 25);
        start_era(2, 2, 2);
        assert_eq!(unsent_queue_len(), 2);

        // this triggers on_initialize
        run_block();
        assert_eq!(unsent_queue_len(), 1);
        assert_eq!(queued_slash_ids(), (20..25).collect::<Vec<_>>());

        for i in 0..25 {
            PendingOffenceKind::<Test>::insert(2, 3 + i, OffenceKind::LivenessOffence);
            Pallet::<Test>::on_offence(
                &[OffenceDetails {
                    // 1 and 2 are invulnerables
                    offender: (3 + i, ()),
                    reporters: vec![],
                }],
                &[Perbill::from_percent(75)],
                // Inject for slashing session 1
                2,
            );
        }

        start_era(3, 3, 3);
        assert_eq!(unsent_queue_len(), 3);
        assert_eq!(queued_batch_eras(), vec![2, 3, 3]);

        // this triggers on_initialize
        run_block();
        assert_eq!(unsent_queue_len(), 2);
        assert_eq!(queued_batch_eras(), vec![3, 3]);

        // this triggers on_initialize
        run_block();
        assert_eq!(unsent_queue_len(), 1);

        run_block();
        assert!(ExternalValidatorSlashes::unsent_queue_is_empty());
    });
}

// ── PendingOffenceKind & EquivocationReportWrapper tests ──

#[test]
fn on_offence_reads_pending_offence_kind_from_double_map() {
    new_test_ext().execute_with(|| {
        start_era(0, 0, 0);
        start_era(1, 1, 1);

        // Pre-populate PendingOffenceKind for validator 3 at session 0.
        PendingOffenceKind::<Test>::insert(0, 3u64, OffenceKind::BabeEquivocation);

        Pallet::<Test>::on_offence(
            &[OffenceDetails {
                offender: (3, ()),
                reporters: vec![],
            }],
            &[Perbill::from_percent(75)],
            0,
        );

        assert_eq!(
            Slashes::<Test>::get(get_slashing_era(0)),
            vec![Slash {
                validator: 3,
                percentage: Perbill::from_percent(75),
                confirmed: false,
                reporters: vec![],
                slash_id: 0,
                offence_kind: OffenceKind::BabeEquivocation,
            }]
        );

        // Entry should have been consumed.
        assert_eq!(PendingOffenceKind::<Test>::get(0, 3u64), None);
    });
}

#[test]
fn pending_offence_kind_is_session_isolated() {
    new_test_ext().execute_with(|| {
        start_era(0, 0, 0);
        start_era(1, 1, 1);

        // Same validator, different kinds in different sessions.
        PendingOffenceKind::<Test>::insert(0, 3u64, OffenceKind::BabeEquivocation);
        PendingOffenceKind::<Test>::insert(1, 3u64, OffenceKind::GrandpaEquivocation);

        // Report at session 0 — should use BabeEquivocation.
        Pallet::<Test>::on_offence(
            &[OffenceDetails {
                offender: (3, ()),
                reporters: vec![],
            }],
            &[Perbill::from_percent(50)],
            0,
        );

        // Session 0 consumed, session 1 untouched.
        assert_eq!(PendingOffenceKind::<Test>::get(0, 3u64), None);
        assert_eq!(
            PendingOffenceKind::<Test>::get(1, 3u64),
            Some(OffenceKind::GrandpaEquivocation),
        );
    });
}

#[test]
fn wrapper_filters_historical_offence_before_bonding_period() {
    new_test_ext().execute_with(|| {
        start_era(0, 0, 0);
        start_era(1, 1, 1);
        MockInnerReporter::reset();

        // BondedEras now contains [(0,0,0), (1,1,1)].
        // An offence at session 0 is within the bonding period — should pass.
        let result = MockBabeWrapper::report_offence(
            Vec::<u64>::new(),
            MockOffence {
                session_index: 0,
                offenders: vec![(3, ())],
            },
        );
        assert!(result.is_ok());
        assert!(MockInnerReporter::was_called());

        // The mock reporter doesn't trigger on_offence, so manually consume the entry.
        assert_eq!(
            PendingOffenceKind::<Test>::take(0, 3u64),
            Some(OffenceKind::BabeEquivocation),
        );

        // Advance eras until era 0 drops out of BondedEras.
        // BondingDuration = 5, so after era 6 starts, era 0 is pruned.
        for i in 2..=7 {
            start_era(i, i, i as u64);
        }

        MockInnerReporter::reset();

        // Session 0 now predates the bonding period — should be silently discarded.
        let result = MockBabeWrapper::report_offence(
            Vec::<u64>::new(),
            MockOffence {
                session_index: 0,
                offenders: vec![(3, ())],
            },
        );
        assert!(result.is_ok());
        assert!(!MockInnerReporter::was_called());

        // No PendingOffenceKind should have been written.
        assert_eq!(PendingOffenceKind::<Test>::get(0, 3u64), None);
    });
}

#[test]
fn wrapper_sets_pending_offence_kind_per_session_and_offender() {
    new_test_ext().execute_with(|| {
        start_era(0, 0, 0);
        start_era(1, 1, 1);
        MockInnerReporter::reset();

        let _ = MockBabeWrapper::report_offence(
            Vec::<u64>::new(),
            MockOffence {
                session_index: 0,
                offenders: vec![(3, ()), (4, ())],
            },
        );

        // Both offenders should have entries at session 0.
        assert_eq!(
            PendingOffenceKind::<Test>::get(0, 3u64),
            Some(OffenceKind::BabeEquivocation),
        );
        assert_eq!(
            PendingOffenceKind::<Test>::get(0, 4u64),
            Some(OffenceKind::BabeEquivocation),
        );
        // No entry at a different session.
        assert_eq!(PendingOffenceKind::<Test>::get(1, 3u64), None);
    });
}

#[test]
fn wrapper_cleans_up_pending_offence_kind_on_error() {
    new_test_ext().execute_with(|| {
        start_era(0, 0, 0);
        start_era(1, 1, 1);
        MockInnerReporter::reset();
        MockInnerReporter::set_should_fail(true);

        let result = MockBabeWrapper::report_offence(
            Vec::<u64>::new(),
            MockOffence {
                session_index: 0,
                offenders: vec![(3, ()), (4, ())],
            },
        );

        assert!(result.is_err());
        // Entries should have been cleaned up.
        assert_eq!(PendingOffenceKind::<Test>::get(0, 3u64), None);
        assert_eq!(PendingOffenceKind::<Test>::get(0, 4u64), None);
    });
}

#[test]
fn wrapper_error_cleanup_does_not_affect_other_sessions() {
    new_test_ext().execute_with(|| {
        start_era(0, 0, 0);
        start_era(1, 1, 1);
        MockInnerReporter::reset();

        // Successfully report at session 0.
        let _ = MockGrandpaWrapper::report_offence(
            Vec::<u64>::new(),
            MockOffence {
                session_index: 0,
                offenders: vec![(3, ())],
            },
        );
        assert_eq!(
            PendingOffenceKind::<Test>::get(0, 3u64),
            Some(OffenceKind::GrandpaEquivocation),
        );

        // Now fail a report at session 1 for the same validator.
        MockInnerReporter::set_should_fail(true);
        let result = MockBabeWrapper::report_offence(
            Vec::<u64>::new(),
            MockOffence {
                session_index: 1,
                offenders: vec![(3, ())],
            },
        );
        assert!(result.is_err());

        // Session 1 cleaned up, session 0 untouched.
        assert_eq!(PendingOffenceKind::<Test>::get(1, 3u64), None);
        assert_eq!(
            PendingOffenceKind::<Test>::get(0, 3u64),
            Some(OffenceKind::GrandpaEquivocation),
        );
    });
}

fn start_era(era_index: EraIndex, session_index: SessionIndex, external_idx: u64) {
    Pallet::<Test>::on_era_start(era_index, session_index, external_idx);
    crate::mock::MockEraIndexProvider::with_era(era_index);
}

fn get_slashing_era(slash_era: EraIndex) -> EraIndex {
    if DeferPeriodGetter::get() > 0 {
        slash_era
            .saturating_add(DeferPeriodGetter::get())
            .saturating_add(1)
    } else {
        MockEraIndexProvider::active_era().index.saturating_add(1)
    }
}
