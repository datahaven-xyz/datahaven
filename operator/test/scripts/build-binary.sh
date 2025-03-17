#!/usr/bin/env bash
set -eu

source scripts/set-env.sh

build_binary() {
    pushd $root_dir
    check_local_changes $root_dir

    # Check if flamingo binary exists
    if [ ! -f "target/release/flamingo-node" ] || [ $changes_detected -eq 1 ]; then
        echo "Building flamingo-node..."
        cargo build --release --features fast-runtime
    fi

    # Copy binary to output directory
    cp target/release/flamingo-node "$output_bin_dir"
    
    popd
}

changes_detected=0
check_local_changes() {
    local dir=$1
    cd "$dir"
    if git status --untracked-files=no --porcelain . | grep .; then
        changes_detected=1
    fi
    cd -
}

if [ -z "${from_build_binary:-}" ]; then
    echo "Building Flamingo Binary"
    trap kill_all SIGINT SIGTERM EXIT
    build_binary
    echo "Flamingo Binary built"
fi