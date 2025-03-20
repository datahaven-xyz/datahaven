#!/usr/bin/env bash
set -eu

source scripts/set-env.sh

zombienet_launch() {
    zombienet spawn config/zombie-datahaven-local.toml --provider=native --dir="$zombienet_data_dir" 2>&1 &
    echo "Waiting for nodes to spawn..."
    wait_for_port 30444
}

deploy_datahaven() {
    rm -rf $zombienet_data_dir && zombienet_launch
}

if [ -z "${from_start_services:-}" ]; then
    echo "start datahaven only!"
    trap kill_all SIGINT SIGTERM EXIT
    deploy_datahaven
    echo "datahaven nodes started"
    wait
fi