#!/usr/bin/env bash
set -eu

source scripts/set-env.sh

config_relayer() {
    data_store_dir="$output_dir/relayer_data"
    mkdir -p $data_store_dir

    # Configure beefy relay
    jq \
        --arg k1 "$(address_for BeefyClient)" \
        --arg k2 "$(address_for GatewayProxy)" \
        --arg eth_endpoint_ws $eth_endpoint_ws \
        --arg eth_gas_limit $eth_gas_limit \
        --arg assetHubChannelID $ASSET_HUB_CHANNEL_ID \
        '
      .sink.contracts.BeefyClient = $k1
    | .sink.contracts.Gateway = $k2
    | .sink.ethereum.endpoint = $eth_endpoint_ws
    | .sink.ethereum."gas-limit" = $eth_gas_limit
    | ."on-demand-sync"."asset-hub-channel-id" = $assetHubChannelID
    ' \
        config/beefy-relay.json >$output_dir/beefy-relay.json

# Configure beacon relay
    local deneb_forked_epoch=0
    jq \
        --arg beacon_endpoint_http $beacon_endpoint_http \
        --argjson deneb_forked_epoch $deneb_forked_epoch \
        --arg relay_chain_endpoint $RELAYCHAIN_ENDPOINT \
        --arg data_store_dir $data_store_dir \
        '
      .source.beacon.endpoint = $beacon_endpoint_http
    | .source.beacon.spec.denebForkedEpoch = $deneb_forked_epoch
    | .sink.parachain.endpoint = $relay_chain_endpoint
    | .source.beacon.datastore.location = $data_store_dir
    ' \
        $assets_dir/beacon-relay.json >$output_dir/beacon-relay.json
}

start_relayer() {
    echo "Starting relay services"
    # Launch beefy relay
    (
        : >"$output_dir"/beefy-relay.log
        while :; do
            echo "Starting beefy relay at $(date)"
            "${relayer_bin}" run beefy \
                --config "$output_dir/beefy-relay.json" \
                --ethereum.private-key $beefy_relay_eth_key \
                >>"$output_dir"/beefy-relay.log 2>&1 || true
            sleep 20
        done
    ) &

    # Launch beacon relay
    (
        : >"$output_dir"/beacon-relay.log
        while :; do
            echo "Starting beacon relay at $(date)"
            "${relayer_bin}" run beacon \
                --config $output_dir/beacon-relay.json \
                --substrate.private-key "//BeaconRelay" \
                >>"$output_dir"/beacon-relay.log 2>&1 || true
            sleep 20
        done
    ) &
}

build_relayer() {
    echo "Building relayer"
    mage -d "$relayer_dir/relayer" build
    cp $relayer_bin "$output_bin_dir"
}

deploy_relayer() {
    check_tool && build_relayer && config_relayer && start_relayer
}

if [ -z "${from_start_services:-}" ]; then
    echo "start relayers only!"
    trap kill_all SIGINT SIGTERM EXIT
    deploy_relayer
    
    wait
fi