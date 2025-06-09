# DataHaven Deployment

This directory contains all the necessary files and configurations for deploying DataHaven to various environments.

## Directory Structure

```
deploy/
├── charts/                    # Helm charts
│   ├── node/                 # Node chart
│   │   └── datahaven/       # DataHaven-specific node configurations
│   │       ├── dh-bootnode.yaml
│   │       └── dh-validator.yaml
│   └── relay/               # Relay chart
│       └── snowbridge/     # Snowbridge-specific relay configurations
│           ├── dh-beacon-relay.yaml    # Beacon chain relay
│           ├── dh-beefy-relay.yaml     # BEEFY consensus relay
│           └── dh-execution-relay.yaml # Execution layer relay
├── environments/             # Environment-specific configurations
│   ├── local/               # Local development environment
│   │   └── values.yaml
│   ├── stagenet/           # Staging environment
│   │   └── values.yaml
│   ├── testnet/            # Testing environment
│   │   └── values.yaml
│   └── mainnet/            # Production environment
│       └── values.yaml
└── scripts/                  # Deployment scripts
```

## Prerequisites

- Kubernetes cluster
- kubectl configured
- Helm 3.x installed

## Deployment

To deploy to a specific environment:

```bash
./scripts/deploy.sh <environment>
```

Example:
```bash
./scripts/deploy.sh local
```

Available environments:
- `local`: Local development environment (minimal resources)
- `stagenet`: Staging environment for pre-release testing
- `testnet`: Testing environment for network validation
- `mainnet`: Production environment

## Environment Details

### Local
- Single replica
- Minimal resources (256Mi memory, 100m CPU)
- Latest image tags
- Small persistence size

### Stagenet
- 2 replicas
- Medium resources (512Mi memory, 200m CPU)
- Stagenet image tags
- 20Gi persistence size

### Testnet
- 3 replicas
- Large resources (1Gi memory, 500m CPU)
- Testnet image tags
- 50Gi persistence size

### Mainnet
- 5 replicas
- Maximum resources (2Gi memory, 1000m CPU)
- Mainnet image tags
- 100Gi persistence size

## Configuration Structure

The configuration is organized in layers, with later layers overriding earlier ones:

1. Base Configurations (`charts/node/datahaven/`):
   - Base configurations for DataHaven nodes
   - Default values for bootnode and validator

2. Environment-Specific Configurations (`environments/<env>/values.yaml`):
   - Environment-specific settings
   - Resource configurations
   - Image tags
   - Replica counts
   - Storage configurations

The deployment process:
1. Loads base configurations from the respective chart directories
2. Applies environment-specific overrides from `environments/<env>/values.yaml`
3. Deploys the components with the merged configuration

## Components

### Nodes
- **Bootnode**: Entry point for the network
- **Validator**: Validates transactions and produces blocks

### Relays
- **Snowbridge Relays**: Handle cross-chain communication with Ethereum
  - **Beacon Relay**: Relays Ethereum beacon chain data
  - **BEEFY Relay**: Relays BEEFY consensus data for finality
  - **Execution Relay**: Relays Ethereum execution layer data

## Development

For local development:
1. Ensure you have a local Kubernetes cluster (e.g., Minikube, Kind)
2. Deploy using the local environment:
   ```bash
   ./scripts/deploy.sh local
   ```

## Troubleshooting

Common issues and solutions:

1. Namespace doesn't exist:
   ```bash
   kubectl create namespace kt-datahaven-<env>
   ```

2. Helm dependencies need updating:
   ```bash
   helm dependency update charts/node
   helm dependency update charts/relay
   ```

3. View deployment status:
   ```bash
   kubectl get all -n kt-datahaven-<env>
   ```

4. Preview deployment changes:
   ```bash
   ./scripts/deploy.sh <env> true
   ``` 