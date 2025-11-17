// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

use codec::{Decode, Encode, MaxEncodedLen};
use scale_info::TypeInfo;
use sp_arithmetic::traits::{BaseArithmetic, Unsigned, Zero};
use sp_core::U256;
use sp_runtime::{FixedU128, RuntimeDebug};
use sp_std::prelude::*;

#[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, MaxEncodedLen, TypeInfo)]
pub struct PricingParameters<Balance> {
    /// ETH/DOT exchange rate
    pub exchange_rate: FixedU128,
    /// Relayer rewards
    pub rewards: Rewards<Balance>,
    /// Ether (wei) fee per gas unit
    pub fee_per_gas: U256,
    /// Fee multiplier
    pub multiplier: FixedU128,
}

#[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, MaxEncodedLen, TypeInfo)]
pub struct Rewards<Balance> {
    /// Local reward in DOT
    pub local: Balance,
    /// Remote reward in ETH (wei)
    pub remote: U256,
}

#[derive(RuntimeDebug)]
pub struct InvalidPricingParameters;

impl<Balance> PricingParameters<Balance>
where
    Balance: BaseArithmetic + Unsigned + Copy,
{
    pub fn validate(&self) -> Result<(), InvalidPricingParameters> {
        if self.exchange_rate == FixedU128::zero() {
            return Err(InvalidPricingParameters);
        }
        if self.fee_per_gas == U256::zero() {
            return Err(InvalidPricingParameters);
        }
        if self.rewards.local.is_zero() {
            return Err(InvalidPricingParameters);
        }
        if self.rewards.remote.is_zero() {
            return Err(InvalidPricingParameters);
        }
        if self.multiplier == FixedU128::zero() {
            return Err(InvalidPricingParameters);
        }
        Ok(())
    }
}

/// Holder for fixed point number implemented in <https://github.com/PaulRBerg/prb-math>
#[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo)]
#[cfg_attr(feature = "std", derive(PartialEq))]
pub struct UD60x18(U256);

impl From<FixedU128> for UD60x18 {
    fn from(value: FixedU128) -> Self {
        // Both FixedU128 and UD60x18 have 18 decimal places
        let inner: u128 = value.into_inner();
        UD60x18(inner.into())
    }
}

impl UD60x18 {
    pub fn into_inner(self) -> U256 {
        self.0
    }
}
