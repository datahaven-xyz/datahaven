// Copyright 2025 DataHaven
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
// along with DataHaven.  If not, see <http://www.gnu.org/licenses/>.

// This module implements the StorageHub client traits for the runtime types.
// It is only compiled for native (std) builds to avoid pulling `shc-common` into the
// no_std Wasm runtime.
use shc_common::{
    traits::{ExtensionOperations, StorageEnableRuntime, TransactionHashProvider},
    types::{MinimalExtension, StorageEnableEvents, StorageHubEventsVec},
};
use sp_core::H256;

// Implement the client-facing runtime trait for the concrete runtime.
impl StorageEnableRuntime for crate::Runtime {
    type Address = crate::Address;
    type Call = crate::RuntimeCall;
    type Signature = crate::Signature;
    type Extension = crate::SignedExtra;
    type RuntimeApi = crate::RuntimeApi;
}

// Implement the transaction extension helpers for the concrete runtime's SignedExtra.
impl ExtensionOperations<crate::RuntimeCall, crate::Runtime> for crate::SignedExtra {
    type Hash = H256;

    fn from_minimal_extension(minimal: MinimalExtension) -> Self {
        (
            frame_system::CheckNonZeroSender::<crate::Runtime>::new(),
            frame_system::CheckSpecVersion::<crate::Runtime>::new(),
            frame_system::CheckTxVersion::<crate::Runtime>::new(),
            frame_system::CheckGenesis::<crate::Runtime>::new(),
            frame_system::CheckEra::<crate::Runtime>::from(minimal.era),
            frame_system::CheckNonce::<crate::Runtime>::from(minimal.nonce),
            frame_system::CheckWeight::<crate::Runtime>::new(),
            pallet_transaction_payment::ChargeTransactionPayment::<crate::Runtime>::from(
                minimal.tip,
            ),
            frame_metadata_hash_extension::CheckMetadataHash::<crate::Runtime>::new(false),
        )
    }
}

// Map the runtime event into the client-facing storage events enum.
impl Into<StorageEnableEvents<crate::Runtime>> for crate::RuntimeEvent {
    fn into(self) -> StorageEnableEvents<crate::Runtime> {
        match self {
            crate::RuntimeEvent::System(event) => StorageEnableEvents::System(event),
            crate::RuntimeEvent::Providers(event) => StorageEnableEvents::StorageProviders(event),
            crate::RuntimeEvent::ProofsDealer(event) => StorageEnableEvents::ProofsDealer(event),
            crate::RuntimeEvent::PaymentStreams(event) => {
                StorageEnableEvents::PaymentStreams(event)
            }
            crate::RuntimeEvent::FileSystem(event) => StorageEnableEvents::FileSystem(event),
            crate::RuntimeEvent::TransactionPayment(event) => {
                StorageEnableEvents::TransactionPayment(event)
            }
            crate::RuntimeEvent::Balances(event) => StorageEnableEvents::Balances(event),
            crate::RuntimeEvent::BucketNfts(event) => StorageEnableEvents::BucketNfts(event),
            crate::RuntimeEvent::Randomness(event) => StorageEnableEvents::Randomness(event),
            _ => StorageEnableEvents::Other(self),
        }
    }
}

// Implement transaction hash extraction for the EVM runtime.
impl TransactionHashProvider for crate::Runtime {
    fn build_transaction_hash_map(
        all_events: &StorageHubEventsVec<Self>,
    ) -> std::collections::HashMap<u32, H256> {
        let mut tx_map = std::collections::HashMap::new();

        for ev in all_events {
            if let frame_system::Phase::ApplyExtrinsic(extrinsic_index) = ev.phase {
                // Convert to StorageEnableEvents
                let storage_event: StorageEnableEvents<Self> = ev.event.clone().into();

                // Check if it's an `Executed` Ethereum event in the `Other` variant
                if let StorageEnableEvents::Other(runtime_event) = storage_event {
                    if let crate::RuntimeEvent::Ethereum(pallet_ethereum::Event::Executed {
                        transaction_hash,
                        ..
                    }) = runtime_event
                    {
                        tx_map.insert(extrinsic_index, transaction_hash);
                    }
                }
            }
        }

        tx_map
    }
}
