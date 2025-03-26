#!/usr/bin/env bash
set -eu

from_start_services=true

# Source environment variables
source scripts/set-env.sh
source scripts/build-binary.sh

trap kill_all SIGINT SIGTERM EXIT

# 0. check required tools
echo "Check building tools"
check_tool

# 1. Buid Datahaven Binary
build_binary

# 2. Start Datahaven Nodes
echo "Starting Datahaven Nodes"
source scripts/deploy-datahaven.sh
deploy_datahaven

# 3. generate beefy checkpoint
echo "Generate beefy checkpoint"
source scripts/generate-beefy-checkpoint.sh
generate_beefy_checkpoint

# 4. Start Ethereum Nodes
# source scripts/build-ethereum.sh
# build_lodestar
# build_geth

# 5. Start Ethereum Nodes
source scripts/deploy-ethereum.sh
echo "Starting Ethereum Nodes"
deploy_local

# 6. Build Snowbridge Contracts
source scripts/build-contracts.sh
echo "Building Snowbridge Contracts"
build_snowbridge_contracts

# 7. Deploy Snowbridge Contracts
source scripts/deploy-contracts.sh
echo "Deploying Snowbridge Contracts"
deploy_snowbridge_contracts

wait