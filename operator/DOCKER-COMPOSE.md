# Docker Compose Setup for DataHaven Network

This docker-compose configuration runs a local DataHaven network with:
- **2 Validator nodes**: Alice and Bob
- **1 Main Storage Provider (MSP)** node: Charlie (exposed as "msp")
- **2 Backup Storage Provider (BSP)** nodes: Dave (bsp01) and Eve (bsp02)

## Prerequisites

- Docker & Docker Compose installed
- Pre-built DataHaven binary (see Building section)

## Directory Structure

```
operator/
├── docker-compose.yml          # Main compose configuration
├── Dockerfile                  # Node image
├── scripts/
│   ├── docker-entrypoint.sh   # Unified key injection entrypoint
│   └── docker-prepare.sh      # Build preparation script
└── DOCKER-COMPOSE.md          # This file
```

## Building the Binary

Before running docker-compose, you need to build the DataHaven node binary.

### Option 1: Using the prepare script (Recommended)

```bash
# For development (faster blocks with fast-runtime feature)
./scripts/docker-prepare.sh --fast

# For production
./scripts/docker-prepare.sh
```

### Option 2: Manual build

```bash
# For development (faster blocks with fast-runtime feature)
cargo build --release --features fast-runtime

# For production
cargo build --release

# Copy binary to expected location
mkdir -p build
cp target/release/datahaven-node build/
```

The binary will be output to `target/release/datahaven-node` and copied to `build/datahaven-node`.

## Running the Network

Once the binary is built and copied, start the network:

```bash
# Start both validators
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific node
docker-compose logs -f alice
docker-compose logs -f bob
docker-compose logs -f msp
docker-compose logs -f bsp01
docker-compose logs -f bsp02
```

### Key Injection

All nodes automatically inject the required keys on startup using the unified `docker-entrypoint.sh` script.

#### Validator Keys (Alice, Bob)
Validators require 4 keys:
1. **GRANDPA** (`gran`) - ed25519 - Finality gadget
2. **BABE** (`babe`) - sr25519 - Block authoring
3. **ImOnline** (`imon`) - sr25519 - Validator heartbeat
4. **BEEFY** (`beef`) - ecdsa - Bridge consensus

#### Storage Provider Keys (MSP/BSP)
Storage providers (both MSP and BSP) require 1 key:
1. **BCSV** (`bcsv`) - ecdsa - Storage provider identity

Keys are derived from a test seed phrase using the pattern: `<seed>//<NodeName>` (e.g., `//Alice`, `//Bob`, `//Charlie`, `//Dave`, `//Eve`).

**⚠️ Security Warning**: The default seed phrase is for **development only**. Never use this in production! To use custom seeds, modify the `SEED` environment variable in `docker-compose.yml`.

## Accessing the Nodes

All nodes are accessible on the following ports:

### Alice (Primary Validator)
- **WebSocket/RPC**: `ws://localhost:9944`
- **Prometheus Metrics**: `http://localhost:9615`
- **P2P**: `localhost:30333`

### Bob (Secondary Validator)
- **WebSocket/RPC**: `ws://localhost:9945`
- **Prometheus Metrics**: `http://localhost:9616`
- **P2P**: `localhost:30334`

### MSP (Main Storage Provider - Charlie)
- **WebSocket/RPC**: `ws://localhost:9946`
- **Prometheus Metrics**: `http://localhost:9617`
- **P2P**: `localhost:30335`
- **Storage Capacity**: 1 GiB
- **Jump Capacity**: 100 MiB
- **Charging Period**: 100 blocks

### BSP01 (Backup Storage Provider - Dave)
- **WebSocket/RPC**: `ws://localhost:9947`
- **Prometheus Metrics**: `http://localhost:9618`
- **P2P**: `localhost:30336`
- **Storage Capacity**: 1 GiB
- **Jump Capacity**: 100 MiB

### BSP02 (Backup Storage Provider - Eve)
- **WebSocket/RPC**: `ws://localhost:9948`
- **Prometheus Metrics**: `http://localhost:9619`
- **P2P**: `localhost:30337`
- **Storage Capacity**: 1 GiB
- **Jump Capacity**: 100 MiB

## Network Communication

All nodes run on a shared Docker network (`datahaven-network`). All nodes use:
- `--discover-local` for automatic peer discovery via mDNS
- `--unsafe-force-node-key-generation` for automatic node key generation

The validators (Alice and Bob) will produce blocks, while the storage providers (MSP and BSPs) provide storage services.

**Note**: All nodes use libp2p as the network backend (`--network-backend=libp2p`).

### Docker Desktop for macOS
**Important**: On Docker Desktop for macOS, you must use the **experimental DockerVMM** virtualization framework for proper networking support.

To enable DockerVMM:
1. Open Docker Desktop settings
2. Go to "General" tab
3. Enable "Use experimental virtualization framework (DockerVMM)"
4. Restart Docker Desktop

**Note**: The default Apple Virtualization Framework will cause networking issues with peer-to-peer connections, resulting in connection failures and protocol handshake errors.

## Stopping the Network

```bash
# Stop all nodes
docker-compose down

# Stop and remove volumes (clears chain data)
docker-compose down -v
```

## Configuration Notes

### Node Flags
- `--chain=stagenet-local` - Use stagenet-local chain specification (ensures all nodes share same genesis)
- `--base-path=/data` - Base directory for chain data and keystore
- `--keystore-path=/data/keystore` - Keystore persisted in Docker volumes
- `--validator` - Enables validator mode (Alice & Bob only)
- `--pool-type=fork-aware` - Uses fork-aware transaction pool for better fork handling
- `--unsafe-force-node-key-generation` - Automatic P2P key generation
- `--unsafe-rpc-external` - RPC exposed externally (**development only!**)
- `--rpc-cors=all` - Allows all CORS origins
- `--force-authoring` - Forces block authoring even with a single validator (Alice only)
- `--no-prometheus` - Prometheus metrics disabled
- `--enable-offchain-indexing=true` - Enables offchain indexing
- `--discover-local` - Enables local peer discovery via mDNS
- `--alice` / `--bob` - Use well-known development identities
- `--provider` - Enables storage provider mode (MSP & BSP)
- `--provider-type=msp|bsp` - Type of storage provider
- `--max-storage-capacity` - Maximum storage capacity in bytes (1073741824 = 1 GiB)
- `--jump-capacity` - Jump capacity in bytes (104857600 = 100 MiB)
- `--msp-charging-period` - Charging period in blocks (MSP only)

### Node Types
The docker-compose setup includes three node types:
1. **Validators** (`NODE_TYPE=validator`) - Alice & Bob
   - Run consensus and produce blocks
   - Require 4 keys: gran, babe, imon, beef
2. **MSP** (`NODE_TYPE=msp`) - Charlie (name: msp)
   - Main Storage Provider with storage provider capabilities
   - Requires 1 key: bcsv
   - Additional flags: `--provider`, `--provider-type=msp`, `--msp-charging-period`, storage capacity settings
3. **BSP** (`NODE_TYPE=bsp`) - Dave (bsp01) & Eve (bsp02)
   - Backup Storage Provider with storage provider capabilities
   - Requires 1 key: bcsv
   - Additional flags: `--provider`, `--provider-type=bsp`, storage capacity settings

### Storage
- **Chain data**: Persisted in Docker volumes at `/data` (not using `--tmp`)
- **Keystore**: Persisted in Docker volumes at `/data/keystore` (`alice-keystore`, `bob-keystore`, `msp-keystore`, `bsp01-keystore`, `bsp02-keystore`)
- To clear all data and start fresh: `docker-compose down -v`

### User Permissions
- Containers run as `root` user to allow the entrypoint script to inject keys and set permissions
- The entrypoint script (`docker-entrypoint.sh`) switches to the `datahaven` user (UID 1001) before starting the node process
- Keystore and data directories are owned by `datahaven:datahaven`

### Security
All settings are configured for **local development only**:
- Uses well-known test seed phrase
- RPC exposed without authentication
- Unsafe flags enabled for convenience

## Troubleshooting

### Binary not found error
If you see "datahaven-node: No such file or directory", ensure:
1. You're in the operator directory: `cd operator`
2. You've built the binary: `cargo build --release`
3. You've copied it to the correct location: `cp target/release/datahaven-node build/`
   Or simply run: `./prepare-docker.sh`

### Nodes not connecting
Check the logs to ensure nodes are peering correctly:
```bash
# Check if Bob connected to Alice
docker-compose logs bob | grep -i "peer\|sync"

# Check if MSP connected to Alice
docker-compose logs msp | grep -i "peer\|sync"

# View Alice's peer connections
docker-compose logs alice | grep -i "peer"
```

You should see messages like:
- `Discovered new external address`
- `Syncing` or `best: #X`
- Connection established messages

If nodes are not connecting:
1. Ensure Alice started first and is running: `docker-compose ps alice`
2. Verify Alice is accessible on the Docker network: `docker exec datahaven-bob ping alice`
3. Check Alice's peer ID matches the bootnode address in the config

### Port conflicts
If ports are already in use, modify the port mappings in `docker-compose.yml`:
```yaml
ports:
  - "YOUR_PORT:9944"  # Change YOUR_PORT to an available port
```

### Key injection issues
If you see key injection errors in the logs:
```bash
# Check the logs for key injection
docker-compose logs alice | grep "🔑"

# Verify keystore contents
docker exec datahaven-alice ls -la /keystore
```

To regenerate keys, remove the keystore volumes and restart:
```bash
docker-compose down -v
docker-compose up -d
```

### Checking node keys
To verify that keys were injected successfully:
```bash
# Alice keys (validator - 4 keys)
docker exec datahaven-alice ls -la /keystore

# Bob keys (validator - 4 keys)
docker exec datahaven-bob ls -la /keystore

# MSP keys (storage provider - 1 key)
docker exec datahaven-msp ls -la /data/keystore

# BSP keys (storage provider - 1 key)
docker exec datahaven-bsp01 ls -la /data/keystore
docker exec datahaven-bsp02 ls -la /data/keystore
```

Validators should show: `babe`, `gran`, `imon`, and `beef`
Storage providers (MSP/BSP) should show: `bcsv`
