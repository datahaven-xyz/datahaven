# DataHaven Bootnode Setup

## Overview

A bootnode serves as an entry point for peer discovery in the DataHaven network. It maintains a stable network identity and helps new nodes discover peers.

## Purpose

- Provide stable peer discovery endpoint
- Maintain persistent network identity
- Facilitate initial network connections for new nodes
- No participation in consensus or block production

## Prerequisites

- DataHaven node binary or Docker image
- Persistent storage for node key
- Open network port (default: 30333)

## Hardware Requirements

Bootnodes have moderate hardware requirements as they only handle peer discovery and do not participate in consensus. Network bandwidth and uptime are the primary concerns.

### Minimum Specifications

| Component | Requirement |
|-----------|-------------|
| **CPU** | 4 physical cores @ 2.0 GHz |
| **RAM** | 8 GB DDR4 |
| **Storage** | 100 GB NVMe SSD |
| **Network** | 500 Mbit/s symmetric |

### Recommended Specifications

| Component | Requirement |
|-----------|-------------|
| **CPU** | 8 physical cores @ 3.0 GHz (Intel Ice Lake+ or AMD Zen3+) |
| **RAM** | 16 GB DDR4 |
| **Storage** | 250 GB NVMe SSD |
| **Network** | 1 Gbit/s symmetric |

### Important Considerations

- **High availability**: Bootnodes should have excellent uptime as they are entry points for the network
- **Geographic distribution**: Deploy bootnodes in multiple regions for network resilience
- **Static IP**: Required for stable multiaddress that other nodes can reference
- **DDoS protection**: Consider DDoS mitigation as bootnodes are publicly known endpoints

## Key Requirements

### Node Key

Bootnodes require a **persistent node key** to maintain a stable peer ID.

#### Generate Node Key

```bash
# Generate a new node key
datahaven-node key generate-node-key > node-key.txt

# View the generated peer ID
datahaven-node key inspect-node-key --file node-key.txt
```

The output will show:
```
12D3KooWXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### No Session Keys Required

Bootnodes do **not** require session keys (BABE, GRANDPA, ImOnline, BEEFY) as they do not participate in consensus.

## Wallet Requirements

### No Wallet Required

Bootnodes do not submit transactions or participate in consensus, so no funded account is needed.

## CLI Flags

### Required Flags

```bash
datahaven-node \
  --chain <CHAIN_SPEC> \
  --name <NODE_NAME> \
  --node-key-file <PATH_TO_NODE_KEY>
```

### Important Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--chain <SPEC>` | Chain specification (stagenet-local, testnet-local, mainnet-local) | Required |
| `--name <NAME>` | Human-readable node name | Required |
| `--node-key-file <PATH>` | Path to node key file | Required |
| `--base-path <PATH>` | Base directory for chain data | `~/.local/share/datahaven-node` |
| `--port <PORT>` | P2P network port | `30333` |
| `--listen-addr <MULTIADDR>` | Listen address for P2P | `/ip4/0.0.0.0/tcp/30333` |
| `--public-addr <MULTIADDR>` | Public address to advertise | Auto-detected |

### Optional Flags

| Flag | Description |
|------|-------------|
| `--no-telemetry` | Disable telemetry reporting |
| `--log <TARGETS>` | Logging targets (e.g., `info,libp2p=debug`) |
| `--unsafe-rpc-external` | Allow external RPC access (not recommended) |

## Complete Setup Example

### 1. Generate Node Key

```bash
mkdir -p /data/bootnode
datahaven-node key generate-node-key > /data/bootnode/node-key.txt
```

### 2. Get Peer ID

```bash
PEER_ID=$(datahaven-node key inspect-node-key --file /data/bootnode/node-key.txt)
echo "Bootnode Peer ID: $PEER_ID"
```

### 3. Start Bootnode

```bash
datahaven-node \
  --chain stagenet-local \
  --name "Bootnode-01" \
  --base-path /data/bootnode \
  --node-key-file /data/bootnode/node-key.txt \
  --port 30333 \
  --listen-addr /ip4/0.0.0.0/tcp/30333 \
  --public-addr /dns/bootnode.example.com/tcp/30333 \
  --no-telemetry
```

### 4. Advertise Bootnode Address

Other nodes can connect using:
```bash
--bootnodes /dns/bootnode.example.com/tcp/30333/p2p/$PEER_ID
```

## Docker Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  bootnode:
    image: datahavenxyz/datahaven:latest
    container_name: datahaven-bootnode
    ports:
      - "30333:30333"
    volumes:
      - bootnode-data:/data
      - ./node-key.txt:/data/node-key.txt:ro
    command:
      - "--chain=stagenet-local"
      - "--name=Bootnode-01"
      - "--base-path=/data"
      - "--node-key-file=/data/node-key.txt"
      - "--port=30333"
      - "--listen-addr=/ip4/0.0.0.0/tcp/30333"
      - "--no-telemetry"

volumes:
  bootnode-data:
```

### Docker Run

```bash
docker run -d \
  --name datahaven-bootnode \
  -p 30333:30333 \
  -v $(pwd)/bootnode-data:/data \
  -v $(pwd)/node-key.txt:/data/node-key.txt:ro \
  datahavenxyz/datahaven:latest \
  --chain stagenet-local \
  --name "Bootnode-01" \
  --base-path /data \
  --node-key-file /data/node-key.txt \
  --port 30333 \
  --no-telemetry
```

## Kubernetes Deployment

```yaml
apiVersion: v1
kind: Service
metadata:
  name: datahaven-bootnode
spec:
  type: LoadBalancer
  ports:
    - port: 30333
      targetPort: 30333
      name: p2p
  selector:
    app: datahaven-bootnode

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: datahaven-bootnode
spec:
  serviceName: datahaven-bootnode
  replicas: 1
  selector:
    matchLabels:
      app: datahaven-bootnode
  template:
    metadata:
      labels:
        app: datahaven-bootnode
    spec:
      containers:
      - name: bootnode
        image: datahavenxyz/datahaven:latest
        ports:
        - containerPort: 30333
          name: p2p
        volumeMounts:
        - name: data
          mountPath: /data
        - name: node-key
          mountPath: /data/node-key.txt
          subPath: node-key.txt
          readOnly: true
        args:
          - "--chain=stagenet-local"
          - "--name=Bootnode-01"
          - "--base-path=/data"
          - "--node-key-file=/data/node-key.txt"
          - "--port=30333"
          - "--no-telemetry"
      volumes:
      - name: node-key
        secret:
          secretName: bootnode-node-key
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 100Gi
```

## On-Chain Registration

### Not Required

Bootnodes do not require any on-chain registration or extrinsics.

## Monitoring

### Health Checks

```bash
# Check peer count
curl -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
  http://localhost:9944

# Check node info
curl -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_localPeerId"}' \
  http://localhost:9944
```

### Logs

```bash
# View logs with Docker
docker logs -f datahaven-bootnode

# Filter for connection events
docker logs datahaven-bootnode 2>&1 | grep -i "discovered\|connected"
```

## Troubleshooting

### Issue: Peers Cannot Connect

**Check:**
1. Port 30333 is open in firewall
2. Public address is correctly configured
3. DNS resolves correctly (if using DNS)
4. Node key file has correct permissions

### Issue: Node Key Not Found

**Solution:**
```bash
# Verify node key file exists
ls -la /data/bootnode/node-key.txt

# Check file permissions
chmod 600 /data/bootnode/node-key.txt
```

### Issue: Network Identity Changes

**Solution:**
Always use `--node-key-file` instead of `--node-key` to ensure the key persists across restarts.

## Security Considerations

1. **Node Key Protection**: Keep node key file secure with restricted permissions (600)
2. **RPC Access**: Do not expose RPC publicly on bootnodes
3. **DDoS Protection**: Implement rate limiting at network level
4. **Monitoring**: Set up alerts for unexpected downtime

## Best Practices

1. Run multiple bootnodes for redundancy
2. Use DNS names instead of IP addresses for flexibility
3. Monitor peer connections and network health
4. Keep node software updated
5. Backup node key securely

## Related Documentation

- [Validator Setup](./datahaven-validator.md)
- [Full Node Setup](./datahaven-fullnode.md)
- [Docker Compose Guide](../operator/DOCKER-COMPOSE.md)
