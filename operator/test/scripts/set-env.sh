#!/usr/bin/env bash

root_dir="$(realpath ..)"
export output_dir="${root_dir}/tmp"
export output_bin_dir="$output_dir/bin"
mkdir -p "$output_bin_dir"
export PATH="$output_bin_dir:$PATH"

scripts_dir="$root_dir/test/scripts"
zombienet_data_dir="$output_dir/zombienet"
ethereum_data_dir="$output_dir/ethereum"
assets_dir="$root_dir/test/assets"
helpers_dir="$root_dir/test/helpers"
artifacts_dir="$output_dir/artifacts"
mkdir -p "$artifacts_dir"
logs_dir="$artifacts_dir/logs"
mkdir -p "$logs_dir"

LODESTAR_TAG="v1.19.0"
GETH_TAG="v1.14.11"
lodestar_dir="$artifacts_dir/lodestar"
geth_dir="$artifacts_dir/geth"

relayer_dir="$artifacts_dir/datahaven-bridge-relayer"
relayer_bin="$relayer_dir/relayer/build/datahaven-bridge-relay"
web_dir="$relayer_dir/snowbridge/web"
snowbridge_contracts_dir="$relayer_dir/snowbridge/contracts"
test_helpers_dir="$web_dir/packages/test-helpers"

eth_network="${ETH_NETWORK:-localhost}"
eth_endpoint_http="${ETH_RPC_ENDPOINT:-http://127.0.0.1:8545}/${INFURA_PROJECT_ID:-}"
eth_endpoint_ws="${ETH_WS_ENDPOINT:-ws://127.0.0.1:8546}/${INFURA_PROJECT_ID:-}"
eth_gas_limit="${ETH_GAS_LIMIT:-5000000}"
etherscan_api_key="${ETHERSCAN_API_KEY:-}"
reset_ethereum="${RESET_ETHEREUM:-true}"

beefy_relay_eth_key="${BEEFY_RELAY_ETH_KEY:-0x935b65c833ced92c43ef9de6bff30703d941bd92a2637cb00cfad389f5862109}"
beacon_endpoint_http="${BEACON_HTTP_ENDPOINT:-http://127.0.0.1:9596}"
# Beacon relay account (//BeaconRelay 5GWFwdZb6JyU46e6ZiLxjGxogAHe8SenX76btfq8vGNAaq8c in testnet)
beacon_relayer_pub_key="${BEACON_RELAYER_PUB_KEY:-0xc46e141b5083721ad5f5056ba1cded69dce4a65f}"

export RELAYCHAIN_ENDPOINT=ws://127.0.0.1:30444
## Deployment key
export PRIVATE_KEY="${DEPLOYER_ETH_KEY:-0x4e9444a6efd6d42725a250b650a781da2737ea308c839eaccb0f7f3dbd2fea77}"
export ETHERSCAN_API_KEY="${ETHERSCAN_API_KEY:-0x0}"

export BRIDGE_HUB_PARAID="${BRIDGE_HUB_PARAID:-1002}"
export BRIDGE_HUB_AGENT_ID="${BRIDGE_HUB_AGENT_ID:-0x03170a2e7597b7b7e3d84c05391d139a62b157e78786d8c082f29dcf4c111314}"
export ASSET_HUB_PARAID="${ASSET_HUB_PARAID:-1000}"
export ASSET_HUB_AGENT_ID="${ASSET_HUB_AGENT_ID:-0x81c5ab2571199e3188135178f3c2c8e2d268be1313d029b30f534fa579b69b79}"
export ASSET_HUB_CHANNEL_ID="0xc173fac324158e77fb5840738a1a541f633cbec8884c6a601c567d2b376a0539"

export FOREIGN_TOKEN_DECIMALS=12
## BeefyClient
# For max safety delay should be MAX_SEED_LOOKAHEAD=4 epochs=4*8*6=192s
# but for rococo-local each session is only 20 slots=120s
# so relax somehow here just for quick test
# for production deployment ETH_RANDAO_DELAY should be configured in a more reasonable sense
export RANDAO_COMMIT_DELAY="${ETH_RANDAO_DELAY:-3}"
export RANDAO_COMMIT_EXP="${ETH_RANDAO_EXP:-3}"
export MINIMUM_REQUIRED_SIGNATURES="${MINIMUM_REQUIRED_SIGNATURES:-16}"

export REJECT_OUTBOUND_MESSAGES="${REJECT_OUTBOUND_MESSAGES:-false}"

## Fee
export REGISTER_TOKEN_FEE="${REGISTER_TOKEN_FEE:-200000000000000000}"
export CREATE_ASSET_FEE="${CREATE_ASSET_FEE:-100000000000}"
export RESERVE_TRANSFER_FEE="${RESERVE_TRANSFER_FEE:-100000000000}"
export RESERVE_TRANSFER_MAX_DESTINATION_FEE="${RESERVE_TRANSFER_MAX_DESTINATION_FEE:-10000000000000}"

## Pricing Parameters
export EXCHANGE_RATE="${EXCHANGE_RATE:-2500000000000000}"
export DELIVERY_COST="${DELIVERY_COST:-10000000000}"
export FEE_MULTIPLIER="${FEE_MULTIPLIER:-1000000000000000000}"

## Vault
export GATEWAY_PROXY_INITIAL_DEPOSIT="${GATEWAY_PROXY_INITIAL_DEPOSIT:-10000000000000000000}"

export GATEWAY_STORAGE_KEY="${GATEWAY_STORAGE_KEY:-0xaed97c7854d601808b98ae43079dafb3}"
export GATEWAY_PROXY_CONTRACT="${GATEWAY_PROXY_CONTRACT:-0x87d1f7fdfEe7f651FaBc8bFCB6E086C278b77A7d}"

address_for() {
    jq -r ".contracts.${1}.address" "$output_dir/contracts.json"
}

kill_all() {
    trap - SIGTERM
    kill 0
}

cleanup() {
    echo "Cleaning resource"
    rm -rf "$output_dir"
    mkdir "$output_dir"
    mkdir "$output_bin_dir"
    mkdir "$ethereum_data_dir"
}

check_port() {
    nc -z localhost $1 >/dev/null 2>&1
}

wait_for_port() {
    while ! check_port $1; do
        echo "Waiting for port $1 to be available..."
        sleep 10
    done
}

check_node_version() {
  local expected_version=$1

  if ! [ -x "$(command -v node)" ]; then
      echo 'Error: NodeJS is not installed.'
      exit 1
  fi

  node_version=$(node -v) # This does not seem to work in Git Bash on Windows.
  # "node -v" outputs version in the format "v18.12.1"
  node_version=${node_version:1} # Remove 'v' at the beginning
  node_version=${node_version%\.*} # Remove trailing ".*".
  node_version=${node_version%\.*} # Remove trailing ".*".
  node_version=$(($node_version)) # Convert the NodeJS version number from a string to an integer.
  if [ $node_version -lt "$expected_version" ]
  then
    echo "NodeJS version is lower than $expected_version (it is $node_version), Please update your node installation!"
    exit 1
  fi
}

vercomp() {
    if [[ $1 == $2 ]]
    then
        echo "Equal"
        return
    fi
    local IFS=.
    local i ver1=($1) ver2=($2)
    # fill empty fields in ver1 with zeros
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++))
    do
        ver1[i]=0
    done
    for ((i=0; i<${#ver1[@]}; i++))
    do
        if ((10#${ver1[i]:=0} > 10#${ver2[i]:=0}))
        then
            echo "Greater"
            return
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]}))
        then
            echo "Less"
            return
        fi
    done
}

check_go_version() {
  local expected_version=$1

  if ! [ -x "$(command -v go)" ]; then
        echo 'Error: Go is not installed.'
        exit 1
  fi

  go_version=$(go version | { read _ _ v _; echo ${v#go}; })
  op=$(vercomp "$go_version" "$1")

  if [[ $op = "Less" ]]
  then
      echo "Go version is lower than $expected_version (it is $go_version), Please update your go installation!"
      exit 1
  fi
}

check_tool() {
    if ! [ -x "$(command -v protoc)" ]; then
        echo 'Error: protoc is not installed.'
        exit 1
    fi
    if ! [ -x "$(command -v jq)" ]; then
        echo 'Error: jq is not installed.'
        exit 1
    fi
    if ! [ -x "$(command -v pnpm)" ]; then
        echo 'Error: pnpm is not installed.'
        exit 1
    fi
    if ! [ -x "$(command -v forge)" ]; then
        echo 'Error: foundry is not installed.'
        exit 1
    fi
    if ! [ -x "$(command -v yarn)" ]; then
        echo 'Error: yarn is not installed.'
        exit 1
    fi
    if [[ "$(uname)" == "Darwin" && -z "${IN_NIX_SHELL:-}" ]]; then
          if ! [ -x "$(command -v gdate)" ]; then
              echo 'Error: gdate (GNU Date) is not installed.'
              exit 1
          fi
      else
          if ! [ -x "$(command -v date)" ]; then
              echo 'Error: date is not installed.'
              exit 1
          fi
    fi

    check_node_version 20
    check_go_version 1.21.2
}
