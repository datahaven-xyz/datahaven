#!/bin/bash

# Exit on error
set -e

# Default values
ENVIRONMENT=${1:-local}
DRY_RUN=${2:-false}
NAMESPACE="kt-datahaven-${ENVIRONMENT}"
VALUES_FILE="$(dirname "$0")/../environments/${ENVIRONMENT}/values.yaml"
NODE_CHART="$(dirname "$0")/../charts/node"
RELAY_CHART="$(dirname "$0")/../charts/relay"

# Validate environment
if [[ ! -f "${VALUES_FILE}" ]]; then
    echo "Error: Invalid environment '${ENVIRONMENT}'"
    echo "Available environments:"
    echo "- local (local development)"
    echo "- stagenet (staging environment)"
    echo "- testnet (testing environment)"
    echo "- mainnet (production environment)"
    exit 1
fi

# Validate namespace exists
if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
    echo "Creating namespace ${NAMESPACE}"
    kubectl create namespace "${NAMESPACE}"
fi

# Update dependencies
echo "Updating Helm dependencies..."
helm dependency update "${NODE_CHART}"
helm dependency update "${RELAY_CHART}"

# Deploy DataHaven nodes
echo "Deploying DataHaven nodes..."

# Deploy bootnode
echo "Deploying DataHaven bootnode..."
if [[ "${DRY_RUN}" == "true" ]]; then
    echo "=== Bootnode Configuration Preview ==="
    helm template dh-bootnode "${NODE_CHART}" \
        -f "${NODE_CHART}/datahaven/dh-bootnode.yaml" \
        -f "${VALUES_FILE}" \
        -n "${NAMESPACE}" \
        --debug
    echo "=== End Bootnode Configuration Preview ==="
else
    helm upgrade --install dh-bootnode "${NODE_CHART}" \
        -f "${NODE_CHART}/datahaven/dh-bootnode.yaml" \
        -f "${VALUES_FILE}" \
        -n "${NAMESPACE}" \
        --wait
fi

# Deploy validator
echo "Deploying DataHaven validator..."
if [[ "${DRY_RUN}" == "true" ]]; then
    echo "=== Validator Configuration Preview ==="
    helm template dh-validator "${NODE_CHART}" \
        -f "${NODE_CHART}/datahaven/dh-validator.yaml" \
        -f "${VALUES_FILE}" \
        -n "${NAMESPACE}" \
        --debug
    echo "=== End Validator Configuration Preview ==="
else
    helm upgrade --install dh-validator "${NODE_CHART}" \
        -f "${NODE_CHART}/datahaven/dh-validator.yaml" \
        -f "${VALUES_FILE}" \
        -n "${NAMESPACE}" \
        --wait
fi

# Deploy Snowbridge relays
echo "Deploying Snowbridge relays..."

# Deploy Beacon relay
echo "Deploying Snowbridge Beacon relay..."
if [[ "${DRY_RUN}" == "true" ]]; then
    echo "=== Snowbridge Beacon Relay Configuration Preview ==="
    helm template snowbridge-beacon-relay "${RELAY_CHART}" \
        -f "${RELAY_CHART}/snowbridge/dh-beacon-relay.yaml" \
        -f "${VALUES_FILE}" \
        -n "${NAMESPACE}" \
        --debug
    echo "=== End Snowbridge Beacon Relay Configuration Preview ==="
else
    helm upgrade --install snowbridge-beacon-relay "${RELAY_CHART}" \
        -f "${RELAY_CHART}/snowbridge/dh-beacon-relay.yaml" \
        -f "${VALUES_FILE}" \
        -n "${NAMESPACE}" \
        --wait
fi

# Deploy BEEFY relay
echo "Deploying Snowbridge BEEFY relay..."
if [[ "${DRY_RUN}" == "true" ]]; then
    echo "=== Snowbridge BEEFY Relay Configuration Preview ==="
    helm template snowbridge-beefy-relay "${RELAY_CHART}" \
        -f "${RELAY_CHART}/snowbridge/dh-beefy-relay.yaml" \
        -f "${VALUES_FILE}" \
        -n "${NAMESPACE}" \
        --debug
    echo "=== End Snowbridge BEEFY Relay Configuration Preview ==="
else
    helm upgrade --install snowbridge-beefy-relay "${RELAY_CHART}" \
        -f "${RELAY_CHART}/snowbridge/dh-beefy-relay.yaml" \
        -f "${VALUES_FILE}" \
        -n "${NAMESPACE}" \
        --wait
fi

# Deploy Execution relay
echo "Deploying Snowbridge Execution relay..."
if [[ "${DRY_RUN}" == "true" ]]; then
    echo "=== Snowbridge Execution Relay Configuration Preview ==="
    helm template snowbridge-execution-relay "${RELAY_CHART}" \
        -f "${RELAY_CHART}/snowbridge/dh-execution-relay.yaml" \
        -f "${VALUES_FILE}" \
        -n "${NAMESPACE}" \
        --debug
    echo "=== End Snowbridge Execution Relay Configuration Preview ==="
else
    helm upgrade --install snowbridge-execution-relay "${RELAY_CHART}" \
        -f "${RELAY_CHART}/snowbridge/dh-execution-relay.yaml" \
        -f "${VALUES_FILE}" \
        -n "${NAMESPACE}" \
        --wait
fi

if [[ "${DRY_RUN}" == "true" ]]; then
    echo "Dry run completed. No changes were made."
else
    echo "Deployment completed successfully!"
fi 