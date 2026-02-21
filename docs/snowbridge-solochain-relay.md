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

## Hardware Requirements

The Solochain Relay handles more operations than other relays (bidirectional messaging + rewards), so additional resources are recommended.

### Specifications

| Component | Requirement |
|-----------|-------------|
| **CPU** | 4 cores |
| **RAM** | 8 GB |
| **Storage (Datastore)** | 20 GB SSD |
| **Network** | 100 Mbit/s symmetric |

### Important Considerations

- **Persistent storage**: The relay maintains a local datastore to track processed messages and reward operations; use persistent volumes in containerized deployments
- **Bidirectional operations**: Handles both DataHaven → Ethereum messages and reward synchronization
- **Network connectivity**: Requires connections to Ethereum (execution + beacon) and DataHaven nodes simultaneously
- **Higher resource usage**: May use more resources during high message volumes or reward distribution periods
- **Reliable RPC endpoints**: Use enterprise-grade or self-hosted nodes for production deployments

## RPC Endpoint Requirements

### Ethereum Execution Layer

The relay requires access to a **stable, reliable Ethereum WebSocket endpoint**. Endpoint instability or downtime will prevent the relay from functioning correctly.

**Recommended providers:**
- Self-hosted execution node (Geth, Nethermind, Besu, Erigon)
- [Dwellir](https://www.dwellir.com/)
- [Chainstack](https://chainstack.com/)
- [QuickNode](https://www.quicknode.com/)
- [Alchemy](https://www.alchemy.com/)

**Requirements:**
- WebSocket support (WSS for production)
- Full event log access for contract monitoring
- Low latency (< 100ms recommended)
- High availability (99.9%+ uptime)

### Beacon Node API

The relay also requires access to the Ethereum Beacon API for finality verification.

**Recommended providers:**
- Self-hosted beacon node (Lighthouse, Prysm, Teku, Nimbus, Lodestar)
- Same providers as execution layer (with beacon API support)

**Requirements:**
- Full beacon API support (`/eth/v1/beacon/*` endpoints)
- State endpoint access for sync committee data
- Low latency (< 100ms recommended)

### DataHaven Node

- Full node or archive node with WebSocket endpoint
- Low latency connection for monitoring outbound messages

## Relay Redundancy

### Why Redundancy Matters

Running multiple relay instances provides fault tolerance and ensures continuous bridge operation even if one relay fails. The Gateway contract and on-chain pallets handle duplicate submissions gracefully—only the first valid submission is processed.

### Configuring Redundant Relays

Deploy multiple relay instances pointing to **different RPC providers** for maximum fault tolerance. Use the `schedule` configuration to coordinate between instances:

**Instance 1 (Primary):**
```json
{
  "source": {
    "ethereum": {
      "endpoint": "wss://eth-provider-a.example.com"
    },
    "solochain": {
      "endpoint": "wss://datahaven-rpc-1.example.com"
    },
    "beacon": {
      "endpoint": "https://beacon-provider-a.example.com"
    }
  },
  "sink": {
    "ethereum": {
      "endpoint": "wss://eth-provider-a.example.com"
    }
  },
  "schedule": {
    "id": 0,
    "totalRelayerCount": 2,
    "sleepInterval": 10
  }
}
```

**Instance 2 (Backup):**
```json
{
  "source": {
    "ethereum": {
      "endpoint": "wss://eth-provider-b.example.com"
    },
    "solochain": {
      "endpoint": "wss://datahaven-rpc-2.example.com"
    },
    "beacon": {
      "endpoint": "https://beacon-provider-b.example.com"
    }
  },
  "sink": {
    "ethereum": {
      "endpoint": "wss://eth-provider-b.example.com"
    }
  },
  "schedule": {
    "id": 1,
    "totalRelayerCount": 2,
    "sleepInterval": 10
  }
}
```

### Best Practices for Redundancy

1. **Use different RPC providers**: Avoid single points of failure by using different Ethereum and DataHaven node providers for each relay instance
2. **Geographic distribution**: Deploy relays in different regions/data centers
3. **Independent infrastructure**: Run relays on separate machines or Kubernetes nodes
4. **Separate funding accounts**: Use different relay accounts (both Ethereum and Substrate) to avoid nonce conflicts
5. **Coordinate with schedule IDs**: Use unique `schedule.id` values for each instance
6. **Monitor all instances**: Set up alerting for each relay independently

## Key Requirements

### Both Ethereum and Substrate Private Keys

The Solochain Relay requires **both** an Ethereum private key and a Substrate private key.

| Key Type | Purpose |
|----------|---------|
| Ethereum (secp256k1) | Sign Ethereum transactions to Gateway contract |
| Substrate (sr25519/ecdsa) | Sign DataHaven operations |

### Account Funding

The Solochain Relay requires funded accounts on both Ethereum and DataHaven to operate continuously.

| Account | Minimum | Recommended | Purpose |
|---------|---------|-------------|---------|
| Ethereum | 0.5 ETH | 2.0 ETH | Gas fees for Gateway contract calls |
| Substrate (HAVE) | 100 HAVE | 500 HAVE | Transaction fees on DataHaven |

For detailed operating cost estimates, annual forecasts, and cost optimization strategies, see the [Relay Operating Costs](./snowbridge-relay-costs.md) guide.

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

For high-availability or load distribution, multiple Solochain Relayers can be deployed using the `schedule` configuration to coordinate between instances.

### Schedule Configuration Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `schedule.id` | `number` | Unique identifier for this relay instance (0-indexed). |
| `schedule.totalRelayerCount` | `number` | Total number of relay instances in the deployment. All instances must use the same value. |
| `schedule.sleepInterval` | `number` | Seconds to wait between polling for new messages. Lower values = faster detection, higher resource usage. |

### How Multi-Instance Scheduling Works

When multiple relayers are deployed, the `schedule.id` and `totalRelayerCount` parameters work together to distribute message processing:

1. **Message assignment**: Messages are assigned to relayers based on `message_nonce % totalRelayerCount == schedule.id`
2. **Staggered processing**: Each relayer only processes messages assigned to its ID, preventing duplicate submissions
3. **Failover**: If a relayer fails, its messages will eventually be picked up by other relayers after timeout

**Example with 2 relayers:**
- Instance 0 processes messages where `nonce % 2 == 0` (nonces: 0, 2, 4, 6, ...)
- Instance 1 processes messages where `nonce % 2 == 1` (nonces: 1, 3, 5, 7, ...)

### Configuration Examples

**Single Instance (default):**
```json
{
  "schedule": {
    "id": 0,
    "totalRelayerCount": 1,
    "sleepInterval": 10
  }
}
```

**Two-Instance Deployment:**

*Instance 0:*
```json
{
  "schedule": {
    "id": 0,
    "totalRelayerCount": 2,
    "sleepInterval": 10
  }
}
```

*Instance 1:*
```json
{
  "schedule": {
    "id": 1,
    "totalRelayerCount": 2,
    "sleepInterval": 10
  }
}
```

### Sleep Interval Tuning

The `sleepInterval` parameter controls how frequently the relay polls for new messages:

| Value | Use Case | Trade-offs |
|-------|----------|------------|
| `1` | Low latency required | Higher RPC usage, faster message detection |
| `10` | Balanced (default) | Good balance of latency and resource usage |
| `30` | Cost-sensitive | Lower RPC costs, slower message detection |

**Recommendation**: The default `sleepInterval: 10` works well for most deployments. Decrease if message latency is critical; increase if RPC rate limits are a concern.

### Deployment Checklist

1. **Unique IDs**: Each instance must have a unique `schedule.id` (0 to `totalRelayerCount - 1`)
2. **Consistent count**: All instances must use the same `totalRelayerCount` value
3. **Separate accounts**: Use different Ethereum and Substrate accounts to avoid nonce conflicts
4. **Independent storage**: Each instance needs its own persistent datastore volume
5. **Different RPC endpoints**: Point instances to different RPC providers for fault tolerance

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
- [Relay Operating Costs](./snowbridge-relay-costs.md)
- [Snowbridge Documentation](https://docs.snowbridge.network)
- [DataHaven Snowbridge Repository](https://github.com/datahaven-xyz/snowbridge)
