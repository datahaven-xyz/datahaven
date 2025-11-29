# Snowbridge Solochain Relay

## Overview

The Solochain Relay handles DataHaven-specific operations, including relaying outbound messages from DataHaven to Ethereum and managing validator reward distributions. This relay is specific to the DataHaven solochain implementation of Snowbridge.

## Purpose

- Relay DataHaven outbound messages to Ethereum
- Submit messages to the Gateway contract on Ethereum
- Handle validator reward synchronization
- Enable cross-chain token transfers from DataHaven to Ethereum

## Direction

```
DataHaven → Ethereum (with bidirectional monitoring)
```

## Prerequisites

- Docker with `linux/amd64` platform support
- Access to DataHaven node WebSocket endpoint
- Access to Ethereum execution layer WebSocket endpoint
- Access to Ethereum consensus layer (beacon) HTTP endpoint
- Ethereum account with ETH for gas fees
- Substrate account for DataHaven operations
- Deployed BeefyClient, Gateway, and RewardsRegistry contracts on Ethereum
- Persistent storage for relay datastore

## Key Requirements

### Both Ethereum and Substrate Private Keys

The Solochain Relay requires **both** an Ethereum private key and a Substrate private key.

| Key Type | Purpose |
|----------|---------|
| Ethereum (secp256k1) | Sign Ethereum transactions to Gateway contract |
| Substrate (sr25519/ecdsa) | Sign DataHaven operations |

### Account Funding

| Account | Funding Required |
|---------|-----------------|
| Ethereum | 0.5+ ETH for gas fees |
| Substrate | 100+ HAVE for transaction fees |

## CLI Flags

### Required Flags

| Flag | Description |
|------|-------------|
| `--config <PATH>` | Path to the JSON configuration file |

### Ethereum Private Key Flags (One Required)

| Flag | Description |
|------|-------------|
| `--ethereum.private-key <KEY>` | Ethereum private key directly |
| `--ethereum.private-key-file <PATH>` | Path to file containing the private key |
| `--ethereum.private-key-id <ID>` | AWS Secrets Manager secret ID for the private key |

### Substrate Private Key Flag

| Flag | Description |
|------|-------------|
| `--substrate.private-key <KEY>` | Substrate private key URI |

## Configuration File

### Structure

```json
{
  "source": {
    "ethereum": {
      "endpoint": "ws://ethereum-node:8546"
    },
    "solochain": {
      "endpoint": "ws://datahaven-node:9944"
    },
    "contracts": {
      "BeefyClient": "0x4826533B4897376654Bb4d4AD88B7faFD0C98528",
      "Gateway": "0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf"
    },
    "beacon": {
      "endpoint": "http://beacon-node:4000",
      "stateEndpoint": "http://beacon-node:4000",
      "spec": {
        "syncCommitteeSize": 512,
        "slotsInEpoch": 32,
        "epochsPerSyncCommitteePeriod": 256,
        "forkVersions": {
          "deneb": 0,
          "electra": 0
        }
      },
      "datastore": {
        "location": "/relay-data",
        "maxEntries": 100
      }
    }
  },
  "sink": {
    "ethereum": {
      "endpoint": "ws://ethereum-node:8546"
    },
    "contracts": {
      "Gateway": "0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf"
    }
  },
  "schedule": {
    "id": 0,
    "totalRelayerCount": 1,
    "sleepInterval": 10
  },
  "reward-address": "0x4c5859f0F772848b2D91F1D83E2Fe57935348029",
  "ofac": {
    "enabled": false,
    "apiKey": ""
  }
}
```

### Configuration Parameters

#### Source Configuration

| Parameter | Description | Example |
|-----------|-------------|---------|
| `source.ethereum.endpoint` | Ethereum WebSocket endpoint | `ws://ethereum-node:8546` |
| `source.solochain.endpoint` | DataHaven WebSocket endpoint | `ws://datahaven-node:9944` |
| `source.contracts.BeefyClient` | BeefyClient contract address | `0x...` |
| `source.contracts.Gateway` | Gateway contract address | `0x...` |
| `source.beacon.*` | Beacon chain configuration | See beacon spec |

#### Sink Configuration

| Parameter | Description | Example |
|-----------|-------------|---------|
| `sink.ethereum.endpoint` | Ethereum WebSocket endpoint | `ws://ethereum-node:8546` |
| `sink.contracts.Gateway` | Gateway contract address | `0x...` |

#### Schedule Configuration

| Parameter | Description | Example |
|-----------|-------------|---------|
| `schedule.id` | Relayer instance ID (for multi-instance) | `0` |
| `schedule.totalRelayerCount` | Total number of relayer instances | `1` |
| `schedule.sleepInterval` | Seconds between message checks | `10` |

#### Rewards Configuration

| Parameter | Description | Example |
|-----------|-------------|---------|
| `reward-address` | RewardsRegistry contract address | `0x...` |

#### OFAC Compliance (Optional)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `ofac.enabled` | Enable OFAC sanctions screening | `false` |
| `ofac.apiKey` | API key for OFAC screening service | `""` |

## Contract Requirements

### Required Contracts

1. **BeefyClient**: Verifies BEEFY finality proofs on Ethereum
2. **Gateway**: Handles cross-chain message passing
3. **RewardsRegistry**: Manages validator reward distribution

### Get Contract Addresses

```typescript
const deployments = await parseDeploymentsFile();
const beefyClientAddress = deployments.BeefyClient;
const gatewayAddress = deployments.Gateway;
const rewardsRegistryAddress = deployments.RewardsRegistry;
```

## Running the Relay

### Docker Run

```bash
docker run -d \
  --name snowbridge-solochain-relay \
  --platform linux/amd64 \
  --add-host host.docker.internal:host-gateway \
  --network datahaven-network \
  -v $(pwd)/solochain-relay.json:/configs/solochain-relay.json:ro \
  -v $(pwd)/relay-data:/relay-data \
  --pull always \
  datahavenxyz/snowbridge-relay:latest \
  run solochain \
  --config /configs/solochain-relay.json \
  --ethereum.private-key "0x..." \
  --substrate.private-key "0x..."
```

### Docker Compose

```yaml
version: '3.8'

services:
  solochain-relay:
    image: datahavenxyz/snowbridge-relay:latest
    container_name: snowbridge-solochain-relay
    platform: linux/amd64
    restart: unless-stopped
    volumes:
      - ./configs/solochain-relay.json:/configs/solochain-relay.json:ro
      - solochain-relay-data:/relay-data
    command:
      - "run"
      - "solochain"
      - "--config"
      - "/configs/solochain-relay.json"
      - "--ethereum.private-key-file"
      - "/secrets/ethereum-key"
      - "--substrate.private-key"
      - "${SUBSTRATE_PRIVATE_KEY}"
    secrets:
      - ethereum-key
    environment:
      - SUBSTRATE_PRIVATE_KEY=${SUBSTRATE_PRIVATE_KEY}

volumes:
  solochain-relay-data:

secrets:
  ethereum-key:
    file: ./secrets/solochain-relay-ethereum-key
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: dh-solochain-relay
spec:
  serviceName: dh-solochain-relay
  replicas: 1
  selector:
    matchLabels:
      app: dh-solochain-relay
  template:
    metadata:
      labels:
        app: dh-solochain-relay
    spec:
      containers:
      - name: solochain-relay
        image: datahavenxyz/snowbridge-relay:latest
        imagePullPolicy: Always
        args:
          - "run"
          - "solochain"
          - "--config"
          - "/configs/solochain-relay.json"
          - "--ethereum.private-key-file"
          - "/secrets/dh-solochain-relay-ethereum-key"
          - "--substrate.private-key"
          - "$(SUBSTRATE_PRIVATE_KEY)"
        env:
        - name: SUBSTRATE_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: dh-solochain-relay-substrate-key
              key: private-key
        volumeMounts:
        - name: config
          mountPath: /configs
          readOnly: true
        - name: secrets
          mountPath: /secrets
          readOnly: true
        - name: relay-data
          mountPath: /relay-data
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
      volumes:
      - name: config
        configMap:
          name: solochain-relay-config
      - name: secrets
        secret:
          secretName: dh-solochain-relay-ethereum-key
  volumeClaimTemplates:
  - metadata:
      name: relay-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
```

## Message Flow

### DataHaven → Ethereum Message Flow

1. User submits outbound message on DataHaven
2. `EthereumOutboundQueue` pallet queues the message
3. Solochain Relay monitors for outbound messages
4. Relay constructs message proof using BEEFY finality
5. Relay submits proof to Gateway contract on Ethereum
6. Gateway verifies proof against BeefyClient
7. Message is executed on Ethereum

### Reward Distribution Flow

1. Validators earn rewards on DataHaven
2. Reward data is synchronized to RewardsRegistry contract
3. Operators can claim rewards on Ethereum

## Multi-Instance Deployment

For high-availability, deploy multiple Solochain Relayers:

```json
{
  "schedule": {
    "id": 0,
    "totalRelayerCount": 2,
    "sleepInterval": 10
  }
}
```

**Instance 0**:
```json
{ "schedule": { "id": 0, "totalRelayerCount": 2, "sleepInterval": 10 } }
```

**Instance 1**:
```json
{ "schedule": { "id": 1, "totalRelayerCount": 2, "sleepInterval": 10 } }
```

## Monitoring

### Health Checks

```bash
# View relay logs
docker logs -f snowbridge-solochain-relay

# Check for message processing
docker logs snowbridge-solochain-relay 2>&1 | grep -i "message\|submit\|reward"
```

### Key Metrics to Monitor

- Outbound message queue depth
- Message delivery success rate
- Reward synchronization status
- Ethereum and Substrate account balances
- BEEFY finality status

## Troubleshooting

### Issue: Messages Not Being Delivered

**Check**:
1. BeefyClient has recent commitments (BEEFY Relay running)
2. Gateway contract address is correct
3. Both Ethereum and Substrate endpoints are accessible
4. Account balances are sufficient

### Issue: Reward Synchronization Failures

**Check**:
1. RewardsRegistry contract address is correct
2. Ethereum account has sufficient gas
3. Reward data is available on DataHaven

### Issue: OFAC Screening Failures

**Check**:
1. API key is valid (if OFAC enabled)
2. Network connectivity to OFAC service
3. Consider disabling OFAC for testing environments

## Security Considerations

1. **Private Key Protection**: Secure both Ethereum and Substrate keys
2. **Dual Account Management**: Monitor balances on both chains
3. **Network Security**: Use secure connections (WSS) when possible
4. **Access Control**: Use dedicated accounts with minimal permissions
5. **OFAC Compliance**: Enable OFAC screening for production if required

## Dependencies

The Solochain Relay depends on:
- **BEEFY Relay**: Must be running to provide finality proofs
- **Beacon Relay**: Must be running for Ethereum light client state

Ensure both relays are operational before starting the Solochain Relay.

## Related Documentation

- [Beacon Relay](./snowbridge-beacon-relay.md)
- [BEEFY Relay](./snowbridge-beefy-relay.md)
- [Execution Relay](./snowbridge-execution-relay.md)
- [Snowbridge Documentation](https://docs.snowbridge.network)
- [DataHaven Snowbridge Repository](https://github.com/datahaven-xyz/snowbridge)
