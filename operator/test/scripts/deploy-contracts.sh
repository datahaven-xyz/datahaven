#!/usr/bin/env bash
set -eu

source scripts/set-env.sh

deploy_command() {
    local deploy_script=$1
    local contract_dir=$2

    pushd "$contract_dir"
    if [ "$eth_network" != "localhost" ]; then
        forge script \
            --rpc-url $eth_endpoint_http \
            --broadcast \
            --verify \
            --etherscan-api-key $etherscan_api_key \
            -vvv \
            $deploy_script
    else
        forge script \
            --rpc-url $eth_endpoint_http \
            --broadcast \
            -vvv \
            $deploy_script
    fi
    popd
}

deploy_snowbridge_contracts()
{
    deploy_command scripts/DeployLocal.sol:DeployLocal $snowbridge_contracts_dir

    pushd "$test_helpers_dir"
    contract_dir=$snowbridge_contracts_dir pnpm generateContracts "$output_dir/contracts.json"
    popd

    echo "Exported contract artifacts: $output_dir/contracts.json"
}

if [ -z "${from_start_services:-}" ]; then
    echo "Deploying contracts"
    deploy_snowbridge_contracts
fi