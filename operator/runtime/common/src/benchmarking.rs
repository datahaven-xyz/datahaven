// Copyright 2019-2025 Moonbeam Foundation.
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

use fp_account::AccountId20;
use frame_support::traits::Currency;
use pallet_treasury::ArgumentsFactory;
use sp_runtime::traits::Zero;

pub struct BenchmarkHelper;
impl ArgumentsFactory<(), AccountId20> for BenchmarkHelper {
    fn create_asset_kind(_seed: u32) -> () {
        ()
    }

    fn create_beneficiary(seed: [u8; 32]) -> AccountId20 {
        // Avoid generating a zero address
        if seed == [0; 32] {
            return AccountId20::from([1; 32]);
        }
        AccountId20::from(seed)
    }
}

pub struct StorageHubBenchmarking;
impl StorageHubBenchmarking {
    pub const SP_MIN_DEPOSIT: u128 = 100_000_000_000_000;
    pub const BUCKET_DEPOSIT: u128 = 100_000_000_000_000;
    // Keep the benchmark challenge period within u32 limits.
    pub const STAKE_TO_CHALLENGE_PERIOD: u128 = 3_000_000_000_000_000;
    // Derived from StakeToChallengePeriod / SP_MIN_DEPOSIT + tolerance + 1.
    pub const CHECKPOINT_CHALLENGE_PERIOD: u32 = 81;

    pub fn ensure_treasury_account<AccountId, Balance, CurrencyT>(account: AccountId) -> AccountId
    where
        Balance: From<u128> + Zero,
        CurrencyT: Currency<AccountId, Balance = Balance>,
    {
        if CurrencyT::free_balance(&account).is_zero() {
            let _ = CurrencyT::deposit_creating(&account, 1u128.into());
        }
        account
    }
}
