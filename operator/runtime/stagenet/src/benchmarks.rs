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

// TODO: Temporary workaround before upgrading to latest polkadot-sdk - fix https://github.com/paritytech/polkadot-sdk/pull/6435
#[allow(unused_imports)]
use pallet_collective as pallet_collective_treasury_council;
#[allow(unused_imports)]
use pallet_collective as pallet_collective_technical_committee;

frame_benchmarking::define_benchmarks!(
    // System benchmarks
    [frame_system, SystemBench::<Runtime>]

    // Consensus pallets
    [pallet_mmr, Mmr]
    [pallet_beefy_mmr, BeefyMmrLeaf]
    [pallet_babe, Babe]
    [pallet_grandpa, Grandpa]
    [pallet_randomness, Randomness]

    // Substrate pallets
    [pallet_balances, Balances]
    // FIXME: benchmarking identity fail
    // [pallet_identity, Identity]
    [pallet_im_online, ImOnline]
    [pallet_multisig, Multisig]
    [pallet_preimage, Preimage]
    [pallet_scheduler, Scheduler]
    [pallet_treasury, Treasury]
    [pallet_timestamp, Timestamp]
    [pallet_utility, Utility]
    [pallet_sudo, Sudo]
    [pallet_proxy, Proxy]
    [pallet_transaction_payment, TransactionPayment]
    [pallet_parameters, Parameters]
    [pallet_message_queue, MessageQueue]
    [pallet_safe_mode, SafeMode]
    [pallet_tx_pause, TxPause]

    // Governance pallets
    [pallet_collective_technical_committee, TechnicalCommittee]
    [pallet_collective_treasury_council, TreasuryCouncil]
    [pallet_conviction_voting, ConvictionVoting]
    [pallet_referenda, Referenda]
    [pallet_whitelist, Whitelist]

    // EVM pallets
    [pallet_evm, EVM]

    // DataHaven custom pallets
    [pallet_external_validators, ExternalValidators]
    [pallet_external_validators_rewards, ExternalValidatorsRewards]
    [pallet_external_validator_slashes, ExternalValidatorsSlashes]
    [pallet_datahaven_native_transfer, DataHavenNativeTransfer]

    // Snowbridge pallets
    [snowbridge_pallet_ethereum_client, EthereumBeaconClient]
    [snowbridge_pallet_inbound_queue_v2, EthereumInboundQueueV2]
    [snowbridge_pallet_outbound_queue_v2, EthereumOutboundQueueV2]
    [snowbridge_pallet_system, SnowbridgeSystem]
    [snowbridge_pallet_system_v2, SnowbridgeSystemV2]
);
