// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Pallet for committing outbound messages for delivery to Ethereum
//!
//! # Overview
//!
//! Messages come either from sibling parachains via XCM, or BridgeHub itself
//! via the `snowbridge-pallet-system-v2`:
//!
//! 1. `snowbridge_outbound_queue_primitives::v2::EthereumBlobExporter::deliver`
//! 2. `snowbridge_pallet_system_v2::Pallet::send`
//!
//! The message submission pipeline works like this:
//! 1. The message is first validated via the implementation for
//!    [`snowbridge_outbound_queue_primitives::v2::SendMessage::validate`]
//! 2. The message is then enqueued for later processing via the implementation for
//!    [`snowbridge_outbound_queue_primitives::v2::SendMessage::deliver`]
//! 3. The underlying message queue is implemented by [`Config::MessageQueue`]
//! 4. The message queue delivers messages to this pallet via the implementation for
//!    [`frame_support::traits::ProcessMessage::process_message`]
//! 5. The message is processed in `Pallet::do_process_message`:
//! 	a. Convert to `OutboundMessage`, and stored into the `Messages` vector storage
//! 	b. ABI-encode the `OutboundMessage` and store the committed Keccak256 hash in `MessageLeaves`
//! 	c. Generate `PendingOrder` with assigned nonce and fee attached, stored into the
//! 	   `PendingOrders` map storage, with nonce as the key
//! 	d. Increment nonce and update the `Nonce` storage
//! 6. At the end of the block, a merkle root is constructed from all the leaves in `MessageLeaves`.
//!    At the beginning of the next block, both `Messages` and `MessageLeaves` are dropped so that
//!    state at each block only holds the messages processed in that block.
//! 7. This merkle root is inserted into the parachain header as a digest item
//! 8. Offchain relayers are able to relay the message to Ethereum after:
//! 	a. Generating a merkle proof for the committed message using the `prove_message` runtime API
//! 	b. Reading the actual message content from the `Messages` vector in storage
//! 9. On the Ethereum side, the message root is ultimately the thing being verified by the Beefy
//!    light client.
//! 10. When the message has been verified and executed, the relayer will call the extrinsic
//!     `submit_delivery_receipt` to:
//! 	a. Verify the message with proof for a transaction receipt containing the event log,
//! 	   same as the inbound queue verification flow
//! 	b. Fetch the pending order by nonce of the message, pay reward with fee attached in the order
//!    	c. Remove the order from `PendingOrders` map storage by nonce
//!
//!
//! # Extrinsics
//!
//! * [`Call::submit_delivery_receipt`]: Submit delivery proof
//!
//! # Runtime API
//!
//! * `prove_message`: Generate a merkle proof for a committed message
#![cfg_attr(not(feature = "std"), no_std)]
extern crate alloc;

pub mod api;
pub mod process_message_impl;
pub mod send_message_impl;
pub mod types;
pub mod weights;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod test;

#[cfg(feature = "runtime-benchmarks")]
mod fixture;

use alloy_core::{
    primitives::{Bytes, FixedBytes},
    sol_types::SolValue,
};
use bridge_hub_common::{AggregateMessageOrigin, CustomDigestItem};
use codec::Decode;
use frame_support::{
    storage::StorageStreamIter,
    traits::{tokens::Balance, EnqueueMessage, Get, ProcessMessageError},
    weights::{Weight, WeightToFee},
};
use snowbridge_core::{BasicOperatingMode, TokenId};
use snowbridge_inbound_queue_primitives::RewardLedger;
use snowbridge_merkle_tree::merkle_root;
use snowbridge_outbound_queue_primitives::{
    v2::{
        abi::{CommandWrapper, OutboundMessageWrapper},
        DeliveryReceipt, GasMeter, Message, OutboundCommandWrapper, OutboundMessage,
    },
    EventProof, VerificationError, Verifier,
};
use sp_core::{H160, H256};
use sp_runtime::{
    traits::{BlockNumberProvider, Hash, MaybeEquivalence},
    DigestItem,
};
pub use types::{OnNewCommitment, PendingOrder, ProcessMessageOriginOf};
pub use weights::WeightInfo;
use xcm::latest::{Location, NetworkId};
type DeliveryReceiptOf<T> = DeliveryReceipt<<T as frame_system::Config>::AccountId>;

#[cfg(feature = "runtime-benchmarks")]
use snowbridge_beacon_primitives::BeaconHeader;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use alloc::boxed::Box;
    use alloc::vec::Vec;
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        type Hashing: Hash<Output = H256>;

        type MessageQueue: EnqueueMessage<AggregateMessageOrigin>;

        /// Measures the maximum gas used to execute a command on Ethereum
        type GasMeter: GasMeter;

        type Balance: Balance + From<u128>;

        /// Max bytes in a message payload
        #[pallet::constant]
        type MaxMessagePayloadSize: Get<u32>;

        /// Max number of messages processed per block
        #[pallet::constant]
        type MaxMessagesPerBlock: Get<u32>;

        /// Hook that is called whenever there is a new commitment.
        type OnNewCommitment: OnNewCommitment;

        /// Convert a weight value into a deductible fee based.
        type WeightToFee: WeightToFee<Balance = Self::Balance>;

        /// Weight information for extrinsics in this pallet
        type WeightInfo: WeightInfo;

        /// The verifier for delivery proof from Ethereum
        type Verifier: Verifier;

        /// Address of the Gateway contract
        #[pallet::constant]
        type GatewayAddress: Get<H160>;
        /// Reward discriminator type.
        type RewardKind: Parameter + MaxEncodedLen + Send + Sync + Copy + Clone;
        /// The default RewardKind discriminator for rewards allocated to relayers from this pallet.
        #[pallet::constant]
        type DefaultRewardKind: Get<Self::RewardKind>;
        /// Relayer reward payment.
        type RewardPayment: RewardLedger<Self::AccountId, Self::RewardKind, u128>;
        /// Ethereum NetworkId
        type EthereumNetwork: Get<NetworkId>;
        type ConvertAssetId: MaybeEquivalence<TokenId, Location>;
        #[cfg(feature = "runtime-benchmarks")]
        type Helper: BenchmarkHelper<Self>;
    }

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// Message has been queued and will be processed in the future
        MessageQueued {
            /// The message
            message: Message,
        },
        /// Message will be committed at the end of current block. From now on, to track the
        /// progress the message, use the `nonce` or the `id`.
        MessageAccepted {
            /// ID of the message
            id: H256,
            /// The nonce assigned to this message
            nonce: u64,
        },
        /// Some messages have been committed
        MessagesCommitted {
            /// Merkle root of the committed messages
            root: H256,
            /// number of committed messages
            count: u64,
        },
        /// Set OperatingMode
        OperatingModeChanged { mode: BasicOperatingMode },
        /// Delivery Proof received
        MessageDeliveryProofReceived { nonce: u64 },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// The message is too large
        MessageTooLarge,
        /// The pallet is halted
        Halted,
        /// Invalid Channel
        InvalidChannel,
        /// Invalid Envelope
        InvalidEnvelope,
        /// Message verification error
        Verification(VerificationError),
        /// Invalid Gateway
        InvalidGateway,
        /// Pending nonce does not exist
        InvalidPendingNonce,
        /// Reward payment failed
        RewardPaymentFailed,
    }

    /// Messages to be committed in the current block. This storage value is killed in
    /// `on_initialize`, so will not end up bloating state.
    ///
    /// Is never read in the runtime, only by offchain message relayers.
    /// Because of this, it will never go into the PoV of a block.
    ///
    /// Inspired by the `frame_system::Pallet::Events` storage value
    #[pallet::storage]
    #[pallet::unbounded]
    pub(super) type Messages<T: Config> = StorageValue<_, Vec<OutboundMessage>, ValueQuery>;

    /// Hashes of the ABI-encoded messages in the [`Messages`] storage value. Used to generate a
    /// merkle root during `on_finalize`. This storage value is killed in `on_initialize`, so state
    /// at each block contains only root hash of messages processed in that block. This also means
    /// it doesn't have to be included in PoV.
    #[pallet::storage]
    #[pallet::unbounded]
    pub(super) type MessageLeaves<T: Config> = StorageValue<_, Vec<H256>, ValueQuery>;

    /// The current nonce for the messages
    #[pallet::storage]
    pub type Nonce<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// Pending orders to relay
    #[pallet::storage]
    pub type PendingOrders<T: Config> =
        StorageMap<_, Twox64Concat, u64, PendingOrder<BlockNumberFor<T>>, OptionQuery>;

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        fn on_initialize(_: BlockNumberFor<T>) -> Weight {
            // Remove storage from previous block
            Messages::<T>::kill();
            MessageLeaves::<T>::kill();
            // Reserve some weight for the `on_finalize` handler
            T::WeightInfo::on_initialize() + T::WeightInfo::commit()
        }

        fn on_finalize(_: BlockNumberFor<T>) {
            Self::commit();
        }
    }

    #[cfg(feature = "runtime-benchmarks")]
    pub trait BenchmarkHelper<T> {
        fn initialize_storage(beacon_header: BeaconHeader, block_roots_root: H256);
    }

    #[pallet::call]
    impl<T: Config> Pallet<T>
    where
        T::AccountId: From<[u8; 32]>,
    {
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::submit_delivery_receipt())]
        pub fn submit_delivery_receipt(
            origin: OriginFor<T>,
            event: Box<EventProof>,
        ) -> DispatchResult {
            let relayer = ensure_signed(origin)?;

            // submit message to verifier for verification
            T::Verifier::verify(&event.event_log, &event.proof)
                .map_err(|e| Error::<T>::Verification(e))?;

            let receipt = DeliveryReceiptOf::<T>::try_from(&event.event_log)
                .map_err(|_| Error::<T>::InvalidEnvelope)?;

            Self::process_delivery_receipt(relayer, receipt)
        }
    }

    impl<T: Config> Pallet<T> {
        /// Generate a messages commitment and insert it into the header digest
        pub(crate) fn commit() {
            let count = MessageLeaves::<T>::decode_len().unwrap_or_default() as u64;
            if count == 0 {
                return;
            }

            // Create merkle root of messages
            let root = merkle_root::<<T as Config>::Hashing, _>(MessageLeaves::<T>::stream_iter());

            let digest_item: DigestItem = CustomDigestItem::SnowbridgeV2(root).into();

            // Insert merkle root into the header digest
            <frame_system::Pallet<T>>::deposit_log(digest_item);

            T::OnNewCommitment::on_new_commitment(root);

            Self::deposit_event(Event::MessagesCommitted { root, count });
        }

        /// Process a message delivered by the MessageQueue pallet
        pub(crate) fn do_process_message(
            _: ProcessMessageOriginOf<T>,
            mut message: &[u8],
        ) -> Result<bool, ProcessMessageError> {
            use ProcessMessageError::*;

            // Yield if the maximum number of messages has been processed this block.
            // This ensures that the weight of `on_finalize` has a known maximum bound.
            ensure!(
                MessageLeaves::<T>::decode_len().unwrap_or(0)
                    < T::MaxMessagesPerBlock::get() as usize,
                Yield
            );

            let nonce = Nonce::<T>::get();

            // Decode bytes into Message
            let Message {
                origin,
                id,
                fee,
                commands,
            } = Message::decode(&mut message).map_err(|_| Corrupt)?;

            // Convert it to OutboundMessage and save into Messages storage
            let commands: Vec<OutboundCommandWrapper> = commands
                .into_iter()
                .map(|command| OutboundCommandWrapper {
                    kind: command.index(),
                    gas: T::GasMeter::maximum_dispatch_gas_used_at_most(&command),
                    payload: command.abi_encode(),
                })
                .collect();
            let outbound_message = OutboundMessage {
                origin,
                nonce,
                topic: id,
                commands: commands.clone().try_into().map_err(|_| Corrupt)?,
            };
            Messages::<T>::append(outbound_message);

            // Convert it to an OutboundMessageWrapper (in ABI format), hash it using Keccak256 to
            // generate a committed hash, and store it in MessageLeaves storage which can be
            // verified on Ethereum later.
            let abi_commands: Vec<CommandWrapper> = commands
                .into_iter()
                .map(|command| CommandWrapper {
                    kind: command.kind,
                    gas: command.gas,
                    payload: Bytes::from(command.payload),
                })
                .collect();
            let committed_message = OutboundMessageWrapper {
                origin: FixedBytes::from(origin.as_fixed_bytes()),
                nonce,
                topic: FixedBytes::from(id.as_fixed_bytes()),
                commands: abi_commands,
            };
            let message_abi_encoded_hash =
                <T as Config>::Hashing::hash(&committed_message.abi_encode());
            MessageLeaves::<T>::append(message_abi_encoded_hash);

            // Generate `PendingOrder` with fee attached in the message, stored
            // into the `PendingOrders` map storage, with assigned nonce as the key.
            // When the message is processed on ethereum side, the relayer will send the nonce
            // back with delivery proof, only after that the order can
            // be resolved and the fee will be rewarded to the relayer.
            let order = PendingOrder {
                nonce,
                fee,
                block_number: frame_system::Pallet::<T>::current_block_number(),
            };
            <PendingOrders<T>>::insert(nonce, order);

            Nonce::<T>::set(nonce.checked_add(1).ok_or(Unsupported)?);

            Self::deposit_event(Event::MessageAccepted { id, nonce });

            Ok(true)
        }

        /// Process a delivery receipt from a relayer, to allocate the relayer reward.
        pub fn process_delivery_receipt(
            relayer: <T as frame_system::Config>::AccountId,
            receipt: DeliveryReceiptOf<T>,
        ) -> DispatchResult
        where
            <T as frame_system::Config>::AccountId: From<[u8; 32]>,
        {
            // Verify that the message was submitted from the known Gateway contract
            ensure!(
                T::GatewayAddress::get() == receipt.gateway,
                Error::<T>::InvalidGateway
            );

            let nonce = receipt.nonce;

            let order = <PendingOrders<T>>::get(nonce).ok_or(Error::<T>::InvalidPendingNonce)?;

            if order.fee > 0 {
                // Pay relayer reward
                T::RewardPayment::register_reward(&relayer, T::DefaultRewardKind::get(), order.fee);
            }

            <PendingOrders<T>>::remove(nonce);

            Self::deposit_event(Event::MessageDeliveryProofReceived { nonce });

            Ok(())
        }

        /// The local component of the message processing fees in native currency
        pub(crate) fn calculate_local_fee() -> T::Balance {
            T::WeightToFee::weight_to_fee(
                &T::WeightInfo::do_process_message().saturating_add(T::WeightInfo::commit_single()),
            )
        }
    }
}
