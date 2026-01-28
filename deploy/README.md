# DataHaven Deployment

This directory contains Helm charts and configurations for deploying DataHaven nodes and relayers to Kubernetes clusters across various environments (local development, staging, production).

## Directory Structure

```
deploy/
├── charts/                             # Helm charts
│   ├── node/                           # Node chart
│   │   └── datahaven/                  # DataHaven-specific node configurations
│   │       ├── dh-bootnode.yaml
│   │       └── dh-validator.yaml
│   └── relay/                          # Relay chart
│       └── snowbridge/                 # Snowbridge-specific relay configurations
│           ├── dh-beacon-relay.yaml    # Beacon chain relay
│           ├── dh-beefy-relay.yaml     # BEEFY consensus relay
│           └── dh-execution-relay.yaml # Execution layer relay
├── environments/                       # Environment-specific configurations
│   ├── local/                          # Local development environment
│   │   └── values.yaml
│   ├── stagenet/                       # Staging environment
│       └── values.yaml
└── scripts/                            # Deployment scripts
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
- **Purpose**: Local development and testing
- **Replicas**: 1 (bootnode + validator)
- **Resources**: Minimal (256Mi memory, 100m CPU)
- **Image**: Local Docker builds (`datahavenxyz/datahaven:local`)
- **Storage**: Small persistence (1-5Gi)
- **Network**: Single-node network with fast block times

### Stagenet
- **Purpose**: Pre-production testing and staging
- **Replicas**: 2+ validators
- **Resources**: Medium (512Mi memory, 200m CPU)
- **Image**: Stagenet tags from DockerHub
- **Storage**: 20Gi+ persistent volumes
- **Network**: Multi-validator network simulating production

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

### Relays (Snowbridge)
- **Beacon Relay**: Relays Ethereum beacon chain finality to DataHaven
- **BEEFY Relay**: Relays DataHaven BEEFY finality proofs to Ethereum
- **Execution Relay**: Relays Ethereum execution layer messages to DataHaven
- **Solochain Relayers**: Relays DataHaven chain operations to the DataHaven AVS

These relayers enable trustless bidirectional token and message passing between Ethereum and DataHaven.

## Development Workflow

1. **Local Testing**:
   ```bash
   cd test
   bun cli launch  # Starts local network without K8s
   ```

2. **K8s Deployment**:
   ```bash
   cd test
   bun cli deploy --e local
   ```

3. **Building Local Images**:
   ```bash
   cd test
   bun build:docker:operator  # Builds datahavenxyz/datahaven:local
   ```

4. **Updating Configurations**:
   - Modify `environments/<env>/values.yaml` for environment-specific changes
   - Modify chart templates in `charts/` for structural changes
   - Redeploy with `bun cli deploy --e <env>`

## Troubleshooting

- **Pods not starting**: Check logs with `kubectl logs <pod-name>`
- **Image pull failures**: Verify Docker registry access and image tags
- **Persistent volume issues**: Ensure storage class is available with `kubectl get sc`
- **Network connectivity**: Check service endpoints with `kubectl get svc`

For more detailed deployment and testing workflows, see the [test directory](../test/README.md).
