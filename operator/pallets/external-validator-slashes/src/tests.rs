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
            new_test_ext, run_block, sent_ethereum_message_nonce, DeferPeriodGetter,
            ExternalValidatorSlashes, MockEraIndexProvider, RuntimeEvent, RuntimeOrigin, System,
            Test,
        },
        Slash,
    },
    frame_support::{assert_noop, assert_ok},
};

#[test]
fn root_can_inject_manual_offence() {
    new_test_ext().execute_with(|| {
        start_era(0, 0, 0);
        assert_ok!(ExternalValidatorSlashes::force_inject_slash(
            RuntimeOrigin::root(),
            0,
            1u64,
            Perbill::from_percent(75),
            1
        ));
        assert_eq!(
            Slashes::<Test>::get(get_slashing_era(0)),
            vec![Slash {
                external_idx: 1,
                validator: 1,
                percentage: Perbill::from_percent(75),
                confirmed: false,
                reporters: vec![],
                slash_id: 0
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
                1
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
                1
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
            1
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
            1
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
            1
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
            1
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
            1
        ));
        assert_ok!(ExternalValidatorSlashes::force_inject_slash(
            RuntimeOrigin::root(),
            0,
            2u64,
            Perbill::from_percent(75),
            2
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
            1
        ));

        assert_eq!(
            Slashes::<Test>::get(get_slashing_era(0)),
            vec![Slash {
                external_idx: 1,
                validator: 1,
                percentage: Perbill::from_percent(75),
                confirmed: false,
                reporters: vec![],
                slash_id: 0
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
                external_idx: 0,
                validator: 3,
                percentage: Perbill::from_percent(75),
                confirmed: false,
                reporters: vec![],
                slash_id: 0
            }]
        );
    });
}

#[test]
fn test_on_offence_does_not_work_for_invulnerables() {
    new_test_ext().execute_with(|| {
        start_era(0, 0, 0);
        start_era(1, 1, 1);
        // account 1 invulnerable
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
            1
        ));
        assert_eq!(
            Slashes::<Test>::get(get_slashing_era(0)),
            vec![Slash {
                external_idx: 1,
                validator: 1,
                percentage: Perbill::from_percent(75),
                confirmed: true,
                reporters: vec![],
                slash_id: 0
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
            1
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
                external_idx: 0,
                validator: 3,
                percentage: Perbill::from_percent(75),
                confirmed: true,
                reporters: vec![],
                slash_id: 0
            }]
        );
        start_era(2, 2, 2);
        run_block();

        assert_eq!(sent_ethereum_message_nonce(), 1);
    });
}

#[test]
fn test_slashes_command_matches_event() {
    new_test_ext().execute_with(|| {
        crate::mock::DeferPeriodGetter::with_defer_period(0);
        start_era(0, 0, 0);
        start_era(1, 1, 1);
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
                external_idx: 0,
                validator: 3,
                percentage: Perbill::from_percent(75),
                confirmed: true,
                reporters: vec![],
                slash_id: 0
            }]
        );
        start_era(2, 2, 2);
        run_block();

        assert_eq!(sent_ethereum_message_nonce(), 1);

        // The slash is sent on era 2
        let expected_slashes = vec![SlashData {
            encoded_validator_id: 3u64.encode(),
            slash_fraction: Perbill::from_percent(75).deconstruct(),
            external_idx: 0u64,
        }];
        let expected_command = Command::ReportSlashes {
            era_index: 2u32,
            slashes: expected_slashes,
        };

        System::assert_last_event(RuntimeEvent::ExternalValidatorSlashes(
            crate::Event::SlashesMessageSent {
                message_id: Default::default(),
                slashes_command: expected_command,
            },
        ));
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
        assert_eq!(UnreportedSlashesQueue::<Test>::get().len(), 25);

        // this triggers on_initialize
        run_block();
        assert_eq!(sent_ethereum_message_nonce(), 1);
        assert_eq!(UnreportedSlashesQueue::<Test>::get().len(), 5);

        run_block();
        assert_eq!(sent_ethereum_message_nonce(), 2);
        assert_eq!(UnreportedSlashesQueue::<Test>::get().len(), 0);
    });
}

#[test]
fn test_account_id_encoding() {
    new_test_ext().execute_with(|| {
        use polkadot_core_primitives::AccountId as OpaqueAccountId;
        let alice_account: [u8; 32] = [4u8; 32];

        let slash = Slash::<OpaqueAccountId, u32> {
            external_idx: 0,
            validator: OpaqueAccountId::from(alice_account),
            reporters: vec![],
            slash_id: 1,
            percentage: Perbill::default(),
            confirmed: true,
        };

        let encoded_account = slash.validator.encode();
        assert_eq!(alice_account.to_vec(), encoded_account);
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
        assert_eq!(UnreportedSlashesQueue::<Test>::get().len(), 25);

        // this triggers on_initialize
        run_block();
        assert_eq!(sent_ethereum_message_nonce(), 1);
        assert_eq!(UnreportedSlashesQueue::<Test>::get().len(), 5);

        // We have 5 non-dispatched, which should accumulate
        // We shoulld have 30 after we initialie era 3
        for i in 0..25 {
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
        assert_eq!(UnreportedSlashesQueue::<Test>::get().len(), 30);

        // this triggers on_initialize
        run_block();
        assert_eq!(UnreportedSlashesQueue::<Test>::get().len(), 10);
        assert_eq!(sent_ethereum_message_nonce(), 2);

        // this triggers on_initialize
        run_block();
        assert_eq!(UnreportedSlashesQueue::<Test>::get().len(), 0);
        assert_eq!(sent_ethereum_message_nonce(), 3);
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
