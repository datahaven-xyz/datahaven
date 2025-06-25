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

## Manual Deployment (Advanced)

For advanced users who want to deploy components individually or need more control:

### DataHaven Bootnode & Validators

#### Deploy individual components
```bash
cd deploy
helm upgrade --install dh-bootnode charts/node -f charts/node/datahaven/dh-bootnode.yaml -f ../environments/<env>/values.yaml -n kt-datahaven-<env>
helm upgrade --install dh-validator charts/node -f charts/node/datahaven/dh-validator.yaml -f ../environments/<env>/values.yaml -n kt-datahaven-<env>
```

#### Access validator node with Polkadot.js apps
```bash
kubectl port-forward svc/dh-validator-0 -n kt-datahaven-<env> 9955:9955
# Then visit: https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A9955#/explorer
```

#### Remove DataHaven components
```bash
helm uninstall dh-bootnode -n kt-datahaven-<env>
helm uninstall dh-validator -n kt-datahaven-<env>
```

#### Cleanup volumes
```bash
kubectl delete pvc -l app.kubernetes.io/instance=dh-bootnode -n kt-datahaven-<env>
kubectl delete pvc -l app.kubernetes.io/instance=dh-validator -n kt-datahaven-<env>
```

### Snowbridge Relayers

#### Create required secrets
```bash
kubectl create secret generic dh-beefy-relay-ethereum-key --from-literal=pvk="<ETHEREUM_PRIVATE_KEY>" -n kt-datahaven-<env>
kubectl create secret generic dh-beacon-relay-substrate-key --from-literal=pvk="<SUBSTRATE_PRIVATE_KEY>" -n kt-datahaven-<env>
kubectl create secret generic dh-execution-relay-substrate-key --from-literal=pvk="<SUBSTRATE_PRIVATE_KEY>" -n kt-datahaven-<env>
```

#### Deploy individual relay components
```bash
cd deploy
helm upgrade --install dh-beacon-relay charts/relay -f charts/relay/snowbridge/dh-beacon-relay.yaml -f ../environments/<env>/values.yaml -n kt-datahaven-<env>
helm upgrade --install dh-beefy-relay charts/relay -f charts/relay/snowbridge/dh-beefy-relay.yaml -f ../environments/<env>/values.yaml -n kt-datahaven-<env>
helm upgrade --install dh-execution-relay charts/relay -f charts/relay/snowbridge/dh-execution-relay.yaml -f ../environments/<env>/values.yaml -n kt-datahaven-<env>
```

#### Remove relay components
```bash
helm uninstall dh-beacon-relay -n kt-datahaven-<env>
helm uninstall dh-beefy-relay -n kt-datahaven-<env>
helm uninstall dh-execution-relay -n kt-datahaven-<env>
```

#### Delete relay secrets
```bash
kubectl delete secret dh-beefy-relay-ethereum-key -n kt-datahaven-<env>
kubectl delete secret dh-beacon-relay-substrate-key -n kt-datahaven-<env>
kubectl delete secret dh-execution-relay-substrate-key -n kt-datahaven-<env>
```