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
//!
//! ## Linear (Non-Compounding) Inflation Model
//!
//! DataHaven uses a **linear inflation model** where a fixed amount of tokens (500M HAVE)
//! is minted annually, regardless of the current total supply. This ensures:
//! - Consistent, predictable rewards for validators and stakers
//! - Publicly auditable emissions on the blockchain
//! - Non-compounding inflation (5% of genesis supply, not current supply)
//!
//! The annual inflation amount is divided equally across all eras in a year.

use crate::constants::time::MILLISECONDS_PER_YEAR;
use frame_support::traits::Get;
use sp_runtime::Perbill;

/// Generic era inflation provider that calculates per-era inflation based on a fixed annual amount.
///
/// This implements **linear (non-compounding) inflation** where the annual inflation amount
/// is fixed (e.g., 500M tokens), regardless of current total supply. This is in contrast to
/// compounding inflation where the rate is applied to the current supply.
///
/// # Type Parameters
/// * `AnnualAmount` - Get<u128> providing the fixed annual inflation amount in base units
/// * `SessionsPerEra` - Get<u32> providing the number of sessions per era
/// * `BlocksPerSession` - Get<u32> providing the number of blocks per session
/// * `MillisecsPerBlock` - Get<u64> providing milliseconds per block
///
/// # Calculation
/// 1. Retrieves the fixed annual inflation amount (e.g., 500M HAVE)
/// 2. Calculates eras per year based on era duration
/// 3. Divides annual inflation by eras per year to get per-era amount
///
/// # Example
/// With 500M annual inflation and ~1461 eras per year (6-hour eras):
/// Per-era inflation ≈ 342,231 HAVE
pub struct ExternalRewardsEraInflationProvider<
    AnnualAmount,
    SessionsPerEra,
    BlocksPerSession,
    MillisecsPerBlock,
>(
    core::marker::PhantomData<(
        AnnualAmount,
        SessionsPerEra,
        BlocksPerSession,
        MillisecsPerBlock,
    )>,
);

impl<AnnualAmount, SessionsPerEra, BlocksPerSession, MillisecsPerBlock> Get<u128>
    for ExternalRewardsEraInflationProvider<
        AnnualAmount,
        SessionsPerEra,
        BlocksPerSession,
        MillisecsPerBlock,
    >
where
    AnnualAmount: Get<u128>,
    SessionsPerEra: Get<u32>,
    BlocksPerSession: Get<u32>,
    MillisecsPerBlock: Get<u64>,
{
    fn get() -> u128 {
        use sp_runtime::traits::Zero;

        let annual_inflation_amount = AnnualAmount::get();
        if annual_inflation_amount.is_zero() {
            log::warn!(
                target: "ext_validators_rewards",
                "Annual inflation amount is zero, no inflation will be minted"
            );
            return 0;
        }

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

        // Calculate per-era inflation from the fixed annual amount
        // This is linear (non-compounding) - the same absolute amount each year
        let per_era_inflation = annual_inflation_amount.saturating_div(eras_per_year);

        log::info!(
            target: "ext_validators_rewards",
            "Linear inflation: {} annual, {} per-era ({} eras/year)",
            annual_inflation_amount,
            per_era_inflation,
            eras_per_year
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
    core::marker::PhantomData<(Balances, TreasuryProportion, TreasuryAccount)>,
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

    #[allow(dead_code)]
    fn set_total_issuance(amount: u128) {
        TOTAL_ISSUANCE.with(|v| *v.borrow_mut() = amount);
    }

    mod era_inflation_provider {
        use super::*;

        // Constants for linear inflation testing
        // 1 HAVE = 10^18 wei (18 decimals)
        const HAVE: u128 = 1_000_000_000_000_000_000;
        // 500 million HAVE annual inflation (5% of 10B genesis supply)
        const ANNUAL_500M_HAVE: u128 = 500_000_000 * HAVE;
        // 1 billion HAVE annual inflation (for comparison tests)
        const ANNUAL_1B_HAVE: u128 = 1_000_000_000 * HAVE;

        parameter_types! {
            // Fixed annual inflation amounts (linear, non-compounding)
            pub const AnnualInflation500M: u128 = ANNUAL_500M_HAVE;
            pub const AnnualInflation1B: u128 = ANNUAL_1B_HAVE;
            pub const ZeroInflation: u128 = 0;
            pub const SessionsPerEra: u32 = 6;
            pub const BlocksPerSession: u32 = 600;
            pub const MillisecsPerBlock: u64 = 6000;
        }

        type TestInflationProvider = ExternalRewardsEraInflationProvider<
            AnnualInflation500M,
            SessionsPerEra,
            BlocksPerSession,
            MillisecsPerBlock,
        >;

        type TestInflationProvider1B = ExternalRewardsEraInflationProvider<
            AnnualInflation1B,
            SessionsPerEra,
            BlocksPerSession,
            MillisecsPerBlock,
        >;

        type ZeroInflationProvider = ExternalRewardsEraInflationProvider<
            ZeroInflation,
            SessionsPerEra,
            BlocksPerSession,
            MillisecsPerBlock,
        >;

        #[test]
        fn returns_zero_when_annual_amount_is_zero() {
            // Linear inflation: zero annual amount means zero per-era inflation
            assert_eq!(ZeroInflationProvider::get(), 0);
        }

        #[test]
        fn calculates_correct_per_era_linear_inflation_500m() {
            // With 6 sessions per era, 600 blocks per session, 6000ms per block:
            // millisecs_per_era = 6 * 600 * 6000 = 21,600,000ms = 6 hours
            // eras_per_year = 31,557,600,000 / 21,600,000 = 1461 eras
            // annual_inflation = 500M HAVE (fixed, linear)
            // per_era_inflation = 500M HAVE / 1461 ≈ 342,231 HAVE

            let per_era_inflation = TestInflationProvider::get();

            // Expected: 500M HAVE / 1461 eras
            // = 500_000_000 * 10^18 / 1461 = 342,231,348,391,512,662,559,890 wei
            let expected = 342_231_348_391_512_662_559_890u128;
            assert_eq!(per_era_inflation, expected);
        }

        #[test]
        fn calculates_correct_per_era_linear_inflation_1b() {
            let per_era_inflation = TestInflationProvider1B::get();

            // Expected: 1B HAVE / 1461 eras (double the 500M case)
            // = 1_000_000_000 * 10^18 / 1461 = 684,462,696,783,025,325,119,780 wei
            let expected = 684_462_696_783_025_325_119_780u128;
            assert_eq!(per_era_inflation, expected);
        }

        #[test]
        fn linear_inflation_does_not_scale_with_total_issuance() {
            // This is the key test for linear (non-compounding) inflation:
            // The per-era inflation should be the SAME regardless of current total supply

            // Get inflation with any total issuance (it doesn't matter for linear inflation)
            let inflation = TestInflationProvider::get();

            // The inflation should always be 500M HAVE / 1461 eras
            // regardless of how many tokens are in circulation
            let expected = 342_231_348_391_512_662_559_890u128;
            assert_eq!(inflation, expected);

            // Verify it's approximately 342,231 HAVE per era
            // (500M HAVE / 1461 eras ≈ 342,231 HAVE)
            let per_era_in_have = inflation / HAVE;
            assert!(per_era_in_have >= 342_230 && per_era_in_have <= 342_232);
        }

        #[test]
        fn handles_different_era_durations() {
            parameter_types! {
                pub const LongEraSessionsPerEra: u32 = 12; // Double the sessions
            }

            type LongEraProvider = ExternalRewardsEraInflationProvider<
                AnnualInflation500M,
                LongEraSessionsPerEra,
                BlocksPerSession,
                MillisecsPerBlock,
            >;

            let standard_era = TestInflationProvider::get();
            let long_era = LongEraProvider::get();

            // Longer eras should have roughly 2x the inflation per era
            // (since there are half as many eras per year, but the annual total is the same)
            assert!(long_era > standard_era * 19 / 10); // Allow some rounding tolerance
            assert!(long_era < standard_era * 21 / 10);
        }

        #[test]
        fn annual_inflation_sums_correctly() {
            // Verify that per-era inflation * eras_per_year ≈ annual inflation
            let per_era = TestInflationProvider::get();

            // eras_per_year = 31,557,600,000 / 21,600,000 = 1461
            let eras_per_year: u128 = 1461;
            let calculated_annual = per_era * eras_per_year;

            // Should be very close to 500M HAVE (within rounding error)
            let annual_500m = ANNUAL_500M_HAVE;

            // Allow up to 1461 wei difference due to integer division rounding
            let diff = if calculated_annual > annual_500m {
                calculated_annual - annual_500m
            } else {
                annual_500m - calculated_annual
            };

            assert!(
                diff <= eras_per_year,
                "Annual sum differs by more than expected rounding error: diff={}, expected max={}",
                diff,
                eras_per_year
            );
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
