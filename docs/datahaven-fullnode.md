# DataHaven Full Node Setup

## Overview

Full nodes synchronize with the DataHaven network and provide RPC endpoints for applications without participating in consensus or block production.

## Purpose

- Synchronize and maintain full blockchain state
- Provide RPC/WebSocket endpoints for applications
- Relay transactions to the network
- Query historical blockchain data
- No participation in consensus or validation

## Prerequisites

- DataHaven node binary or Docker image
- Sufficient storage for chain data
- Stable network connection
- Open network ports (30333, optionally 9944)

## Hardware Requirements

Full nodes have moderate hardware requirements as they sync the chain and serve RPC requests but do not participate in consensus.

### Minimum Specifications

| Component | Requirement |
|-----------|-------------|
| **CPU** | 4 physical cores @ 2.5 GHz |
| **RAM** | 16 GB DDR4 |
| **Storage** | 500 GB NVMe SSD |
| **Network** | 100 Mbit/s symmetric |

### Recommended Specifications

| Component | Requirement |
|-----------|-------------|
| **CPU** | 8 physical cores @ 3.0 GHz (Intel Ice Lake+ or AMD Zen3+) |
| **RAM** | 32 GB DDR4 |
| **Storage** | 1 TB NVMe SSD |
| **Network** | 500 Mbit/s symmetric |

### Important Considerations

- **Storage growth**: Plan for chain data growth over time; storage requirements will increase
- **RPC load**: If serving many RPC requests, consider higher CPU and RAM specifications
- **Archive node**: If running an archive node (full history), significantly more storage is required (2+ TB)
- **Cloud compatible**: Unlike validators, full nodes can run effectively on cloud VPS

## Key Requirements

### No Session Keys Required

Full nodes do **not** require session keys since they don't participate in consensus.

### Node Key (Optional)

A node key is optional but recommended for persistent peer identity:

```bash
# Generate node key
datahaven-node key generate-node-key > /data/fullnode/node-key.txt
```

## Wallet Requirements

### No Wallet Required

Full nodes do not submit transactions or participate in consensus, so no funded account is needed.

## CLI Flags

### Required Flags

```bash
datahaven-node \
  --chain <CHAIN_SPEC> \
  --name <NODE_NAME>
```

### Important Full Node Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--chain <SPEC>` | Chain specification (stagenet-local, testnet-local, mainnet-local) | Required |
| `--name <NAME>` | Human-readable node name | Required |
| `--base-path <PATH>` | Base directory for chain data | `~/.local/share/datahaven-node` |
| `--port <PORT>` | P2P network port | `30333` |
| `--rpc-port <PORT>` | WebSocket RPC port | `9944` |
| `--rpc-external` | Listen on all network interfaces | Localhost only |
| `--rpc-cors <ORIGINS>` | CORS origins for RPC | `localhost` |
| `--rpc-methods <METHOD>` | RPC methods allowed (`safe`, `unsafe`, `auto`) | `auto` |
| `--bootnodes <MULTIADDR>` | Bootstrap nodes for peer discovery | None |

### Pruning and Storage Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--pruning <MODE>` | State pruning mode (`archive`, `<number>`) | `256` blocks |
| `--blocks-pruning <MODE>` | Block pruning mode (`archive`, `archive-canonical`, `<number>`) | `archive-canonical` |
| `--state-cache-size <MB>` | State cache size in MB | `67108864` (64 GB) |

### Network Flags

| Flag | Description |
|------|-------------|
| `--public-addr <MULTIADDR>` | Public address to advertise |
| `--listen-addr <MULTIADDR>` | Listen address for P2P |
| `--reserved-nodes <MULTIADDR>` | Reserved peer addresses |
| `--reserved-only` | Only connect to reserved nodes |
| `--no-private-ip` | Disable private IP discovery |

### Optional Flags

| Flag | Description |
|------|-------------|
| `--prometheus-external` | Expose Prometheus metrics externally |
| `--prometheus-port <PORT>` | Prometheus metrics port (default: 9615) |
| `--telemetry-url <URL>` | Telemetry endpoint |
| `--log <TARGETS>` | Logging verbosity (e.g., `info,libp2p=debug`) |
| `--max-runtime-instances <N>` | Max WASM runtime instances |
| `--execution <STRATEGY>` | Execution strategy (`native`, `wasm`, `both`) |

## Complete Setup Examples

### 1. Basic Full Node

```bash
datahaven-node \
  --chain stagenet-local \
  --name "FullNode-01" \
  --base-path /data/fullnode \
  --port 30333 \
  --rpc-port 9944 \
  --rpc-external \
  --rpc-cors all \
  --bootnodes /dns/bootnode.example.com/tcp/30333/p2p/12D3KooW...
```

### 2. Archive Node

```bash
datahaven-node \
  --chain stagenet-local \
  --name "ArchiveNode-01" \
  --base-path /data/archive \
  --pruning archive \
  --blocks-pruning archive \
  --port 30333 \
  --rpc-port 9944 \
  --rpc-external \
  --rpc-cors all \
  --rpc-methods safe
```

### 3. RPC Node with High Performance

```bash
datahaven-node \
  --chain stagenet-local \
  --name "RPC-Node-01" \
  --base-path /data/rpc \
  --port 30333 \
  --rpc-port 9944 \
  --rpc-external \
  --rpc-cors all \
  --rpc-methods safe \
  --state-cache-size 134217728 \
  --max-runtime-instances 8 \
  --execution wasm
```

## Docker Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  fullnode:
    image: datahavenxyz/datahaven:latest
    container_name: datahaven-fullnode
    ports:
      - "30333:30333"
      - "9944:9944"
      - "9615:9615"  # Prometheus metrics
    volumes:
      - fullnode-data:/data
    command:
      - "--chain=stagenet-local"
      - "--name=FullNode-01"
      - "--base-path=/data"
      - "--port=30333"
      - "--rpc-port=9944"
      - "--rpc-external"
      - "--rpc-cors=all"
      - "--rpc-methods=safe"
      - "--prometheus-external"
      - "--prometheus-port=9615"
      - "--bootnodes=/dns/bootnode/tcp/30333/p2p/12D3KooW..."
    restart: unless-stopped

volumes:
  fullnode-data:
```

### Docker Run

```bash
docker run -d \
  --name datahaven-fullnode \
  -p 30333:30333 \
  -p 9944:9944 \
  -v $(pwd)/fullnode-data:/data \
  datahavenxyz/datahaven:latest \
  --chain stagenet-local \
  --name "FullNode-01" \
  --base-path /data \
  --port 30333 \
  --rpc-port 9944 \
  --rpc-external \
  --rpc-cors all \
  --rpc-methods safe
```

## Kubernetes Deployment

```yaml
apiVersion: v1
kind: Service
metadata:
  name: datahaven-fullnode
spec:
  type: LoadBalancer
  ports:
    - port: 30333
      targetPort: 30333
      name: p2p
    - port: 9944
      targetPort: 9944
      name: rpc
    - port: 9615
      targetPort: 9615
      name: metrics
  selector:
    app: datahaven-fullnode

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: datahaven-fullnode
spec:
  serviceName: datahaven-fullnode
  replicas: 1
  selector:
    matchLabels:
      app: datahaven-fullnode
  template:
    metadata:
      labels:
        app: datahaven-fullnode
    spec:
      containers:
      - name: fullnode
        image: datahavenxyz/datahaven:latest
        ports:
        - containerPort: 30333
          name: p2p
        - containerPort: 9944
          name: rpc
        - containerPort: 9615
          name: metrics
        volumeMounts:
        - name: data
          mountPath: /data
        resources:
          requests:
            memory: "8Gi"
            cpu: "2"
          limits:
            memory: "16Gi"
            cpu: "4"
        args:
          - "--chain=stagenet-local"
          - "--name=FullNode-01"
          - "--base-path=/data"
          - "--port=30333"
          - "--rpc-port=9944"
          - "--rpc-external"
          - "--rpc-cors=all"
          - "--rpc-methods=safe"
          - "--prometheus-external"
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

### Not Required

Full nodes do not require any on-chain registration or extrinsics.

## Monitoring

### Health Checks

```bash
# Check node health
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
  http://localhost:9944 | jq

# Check sync status
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_syncState"}' \
  http://localhost:9944 | jq

# Check peer count
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_peers"}' \
  http://localhost:9944 | jq
```

### Prometheus Metrics

Access at `http://localhost:9615/metrics` when `--prometheus-external` is enabled.

Key metrics:
- `substrate_block_height` - Current block height
- `substrate_finalized_height` - Finalized block height
- `substrate_peers_count` - Connected peer count
- `substrate_ready_transactions_number` - Pending transactions
- `substrate_sync_blocks_total` - Total blocks synced

### Log Monitoring

```bash
# View logs with Docker
docker logs -f datahaven-fullnode

# Filter for errors
docker logs datahaven-fullnode 2>&1 | grep -i error

# Check sync progress
docker logs datahaven-fullnode 2>&1 | grep -i "Imported\|Syncing"
```

## RPC Usage Examples

### Query Chain Data

```bash
# Get latest block
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getBlock"}' \
  http://localhost:9944 | jq

# Get account balance
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_accountNextIndex", "params":["0x..."]}' \
  http://localhost:9944 | jq
```

### Submit Transactions

```bash
# Submit extrinsic
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "author_submitExtrinsic", "params":["0x..."]}' \
  http://localhost:9944 | jq
```

## Troubleshooting

### Issue: Slow Sync Speed

**Solutions:**
1. Increase `--max-runtime-instances` to 8-16
2. Increase `--state-cache-size` (requires more RAM)
3. Use faster storage (NVMe SSD)
4. Add more `--bootnodes` for better peer discovery

### Issue: High Memory Usage

**Solutions:**
1. Reduce `--state-cache-size`
2. Enable pruning (remove `--pruning archive`)
3. Reduce `--max-runtime-instances`

### Issue: RPC Connection Refused

**Check:**
1. `--rpc-external` flag is set
2. Port 9944 is open in firewall
3. `--rpc-cors` includes your origin
4. Node is fully started (check logs)

### Issue: No Peers Connecting

**Solutions:**
1. Verify bootnode addresses are correct
2. Check port 30333 is open
3. Use `--listen-addr /ip4/0.0.0.0/tcp/30333`
4. Check firewall rules

## Performance Tuning

### For RPC Workloads

```bash
datahaven-node \
  --rpc-methods safe \
  --rpc-max-connections 1000 \
  --state-cache-size 134217728 \
  --max-runtime-instances 16 \
  --execution wasm
```

### For Archive Node

```bash
datahaven-node \
  --pruning archive \
  --blocks-pruning archive \
  --state-cache-size 268435456
```

### Resource Requirements

| Node Type | CPU | RAM | Storage | Network |
|-----------|-----|-----|---------|---------|
| Full Node (Pruned) | 2-4 cores | 8-16 GB | 100-200 GB | 100 Mbps |
| Archive Node | 4-8 cores | 16-32 GB | 500+ GB | 100 Mbps |
| RPC Node (High Traffic) | 8-16 cores | 32-64 GB | 200-500 GB | 1 Gbps |

## Security Considerations

1. **RPC Security**: Use `--rpc-methods safe` for public endpoints
2. **CORS**: Restrict `--rpc-cors` to specific domains in production
3. **Rate Limiting**: Implement reverse proxy with rate limiting
4. **Firewall**: Restrict RPC access to known IPs
5. **Monitoring**: Set up alerts for unusual activity

## Best Practices

1. Use dedicated server for production RPC nodes
2. Enable Prometheus metrics for monitoring
3. Regular backups of chain data
4. Use load balancer for multiple RPC nodes
5. Keep node software updated
6. Monitor disk space usage
7. Implement log rotation

## Related Documentation

- [Bootnode Setup](./datahaven-bootnode.md)
- [Validator Setup](./datahaven-validator.md)
- [Docker Compose Guide](../operator/DOCKER-COMPOSE.md)
- [Kubernetes Deployment](../deploy/charts/node/README.md)
