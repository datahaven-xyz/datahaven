#!/usr/bin/env bash
set -eu

source scripts/set-env.sh

generate_beefy_checkpoint()
{
    pushd "$test_helpers_dir"
    pnpm install
    RELAYCHAIN_ENDPOINT=ws://127.0.0.1:30444 pnpm generateBeefyCheckpoint
    popd
}

if [ -z "${from_start_services:-}" ]; then
    echo "Generating Beefy Checkpoint"
    generate_beefy_checkpoint
    wait
fi