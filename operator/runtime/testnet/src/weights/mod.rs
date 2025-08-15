// This file is part of DataHaven.

// Copyright (C) DataHaven Team.
// SPDX-License-Identifier: Apache-2.0

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//! Weight definitions for the DataHaven runtime.

// DataHaven pallets
pub mod pallet_datahaven_native_transfer;
pub mod pallet_external_validators;
pub mod pallet_external_validators_rewards;

// Snowbridge pallets
pub mod snowbridge_pallet_ethereum_client;
pub mod snowbridge_pallet_inbound_queue_v2;
pub mod snowbridge_pallet_outbound_queue_v2;
pub mod snowbridge_pallet_system;
pub mod snowbridge_pallet_system_v2;

// Substrate pallets
pub mod frame_system;
pub mod pallet_balances;
pub mod pallet_beefy_mmr;
pub mod pallet_evm;
//pub mod pallet_identity;
//pub mod pallet_im_online;
pub mod pallet_message_queue;
pub mod pallet_mmr;
pub mod pallet_multisig;
pub mod pallet_parameters;
pub mod pallet_preimage;
pub mod pallet_scheduler;
pub mod pallet_sudo;
pub mod pallet_timestamp;
pub mod pallet_transaction_payment;
pub mod pallet_treasury;
pub mod pallet_utility;

// Governance pallets
pub mod pallet_collective;
pub mod pallet_conviction_voting;
pub mod pallet_referenda;
pub mod pallet_whitelist;
