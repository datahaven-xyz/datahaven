// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Benchmarking setup for pallet-template
use super::*;

#[allow(unused)]
use crate::Pallet as SnowbridgeControl;
use frame_benchmarking::v2::*;
use frame_system::RawOrigin;
use snowbridge_core::eth;
use snowbridge_outbound_queue_primitives::OperatingMode;
use sp_runtime::SaturatedConversion;
use xcm::prelude::*;

#[benchmarks]
mod benchmarks {
    use super::*;

    #[benchmark]
    fn upgrade() -> Result<(), BenchmarkError> {
        let impl_address = H160::repeat_byte(1);
        let impl_code_hash = H256::repeat_byte(1);

        // Assume 256 bytes passed to initializer
        let params: Vec<u8> = (0..256).map(|_| 1u8).collect();

        #[extrinsic_call]
        _(
            RawOrigin::Root,
            impl_address,
            impl_code_hash,
            Some(Initializer {
                params,
                maximum_required_gas: 100000,
            }),
        );

        Ok(())
    }

    #[benchmark]
    fn set_operating_mode() -> Result<(), BenchmarkError> {
        #[extrinsic_call]
        _(RawOrigin::Root, OperatingMode::RejectingOutboundMessages);

        Ok(())
    }

    #[benchmark]
    fn set_pricing_parameters() -> Result<(), BenchmarkError> {
        let params = T::DefaultPricingParameters::get();

        #[extrinsic_call]
        _(RawOrigin::Root, params);

        Ok(())
    }

    #[benchmark]
    fn set_token_transfer_fees() -> Result<(), BenchmarkError> {
        #[extrinsic_call]
        _(RawOrigin::Root, 1, 1, eth(1));

        Ok(())
    }

    #[benchmark]
    fn register_token() -> Result<(), BenchmarkError> {
        let caller: T::AccountId = whitelisted_caller();

        let amount: BalanceOf<T> = (10_000_000_000_000_u128)
            .saturated_into::<u128>()
            .saturated_into();

        T::Token::mint_into(&caller, amount)?;

        // Use the current chain's location, which will properly reanchor
        // This represents the native token of the current chain
        let native_token_location: Location = Location::here();
        let asset = Box::new(VersionedLocation::from(native_token_location));
        let asset_metadata = AssetMetadata {
            name: "wnd".as_bytes().to_vec().try_into().unwrap(),
            symbol: "wnd".as_bytes().to_vec().try_into().unwrap(),
            decimals: 12,
        };

        #[extrinsic_call]
        _(RawOrigin::Root, asset, asset_metadata);

        Ok(())
    }

    impl_benchmark_test_suite!(
        SnowbridgeControl,
        crate::mock::new_test_ext(true),
        crate::mock::Test
    );
}
