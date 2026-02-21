# DataHaven Node Operations Documentation

This directory contains comprehensive documentation for setting up and operating DataHaven and StorageHub nodes.

## Documentation Structure

### DataHaven Nodes
- [Bootnode Setup](./datahaven-bootnode.md) - Bootnode configuration and operations
- [Validator Setup](./datahaven-validator.md) - Validator node configuration and operations
- [Full Node Setup](./datahaven-fullnode.md) - Full node (RPC) configuration and operations

### StorageHub Nodes
- [MSP Setup](./storagehub-msp.md) - Main Storage Provider configuration and operations
- [BSP Setup](./storagehub-bsp.md) - Backup Storage Provider configuration and operations
- [Indexer Setup](./storagehub-indexer.md) - Indexer node configuration and operations
- [Fisherman Setup](./storagehub-fisherman.md) - Fisherman node configuration and operations

## Quick Reference

### Node Types Overview

| Node Type | Purpose | Keys Required | On-Chain Registration | Database Required |
|-----------|---------|---------------|----------------------|-------------------|
| **Bootnode** | Network peer discovery | None | No | No |
| **Validator** | Block production & consensus | 4 (BABE, GRANDPA, ImOnline, BEEFY) | Yes (session.setKeys) | No |
| **Full Node** | RPC endpoint, sync only | None | No | No |
| **MSP** | Main storage provider | 1 (BCSV ECDSA) | Yes (2-step: request + confirm) | Optional |
| **BSP** | Backup storage provider | 1 (BCSV ECDSA) | Yes (2-step: request + confirm) | No |
| **Indexer** | Blockchain data indexer | None | No | Yes (PostgreSQL) |
| **Fisherman** | Storage provider monitor | 1 (BCSV ECDSA) | No | Yes (PostgreSQL) |

### Common CLI Flags

All node types support standard Substrate flags:
- `--chain <CHAIN_SPEC>` - Chain specification (dev, local, stagenet-local, testnet-local, mainnet-local)
- `--base-path <PATH>` - Base directory for chain data
- `--name <NAME>` - Human-readable node name
- `--port <PORT>` - P2P network port (default: 30333)
- `--rpc-port <PORT>` - WebSocket RPC port (default: 9944)
- `--rpc-external` - Listen on all network interfaces
- `--rpc-cors <ORIGINS>` - CORS origins for RPC (default: localhost)
- `--bootnodes <MULTIADDR>` - Bootstrap nodes for peer discovery

### Key Types Reference

| Key Type | Scheme | Purpose | Required For |
|----------|--------|---------|--------------|
| `gran` | ed25519 | GRANDPA finality | Validators |
| `babe` | sr25519 | BABE block authoring | Validators |
| `imon` | sr25519 | ImOnline heartbeat | Validators |
| `beef` | ecdsa | BEEFY bridge consensus | Validators |
| `bcsv` | ecdsa | Storage provider identity | MSP, BSP, Fisherman |

### Prerequisites

- [Docker](https://www.docker.com/) - Container runtime
- [Bun](https://bun.sh/) v1.2+ - For testing and tooling
- [Foundry](https://getfoundry.sh/) - For smart contract operations
- [PostgreSQL](https://www.postgresql.org/) - For Indexer and Fisherman nodes

### Getting Started

1. Choose your node type from the list above
2. Follow the specific setup guide for that node type
3. Generate or import keys as required
4. Configure CLI flags and environment
5. Start the node
6. Complete on-chain registration (if required)

### Support & Resources

- [Main Repository](https://github.com/Moonsong-Labs/datahaven)
- [StorageHub Repository](https://github.com/Moonsong-Labs/storage-hub)
- [E2E Testing Guide](../test/README.md)
- [Docker Compose Guide](../operator/DOCKER-COMPOSE.md)
- [Kubernetes Deployment](../deploy/charts/node/README.md)
