#!/bin/bash

# Unified entrypoint script for DataHaven nodes (validators and MSP)
# This script injects the required keys before starting the node
# Note: Not using 'set -e' because key injection may return errors we want to handle gracefully

KEYSTORE_PATH="/data/keystore"
NODE_NAME="${NODE_NAME:-alice}"
NODE_TYPE="${NODE_TYPE:-validator}"
SEED="${SEED:-bottom drive obey lake curtain smoke basket hold race lonely fit walk}"
CHAIN="${CHAIN:-stagenet-local}"

echo "🔑 Setting up ${NODE_TYPE} keys for ${NODE_NAME}..."

# Function to inject a key
inject_key() {
    local key_type=$1
    local scheme=$2
    local suri="${SEED}//${NODE_NAME^}"  # Capitalize first letter (Alice, Bob, Charlie)

    echo "Injecting ${key_type} key (${scheme})..."

    /usr/local/bin/datahaven-node key insert \
        --chain "${CHAIN}" \
        --keystore-path "${KEYSTORE_PATH}" \
        --key-type "${key_type}" \
        --scheme "${scheme}" \
        --suri "${suri}" 2>&1 | grep -v "SECRET SEED"

    echo "✅ ${key_type} key injected"
}

# Inject keys based on node type
if [ "${NODE_TYPE}" = "validator" ]; then
    echo "📝 Injecting validator keys (4 keys)..."
    # Based on deploy/charts/node/datahaven/dh-validator.yaml

    # GRANDPA (finality gadget) - ed25519
    inject_key "gran" "ed25519"

    # BABE (block authoring) - sr25519
    inject_key "babe" "sr25519"

    # ImOnline (validator heartbeat) - sr25519
    inject_key "imon" "sr25519"

    # BEEFY (bridge consensus) - ecdsa
    inject_key "beef" "ecdsa"

elif [ "${NODE_TYPE}" = "msp" ]; then
    echo "📝 Injecting MSP provider key (1 key)..."
    # Based on deploy/charts/node/storagehub/sh-mspnode.yaml

    # BCSV (storage provider) - ecdsa
    inject_key "bcsv" "ecdsa"

elif [ "${NODE_TYPE}" = "bsp" ]; then
    echo "📝 Injecting BSP provider key (1 key)..."
    # Based on deploy/charts/node/storagehub/sh-bspnode.yaml

    # BCSV (storage provider) - ecdsa
    inject_key "bcsv" "ecdsa"

else
    echo "⚠️  Unknown node type: ${NODE_TYPE}"
    echo "Supported types: validator, msp, bsp"
    exit 1
fi

echo "✅ All keys injected successfully"

# Change ownership of keystore to datahaven user
chown -R datahaven:datahaven "${KEYSTORE_PATH}"

# Change ownership of base path to datahaven user
if [ -d "/data" ]; then
    chown -R datahaven:datahaven /data
fi

echo "🚀 Starting ${NODE_TYPE} node as datahaven user..."

# Switch to datahaven user and start the node
exec su -s /bin/sh datahaven -c "exec /usr/local/bin/datahaven-node $*"
