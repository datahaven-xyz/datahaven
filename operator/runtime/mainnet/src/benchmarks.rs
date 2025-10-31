// This is free and unencumbered software released into the public domain.
//
// Anyone is free to copy, modify, publish, use, compile, sell, or
// distribute this software, either in source code form or as a compiled
// binary, for any purpose, commercial or non-commercial, and by any
// means.
//
// In jurisdictions that recognize copyright laws, the author or authors
// of this software dedicate any and all copyright interest in the
// software to the public domain. We make this dedication for the benefit
// of the public at large and to the detriment of our heirs and
// successors. We intend this dedication to be an overt act of
// relinquishment in perpetuity of all present and future rights to this
// software under copyright law.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
// IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
// OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
// ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.
//
// For more information, please refer to <http://unlicense.org>

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
    [pallet_timestamp, Timestamp]
    [pallet_treasury, Treasury]
    [pallet_utility, Utility]
    [pallet_sudo, Sudo]
    [pallet_proxy, Proxy]
    [pallet_transaction_payment, TransactionPayment]
    [pallet_parameters, Parameters]
    [pallet_message_queue, MessageQueue]
    [pallet_safe_mode, SafeMode]
    [pallet_tx_pause, TxPause]

    // EVM pallets
    [pallet_evm, EVM]

    // Governance pallets
    [pallet_collective_technical_committee, TechnicalCommittee]
    [pallet_collective_treasury_council, TreasuryCouncil]
    [pallet_conviction_voting, ConvictionVoting]
    [pallet_referenda, Referenda]
    [pallet_whitelist, Whitelist]

    // DataHaven custom pallets
    [pallet_external_validators, ExternalValidators]
    [pallet_external_validators_rewards, ExternalValidatorsRewards]
    [pallet_datahaven_native_transfer, DataHavenNativeTransfer]

    // Snowbridge pallets
    [snowbridge_pallet_ethereum_client, EthereumBeaconClient]
    [snowbridge_pallet_inbound_queue_v2, EthereumInboundQueueV2]
    [snowbridge_pallet_outbound_queue_v2, EthereumOutboundQueueV2]
    [snowbridge_pallet_system, SnowbridgeSystem]
    [snowbridge_pallet_system_v2, SnowbridgeSystemV2]
);
