// Copyright 2025 DataHaven
// This file is part of DataHaven.
//
// DataHaven is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// DataHaven is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with DataHaven.  If not, see <http://www.gnu.org/licenses/>.

//! Common inflation handling utilities for validator rewards.
//!
//! This module provides reusable implementations for calculating and minting
//! inflation-based rewards that can be shared across different runtime configurations.

use crate::constants::time::MILLISECONDS_PER_YEAR;
use frame_support::traits::{fungible::Inspect, Get};
use sp_runtime::Perbill;

/// Generic era inflation provider that calculates per-era inflation based on annual inflation rate.
///
/// # Type Parameters
/// * `R` - Runtime type that provides access to necessary pallets and configuration
/// * `Balances` - Pallet implementing fungible::Inspect for total issuance
/// * `AnnualRate` - Get<Perbill> providing the target annual inflation rate
/// * `SessionsPerEra` - Get<u32> providing the number of sessions per era
/// * `BlocksPerSession` - Get<u32> providing the number of blocks per session
/// * `MillisecsPerBlock` - Get<u64> providing milliseconds per block
///
/// # Calculation
/// 1. Gets total token issuance from Balances pallet
/// 2. Retrieves annual inflation rate from runtime parameters
/// 3. Calculates eras per year based on era duration
/// 4. Divides annual inflation by eras per year to get per-era amount
pub struct ExternalRewardsEraInflationProvider<
    Balances,
    AnnualRate,
    SessionsPerEra,
    BlocksPerSession,
    MillisecsPerBlock,
>(
    sp_std::marker::PhantomData<(
        Balances,
        AnnualRate,
        SessionsPerEra,
        BlocksPerSession,
        MillisecsPerBlock,
    )>,
);

impl<Balances, AnnualRate, SessionsPerEra, BlocksPerSession, MillisecsPerBlock> Get<u128>
    for ExternalRewardsEraInflationProvider<
        Balances,
        AnnualRate,
        SessionsPerEra,
        BlocksPerSession,
        MillisecsPerBlock,
    >
where
    Balances: Inspect<crate::AccountId, Balance = u128>,
    AnnualRate: Get<Perbill>,
    SessionsPerEra: Get<u32>,
    BlocksPerSession: Get<u32>,
    MillisecsPerBlock: Get<u64>,
{
    fn get() -> u128 {
        use sp_runtime::traits::Zero;

        let total_issuance = Balances::total_issuance();
        if total_issuance.is_zero() {
            return 0;
        }

        let annual_inflation_rate = AnnualRate::get();

        // Calculate eras per year
        // - SessionsPerEra: number of sessions in an era
        // - BlocksPerSession: number of blocks in an epoch (session)
        // - MillisecsPerBlock: milliseconds per block (6000ms = 6s)
        // - Year in milliseconds: 365.25 * 24 * 60 * 60 * 1000

        let sessions_per_era = SessionsPerEra::get() as u128;
        let blocks_per_session = BlocksPerSession::get() as u128;
        let millisecs_per_block = MillisecsPerBlock::get() as u128;

        let millisecs_per_era = sessions_per_era
            .saturating_mul(blocks_per_session)
            .saturating_mul(millisecs_per_block);

        if millisecs_per_era.is_zero() {
            log::error!(
                target: "ext_validators_rewards",
                "Invalid era duration configuration"
            );
            return 0;
        }

        let eras_per_year = MILLISECONDS_PER_YEAR.saturating_div(millisecs_per_era);
        if eras_per_year.is_zero() {
            log::error!(
                target: "ext_validators_rewards",
                "Eras per year is zero, check configuration"
            );
            return 0;
        }

        // Calculate per-era inflation
        let annual_inflation = annual_inflation_rate.mul_floor(total_issuance);
        let per_era_inflation = annual_inflation.saturating_div(eras_per_year);

        log::info!(
            target: "ext_validators_rewards",
            "Per-era inflation: {}",
            per_era_inflation
        );

        per_era_inflation
    }
}

/// Generic implementation of inflation handler that mints tokens and splits between rewards and treasury.
///
/// # Type Parameters
/// * `Balances` - Currency pallet implementing fungible::Mutate for minting
/// * `TreasuryProportion` - Get<Perbill> providing the treasury allocation percentage
/// * `TreasuryAccount` - Get<AccountId> providing the treasury account
///
/// # Functionality
/// 1. Validates the total amount is non-zero
/// 2. Calculates treasury allocation based on configured proportion
/// 3. Mints rewards portion to the rewards account
/// 4. Mints treasury portion to the treasury account
///
/// This struct provides a mint_inflation method that can be called from wrapper implementations
/// in your runtime to avoid circular dependencies.
pub struct ExternalRewardsInflationHandler<Balances, TreasuryProportion, TreasuryAccount>(
    sp_std::marker::PhantomData<(Balances, TreasuryProportion, TreasuryAccount)>,
);

impl<Balances, TreasuryProportion, TreasuryAccount>
    ExternalRewardsInflationHandler<Balances, TreasuryProportion, TreasuryAccount>
where
    Balances: frame_support::traits::fungible::Mutate<crate::AccountId, Balance = u128>,
    TreasuryProportion: Get<Perbill>,
    TreasuryAccount: Get<crate::AccountId>,
{
    /// Mints inflation tokens and splits them between rewards and treasury accounts
    pub fn mint_inflation(
        rewards_account: &crate::AccountId,
        total_amount: u128,
    ) -> sp_runtime::DispatchResult {
        use sp_runtime::traits::Zero;

        if total_amount.is_zero() {
            log::error!(
                target: "ext_validators_rewards",
                "Attempted to mint zero inflation"
            );
            return Err(sp_runtime::DispatchError::Other(
                "Cannot mint zero inflation",
            ));
        }

        // Get treasury allocation proportion
        let treasury_proportion = TreasuryProportion::get();

        // Calculate amounts
        let treasury_amount = treasury_proportion.mul_floor(total_amount);
        let rewards_amount = total_amount.saturating_sub(treasury_amount);

        log::debug!(
            target: "ext_validators_rewards",
            "Minting inflation: total={}, treasury={}, rewards={}",
            total_amount,
            treasury_amount,
            rewards_amount
        );

        // Mint rewards to the rewards account
        if !rewards_amount.is_zero() {
            Balances::mint_into(rewards_account, rewards_amount).map_err(|e| {
                log::error!(
                    target: "ext_validators_rewards",
                    "Failed to mint rewards inflation: {:?}",
                    e
                );
                sp_runtime::DispatchError::Other("Failed to mint rewards inflation")
            })?;
        }

        // Mint treasury portion if non-zero
        if !treasury_amount.is_zero() {
            let treasury_account = TreasuryAccount::get();
            Balances::mint_into(&treasury_account, treasury_amount).map_err(|e| {
                log::error!(
                    target: "ext_validators_rewards",
                    "Failed to mint treasury inflation: {:?}",
                    e
                );
                sp_runtime::DispatchError::Other("Failed to mint treasury inflation")
            })?;

            log::info!(
                target: "ext_validators_rewards",
                "Successfully minted {} to treasury from inflation",
                treasury_amount
            );
        }

        log::info!(
            target: "ext_validators_rewards",
            "Successfully minted {} total inflation ({} to rewards, {} to treasury)",
            total_amount,
            rewards_amount,
            treasury_amount
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use frame_support::{
        parameter_types,
        traits::fungible::{Inspect, Mutate, Unbalanced},
    };
    use sp_runtime::Perbill;
    use std::cell::RefCell;

    // Mock balances storage
    thread_local! {
        static TOTAL_ISSUANCE: RefCell<u128> = const { RefCell::new(0) };
        static BALANCES: RefCell<std::collections::HashMap<crate::AccountId, u128>> = RefCell::new(std::collections::HashMap::new());
    }

    struct MockBalances;

    impl Inspect<crate::AccountId> for MockBalances {
        type Balance = u128;

        fn total_issuance() -> Self::Balance {
            TOTAL_ISSUANCE.with(|v| *v.borrow())
        }

        fn minimum_balance() -> Self::Balance {
            0
        }

        fn balance(_who: &crate::AccountId) -> Self::Balance {
            0
        }

        fn total_balance(_who: &crate::AccountId) -> Self::Balance {
            0
        }

        fn reducible_balance(
            _who: &crate::AccountId,
            _preservation: frame_support::traits::tokens::Preservation,
            _force: frame_support::traits::tokens::Fortitude,
        ) -> Self::Balance {
            0
        }

        fn can_deposit(
            _who: &crate::AccountId,
            _amount: Self::Balance,
            _provenance: frame_support::traits::tokens::Provenance,
        ) -> frame_support::traits::tokens::DepositConsequence {
            frame_support::traits::tokens::DepositConsequence::Success
        }

        fn can_withdraw(
            _who: &crate::AccountId,
            _amount: Self::Balance,
        ) -> frame_support::traits::tokens::WithdrawConsequence<Self::Balance> {
            frame_support::traits::tokens::WithdrawConsequence::Success
        }
    }

    impl Unbalanced<crate::AccountId> for MockBalances {
        fn write_balance(
            _who: &crate::AccountId,
            _amount: Self::Balance,
        ) -> Result<Option<Self::Balance>, sp_runtime::DispatchError> {
            Ok(None)
        }

        fn set_total_issuance(amount: Self::Balance) -> () {
            TOTAL_ISSUANCE.with(|v| *v.borrow_mut() = amount);
        }

        fn handle_dust(_dust: frame_support::traits::fungible::Dust<crate::AccountId, Self>) {
            // No-op for tests
        }
    }

    impl Mutate<crate::AccountId> for MockBalances {
        fn mint_into(
            who: &crate::AccountId,
            amount: Self::Balance,
        ) -> Result<Self::Balance, sp_runtime::DispatchError> {
            BALANCES.with(|b| {
                let mut balances = b.borrow_mut();
                let balance = balances.entry(*who).or_insert(0);
                *balance = balance.saturating_add(amount);
            });
            TOTAL_ISSUANCE.with(|v| {
                let mut issuance = v.borrow_mut();
                *issuance = issuance.saturating_add(amount);
            });
            Ok(amount)
        }

        fn burn_from(
            _who: &crate::AccountId,
            _amount: Self::Balance,
            _preservation: frame_support::traits::tokens::Preservation,
            _precision: frame_support::traits::tokens::Precision,
            _force: frame_support::traits::tokens::Fortitude,
        ) -> Result<Self::Balance, sp_runtime::DispatchError> {
            Ok(0)
        }
    }

    fn treasury_account_id() -> crate::AccountId {
        crate::AccountId::from([1u8; 20])
    }

    parameter_types! {
        pub TreasuryAccountId: crate::AccountId = treasury_account_id();
    }

    fn reset_balances() {
        TOTAL_ISSUANCE.with(|v| *v.borrow_mut() = 0);
        BALANCES.with(|b| b.borrow_mut().clear());
    }

    fn get_balance(who: &crate::AccountId) -> u128 {
        BALANCES.with(|b| *b.borrow().get(who).unwrap_or(&0))
    }

    fn set_total_issuance(amount: u128) {
        TOTAL_ISSUANCE.with(|v| *v.borrow_mut() = amount);
    }

    mod era_inflation_provider {
        use super::*;

        parameter_types! {
            pub const AnnualRate5Percent: Perbill = Perbill::from_percent(5);
            pub const AnnualRate10Percent: Perbill = Perbill::from_percent(10);
            pub const SessionsPerEra: u32 = 6;
            pub const BlocksPerSession: u32 = 600;
            pub const MillisecsPerBlock: u64 = 6000;
        }

        type TestInflationProvider = ExternalRewardsEraInflationProvider<
            MockBalances,
            AnnualRate5Percent,
            SessionsPerEra,
            BlocksPerSession,
            MillisecsPerBlock,
        >;

        type TestInflationProvider10Pct = ExternalRewardsEraInflationProvider<
            MockBalances,
            AnnualRate10Percent,
            SessionsPerEra,
            BlocksPerSession,
            MillisecsPerBlock,
        >;

        #[test]
        fn returns_zero_when_total_issuance_is_zero() {
            reset_balances();
            set_total_issuance(0);
            assert_eq!(TestInflationProvider::get(), 0);
        }

        #[test]
        fn calculates_correct_per_era_inflation_5_percent() {
            reset_balances();
            // 1 billion tokens total issuance
            let total_issuance = 1_000_000_000_000_000_000u128;
            set_total_issuance(total_issuance);

            // With 6 sessions per era, 600 blocks per session, 6000ms per block:
            // millisecs_per_era = 6 * 600 * 6000 = 21,600,000ms = 6 hours
            // eras_per_year = 31,557,600,000 / 21,600,000 = 1461 eras
            // annual_inflation = 5% of 1B = 50M
            // per_era_inflation = 50M / 1461 ≈ 34,223,312

            let per_era_inflation = TestInflationProvider::get();

            // Expected: 5% of total_issuance / number of eras per year
            // With the calculation: total_issuance * rate * millisecs_per_era / MILLISECONDS_PER_YEAR
            let expected = 34_223_134_839_151u128;
            assert_eq!(per_era_inflation, expected);
        }

        #[test]
        fn calculates_correct_per_era_inflation_10_percent() {
            reset_balances();
            let total_issuance = 1_000_000_000_000_000_000u128;
            set_total_issuance(total_issuance);

            let per_era_inflation = TestInflationProvider10Pct::get();

            // Expected: 10% of total_issuance / number of eras per year
            let expected = 68_446_269_678_302u128;
            assert_eq!(per_era_inflation, expected);
        }

        #[test]
        fn scales_with_total_issuance() {
            reset_balances();

            // Test with 100M tokens
            set_total_issuance(100_000_000_000_000_000u128);
            let inflation_100m = TestInflationProvider::get();

            // Test with 1B tokens (10x more)
            set_total_issuance(1_000_000_000_000_000_000u128);
            let inflation_1b = TestInflationProvider::get();

            // Inflation should scale proportionally (allow 1 unit tolerance for rounding)
            let expected = inflation_100m * 10;
            assert!(
                inflation_1b >= expected.saturating_sub(1) && inflation_1b <= expected + 1,
                "Expected inflation to be ~{}, got {}",
                expected,
                inflation_1b
            );
        }

        #[test]
        fn handles_different_era_durations() {
            reset_balances();
            set_total_issuance(1_000_000_000_000_000_000u128);

            parameter_types! {
                pub const LongEraSessionsPerEra: u32 = 12; // Double the sessions
            }

            type LongEraProvider = ExternalRewardsEraInflationProvider<
                MockBalances,
                AnnualRate5Percent,
                LongEraSessionsPerEra,
                BlocksPerSession,
                MillisecsPerBlock,
            >;

            let standard_era = TestInflationProvider::get();
            let long_era = LongEraProvider::get();

            // Longer eras should have roughly 2x the inflation per era
            // (since there are half as many eras per year)
            assert!(long_era > standard_era * 19 / 10); // Allow some rounding tolerance
            assert!(long_era < standard_era * 21 / 10);
        }
    }

    mod inflation_handler {
        use super::*;

        parameter_types! {
            pub const TreasuryProportion20Pct: Perbill = Perbill::from_percent(20);
            pub const TreasuryProportion50Pct: Perbill = Perbill::from_percent(50);
            pub const TreasuryProportion0Pct: Perbill = Perbill::from_percent(0);
            pub const TreasuryProportion100Pct: Perbill = Perbill::from_percent(100);
        }

        type TestHandler = ExternalRewardsInflationHandler<
            MockBalances,
            TreasuryProportion20Pct,
            TreasuryAccountId,
        >;

        type TestHandler50Pct = ExternalRewardsInflationHandler<
            MockBalances,
            TreasuryProportion50Pct,
            TreasuryAccountId,
        >;

        type TestHandler0Pct = ExternalRewardsInflationHandler<
            MockBalances,
            TreasuryProportion0Pct,
            TreasuryAccountId,
        >;

        type TestHandler100Pct = ExternalRewardsInflationHandler<
            MockBalances,
            TreasuryProportion100Pct,
            TreasuryAccountId,
        >;

        #[test]
        fn rejects_zero_amount() {
            reset_balances();
            let rewards_account = crate::AccountId::from([2u8; 20]);

            let result = TestHandler::mint_inflation(&rewards_account, 0);
            assert!(result.is_err());
        }

        #[test]
        fn splits_inflation_correctly_20_percent_treasury() {
            reset_balances();
            let rewards_account = crate::AccountId::from([2u8; 20]);
            let total_inflation = 1_000_000u128;

            let result = TestHandler::mint_inflation(&rewards_account, total_inflation);
            assert!(result.is_ok());

            let rewards_balance = get_balance(&rewards_account);
            let treasury_balance = get_balance(&TreasuryAccountId::get());

            // 20% to treasury, 80% to rewards
            assert_eq!(treasury_balance, 200_000);
            assert_eq!(rewards_balance, 800_000);
            assert_eq!(rewards_balance + treasury_balance, total_inflation);
        }

        #[test]
        fn splits_inflation_correctly_50_percent_treasury() {
            reset_balances();
            let rewards_account = crate::AccountId::from([2u8; 20]);
            let total_inflation = 1_000_000u128;

            let result = TestHandler50Pct::mint_inflation(&rewards_account, total_inflation);
            assert!(result.is_ok());

            let rewards_balance = get_balance(&rewards_account);
            let treasury_balance = get_balance(&TreasuryAccountId::get());

            // 50% to treasury, 50% to rewards
            assert_eq!(treasury_balance, 500_000);
            assert_eq!(rewards_balance, 500_000);
        }

        #[test]
        fn handles_zero_percent_treasury() {
            reset_balances();
            let rewards_account = crate::AccountId::from([2u8; 20]);
            let total_inflation = 1_000_000u128;

            let result = TestHandler0Pct::mint_inflation(&rewards_account, total_inflation);
            assert!(result.is_ok());

            let rewards_balance = get_balance(&rewards_account);
            let treasury_balance = get_balance(&TreasuryAccountId::get());

            // 0% to treasury, 100% to rewards
            assert_eq!(treasury_balance, 0);
            assert_eq!(rewards_balance, total_inflation);
        }

        #[test]
        fn handles_hundred_percent_treasury() {
            reset_balances();
            let rewards_account = crate::AccountId::from([2u8; 20]);
            let total_inflation = 1_000_000u128;

            let result = TestHandler100Pct::mint_inflation(&rewards_account, total_inflation);
            assert!(result.is_ok());

            let rewards_balance = get_balance(&rewards_account);
            let treasury_balance = get_balance(&TreasuryAccountId::get());

            // 100% to treasury, 0% to rewards
            assert_eq!(treasury_balance, total_inflation);
            assert_eq!(rewards_balance, 0);
        }

        #[test]
        fn updates_total_issuance() {
            reset_balances();
            let rewards_account = crate::AccountId::from([2u8; 20]);
            let total_inflation = 1_000_000u128;

            let issuance_before = MockBalances::total_issuance();

            let result = TestHandler::mint_inflation(&rewards_account, total_inflation);
            assert!(result.is_ok());

            let issuance_after = MockBalances::total_issuance();

            assert_eq!(issuance_after, issuance_before + total_inflation);
        }

        #[test]
        fn handles_large_amounts() {
            reset_balances();
            let rewards_account = crate::AccountId::from([2u8; 20]);
            let total_inflation = u128::MAX / 2; // Very large amount

            let result = TestHandler::mint_inflation(&rewards_account, total_inflation);
            assert!(result.is_ok());

            let rewards_balance = get_balance(&rewards_account);
            let treasury_balance = get_balance(&TreasuryAccountId::get());

            // Verify proportions are maintained even with large numbers
            assert_eq!(rewards_balance + treasury_balance, total_inflation);
        }

        #[test]
        fn handles_rounding_correctly() {
            reset_balances();
            let rewards_account = crate::AccountId::from([2u8; 20]);
            // Amount that will cause rounding: 100 with 20% treasury
            let total_inflation = 100u128;

            let result = TestHandler::mint_inflation(&rewards_account, total_inflation);
            assert!(result.is_ok());

            let rewards_balance = get_balance(&rewards_account);
            let treasury_balance = get_balance(&TreasuryAccountId::get());

            // 20% of 100 = 20, rewards = 80
            assert_eq!(treasury_balance, 20);
            assert_eq!(rewards_balance, 80);
            assert_eq!(rewards_balance + treasury_balance, total_inflation);
        }
    }
}
