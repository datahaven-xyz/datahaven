#!/usr/bin/env bash
set -eu
source scripts/set-env.sh

build_lodestar() {
    if [ -d "$lodestar_dir" ]; then
        echo "Lodestar seems to be already downloaded. Skipping downloading again"
    else
        echo "Downloading Lodestar"
        git clone https://github.com/ChainSafe/lodestar $lodestar_dir
        pushd $lodestar_dir
        git fetch && git checkout $LODESTAR_TAG
        popd
    fi

    echo "Building Lodestar"
    pushd $lodestar_dir
    yarn install
    yarn build
    popd
}

build_geth() {
    echo "Downloading geth"

    if [ -d "$geth_dir" ]; then
        echo "Geth seems to be already downloaded. Skipping downloading"
    else
        git clone https://github.com/ethereum/go-ethereum.git $geth_dir
        pushd $geth_dir
        git fetch && git checkout $GETH_TAG
        popd
    fi

    echo "Building Geth"
    pushd $geth_dir
    GOBIN=$output_bin_dir go install ./cmd/geth
    GOBIN=$output_bin_dir go install ./cmd/abigen
    popd
}

echo "Building ethereum nodes"
build_lodestar
build_geth
echo "ethereum nodes built!"