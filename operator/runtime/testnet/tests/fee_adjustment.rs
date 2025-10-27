// Copyright 2025 Moonbeam Foundation.
// This file is part of DataHaven.

//! Fee adjustment integration tests for DataHaven testnet runtime
//! Based on Moonbeam's fee adjustment tests

use datahaven_runtime_common::constants::gas::WEIGHT_PER_GAS;
use datahaven_testnet_runtime::{
    configs::{
        MinimumMultiplier, RuntimeBlockWeights, SlowAdjustingFeeUpdate, TargetBlockFullness,
        TransactionPaymentAsGasPrice,
    },
    currency::WEIGHT_FEE,
    Runtime, System,
};
use fp_evm::FeeCalculator;
use frame_support::pallet_prelude::DispatchClass;
use frame_support::traits::OnFinalize;
use sp_core::U256;
use sp_runtime::{traits::Convert, BuildStorage, FixedPointNumber, FixedU128, Perbill};

/// Helper function to run tests with a specific system weight
fn run_with_system_weight<F>(w: frame_support::weights::Weight, mut assertions: F)
where
    F: FnMut() -> (),
{
    let mut t: sp_io::TestExternalities = frame_system::GenesisConfig::<Runtime>::default()
        .build_storage()
        .unwrap()
        .into();
    t.execute_with(|| {
        System::set_block_consumed_resources(w, 0);
        assertions()
    });
}

#[test]
fn multiplier_can_grow_from_zero() {
    let minimum_multiplier = MinimumMultiplier::get();
    let target = TargetBlockFullness::get()
        * RuntimeBlockWeights::get()
            .get(DispatchClass::Normal)
            .max_total
            .unwrap();
    // if the min is too small, then this will not change, and we are doomed forever.
    // the weight is 1/100th bigger than target.
    run_with_system_weight(target * 101 / 100, || {
        let next = SlowAdjustingFeeUpdate::<Runtime>::convert(minimum_multiplier);
        assert!(
            next > minimum_multiplier,
            "{:?} !>= {:?}",
            next,
            minimum_multiplier
        );
    })
}

#[test]
fn fee_calculation() {
    let base_extrinsic = RuntimeBlockWeights::get()
        .get(DispatchClass::Normal)
        .base_extrinsic;
    let multiplier = FixedU128::from_float(0.999000000000000000);
    let extrinsic_len = 100u32;
    let extrinsic_weight = 5_000u64;
    let tip = 42u128;

    // For IdentityFee, the fee is just the weight itself
    // Formula: base_extrinsic + (multiplier * call_weight) + extrinsic_len + tip
    let expected_fee = base_extrinsic.ref_time() as u128
        + (multiplier.saturating_mul_int(extrinsic_weight as u128))
        + extrinsic_len as u128
        + tip;

    let mut t: sp_io::TestExternalities = frame_system::GenesisConfig::<Runtime>::default()
        .build_storage()
        .unwrap()
        .into();
    t.execute_with(|| {
        pallet_transaction_payment::NextFeeMultiplier::<Runtime>::set(multiplier);
        let actual_fee = pallet_transaction_payment::Pallet::<Runtime>::compute_fee(
            extrinsic_len,
            &frame_support::dispatch::DispatchInfo {
                class: DispatchClass::Normal,
                pays_fee: frame_support::dispatch::Pays::Yes,
                call_weight: frame_support::weights::Weight::from_parts(extrinsic_weight, 1),
                extension_weight: frame_support::weights::Weight::zero(),
            },
            tip,
        );

        assert_eq!(
            expected_fee, actual_fee,
            "The actual fee did not match the expected fee, expected: {}, actual: {}",
            expected_fee, actual_fee
        );
    });
}

#[test]
fn min_gas_price_is_deterministic() {
    let mut t: sp_io::TestExternalities = frame_system::GenesisConfig::<Runtime>::default()
        .build_storage()
        .unwrap()
        .into();
    t.execute_with(|| {
        let multiplier = FixedU128::from_u32(1);
        pallet_transaction_payment::NextFeeMultiplier::<Runtime>::set(multiplier);
        let actual = TransactionPaymentAsGasPrice::min_gas_price().0;
        let expected: U256 = multiplier
            .saturating_mul_int(WEIGHT_FEE.saturating_mul(WEIGHT_PER_GAS as u128))
            .into();

        assert_eq!(expected, actual);
    });
}

#[test]
fn min_gas_price_has_no_precision_loss_from_saturating_mul_int() {
    let mut t: sp_io::TestExternalities = frame_system::GenesisConfig::<Runtime>::default()
        .build_storage()
        .unwrap()
        .into();
    t.execute_with(|| {
        let multiplier_1 = FixedU128::from_float(0.999593900000000000);
        let multiplier_2 = FixedU128::from_float(0.999593200000000000);

        pallet_transaction_payment::NextFeeMultiplier::<Runtime>::set(multiplier_1);
        let a = TransactionPaymentAsGasPrice::min_gas_price();
        pallet_transaction_payment::NextFeeMultiplier::<Runtime>::set(multiplier_2);
        let b = TransactionPaymentAsGasPrice::min_gas_price();

        assert_ne!(
            a, b,
            "both gas prices were equal, unexpected precision loss incurred"
        );
    });
}

#[test]
fn fee_scenarios() {
    let mut t: sp_io::TestExternalities = frame_system::GenesisConfig::<Runtime>::default()
        .build_storage()
        .unwrap()
        .into();
    t.execute_with(|| {
        let weight_fee_per_gas = WEIGHT_FEE.saturating_mul(WEIGHT_PER_GAS as u128);
        let sim = |start_gas_price: u128, fullness: Perbill, num_blocks: u64| -> U256 {
            let start_multiplier = FixedU128::from_rational(start_gas_price, weight_fee_per_gas);
            pallet_transaction_payment::NextFeeMultiplier::<Runtime>::set(start_multiplier);

            let normal_weight = RuntimeBlockWeights::get()
                .get(DispatchClass::Normal)
                .max_total
                .unwrap();
            let block_weight = normal_weight * fullness;

            for i in 0..num_blocks {
                System::set_block_number(i as u32);
                System::set_block_consumed_resources(block_weight, 0);
                pallet_transaction_payment::Pallet::<Runtime>::on_finalize(i as u32);
            }

            TransactionPaymentAsGasPrice::min_gas_price().0
        };

        // The expected values are the ones observed during test execution,
        // they are expected to change when parameters that influence
        // the fee calculation are changed, and should be updated accordingly.
        // If a test fails when nothing specific to fees has changed,
        // it may indicate an unexpected collateral effect and should be investigated

        assert_eq!(
            sim(1_000_000_000, Perbill::from_percent(0), 1),
            U256::from(998_600_980),
        );
        assert_eq!(
            sim(1_000_000_000, Perbill::from_percent(25), 1),
            U256::from(999_600_080),
        );
        assert_eq!(
            sim(1_000_000_000, Perbill::from_percent(50), 1),
            U256::from(1_000_600_180),
        );
        assert_eq!(
            sim(1_000_000_000, Perbill::from_percent(100), 1),
            U256::from(1_002_603_380),
        );

        // 1 "real" hour (at 6-second blocks)
        assert_eq!(
            sim(1_000_000_000, Perbill::from_percent(0), 600),
            U256::from(431_710_642),
        );
        assert_eq!(
            sim(1_000_000_000, Perbill::from_percent(25), 600),
            U256::from(786_627_866),
        );
        assert_eq!(
            sim(1_000_000_000, Perbill::from_percent(50), 600),
            U256::from(1_433_329_383u128),
        );
        assert_eq!(
            sim(1_000_000_000, Perbill::from_percent(100), 600),
            U256::from(4_758_812_897u128),
        );

        // 1 "real" day (at 6-second blocks)
        assert_eq!(
            sim(1_000_000_000, Perbill::from_percent(0), 14400),
            U256::from(312_500_000), // lower bound enforced
        );
        assert_eq!(
            sim(1_000_000_000, Perbill::from_percent(25), 14400),
            U256::from(312_500_000), // lower bound enforced if threshold not reached
        );
        assert_eq!(
            sim(1_000_000_000, Perbill::from_percent(50), 14400),
            U256::from(5_653_326_895_069u128),
        );
        assert_eq!(
            sim(1_000_000_000, Perbill::from_percent(100), 14400),
            U256::from(31_250_000_000_000u128),
            // upper bound enforced (min_gas_price * MaximumMultiplier)
        );
    });
}
