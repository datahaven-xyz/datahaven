#!/usr/bin/env bash
set -eu

source scripts/set-env.sh

write_beacon_checkpoint() {
    pushd $output_dir > /dev/null
    $relayer_bin generate-beacon-checkpoint --config $output_dir/beacon-relay.json --export-json > /dev/null
    cat $output_dir/dump-initial-checkpoint.json
    popd > /dev/null
}

wait_beacon_chain_ready() {
    local initial_beacon_block=""
    while [ -z "$initial_beacon_block" ] || [ "$initial_beacon_block" == "0x0000000000000000000000000000000000000000000000000000000000000000" ]; do
        initial_beacon_block=$(curl -s "$beacon_endpoint_http/eth/v1/beacon/states/head/finality_checkpoints" |
            jq -r '.data.finalized.root' || true)
        sleep 3
    done
}

submit_beacon_checkpoint() {
    pushd "$helpers_dir" > /dev/null
    pnpm submit-checkpoint "$1"
    popd > /dev/null
}

wait_beacon_chain_ready
# Get the checkpoint data
write_beacon_checkpoint
# Submit the checkpoint using the helper script
echo "Submitting checkpoint to the chain..."
submit_beacon_checkpoint "$output_dir/dump-initial-checkpoint.json"
