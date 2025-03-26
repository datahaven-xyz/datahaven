#!/bin/bash

# Exit on any error
set -e
source scripts/set-env.sh

build_snowbridge_contracts() {  
    if [ -d "$relayer_dir" ]; then
        echo "Snowbridge contracts seem to be already downloaded. Skipping downloading again"
    else
        echo "Downloading datahaven-bridge-relayer"
        git clone --recurse-submodules https://github.com/Moonsong-Labs/datahaven-bridge-relayer $relayer_dir
    fi

    pushd $snowbridge_contracts_dir
    forge build
    popd
}

if [ -z "${from_start_services:-}" ]; then
    echo "Building snowbridge contracts"
    build_snowbridge_contracts
fi