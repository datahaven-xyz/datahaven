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

//! Weight definitions for the DataHaven runtime.

// DataHaven pallets
pub mod pallet_datahaven_native_transfer;
pub mod pallet_external_validator_slashes;
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
pub mod pallet_babe;
pub mod pallet_balances;
pub mod pallet_beefy_mmr;
pub mod pallet_nfts;
pub mod pallet_evm;
pub mod pallet_grandpa;
pub mod pallet_im_online;
pub mod pallet_message_queue;
pub mod pallet_migrations;
pub mod pallet_mmr;
pub mod pallet_multisig;
pub mod pallet_parameters;
pub mod pallet_preimage;
pub mod pallet_proxy;
pub mod pallet_randomness;
pub mod pallet_safe_mode;
pub mod pallet_scheduler;
pub mod pallet_sudo;
pub mod pallet_timestamp;
pub mod pallet_transaction_payment;
pub mod pallet_treasury;
pub mod pallet_tx_pause;
pub mod pallet_utility;

// Governance pallets
pub mod pallet_collective_technical_committee;
pub mod pallet_collective_treasury_council;
pub mod pallet_conviction_voting;
pub mod pallet_referenda;
pub mod pallet_whitelist;
