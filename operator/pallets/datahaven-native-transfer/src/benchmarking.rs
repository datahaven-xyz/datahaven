// Copyright (C) DataHaven.
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
// along with DataHaven.  If not, see <http://www.gnu.org/licenses/>

//! Benchmarking setup for pallet-datahaven-native-transfer

use super::*;
use frame_benchmarking::v2::*;
use frame_support::traits::{fungible::Mutate, EnsureOrigin};
use frame_system::RawOrigin;
use sp_core::H160;

// Helper function to create a funded account
fn create_funded_account<T: Config>(seed: u32, amount: BalanceOf<T>) -> T::AccountId {
    let account: T::AccountId = account("user", seed, seed);
    let _ = T::Currency::mint_into(&account, amount);
    account
}

// Helper function to create an Ethereum address
fn ethereum_address(seed: u8) -> H160 {
    H160::from_low_u64_be(seed as u64)
}

#[benchmarks(
    where
        T: Config,
        <T as Config>::PauseOrigin: EnsureOrigin<T::RuntimeOrigin>,
        BalanceOf<T>: From<u128>,
)]
mod benchmarks {
    use super::*;

    #[benchmark]
    fn transfer_to_ethereum() -> Result<(), BenchmarkError> {
        // Setup
        let existential_deposit: BalanceOf<T> = 1_000_000_000u128.into();
        let amount: BalanceOf<T> = (10_000 * 1_000_000_000u128).into(); // 10k units
        let fee: BalanceOf<T> = (100 * 1_000_000_000u128).into(); // 100 units
        
        // Sender needs: amount + fee + existential deposit to remain after transfers
        let total_needed = amount + fee + existential_deposit + existential_deposit;

        let sender = create_funded_account::<T>(1, total_needed);
        let recipient = ethereum_address(42);
        
        // Ensure fee recipient exists with existential deposit
        let _ = T::Currency::mint_into(&T::FeeRecipient::get(), existential_deposit);
        
        // Ensure Ethereum sovereign account exists with existential deposit
        let _ = T::Currency::mint_into(&T::EthereumSovereignAccount::get(), existential_deposit);

        // Ensure pallet is not paused
        Paused::<T>::put(false);

        #[extrinsic_call]
        transfer_to_ethereum(RawOrigin::Signed(sender.clone()), recipient, amount, fee);

        // Verify
        assert_eq!(
            T::Currency::balance(&T::EthereumSovereignAccount::get()),
            amount + existential_deposit
        );
        assert_eq!(T::Currency::balance(&T::FeeRecipient::get()), fee + existential_deposit);

        Ok(())
    }

    #[benchmark]
    fn pause() -> Result<(), BenchmarkError> {
        // Setup
        let pause_origin =
            T::PauseOrigin::try_successful_origin().map_err(|_| BenchmarkError::Weightless)?;

        // Ensure pallet is not paused initially
        Paused::<T>::put(false);

        #[extrinsic_call]
        pause(pause_origin as T::RuntimeOrigin);

        // Verify
        assert!(Paused::<T>::get());

        Ok(())
    }

    #[benchmark]
    fn unpause() -> Result<(), BenchmarkError> {
        // Setup
        let pause_origin =
            T::PauseOrigin::try_successful_origin().map_err(|_| BenchmarkError::Weightless)?;

        // Ensure pallet is paused initially
        Paused::<T>::put(true);

        #[extrinsic_call]
        unpause(pause_origin as T::RuntimeOrigin);

        // Verify
        assert!(!Paused::<T>::get());

        Ok(())
    }

    impl_benchmark_test_suite!(
        DataHavenNativeTransfer,
        crate::mock::new_test_ext(),
        crate::mock::Test
    );
}
