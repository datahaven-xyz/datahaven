# Snowbridge BEEFY Relay

## Overview

The BEEFY Relay submits DataHaven BEEFY (Bridge Efficiency Enabling Finality Yielder) finality proofs to the `BeefyClient` smart contract on Ethereum. This enables trustless verification of DataHaven state on Ethereum.

## Purpose

- Relay DataHaven BEEFY finality proofs to Ethereum
- Submit validator set commitments to BeefyClient contract
- Enable trustless verification of DataHaven state on Ethereum
- Support cross-chain message verification to Ethereum

## Direction

```
DataHaven → Ethereum
```

## Prerequisites

- Docker with `linux/amd64` platform support
- Access to DataHaven node WebSocket endpoint
- Access to Ethereum execution layer WebSocket endpoint
- Ethereum account with ETH for gas fees
- Deployed BeefyClient and Gateway contracts on Ethereum

## Hardware Requirements

### Specifications

| Component | Requirement |
|-----------|-------------|
| **CPU** | 4 cores |
| **RAM** | 8 GB |
| **Storage (Datastore)** | 5 GB SSD |
| **Network** | 100 Mbit/s symmetric |

### Important Considerations

- **No persistent storage required**: BEEFY relay is stateless and recovers from on-chain state on restart
- **Gas optimization**: The relay batches BEEFY proofs when possible to reduce Ethereum gas costs
- **Network latency**: Low latency to Ethereum node is important for timely proof submission
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
- Low latency (< 100ms recommended)
- High availability (99.9%+ uptime)

### DataHaven Node

- Full node or archive node with WebSocket endpoint
- Low latency connection for monitoring BEEFY finality

## Relay Redundancy

### Why Redundancy Matters

Running multiple relay instances provides fault tolerance and ensures continuous bridge operation even if one relay fails. The BeefyClient contract handles duplicate submissions gracefully—only the first valid submission is processed.

### Configuring Redundant Relays

Deploy multiple relay instances pointing to **different RPC providers** for maximum fault tolerance:

**Instance 1 (Primary):**
```json
{
  "source": {
    "polkadot": {
      "endpoint": "wss://datahaven-rpc-1.example.com"
    }
  },
  "sink": {
    "ethereum": {
      "endpoint": "wss://eth-provider-a.example.com"
    }
  }
}
```

**Instance 2 (Backup):**
```json
{
  "source": {
    "polkadot": {
      "endpoint": "wss://datahaven-rpc-2.example.com"
    }
  },
  "sink": {
    "ethereum": {
      "endpoint": "wss://eth-provider-b.example.com"
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

### Ethereum Private Key

The BEEFY Relay requires an **Ethereum private key** to sign and submit transactions to the BeefyClient contract.

| Key Type | Purpose |
|----------|---------|
| Ethereum (secp256k1) | Sign Ethereum transactions to BeefyClient contract |

### Account Funding

The relay account must be funded with ETH to pay for gas when submitting BEEFY proofs.

**Recommended Balance**: 0.5+ ETH for continuous operations (gas costs vary with network conditions)

For detailed operating cost estimates and optimization strategies, see the [Relay Operating Costs](./snowbridge-relay-costs.md) guide.

## CLI Flags

### Required Flags

| Flag | Description |
|------|-------------|
| `--config <PATH>` | Path to the JSON configuration file |

### Private Key Flags (One Required)

| Flag | Description |
|------|-------------|
| `--ethereum.private-key <KEY>` | Ethereum private key directly |
| `--ethereum.private-key-file <PATH>` | Path to file containing the private key |
| `--ethereum.private-key-id <ID>` | AWS Secrets Manager secret ID for the private key |

### Optional Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--on-demand` | Synchronize commitments on demand | `false` |

## Configuration File

### Structure

```json
{
  "source": {
    "polkadot": {
      "endpoint": "ws://datahaven-node:9944"
    }
  },
  "sink": {
    "ethereum": {
      "endpoint": "ws://ethereum-node:8546",
      "gas-limit": ""
    },
    "descendants-until-final": 3,
    "contracts": {
      "BeefyClient": "0x4826533B4897376654Bb4d4AD88B7faFD0C98528",
      "Gateway": "0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf"
    }
  },
  "on-demand-sync": {
    "max-tokens": 5,
    "refill-amount": 1,
    "refill-period": 3600
  }
}
```

### Configuration Parameters

#### Source (DataHaven)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `source.polkadot.endpoint` | DataHaven WebSocket endpoint | `ws://datahaven-node:9944` |

#### Sink (Ethereum)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `sink.ethereum.endpoint` | Ethereum WebSocket endpoint | `ws://ethereum-node:8546` |
| `sink.ethereum.gas-limit` | Optional gas limit override | `""` (empty for auto) |
| `sink.descendants-until-final` | Blocks to wait for finality | `3` |
| `sink.contracts.BeefyClient` | BeefyClient contract address | `0x...` |
| `sink.contracts.Gateway` | Gateway contract address | `0x...` |

#### On-Demand Sync (Rate Limiting)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `on-demand-sync.max-tokens` | Maximum tokens for rate limiting | `5` |
| `on-demand-sync.refill-amount` | Tokens to refill per period | `1` |
| `on-demand-sync.refill-period` | Refill period in seconds | `3600` |

## Prerequisites: BEEFY Protocol Ready

Before starting the BEEFY Relay, the BEEFY protocol must be active on DataHaven.

### Check BEEFY Status

```bash
# Using curl with JSON-RPC
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "beefy_getFinalizedHead"}' \
  http://localhost:9944

# Should return a non-zero block hash when ready
```

### Automated Wait (Test Environment)

The test framework automatically waits for BEEFY with a 60-second timeout:

```typescript
const waitBeefyReady = async (pollIntervalMs: number, timeoutMs: number) => {
  // Poll beefy_getFinalizedHead until it returns a non-zero hash
};
```

## Running the Relay

### Docker Run

```bash
docker run -d \
  --name snowbridge-beefy-relay \
  --platform linux/amd64 \
  --add-host host.docker.internal:host-gateway \
  --network datahaven-network \
  -v $(pwd)/beefy-relay.json:/configs/beefy-relay.json:ro \
  --pull always \
  datahavenxyz/snowbridge-relay:latest \
  run beefy \
  --config /configs/beefy-relay.json \
  --ethereum.private-key "0x..."
```

### Docker Compose

```yaml
version: '3.8'

services:
  beefy-relay:
    image: datahavenxyz/snowbridge-relay:latest
    container_name: snowbridge-beefy-relay
    platform: linux/amd64
    restart: unless-stopped
    volumes:
      - ./configs/beefy-relay.json:/configs/beefy-relay.json:ro
    command:
      - "run"
      - "beefy"
      - "--config"
      - "/configs/beefy-relay.json"
      - "--ethereum.private-key-file"
      - "/secrets/ethereum-key"
    secrets:
      - ethereum-key

secrets:
  ethereum-key:
    file: ./secrets/beefy-relay-ethereum-key
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dh-beefy-relay
spec:
  replicas: 1
  selector:
    matchLabels:
      app: dh-beefy-relay
  template:
    metadata:
      labels:
        app: dh-beefy-relay
    spec:
      containers:
      - name: beefy-relay
        image: datahavenxyz/snowbridge-relay:latest
        imagePullPolicy: Always
        args:
          - "run"
          - "beefy"
          - "--config"
          - "/configs/beefy-relay.json"
          - "--ethereum.private-key-file"
          - "/secrets/dh-beefy-relay-ethereum-key"
        volumeMounts:
        - name: config
          mountPath: /configs
          readOnly: true
        - name: secrets
          mountPath: /secrets
          readOnly: true
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "250m"
      volumes:
      - name: config
        configMap:
          name: beefy-relay-config
      - name: secrets
        secret:
          secretName: dh-beefy-relay-ethereum-key
```

Note: BEEFY Relay does **not** require persistent storage (no `volumeClaimTemplates`).

## Contract Requirements

### BeefyClient Contract

The BeefyClient contract must be deployed on Ethereum and initialized with:
- Initial validator set
- Initial BEEFY authority set ID

### Gateway Contract

The Gateway contract coordinates cross-chain message passing and interacts with BeefyClient for verification.

### Get Contract Addresses

Contract addresses are typically stored in a deployments file after contract deployment:

```typescript
const deployments = await parseDeploymentsFile();
const beefyClientAddress = deployments.BeefyClient;
const gatewayAddress = deployments.Gateway;
```

## Monitoring

### Health Checks

```bash
# View relay logs
docker logs -f snowbridge-beefy-relay

# Check for BEEFY proof submissions
docker logs snowbridge-beefy-relay 2>&1 | grep -i "submit\|proof\|commitment"
```

### Key Metrics to Monitor

- BEEFY finality lag (DataHaven blocks behind)
- Ethereum transaction success rate
- Gas costs and account balance
- BeefyClient contract state

### Ethereum Contract State

```bash
# Check BeefyClient latest commitment (using cast from Foundry)
cast call $BEEFY_CLIENT "latestBeefyBlock()" --rpc-url $ETH_RPC_URL
```

## Troubleshooting

### Issue: BEEFY Not Ready

**Symptoms**: Relay fails to start with "BEEFY protocol not ready"

**Check**:
1. DataHaven network has active validators
2. BEEFY pallet is enabled in runtime
3. Sufficient blocks have been produced for BEEFY finality

```bash
# Check BEEFY finalized head
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "beefy_getFinalizedHead"}' \
  http://localhost:9944
```

### Issue: Ethereum Transaction Failures

**Check**:
1. Relay account has sufficient ETH for gas
2. BeefyClient contract is deployed and initialized
3. Gas price is appropriate for network conditions
4. No competing relayers submitting same proofs

### Issue: Rate Limiting

**Symptoms**: Relay slows down or stops submitting proofs

**Check**:
1. `on-demand-sync` configuration is appropriate
2. Increase `max-tokens` if needed for higher throughput
3. Ensure `refill-period` matches expected submission frequency

## Security Considerations

1. **Private Key Protection**: Store Ethereum private keys securely
2. **Gas Management**: Monitor gas costs and set appropriate limits
3. **Access Control**: Use dedicated accounts with minimal ETH
4. **Monitoring**: Set up alerts for transaction failures and low balance

## Economics

### Gas Costs

- BEEFY proof submission: ~0.0003 ETH per message (varies with gas price)
- Validator set updates: Higher gas cost (less frequent)

### Incentives

Relayers can earn incentives for successful proof submissions. See Snowbridge documentation for incentive structure.

## Related Documentation

- [Beacon Relay](./snowbridge-beacon-relay.md)
- [Execution Relay](./snowbridge-execution-relay.md)
- [Solochain Relay](./snowbridge-solochain-relay.md)
- [Relay Operating Costs](./snowbridge-relay-costs.md)
- [Snowbridge Documentation](https://docs.snowbridge.network)
- [DataHaven Snowbridge Repository](https://github.com/datahaven-xyz/snowbridge)
