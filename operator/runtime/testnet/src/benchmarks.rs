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

frame_benchmarking::define_benchmarks!(
    // System benchmarks
    [frame_system, SystemBench::<Runtime>]

    // Consensus pallets
    [pallet_mmr, Mmr]
    [pallet_beefy_mmr, BeefyMmrLeaf]

    // Substrate pallets
    [pallet_balances, Balances]
    // TODO: We cannot add due to EthereumSignature not being able
    // to sign with Sr25519. Can be implemented once we incorporate
    // https://github.com/paritytech/polkadot-sdk/pull/8179
    // [pallet_identity, Identity]
    // TODO: Benchmark does not work when MaxKeys is set < 1000.
    // See https://github.com/paritytech/polkadot-sdk/blob/180fcce69fbddfa1bde9830362d8026340b4b750/substrate/frame/im-online/src/benchmarking.rs#L32
    // [pallet_im_online, ImOnline]
    [pallet_multisig, Multisig]
    [pallet_preimage, Preimage]
    [pallet_scheduler, Scheduler]
    [pallet_timestamp, Timestamp]
    [pallet_treasury, Treasury]
    [pallet_utility, Utility]
    [pallet_sudo, Sudo]
    [pallet_transaction_payment, TransactionPayment]
    [pallet_parameters, Parameters]
    [pallet_message_queue, MessageQueue]

    // EVM pallets
    [pallet_evm, Evm]

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
