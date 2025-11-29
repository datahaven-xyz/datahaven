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

## Key Requirements

### Substrate Private Key

The Beacon Relay requires a **Substrate private key** to sign and submit extrinsics to the DataHaven chain.

| Key Type | Purpose |
|----------|---------|
| Substrate (sr25519/ecdsa) | Sign beacon update extrinsics on DataHaven |

### Account Funding

The relay account must be funded with HAVE tokens to pay for transaction fees when submitting beacon updates.

**Recommended Balance**: 100+ HAVE for continuous operations

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
    },
    "updateSlotInterval": 30
  }
}
```

### Configuration Parameters

#### Source (Beacon Chain)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `source.beacon.endpoint` | Beacon chain HTTP API endpoint | `http://beacon-node:4000` |
| `source.beacon.stateEndpoint` | Beacon chain state endpoint (usually same as above) | `http://beacon-node:4000` |
| `source.beacon.spec.syncCommitteeSize` | Size of sync committee | `512` |
| `source.beacon.spec.slotsInEpoch` | Slots per epoch | `32` |
| `source.beacon.spec.epochsPerSyncCommitteePeriod` | Epochs per sync committee period | `256` |
| `source.beacon.spec.forkVersions` | Fork version configuration | `{"deneb": 0, "electra": 0}` |
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
  generate-beacon-checkpoint --config beacon-relay.json --export-json
```

### Submit Checkpoint to DataHaven

The checkpoint must be submitted via a sudo call to `EthereumBeaconClient.force_checkpoint`:

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
- [Snowbridge Documentation](https://docs.snowbridge.network)
- [DataHaven Snowbridge Repository](https://github.com/datahaven-xyz/snowbridge)
