# Snowbridge Execution Relay

## Overview

The Execution Relay processes Ethereum execution layer events and delivers cross-chain messages to DataHaven. It monitors the Gateway contract on Ethereum and relays messages to the corresponding pallets on DataHaven.

## Purpose

- Relay Ethereum execution layer messages to DataHaven
- Monitor Gateway contract for outbound messages
- Submit message proofs to DataHaven for verification
- Enable cross-chain token transfers and message passing from Ethereum

## Direction

```
Ethereum Execution Layer → DataHaven
```

## Prerequisites

- Docker with `linux/amd64` platform support
- Access to Ethereum execution layer WebSocket endpoint
- Access to Ethereum consensus layer (beacon) HTTP endpoint
- Access to DataHaven node WebSocket endpoint
- Substrate account with balance for transaction fees
- Deployed Gateway contract on Ethereum
- Persistent storage for relay datastore

## Hardware Requirements

### Specifications

| Component | Requirement |
|-----------|-------------|
| **CPU** | 4 cores |
| **RAM** | 8 GB |
| **Storage (Datastore)** | 10 GB SSD |
| **Network** | 100 Mbit/s symmetric |

### Important Considerations

- **Persistent storage**: The relay maintains a local datastore to track processed messages; use persistent volumes in containerized deployments
- **Message throughput**: Storage requirements may increase with high message volumes
- **Network connectivity**: Requires connections to both Ethereum (execution + beacon) and DataHaven nodes
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
- Full event log access for Gateway contract monitoring
- Low latency (< 100ms recommended)
- High availability (99.9%+ uptime)

### Beacon Node API

The relay also requires access to the Ethereum Beacon API for constructing message proofs.

**Recommended providers:**
- Self-hosted beacon node (Lighthouse, Prysm, Teku, Nimbus, Lodestar)
- Same providers as execution layer (with beacon API support)

**Requirements:**
- Full beacon API support (`/eth/v1/beacon/*` endpoints)
- State endpoint access for proof construction
- Low latency (< 100ms recommended)

## Relay Redundancy

### Why Redundancy Matters

Running multiple relay instances provides fault tolerance and ensures continuous bridge operation even if one relay fails. The on-chain pallets have built-in deduplication, so only the first valid submission is accepted—redundant relays simply provide backup coverage.

### Configuring Redundant Relays

Deploy multiple relay instances pointing to **different RPC providers** for maximum fault tolerance:

**Instance 1 (Primary):**
```json
{
  "source": {
    "ethereum": {
      "endpoint": "wss://eth-provider-a.example.com"
    },
    "beacon": {
      "endpoint": "https://beacon-provider-a.example.com"
    }
  },
  "sink": {
    "parachain": {
      "endpoint": "wss://datahaven-rpc-1.example.com"
    }
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
    "beacon": {
      "endpoint": "https://beacon-provider-b.example.com"
    }
  },
  "sink": {
    "parachain": {
      "endpoint": "wss://datahaven-rpc-2.example.com"
    }
  }
}
```

### Best Practices for Redundancy

1. **Use different RPC providers**: Avoid single points of failure by using different Ethereum node providers for each relay instance
2. **Geographic distribution**: Deploy relays in different regions/data centers
3. **Independent infrastructure**: Run relays on separate machines or Kubernetes nodes
4. **Separate funding accounts**: Use different relay accounts to avoid nonce conflicts
5. **Monitor all instances**: Set up alerting for each relay independently

## Key Requirements

### Substrate Private Key

The Execution Relay requires a **Substrate private key** to sign and submit extrinsics to DataHaven.

| Key Type | Purpose |
|----------|---------|
| Substrate (sr25519/ecdsa) | Sign message delivery extrinsics on DataHaven |

### Account Funding

The relay account must be funded with HAVE tokens to pay for transaction fees.

**Recommended Balance**: 100+ HAVE for continuous operations

For detailed operating cost estimates and optimization strategies, see the [Relay Operating Costs](./snowbridge-relay-costs.md) guide.

## CLI Flags

### Required Flags

| Flag | Description |
|------|-------------|
| `--config <PATH>` | Path to the JSON configuration file |

### Private Key Flags (One Required)

| Flag | Description |
|------|-------------|
| `--substrate.private-key <KEY>` | Substrate private key URI directly |
| `--substrate.private-key-file <PATH>` | Path to file containing the private key |
| `--substrate.private-key-id <ID>` | AWS Secrets Manager secret ID for the private key |

## Configuration File

### Structure

```json
{
  "source": {
    "ethereum": {
      "endpoint": "ws://ethereum-node:8546"
    },
    "contracts": {
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
    "parachain": {
      "endpoint": "ws://datahaven-node:9944",
      "maxWatchedExtrinsics": 8,
      "headerRedundancy": 20
    }
  },
  "instantVerification": false,
  "schedule": {
    "id": null,
    "totalRelayerCount": 1,
    "sleepInterval": 1
  }
}
```

### Configuration Parameters

#### Source (Ethereum)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `source.ethereum.endpoint` | Ethereum execution layer WebSocket | `ws://ethereum-node:8546` |
| `source.contracts.Gateway` | Gateway contract address | `0x...` |

#### Source (Beacon Chain)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `source.beacon.endpoint` | Beacon chain HTTP API endpoint | `http://beacon-node:4000` |
| `source.beacon.stateEndpoint` | Beacon chain state endpoint | `http://beacon-node:4000` |
| `source.beacon.spec.*` | Beacon chain specification | See beacon spec parameters |
| `source.beacon.datastore.location` | Path to persistent datastore | `/relay-data` |
| `source.beacon.datastore.maxEntries` | Maximum datastore entries | `100` |

#### Sink (DataHaven)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `sink.parachain.endpoint` | DataHaven WebSocket endpoint | `ws://datahaven-node:9944` |
| `sink.parachain.maxWatchedExtrinsics` | Max concurrent watched extrinsics | `8` |
| `sink.parachain.headerRedundancy` | Header redundancy factor | `20` |

#### Relay Settings

| Parameter | Description | Example |
|-----------|-------------|---------|
| `instantVerification` | Enable instant verification mode | `false` |
| `schedule.id` | Relayer instance ID (for multi-instance) | `null` or `0` |
| `schedule.totalRelayerCount` | Total number of relayer instances | `1` |
| `schedule.sleepInterval` | Seconds between message checks | `1` |

## Multi-Instance Deployment

For high-availability or load distribution, multiple Execution Relayers can be deployed using the `schedule` configuration to coordinate between instances.

### Schedule Configuration Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `schedule.id` | `number` or `null` | Unique identifier for this relay instance (0-indexed). Set to `null` for single-instance deployments. |
| `schedule.totalRelayerCount` | `number` | Total number of relay instances in the deployment. All instances must use the same value. |
| `schedule.sleepInterval` | `number` | Seconds to wait between polling for new messages. Lower values = faster detection, higher resource usage. |

### How Multi-Instance Scheduling Works

When multiple relayers are deployed, the `schedule.id` and `totalRelayerCount` parameters work together to distribute message processing:

1. **Message assignment**: Messages are assigned to relayers based on `message_nonce % totalRelayerCount == schedule.id`
2. **Staggered processing**: Each relayer only processes messages assigned to its ID, preventing duplicate submissions
3. **Failover**: If a relayer fails, its messages will eventually be picked up by other relayers after timeout

**Example with 3 relayers:**
- Instance 0 processes messages where `nonce % 3 == 0` (nonces: 0, 3, 6, 9, ...)
- Instance 1 processes messages where `nonce % 3 == 1` (nonces: 1, 4, 7, 10, ...)
- Instance 2 processes messages where `nonce % 3 == 2` (nonces: 2, 5, 8, 11, ...)

### Configuration Examples

**Single Instance (default):**
```json
{
  "schedule": {
    "id": null,
    "totalRelayerCount": 1,
    "sleepInterval": 1
  }
}
```

**Three-Instance Deployment:**

*Instance 0:*
```json
{
  "schedule": {
    "id": 0,
    "totalRelayerCount": 3,
    "sleepInterval": 1
  }
}
```

*Instance 1:*
```json
{
  "schedule": {
    "id": 1,
    "totalRelayerCount": 3,
    "sleepInterval": 1
  }
}
```

*Instance 2:*
```json
{
  "schedule": {
    "id": 2,
    "totalRelayerCount": 3,
    "sleepInterval": 1
  }
}
```

### Sleep Interval Tuning

The `sleepInterval` parameter controls how frequently the relay polls for new messages:

| Value | Use Case | Trade-offs |
|-------|----------|------------|
| `1` | Low latency required | Higher RPC usage, faster message detection |
| `5` | Balanced | Good balance of latency and resource usage |
| `10` | Cost-sensitive | Lower RPC costs, slower message detection |
| `30` | Minimal activity | Very low resource usage, higher latency |

**Recommendation**: Start with `sleepInterval: 1` for production deployments where message latency is important. Increase if RPC rate limits become an issue.

### Deployment Checklist

1. **Unique IDs**: Each instance must have a unique `schedule.id` (0 to `totalRelayerCount - 1`)
2. **Consistent count**: All instances must use the same `totalRelayerCount` value
3. **Separate accounts**: Use different Substrate accounts to avoid nonce conflicts
4. **Independent storage**: Each instance needs its own persistent datastore volume
5. **Different RPC endpoints**: Point instances to different RPC providers for fault tolerance

## Running the Relay

### Docker Run

```bash
docker run -d \
  --name snowbridge-execution-relay \
  --platform linux/amd64 \
  --add-host host.docker.internal:host-gateway \
  --network datahaven-network \
  -v $(pwd)/execution-relay.json:/configs/execution-relay.json:ro \
  -v $(pwd)/relay-data:/relay-data \
  --pull always \
  datahavenxyz/snowbridge-relay:latest \
  run execution \
  --config /configs/execution-relay.json \
  --substrate.private-key "0x..."
```

### Docker Compose

```yaml
version: '3.8'

services:
  execution-relay:
    image: datahavenxyz/snowbridge-relay:latest
    container_name: snowbridge-execution-relay
    platform: linux/amd64
    restart: unless-stopped
    volumes:
      - ./configs/execution-relay.json:/configs/execution-relay.json:ro
      - execution-relay-data:/relay-data
    command:
      - "run"
      - "execution"
      - "--config"
      - "/configs/execution-relay.json"
      - "--substrate.private-key-file"
      - "/secrets/substrate-key"
    secrets:
      - substrate-key

volumes:
  execution-relay-data:

secrets:
  substrate-key:
    file: ./secrets/execution-relay-substrate-key
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: dh-execution-relay
spec:
  serviceName: dh-execution-relay
  replicas: 1
  selector:
    matchLabels:
      app: dh-execution-relay
  template:
    metadata:
      labels:
        app: dh-execution-relay
    spec:
      containers:
      - name: execution-relay
        image: datahavenxyz/snowbridge-relay:latest
        imagePullPolicy: Always
        args:
          - "run"
          - "execution"
          - "--config"
          - "/configs/execution-relay.json"
          - "--substrate.private-key-file"
          - "/secrets/dh-execution-relay-substrate-key"
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
          name: execution-relay-config
      - name: secrets
        secret:
          secretName: dh-execution-relay-substrate-key
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

### Ethereum → DataHaven Message Flow

1. User calls Gateway contract on Ethereum
2. Gateway emits `OutboundMessageAccepted` event
3. Execution Relay monitors for Gateway events
4. Relay constructs message proof using beacon chain state
5. Relay submits proof to DataHaven via `EthereumInboundQueue` pallet
6. DataHaven verifies proof against beacon client state
7. Message is dispatched to target pallet

### Supported Message Types

- Token transfers (ERC-20 tokens to DataHaven)
- Arbitrary cross-chain messages
- Smart contract calls

## Monitoring

### Health Checks

```bash
# View relay logs
docker logs -f snowbridge-execution-relay

# Check for message processing
docker logs snowbridge-execution-relay 2>&1 | grep -i "message\|submit\|proof"
```

### Key Metrics to Monitor

- Message queue depth
- Message delivery success rate
- Ethereum event processing lag
- Account balance (for fees)
- Beacon chain sync status

## Troubleshooting

### Issue: Messages Not Being Delivered

**Check**:
1. Gateway contract address is correct
2. Ethereum endpoint is accessible
3. Beacon chain is synced
4. DataHaven node is accessible

```bash
# Check Ethereum connectivity
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://ethereum-node:8545
```

### Issue: Proof Verification Failures

**Check**:
1. Beacon Relay is running and synced
2. `EthereumBeaconClient` pallet has recent updates
3. Beacon chain spec matches configuration

### Issue: High Latency

**Solutions**:
1. Reduce `sleepInterval` for faster message detection
2. Deploy multiple relay instances
3. Ensure low-latency connections to endpoints

## Security Considerations

1. **Private Key Protection**: Store Substrate private keys securely
2. **Network Security**: Use secure connections (WSS) when possible
3. **Access Control**: Use dedicated accounts with minimal permissions
4. **Monitoring**: Set up alerts for message delivery failures

## Economics

### Transaction Costs

- Message delivery: ~0.012 DOT equivalent per message (varies with message size)
- Relayers earn incentives for successful deliveries

### Incentive Structure

Relayers can claim incentives from the protocol for successful message deliveries. See Snowbridge documentation for details.

## Related Documentation

- [Beacon Relay](./snowbridge-beacon-relay.md)
- [BEEFY Relay](./snowbridge-beefy-relay.md)
- [Solochain Relay](./snowbridge-solochain-relay.md)
- [Relay Operating Costs](./snowbridge-relay-costs.md)
- [Snowbridge Documentation](https://docs.snowbridge.network)
- [DataHaven Snowbridge Repository](https://github.com/datahaven-xyz/snowbridge)
