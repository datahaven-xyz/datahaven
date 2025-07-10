#!/bin/bash

# DataHaven Deployment Script
# 
# This script deploys DataHaven components using Helm.
#
# Usage:
#   ./deploy.sh [environment] [dry_run]
#
# Arguments:
#   environment - Target environment (local, stagenet) [default: local]
#   dry_run     - Preview changes without applying (true/false) [default: false]
#
# Examples:
#   ./deploy.sh local           # Deploy to local environment
#   ./deploy.sh stagenet        # Deploy to stagenet environment
#   ./deploy.sh stagenet true   # Preview stagenet deployment
#
# Configuration Files Structure:
#   environments/
#   ├── local/
#   │   ├── dh-bootnode.yaml
#   │   └── dh-validator.yaml
#   └── stagenet/
#       ├── dh-bootnode.yaml
#       └── dh-validator.yaml

# Exit on error
set -e

# Show usage if help requested
if [[ "${1}" == "--help" ]] || [[ "${1}" == "-h" ]]; then
    echo "DataHaven Deployment Script"
    echo ""
    echo "Usage: $0 [environment] [dry_run]"
    echo ""
    echo "Arguments:"
    echo "  environment  Target environment (local, stagenet) [default: local]"
    echo "  dry_run      Preview changes without applying (true/false) [default: false]"
    echo ""
    echo "Examples:"
    echo "  $0 local           # Deploy to local environment"
    echo "  $0 stagenet        # Deploy to stagenet environment"
    echo "  $0 stagenet true   # Preview stagenet deployment"
    echo ""
    echo "Available environments:"
    echo "  - local    (local development)"
    echo "  - stagenet (staging environment)"
    exit 0
fi

# Default values
ENVIRONMENT=${1:-local}
DRY_RUN=${2:-false}
NAMESPACE="kt-datahaven-${ENVIRONMENT}"
ENV_DIR="$(dirname "$0")/../environments/${ENVIRONMENT}"
NODE_CHART="$(dirname "$0")/../charts/node"
RELAY_CHART="$(dirname "$0")/../charts/relay"

# Per-component configuration files
BOOTNODE_VALUES="${ENV_DIR}/dh-bootnode.yaml"
VALIDATOR_VALUES="${ENV_DIR}/dh-validator.yaml"
BEACON_RELAY_VALUES="${ENV_DIR}/dh-beacon-relay.yaml"
BEEFY_RELAY_VALUES="${ENV_DIR}/dh-beefy-relay.yaml"
EXECUTION_RELAY_VALUES="${ENV_DIR}/dh-execution-relay.yaml"

# Validate environment
if [[ ! -d "${ENV_DIR}" ]]; then
    echo "Error: Invalid environment '${ENVIRONMENT}'"
    echo "Available environments:"
    echo "- local (local development)"
    echo "- stagenet (staging environment)"
    exit 1
fi

# Validate required component files exist
if [[ ! -f "${BOOTNODE_VALUES}" ]]; then
    echo "Error: Missing bootnode configuration file: ${BOOTNODE_VALUES}"
    exit 1
fi

if [[ ! -f "${VALIDATOR_VALUES}" ]]; then
    echo "Error: Missing validator configuration file: ${VALIDATOR_VALUES}"
    exit 1
fi

# Update namespace for local environment
if [[ "${ENVIRONMENT}" == "local" ]]; then
    NAMESPACE="kt-datahaven-local"
elif [[ "${ENVIRONMENT}" == "stagenet" ]]; then
    NAMESPACE="kt-datahaven-stagenet"
fi

# Validate namespace exists
if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
    echo "Creating namespace ${NAMESPACE}"
    kubectl create namespace "${NAMESPACE}"
fi

echo "======================================"
echo "DataHaven Deployment Script"
echo "======================================"
echo "Environment: ${ENVIRONMENT}"
echo "Namespace: ${NAMESPACE}"
echo "Dry Run: ${DRY_RUN}"
echo "Config Dir: ${ENV_DIR}"
echo "======================================"
echo ""

# Update dependencies
echo "📦 Updating Helm dependencies..."
helm dependency update "${NODE_CHART}" || echo "⚠️  Warning: Could not update node chart dependencies"
if [[ -d "${RELAY_CHART}" ]]; then
    helm dependency update "${RELAY_CHART}" || echo "⚠️  Warning: Could not update relay chart dependencies"
else
    echo "⚠️  Warning: Relay chart directory not found, skipping dependency update"
fi
echo ""

# Deploy DataHaven nodes
echo "🚀 Deploying DataHaven nodes..."

# Deploy bootnode
echo "🏁 Deploying DataHaven bootnode..."
if [[ "${DRY_RUN}" == "true" ]]; then
    echo "=== Bootnode Configuration Preview ==="
    helm template dh-bootnode "${NODE_CHART}" \
        -f "${NODE_CHART}/datahaven/dh-bootnode.yaml" \
        -f "${BOOTNODE_VALUES}" \
        -n "${NAMESPACE}" \
        --debug
    echo "=== End Bootnode Configuration Preview ==="
else
    helm upgrade --install dh-bootnode "${NODE_CHART}" \
        -f "${NODE_CHART}/datahaven/dh-bootnode.yaml" \
        -f "${BOOTNODE_VALUES}" \
        -n "${NAMESPACE}" \
        --wait
fi

# Deploy validator
echo "⚡ Deploying DataHaven validator..."
if [[ "${DRY_RUN}" == "true" ]]; then
    echo "=== Validator Configuration Preview ==="
    helm template dh-validator "${NODE_CHART}" \
        -f "${NODE_CHART}/datahaven/dh-validator.yaml" \
        -f "${VALIDATOR_VALUES}" \
        -n "${NAMESPACE}" \
        --debug
    echo "=== End Validator Configuration Preview ==="
else
    helm upgrade --install dh-validator "${NODE_CHART}" \
        -f "${NODE_CHART}/datahaven/dh-validator.yaml" \
        -f "${VALIDATOR_VALUES}" \
        -n "${NAMESPACE}" \
        --wait
fi

# Deploy Snowbridge relays (optional - only if files exist)
if [[ -f "${BEACON_RELAY_VALUES}" ]] && [[ -f "${RELAY_CHART}/snowbridge/dh-beacon-relay.yaml" ]]; then
    echo " 🥓 Deploying Snowbridge Beacon relay..."
    if [[ "${DRY_RUN}" == "true" ]]; then
        echo "=== Snowbridge Beacon Relay Configuration Preview ==="
        helm template dh-beacon-relay "${RELAY_CHART}" \
            -f "${RELAY_CHART}/snowbridge/dh-beacon-relay.yaml" \
            -f "${BEACON_RELAY_VALUES}" \
            -n "${NAMESPACE}" \
            --debug
        echo "=== End Snowbridge Beacon Relay Configuration Preview ==="
    else
        helm upgrade --install dh-beacon-relay "${RELAY_CHART}" \
            -f "${RELAY_CHART}/snowbridge/dh-beacon-relay.yaml" \
            -f "${BEACON_RELAY_VALUES}" \
            -n "${NAMESPACE}" \
            --wait
    fi
else
    echo "Skipping Beacon relay deployment (configuration files not found)"
fi

if [[ -f "${BEEFY_RELAY_VALUES}" ]] && [[ -f "${RELAY_CHART}/snowbridge/dh-beefy-relay.yaml" ]]; then
    echo "🥩 Deploying Snowbridge BEEFY relay..."
    if [[ "${DRY_RUN}" == "true" ]]; then
        echo "=== Snowbridge BEEFY Relay Configuration Preview ==="
        helm template dh-beefy-relay "${RELAY_CHART}" \
            -f "${RELAY_CHART}/snowbridge/dh-beefy-relay.yaml" \
            -f "${BEEFY_RELAY_VALUES}" \
            -n "${NAMESPACE}" \
            --debug
        echo "=== End Snowbridge BEEFY Relay Configuration Preview ==="
    else
        helm upgrade --install dh-beefy-relay "${RELAY_CHART}" \
            -f "${RELAY_CHART}/snowbridge/dh-beefy-relay.yaml" \
            -f "${BEEFY_RELAY_VALUES}" \
            -n "${NAMESPACE}" \
            --wait
    fi
else
    echo "Skipping BEEFY relay deployment (configuration files not found)"
fi

if [[ -f "${EXECUTION_RELAY_VALUES}" ]] && [[ -f "${RELAY_CHART}/snowbridge/dh-execution-relay.yaml" ]]; then
    echo "⚙️ Deploying Snowbridge Execution relay..."
    if [[ "${DRY_RUN}" == "true" ]]; then
        echo "=== Snowbridge Execution Relay Configuration Preview ==="
        helm template dh-execution-relay "${RELAY_CHART}" \
            -f "${RELAY_CHART}/snowbridge/dh-execution-relay.yaml" \
            -f "${EXECUTION_RELAY_VALUES}" \
            -n "${NAMESPACE}" \
            --debug
        echo "=== End Snowbridge Execution Relay Configuration Preview ==="
    else
        helm upgrade --install dh-execution-relay "${RELAY_CHART}" \
            -f "${RELAY_CHART}/snowbridge/dh-execution-relay.yaml" \
            -f "${EXECUTION_RELAY_VALUES}" \
            -n "${NAMESPACE}" \
            --wait
    fi
else
    echo "Skipping Execution relay deployment (configuration files not found)"
fi

if [[ "${DRY_RUN}" == "true" ]]; then
    echo "Dry run completed. No changes were made."
    echo ""
    echo "To deploy for real, run:"
    echo "  $0 ${ENVIRONMENT}"
else
    echo "Deployment completed successfully!"
    echo ""
    echo "Deployment Summary:"
    echo "- Environment: ${ENVIRONMENT}"
    echo "- Namespace: ${NAMESPACE}"
    echo "- Bootnode: dh-bootnode"
    echo "- Validator: dh-validator"
    echo ""
    echo "Check deployment status:"
    echo "  kubectl get pods -n ${NAMESPACE}"
    echo "  kubectl get ingress -n ${NAMESPACE}"
    echo ""
    echo "View logs:"
    echo "  kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/instance=dh-bootnode"
    echo "  kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/instance=dh-validator"
fi 