# Snowbridge Beacon Relay

## Overview

The Beacon Relay syncs Ethereum beacon chain (consensus layer) finality to the DataHaven blockchain. It monitors the Ethereum beacon chain and submits sync committee updates and finality proofs to the `EthereumBeaconClient` pallet on DataHaven.

## Purpose

- Relay Ethereum beacon chain finality to DataHaven
- Submit sync committee updates for light client verification
- Enable trustless verification of Ethereum state on DataHaven
- Support cross-chain message verification from Ethereum

## Direction

```
Ethereum Beacon Chain → DataHaven
```

## Prerequisites

- Docker with `linux/amd64` platform support
- Access to Ethereum consensus layer (beacon) endpoint
- Access to DataHaven node WebSocket endpoint
- Substrate account with balance for transaction fees
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

- **Persistent storage**: The relay maintains a local datastore to track processed beacon updates; use persistent volumes in containerized deployments
- **Network latency**: Low latency connections to both beacon node and DataHaven node improve relay performance
- **Reliable RPC endpoints**: Use enterprise-grade or self-hosted beacon nodes for production deployments

## RPC Endpoint Requirements

### Beacon Node API

The relay requires access to a **stable, reliable Ethereum Beacon API endpoint**. Endpoint instability or downtime will prevent the relay from functioning correctly.

**Recommended providers:**
- Self-hosted beacon node (Lighthouse, Prysm, Teku, Nimbus, Lodestar)
- [Dwellir](https://www.dwellir.com/)
- [Chainstack](https://chainstack.com/)
- [QuickNode](https://www.quicknode.com/)
- [Alchemy](https://www.alchemy.com/)

**Requirements:**
- Full beacon API support (`/eth/v1/beacon/*` endpoints)
- State endpoint access for sync committee data
- Low latency (< 100ms recommended)
- High availability (99.9%+ uptime)

## Relay Redundancy

### Why Redundancy Matters

Running multiple relay instances provides fault tolerance and ensures continuous bridge operation even if one relay fails. The on-chain pallets have built-in deduplication, so only the first valid submission is accepted—redundant relays simply provide backup coverage.

### Configuring Redundant Relays

Deploy multiple relay instances pointing to **different RPC providers** for maximum fault tolerance:

**Instance 1 (Primary):**
```json
{
  "source": {
    "beacon": {
      "endpoint": "https://beacon-provider-a.example.com",
      "stateEndpoint": "https://beacon-provider-a.example.com"
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
    "beacon": {
      "endpoint": "https://beacon-provider-b.example.com",
      "stateEndpoint": "https://beacon-provider-b.example.com"
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

1. **Use different RPC providers**: Avoid single points of failure by using different beacon node providers for each relay instance
2. **Geographic distribution**: Deploy relays in different regions/data centers
3. **Independent infrastructure**: Run relays on separate machines or Kubernetes nodes
4. **Separate funding accounts**: Use different relay accounts to avoid nonce conflicts
5. **Monitor all instances**: Set up alerting for each relay independently

## Key Requirements

### Substrate Private Key

The Beacon Relay requires a **Substrate private key** to sign and submit extrinsics to the DataHaven chain.

| Key Type | Purpose |
|----------|---------|
| Substrate (sr25519/ecdsa) | Sign beacon update extrinsics on DataHaven |

### Account Funding

The relay account must be funded with HAVE tokens to pay for transaction fees when submitting beacon updates.

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
    "beacon": {
      "endpoint": "http://beacon-node:4000",
      "stateEndpoint": "http://beacon-node:4000",
      "spec": {
        "syncCommitteeSize": 512,
        "slotsInEpoch": 32,
        "epochsPerSyncCommitteePeriod": 256,
        "forkVersions": {
          "deneb": 269568,
          "electra": 364032,
          "fulu": 411392
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
    },
    "updateSlotInterval": 30
  }
}
```

### Fork Versions by Network

The `forkVersions` parameter specifies the epoch at which each consensus layer fork becomes active. Use the correct values for your target network:

#### Ethereum Mainnet

```json
"forkVersions": {
  "deneb": 269568,
  "electra": 364032,
  "fulu": 411392
}
```

| Fork | Epoch | Activation Date | Fork Version Hex |
|------|-------|-----------------|------------------|
| Deneb | 269568 | March 13, 2024 | `0x04000000` |
| Electra | 364032 | May 7, 2025 | `0x05000000` |
| Fulu | 411392 | December 3, 2025 | `0x06000000` |

#### Hoodi Testnet

```json
"forkVersions": {
  "deneb": 0,
  "electra": 2048,
  "fulu": 67584
}
```

| Fork | Epoch | Fork Version Hex |
|------|-------|------------------|
| Deneb | 0 (genesis) | `0x50000910` |
| Electra | 2048 | `0x60000910` |
| Fulu | 67584 | `0x70000910` |

**Note**: Hoodi is a merged-from-genesis testnet where Deneb is active from epoch 0. Check the [official Hoodi configuration](https://github.com/eth-clients/hoodi) for the latest values.

#### Local Development / Devnet

```json
"forkVersions": {
  "deneb": 0,
  "electra": 0,
  "fulu": 0
}
```

For local development networks where all forks are active from genesis.

### Configuration Parameters

#### Source (Beacon Chain)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `source.beacon.endpoint` | Beacon chain HTTP API endpoint | `http://beacon-node:4000` |
| `source.beacon.stateEndpoint` | Beacon chain state endpoint (usually same as above) | `http://beacon-node:4000` |
| `source.beacon.spec.syncCommitteeSize` | Size of sync committee | `512` |
| `source.beacon.spec.slotsInEpoch` | Slots per epoch | `32` |
| `source.beacon.spec.epochsPerSyncCommitteePeriod` | Epochs per sync committee period | `256` |
| `source.beacon.spec.forkVersions.deneb` | Epoch when Deneb fork activated | `269568` (mainnet) |
| `source.beacon.spec.forkVersions.electra` | Epoch when Electra fork activated | `364032` (mainnet) |
| `source.beacon.spec.forkVersions.fulu` | Epoch when Fulu fork activated | `411392` (mainnet) |
| `source.beacon.datastore.location` | Path to persistent datastore | `/relay-data` |
| `source.beacon.datastore.maxEntries` | Maximum datastore entries | `100` |

#### Sink (DataHaven)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `sink.parachain.endpoint` | DataHaven WebSocket endpoint | `ws://datahaven-node:9944` |
| `sink.parachain.maxWatchedExtrinsics` | Max concurrent watched extrinsics | `8` |
| `sink.parachain.headerRedundancy` | Header redundancy factor | `20` |
| `sink.updateSlotInterval` | Slot interval for updates | `30` |

## Initialization: Beacon Client Pallet

Before starting the Beacon Relay, the `EthereumBeaconClient` pallet must be initialized with a checkpoint.

### Generate Initial Checkpoint

```bash
docker run --rm \
  -v $(pwd)/beacon-relay.json:/app/beacon-relay.json:ro \
  -v $(pwd)/checkpoint.json:/app/dump-initial-checkpoint.json \
  -v $(pwd)/datastore:/data \
  --platform linux/amd64 \
  datahavenxyz/snowbridge-relay:latest \
  generate-beacon-checkpoint --config beacon-relay.json \
  > beacon_checkpoint.hex
```

This outputs the raw checkpoint payload to `beacon_checkpoint.hex`.

### Submit Checkpoint to DataHaven

The checkpoint must be submitted via a sudo call to `EthereumBeaconClient.force_checkpoint`. There are two methods:

#### Option 1: Using Polkadot.js Apps (Recommended)

1. Open [Polkadot.js Apps](https://polkadot.js.org/apps/) and connect to your DataHaven node
2. Navigate to **Developer** > **Extrinsics**
3. Select **Decode** tab
4. Prepend `0x24003c00` to the contents of `beacon_checkpoint.hex` and paste the full hex string
   - `0x24` = Sudo pallet index
   - `0x00` = sudo call index
   - `0x3c` = EthereumBeaconClient pallet index
   - `0x00` = force_checkpoint call index
5. The UI should decode this as `sudo.sudo(ethereumBeaconClient.force_checkpoint(...))`
6. Select your Sudo account and submit the transaction

#### Option 2: Using Polkadot-API (TypeScript)

```typescript
import { createClient } from 'polkadot-api';
import { datahaven } from '@polkadot-api/descriptors';

const client = createClient(wsProvider);
const api = client.getTypedApi(datahaven);

const forceCheckpointCall = api.tx.EthereumBeaconClient.force_checkpoint({
  update: checkpoint  // Parsed from dump-initial-checkpoint.json
});

const tx = api.tx.Sudo.sudo({
  call: forceCheckpointCall.decodedCall
});

await tx.signAndSubmit(sudoSigner);
```

## Running the Relay

### Docker Run

```bash
docker run -d \
  --name snowbridge-beacon-relay \
  --platform linux/amd64 \
  --add-host host.docker.internal:host-gateway \
  --network datahaven-network \
  -v $(pwd)/beacon-relay.json:/configs/beacon-relay.json:ro \
  -v $(pwd)/relay-data:/relay-data \
  --pull always \
  datahavenxyz/snowbridge-relay:latest \
  run beacon \
  --config /configs/beacon-relay.json \
  --substrate.private-key "0x..."
```

### Docker Compose

```yaml
version: '3.8'

services:
  beacon-relay:
    image: datahavenxyz/snowbridge-relay:latest
    container_name: snowbridge-beacon-relay
    platform: linux/amd64
    restart: unless-stopped
    volumes:
      - ./configs/beacon-relay.json:/configs/beacon-relay.json:ro
      - beacon-relay-data:/relay-data
    command:
      - "run"
      - "beacon"
      - "--config"
      - "/configs/beacon-relay.json"
      - "--substrate.private-key-file"
      - "/secrets/substrate-key"
    secrets:
      - substrate-key

volumes:
  beacon-relay-data:

secrets:
  substrate-key:
    file: ./secrets/beacon-relay-substrate-key
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: dh-beacon-relay
spec:
  serviceName: dh-beacon-relay
  replicas: 1
  selector:
    matchLabels:
      app: dh-beacon-relay
  template:
    metadata:
      labels:
        app: dh-beacon-relay
    spec:
      containers:
      - name: beacon-relay
        image: datahavenxyz/snowbridge-relay:latest
        imagePullPolicy: Always
        args:
          - "run"
          - "beacon"
          - "--config"
          - "/configs/beacon-relay.json"
          - "--substrate.private-key-file"
          - "/secrets/dh-beacon-relay-substrate-key"
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
          name: beacon-relay-config
      - name: secrets
        secret:
          secretName: dh-beacon-relay-substrate-key
  volumeClaimTemplates:
  - metadata:
      name: relay-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
```

## Monitoring

### Health Checks

The relay logs sync committee updates and beacon chain state:

```bash
# View relay logs
docker logs -f snowbridge-beacon-relay

# Check for successful updates
docker logs snowbridge-beacon-relay 2>&1 | grep -i "submitted\|update"
```

### Key Metrics to Monitor

- Beacon chain slot lag
- Sync committee update frequency
- Transaction success rate
- Account balance (for fees)

## Troubleshooting

### Issue: Beacon Chain Not Ready

**Symptoms**: Relay fails to start or continuously retries

**Check**:
1. Beacon chain endpoint is accessible
2. Beacon chain has finalized blocks
3. Network connectivity between relay and beacon node

```bash
# Test beacon chain connectivity
curl http://beacon-node:4000/eth/v1/beacon/states/head/finality_checkpoints
```

### Issue: Checkpoint Submission Failed

**Check**:
1. Sudo account has sufficient balance
2. Checkpoint data is valid
3. DataHaven node is synced

### Issue: Transaction Failures

**Check**:
1. Relay account has sufficient HAVE balance
2. DataHaven node is accessible
3. No duplicate relayers submitting same updates

## Security Considerations

1. **Private Key Protection**: Store private keys securely (AWS Secrets Manager, Kubernetes secrets, or encrypted files)
2. **Network Security**: Restrict access to relay endpoints
3. **Access Control**: Use dedicated accounts with minimal required permissions
4. **Monitoring**: Set up alerts for relay failures

## Related Documentation

- [BEEFY Relay](./snowbridge-beefy-relay.md)
- [Execution Relay](./snowbridge-execution-relay.md)
- [Solochain Relay](./snowbridge-solochain-relay.md)
- [Relay Operating Costs](./snowbridge-relay-costs.md)
- [Snowbridge Documentation](https://docs.snowbridge.network)
- [DataHaven Snowbridge Repository](https://github.com/datahaven-xyz/snowbridge)
- [Ethereum Consensus Specs - Mainnet Config](https://github.com/ethereum/consensus-specs/blob/dev/configs/mainnet.yaml)
- [Hoodi Testnet Configuration](https://github.com/eth-clients/hoodi)
- [Ethereum Fork Timeline](https://ethereum.org/ethereum-forks/)
