# DataHaven Validator Node Setup

## Overview

Validator nodes participate in consensus, produce blocks, and secure the DataHaven network through EigenLayer AVS integration.

## Purpose

- Participate in BABE block production
- Sign GRANDPA finality votes
- Submit ImOnline heartbeats
- Participate in BEEFY bridge consensus
- Earn rewards for block production and consensus participation

## Prerequisites

- DataHaven node binary or Docker image
- ECDSA keypair for operator registration on EigenLayer AVS
- Persistent storage for chain data
- Stable network connection
- Open network ports (30333, optionally 9944)

## Hardware Requirements

Validators have the highest hardware requirements as they participate in block production and consensus. Single-threaded CPU performance is critical.

### Minimum Specifications

| Component | Requirement |
|-----------|-------------|
| **CPU** | 8 physical cores @ 3.4 GHz (Intel Ice Lake+ or AMD Zen3+) |
| **RAM** | 32 GB DDR4 ECC |
| **Storage** | 1 TB NVMe SSD (low latency) |
| **Network** | 500 Mbit/s symmetric |

### Recommended Specifications

| Component | Requirement |
|-----------|-------------|
| **CPU** | Intel Xeon E-2386/E-2388 or AMD Ryzen 9 5950x/5900x |
| **RAM** | 64 GB DDR4 ECC |
| **Storage** | 2 TB NVMe SSD |
| **Network** | 1 Gbit/s symmetric |

### Important Considerations

- **Disable Hyper-Threading/SMT**: Single-threaded performance is prioritized over core count
- **Bare metal preferred**: Cloud VPS may have inconsistent performance due to shared resources
- **Dedicated server**: Do not run other applications on the validator machine
- **Docker not recommended**: Running in containers can significantly impact performance
- **Redundancy**: Consider primary and backup servers in different data centers

## Key Requirements

### Session Keys (4 Required)

Validators require **four session keys** for different consensus mechanisms:

| Key Type | Scheme | Purpose |
|----------|--------|---------|
| `gran` | ed25519 | GRANDPA finality gadget |
| `babe` | sr25519 | BABE block authoring |
| `imon` | sr25519 | ImOnline validator heartbeat |
| `beef` | ecdsa | BEEFY bridge consensus |

### Generate Session Keys

#### Method 1: Using RPC (Recommended)

```bash
# Start node first, then generate keys via RPC
curl -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "author_rotateKeys"}' \
  http://localhost:9944

# Returns: "0x<combined_public_keys_hex>"
```

#### Method 2: CLI Key Insertion

```bash
# Generate seed phrase first
SEED=$(datahaven-node key generate | grep "Secret phrase" | cut -d'`' -f2)

# Insert GRANDPA key (ed25519)
datahaven-node key insert \
  --base-path /data/validator \
  --chain stagenet-local \
  --key-type gran \
  --scheme ed25519 \
  --suri "$SEED"

# Insert BABE key (sr25519)
datahaven-node key insert \
  --base-path /data/validator \
  --chain stagenet-local \
  --key-type babe \
  --scheme sr25519 \
  --suri "$SEED"

# Insert ImOnline key (sr25519)
datahaven-node key insert \
  --base-path /data/validator \
  --chain stagenet-local \
  --key-type imon \
  --scheme sr25519 \
  --suri "$SEED"

# Insert BEEFY key (ecdsa)
datahaven-node key insert \
  --base-path /data/validator \
  --chain stagenet-local \
  --key-type beef \
  --scheme ecdsa \
  --suri "$SEED"
```

#### Method 3: Docker Entrypoint (Automated)

Set environment variables and let the Docker entrypoint inject keys:

```bash
export NODE_TYPE=validator
export NODE_NAME=Alice
export SEED="your seed phrase here"
export CHAIN=stagenet-local
```

The entrypoint script (`operator/scripts/docker-entrypoint.sh`) automatically injects all 4 keys.

## Wallet Requirements

### Operator Account (ECDSA)

DataHaven validators are EigenLayer operators. The operator account is used to:
- Register as an operator on the DataHaven AVS (on Ethereum)
- Sign the `session.setKeys` extrinsic to associate session keys with the operator

**Important**:
- The account **does NOT need to be funded** on DataHaven - staking happens via EigenLayer delegation on Ethereum
- Token holders delegate stake to operators on EigenLayer, not on the DataHaven chain
- The same private key that controls the operator address on the AVS must sign the session keys transaction

### Generate Operator Account (ECDSA)

```bash
# Generate ECDSA keypair using datahaven-node
datahaven-node key generate --scheme ecdsa

# Output:
# Secret phrase:       <your-seed-phrase>
# Network ID:          substrate
# Secret seed:         0x...
# Public key (hex):    0x...
# Account ID:          0x...  (20-byte Ethereum-style address)

# Derive Ethereum address from the hex public key using Foundry's cast
cast wallet address <public_key_hex>

# This gives you the Ethereum address to register on the AVS
```

### Alternative: Generate with cast (Foundry)

```bash
# Generate a new keypair
cast wallet new

# Or import from private key
cast wallet address --private-key 0x...
```

## CLI Flags

### Required Flags

```bash
datahaven-node \
  --chain <CHAIN_SPEC> \
  --validator \
  --name <NODE_NAME>
```

### Important Validator Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--chain <SPEC>` | Chain specification | Required |
| `--validator` | Run as validator | Required |
| `--name <NAME>` | Node name | Required |
| `--base-path <PATH>` | Base directory for data | `~/.local/share/datahaven-node` |
| `--port <PORT>` | P2P port | `30333` |
| `--rpc-port <PORT>` | WebSocket RPC port | `9944` |
| `--bootnodes <MULTIADDR>` | Bootstrap nodes | None |

### Optional Flags

| Flag | Description |
|------|-------------|
| `--rpc-external` | Listen on all interfaces |
| `--rpc-cors <ORIGINS>` | CORS origins (e.g., `all` or `http://localhost:3000`) |
| `--prometheus-external` | Expose Prometheus metrics externally |
| `--telemetry-url <URL>` | Telemetry endpoint |
| `--log <TARGETS>` | Logging verbosity (e.g., `info,runtime=debug`) |
| `--unsafe-force-node-key-generation` | Generate node key (dev only) |

## Complete Setup Example

### 1. Generate Operator Account (ECDSA)

```bash
# Generate ECDSA keypair for operator registration
datahaven-node key generate --scheme ecdsa

# Save the seed phrase and note the public key hex
# Example output:
# Secret phrase: "word1 word2 ... word12"
# Public key (hex): 0x0123456789abcdef...

# Get the Ethereum address for AVS registration
OPERATOR_ETH_ADDRESS=$(cast wallet address 0x<public_key_hex>)
echo "Operator ETH Address: $OPERATOR_ETH_ADDRESS"
```

### 2. Register as Operator on EigenLayer AVS

Before setting session keys, register your operator address on the DataHaven AVS contract on Ethereum. See [On-Chain Registration](#on-chain-registration) for details.

### 3. Generate Session Keys

```bash
# Start node to generate session keys via RPC
datahaven-node \
  --chain stagenet-local \
  --base-path /tmp/validator \
  --validator \
  --name "TempValidator" \
  --rpc-port 9944 &

# Wait for node to start
sleep 10

# Generate session keys
SESSION_KEYS=$(curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "author_rotateKeys"}' \
  http://localhost:9944 | jq -r '.result')

echo "Session Keys: $SESSION_KEYS"

# Stop temporary node
pkill -f datahaven-node
```

### 4. Start Validator Node

```bash
datahaven-node \
  --chain stagenet-local \
  --validator \
  --name "Validator-01" \
  --base-path /data/validator \
  --port 30333 \
  --rpc-port 9944 \
  --bootnodes /dns/bootnode.example.com/tcp/30333/p2p/12D3KooW... \
  --telemetry-url "wss://telemetry.polkadot.io/submit/ 0" \
  --log info
```

### 5. Set Session Keys On-Chain

See [On-Chain Registration](#on-chain-registration) section below.

## Docker Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  validator:
    image: datahavenxyz/datahaven:latest
    container_name: datahaven-validator
    environment:
      NODE_TYPE: validator
      NODE_NAME: Alice
      SEED: "your seed phrase here"
      CHAIN: stagenet-local
      KEYSTORE_PATH: /data/keystore
    ports:
      - "30333:30333"
      - "9944:9944"
    volumes:
      - validator-data:/data
    command:
      - "--chain=stagenet-local"
      - "--validator"
      - "--name=Validator-01"
      - "--base-path=/data"
      - "--keystore-path=/data/keystore"
      - "--port=30333"
      - "--rpc-port=9944"
      - "--rpc-external"
      - "--rpc-cors=all"

volumes:
  validator-data:
```

## Kubernetes Deployment

See `deploy/charts/node/values.yaml` for full Helm configuration.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: datahaven-validator
spec:
  serviceName: datahaven-validator
  replicas: 1
  selector:
    matchLabels:
      app: datahaven-validator
  template:
    metadata:
      labels:
        app: datahaven-validator
    spec:
      containers:
      - name: validator
        image: datahavenxyz/datahaven:latest
        env:
        - name: NODE_TYPE
          value: "validator"
        - name: NODE_NAME
          value: "Alice"
        - name: SEED
          valueFrom:
            secretKeyRef:
              name: validator-seed
              key: seed
        - name: CHAIN
          value: "stagenet-local"
        ports:
        - containerPort: 30333
          name: p2p
        - containerPort: 9944
          name: rpc
        volumeMounts:
        - name: data
          mountPath: /data
        args:
          - "--chain=stagenet-local"
          - "--validator"
          - "--name=Validator-01"
          - "--base-path=/data"
          - "--port=30333"
          - "--rpc-port=9944"
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 200Gi
```

## On-Chain Registration

### Step 1: Register as Operator on EigenLayer AVS

Before setting session keys, you must register your operator address on the DataHaven AVS contract on Ethereum. This establishes your identity as a validator operator.

```solidity
// DataHavenServiceManager.sol
function registerOperatorToAVS(
    address operator,
    ISignatureUtils.SignatureWithSaltAndExpiry memory operatorSignature
) external;
```

See `contracts/` directory and `test/scripts/` for registration scripts.

### Step 2: Set Session Keys

After registering on the AVS, submit your session keys to the DataHaven chain. **Important**: The transaction must be signed with the same private key used for AVS registration, so the session keys are associated with your operator address.

Using Polkadot.js Apps or TypeScript:

```typescript
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';

const api = await ApiPromise.create({
  provider: new WsProvider('ws://localhost:9944')
});

// Use 'ethereum' keyring type for ECDSA keys
const keyring = new Keyring({ type: 'ethereum' });
// Use the same seed phrase as your AVS operator account
const operator = keyring.addFromUri('your operator seed phrase');

// Set session keys (from author_rotateKeys RPC)
const sessionKeys = '0x...'; // Combined public keys hex

const setKeysTx = api.tx.session.setKeys(sessionKeys, []);
await setKeysTx.signAndSend(operator);
```

### Step 3: Verify Registration

```bash
# Check session keys
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "author_hasSessionKeys", "params":["0x..."]}' \
  http://localhost:9944

# Check validator status
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
  http://localhost:9944
```

## Monitoring

### Key Metrics

- Block production rate
- Finality lag
- Peer count
- Session key validity
- ImOnline heartbeats

### Prometheus Metrics

```bash
# Enable Prometheus endpoint
datahaven-node --validator --prometheus-external --prometheus-port 9615

# Access metrics
curl http://localhost:9615/metrics
```

### Health Checks

```bash
# System health
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
  http://localhost:9944 | jq

# Chain info
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_chain"}' \
  http://localhost:9944 | jq
```

## Troubleshooting

### Issue: Not Producing Blocks

**Check:**
1. Session keys are set on-chain
2. Account is in the validator set
3. Node is fully synced
4. Session keys match on-chain registration

### Issue: Session Keys Lost

**Solution:**
```bash
# Rotate keys and re-register
curl -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "author_rotateKeys"}' \
  http://localhost:9944

# Then submit new keys via session.setKeys extrinsic
```

### Issue: Not in Active Validator Set

**Check:**
1. Operator is registered on the DataHaven AVS contract (Ethereum)
2. Operator has sufficient delegated stake on EigenLayer
3. Session keys are correctly associated with operator address
4. Not slashed on EigenLayer
5. Session transition period (changes take effect in the next session)
6. Maximum validator count not exceeded

### Issue: Session Keys Not Linked to Operator

**Check:**
1. The `session.setKeys` transaction was signed with the same private key registered on the AVS
2. Verify the signing address matches your operator address on the AVS contract
3. Use `author_hasSessionKeys` RPC to confirm keys are stored locally

**Solution:**
```bash
# Verify your operator address matches what's registered on AVS
cast wallet address <your_operator_public_key_hex>

# Re-submit session.setKeys with the correct operator account
```

## Security Considerations

1. **Key Management**: Store seed phrase securely offline
2. **Network Security**: Use firewall to restrict RPC access
3. **High Availability**: Implement monitoring and alerting
4. **Slashing Prevention**: Monitor validator performance
5. **Backup Strategy**: Regular backups of keystores

## Best Practices

1. Monitor network connectivity
2. Keep node software updated
3. Test key rotation procedures
4. Document incident response procedures

## Related Documentation

- [Bootnode Setup](./datahaven-bootnode.md)
- [Full Node Setup](./datahaven-fullnode.md)
- [EigenLayer AVS Integration](../contracts/README.md)
- [Rewards System](../operator/pallets/external-validators/README.md)
