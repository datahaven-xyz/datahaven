// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use super::*;

use bridge_hub_common::AggregateMessageOrigin;
use codec::Encode;
use frame_benchmarking::v2::*;
use frame_support::{traits::Hooks, BoundedVec};
use snowbridge_outbound_queue_primitives::v2::{Command, Initializer, Message};
use sp_core::{H160, H256};

#[allow(unused_imports)]
use crate::Pallet as OutboundQueue;

#[benchmarks(
	where
		<T as Config>::MaxMessagePayloadSize: Get<u32>,
)]
mod benchmarks {
    use super::*;

    /// Build `Upgrade` message with `MaxMessagePayloadSize`, in the worst-case.
    fn build_message<T: Config>() -> (Message, OutboundMessage) {
        let commands = vec![Command::Upgrade {
            impl_address: H160::zero(),
            impl_code_hash: H256::zero(),
            initializer: Initializer {
                params: core::iter::repeat_with(|| 1_u8)
                    .take(<T as Config>::MaxMessagePayloadSize::get() as usize)
                    .collect(),
                maximum_required_gas: 200_000,
            },
        }];
        let message = Message {
            origin: Default::default(),
            id: H256::default(),
            fee: 0,
            commands: BoundedVec::try_from(commands.clone()).unwrap(),
        };
        let wrapped_commands: Vec<OutboundCommandWrapper> = commands
            .into_iter()
            .map(|command| OutboundCommandWrapper {
                kind: command.index(),
                gas: T::GasMeter::maximum_dispatch_gas_used_at_most(&command),
                payload: command.abi_encode(),
            })
            .collect();
        let outbound_message = OutboundMessage {
            origin: Default::default(),
            nonce: 1,
            topic: H256::default(),
            commands: wrapped_commands.clone().try_into().unwrap(),
        };
        (message, outbound_message)
    }

    /// Initialize `MaxMessagesPerBlock` messages need to be committed, in the worst-case.
    fn initialize_worst_case<T: Config>() {
        for _ in 0..T::MaxMessagesPerBlock::get() {
            initialize_with_one_message::<T>();
        }
    }

    /// Initialize with a single message
    fn initialize_with_one_message<T: Config>() {
        let (message, outbound_message) = build_message::<T>();
        let leaf = <T as Config>::Hashing::hash(&message.encode());
        MessageLeaves::<T>::append(leaf);
        Messages::<T>::append(outbound_message);
    }

    /// Benchmark for processing a message.
    #[benchmark]
    fn do_process_message() -> Result<(), BenchmarkError> {
        let (enqueued_message, _) = build_message::<T>();
        let origin = AggregateMessageOrigin::SnowbridgeV2([1; 32].into());
        let message = enqueued_message.encode();

        #[block]
        {
            let _ = OutboundQueue::<T>::do_process_message(origin, &message).unwrap();
        }

        assert_eq!(MessageLeaves::<T>::decode_len().unwrap(), 1);

        Ok(())
    }

    /// Benchmark for producing final messages commitment, in the worst-case
    #[benchmark]
    fn commit() -> Result<(), BenchmarkError> {
        initialize_worst_case::<T>();

        #[block]
        {
            OutboundQueue::<T>::commit();
        }

        Ok(())
    }

    /// Benchmark for producing commitment for a single message, used to estimate the delivery
    /// cost. The assumption is that cost of commit a single message is even higher than the average
    /// cost of commit all messages.
    #[benchmark]
    fn commit_single() -> Result<(), BenchmarkError> {
        initialize_with_one_message::<T>();

        #[block]
        {
            OutboundQueue::<T>::commit();
        }

        Ok(())
    }

    /// Benchmark for `on_initialize` in the worst-case
    #[benchmark]
    fn on_initialize() -> Result<(), BenchmarkError> {
        initialize_worst_case::<T>();
        #[block]
        {
            OutboundQueue::<T>::on_initialize(1_u32.into());
        }
        Ok(())
    }

    /// Benchmark the entire process flow in the worst-case. This can be used to determine
    /// appropriate values for the configuration parameters `MaxMessagesPerBlock` and
    /// `MaxMessagePayloadSize`
    #[benchmark]
    fn process() -> Result<(), BenchmarkError> {
        initialize_worst_case::<T>();
        let origin = AggregateMessageOrigin::SnowbridgeV2([1; 32].into());
        let (enqueued_message, _) = build_message::<T>();
        let message = enqueued_message.encode();

        #[block]
        {
            OutboundQueue::<T>::on_initialize(1_u32.into());
            for _ in 0..T::MaxMessagesPerBlock::get() {
                OutboundQueue::<T>::do_process_message(origin, &message).unwrap();
            }
            OutboundQueue::<T>::commit();
        }

        Ok(())
    }

    impl_benchmark_test_suite!(OutboundQueue, crate::mock::new_tester(), crate::mock::Test,);
}
