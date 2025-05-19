// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use super::*;

use crate::Pallet as InboundQueue;
use frame_benchmarking::v2::*;
use frame_support::assert_ok;
use frame_system::RawOrigin;
use snowbridge_pallet_inbound_queue_v2_fixtures::register_token::make_register_token_message;

#[benchmarks]
mod benchmarks {
    use super::*;

    #[benchmark]
    fn submit() -> Result<(), BenchmarkError> {
        let caller: T::AccountId = whitelisted_caller();

        let create_message = make_register_token_message();

        T::Helper::initialize_storage(
            create_message.finalized_header,
            create_message.block_roots_root,
        );

        #[block]
        {
            assert_ok!(InboundQueue::<T>::submit(
                RawOrigin::Signed(caller.clone()).into(),
                Box::new(create_message.event),
            ));
        }

        Ok(())
    }

    impl_benchmark_test_suite!(InboundQueue, crate::mock::new_tester(), crate::mock::Test);
}
