# DataHaven Operator (Substrate Node) 🫎

The DataHaven operator is a Substrate-based blockchain node that serves as an EigenLayer AVS operator. It combines Substrate's modular framework with EVM compatibility (via Frontier) and cross-chain capabilities (via Snowbridge).

## Overview

Built on the [polkadot-sdk-solochain-template](https://github.com/paritytech/polkadot-sdk-solochain-template), this node implements:

- **EVM Compatibility**: Full Ethereum compatibility via Frontier pallets
- **EigenLayer Integration**: Operator registration and management via AVS contracts
- **External Validators**: Dynamic validator set controlled by EigenLayer registry
- **Cross-chain Communication**: Token and message passing via Snowbridge
- **Rewards System**: Performance-based validator rewards from Ethereum

## Project Structure

```
operator/
├── node/                          # Node implementation
│   ├── src/
│   │   ├── chain_spec.rs         # Chain specification & genesis config
│   │   ├── cli.rs                # CLI interface
│   │   ├── command.rs            # Command handlers
│   │   ├── rpc.rs                # RPC configuration
│   │   └── service.rs            # Node service setup
├── pallets/                      # Custom pallets
│   ├── external-validators/      # EigenLayer validator set management
│   ├── native-transfer/          # Cross-chain token transfers
│   └── rewards/                  # Validator rewards distribution
├── runtime/                      # Runtime configurations
│   ├── mainnet/                  # Mainnet runtime
│   ├── stagenet/                 # Stagenet runtime
│   └── testnet/                  # Testnet runtime (with fast-runtime feature)
└── scripts/                      # Utility scripts
    └── run-benchmarks.sh         # Runtime benchmarking automation
```

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Substrate dependencies](https://docs.substrate.io/install/)
- [Zig](https://ziglang.org/) (macOS only, for cross-compilation)

## Building

### Development Build (Fast Runtime)

For local development with shorter epochs and eras:

```bash
cargo build --release --features fast-runtime
```

This switches runtime parameters to the fast variants (1-minute epochs, 3 sessions per era) while the block time remains 6 seconds.

### Production Build

For production or stagenet deployments:

```bash
cargo build --release
```

### Running Tests

```bash
# Run all tests
cargo test

# Run tests for specific pallet
cargo test -p pallet-external-validators

# Run with output
cargo test -- --nocapture
```

### Code Quality

```bash
# Format code
cargo fmt

# Lint with clippy
cargo clippy --all-targets --all-features
```

## Benchmarking

DataHaven uses runtime benchmarking to generate accurate weight calculations for all pallets. The benchmarking process is automated using `frame-omni-bencher`.

### Requirements

- Latest Rust stable version
- `frame-omni-bencher`: Install with `cargo install frame-omni-bencher --profile=production`

### Running Benchmarks

Execute from the operator directory:

```bash
# Benchmark all pallets for testnet runtime (default)
./scripts/run-benchmarks.sh

# Benchmark specific runtime
./scripts/run-benchmarks.sh mainnet

# Custom steps and repetitions
./scripts/run-benchmarks.sh testnet 100 50
```

The script will:
1. Discover all available pallets
2. Build runtime WASM with `runtime-benchmarks` feature
3. Generate weight files in `runtime/{runtime}/src/weights/`
4. Provide summary of results

**Parameters**:
- `runtime`: Runtime to benchmark (testnet, stagenet, mainnet). Default: testnet
- `steps`: Number of steps. Default: 50
- `repeat`: Number of repetitions. Default: 20

## Zombienet Testing

[Zombienet](https://github.com/paritytech/zombienet) provides local multi-validator network testing.

### Setup

1. Install Zombienet:
   ```bash
   # Download binary from releases
   # Or install via npm
   npm install -g @zombienet/cli
   ```

2. Spawn local network with four validators:
   ```bash
   zombienet -p native spawn test/config/zombie-datahaven-local.toml
   ```

This launches a local solochain with BABE consensus for testing validator coordination.

## Docker Image

Build local Docker image for testing:

```bash
cd ../test
bun build:docker:operator
```

This creates `datahavenxyz/datahaven:local` using optimized caching:
- [sccache](https://github.com/mozilla/sccache): Rust build caching
- [cargo-chef](https://lpalmieri.com/posts/fast-rust-docker-builds/): Dependency layer caching
- BuildKit cache mounts: External cache restoration

## Type Generation

After runtime changes, regenerate Polkadot-API TypeScript types:

```bash
cd ../test
bun generate:types           # Production runtime
bun generate:types:fast      # Fast runtime (development)
```

## Integration Testing

For full network integration tests with Ethereum, Snowbridge, and contracts:

```bash
cd ../test
bun cli launch               # Interactive launcher
bun test:e2e                 # Run E2E test suite
```

See the [test directory](../test/README.md) for comprehensive testing documentation.

## Custom Pallets

### External Validators
Manages the dynamic validator set based on EigenLayer operator registry. Syncs validator changes from Ethereum to the Substrate consensus layer.

**Location**: `pallets/external-validators/`

### Native Transfer
Handles cross-chain token transfers between Ethereum and DataHaven via Snowbridge messaging.

**Location**: `pallets/native-transfer/`

### Rewards
Distributes performance-based rewards to validators, processing reward messages from the Ethereum `RewardsRegistry` contract.

**Location**: `pallets/rewards/`

Each pallet includes its own tests and benchmarks. See pallet-specific README files for details.
