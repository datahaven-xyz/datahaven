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
│       └── values.yaml
└── scripts/                  # Deployment scripts
```

## Prerequisites

- Kubernetes cluster
- kubectl configured
- Helm 3.x installed

## Deployment

The recommended way to deploy is using the DataHaven CLI with the deploy command:

```bash
cd test && bun cli deploy --e <environment>
```

Example:
```bash
cd test && bun cli deploy --e local
```

Available environments:
- `local`: Local development environment (minimal resources)
- `stagenet`: Staging environment for pre-release testing

## Environment Details

### Local
- Single replica
- Minimal resources (256Mi memory, 100m CPU)
- Local image tags
- Small persistence size

### Stagenet
- 2 replicas
- Medium resources (512Mi memory, 200m CPU)
- Stagenet image tags
- 20Gi persistence size

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
- **Solochain Relayers**: Handle standalone chain operations and cross-chain communication
