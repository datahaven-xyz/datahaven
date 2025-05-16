#!/usr/bin/env bash
set -eu

source scripts/set-env.sh

build_binary() {
    pushd $root_dir
    check_local_changes $root_dir

    # Check if datahaven binary exists
    if [ ! -f "target/release/datahaven-node" ] || [ $changes_detected -eq 1 ]; then
        echo "Building datahaven-node..."
        cargo build --release --features fast-runtime
    fi

    # Copy binary to output directory
    cp target/release/datahaven-node "$output_bin_dir"
    
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
    echo "Building DataHaven Binary"
    trap kill_all SIGINT SIGTERM EXIT
    build_binary
    echo "DataHaven Binary built"
fi