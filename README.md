# DataHaven 🫎

AI-First Decentralized Storage secured by EigenLayer — a verifiable storage network for AI training data, machine learning models, and Web3 applications.

## Overview

DataHaven is a decentralized storage and retrieval network designed for applications that need verifiable, production-scale data storage. Built on [StorageHub](https://github.com/Moonsong-Labs/storage-hub) and secured by EigenLayer's restaking protocol, DataHaven separates storage from verification: providers store data off-chain while cryptographic commitments are anchored on-chain for tamper-evident verification.

**Core Capabilities:**

- **Verifiable Storage**: Files are chunked, hashed into Merkle trees, and committed on-chain — enabling cryptographic proof that data hasn't been tampered with
- **Provider Network**: Main Storage Providers (MSPs) serve data with competitive offerings, while Backup Storage Providers (BSPs) ensure redundancy through decentralized replication with on-chain slashing for failed proof challenges
- **EigenLayer Security**: Validator set secured by Ethereum restaking — DataHaven validators register as EigenLayer operators with slashing for misbehavior
- **EVM Compatibility**: Full Ethereum support via Frontier pallets for smart contracts and familiar Web3 tooling
- **Cross-chain Bridge**: Native, trustless bridging with Ethereum via Snowbridge for tokens and messages

## Architecture

DataHaven combines EigenLayer's shared security with StorageHub's decentralized storage infrastructure:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Ethereum (L1)                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  EigenLayer AVS Contracts                                             │  │
│  │  • DataHavenServiceManager (validator lifecycle & slashing)           │  │
│  │  • RewardsRegistry (validator performance & rewards)                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    ↕                                        │
│                          Snowbridge Protocol                                │
│                    (trustless cross-chain messaging)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                     ↕
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DataHaven (Substrate)                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  StorageHub Pallets                     DataHaven Pallets             │  │
│  │  • file-system (file operations)        • External Validators         │  │
│  │  • providers (MSP/BSP registry)         • Native Transfer             │  │
│  │  • proofs-dealer (challenge/verify)     • Rewards                     │  │
│  │  • payment-streams (storage payments)   • Frontier (EVM)              │  │
│  │  • bucket-nfts (bucket ownership)                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     ↕
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Storage Provider Network                             │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐        │
│  │  Main Storage Providers     │    │  Backup Storage Providers   │        │
│  │  (MSP)                      │    │  (BSP)                      │        │
│  │  • User-selected            │    │  • Network-assigned         │        │
│  │  • Serve read requests      │    │  • Replicate data           │        │
│  │  • Anchor bucket roots      │    │  • Proof challenges         │        │
│  │  • MSP Backend service      │    │  • On-chain slashing        │        │
│  └─────────────────────────────┘    └─────────────────────────────┘        │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐        │
│  │  Indexer                    │    │  Fisherman                  │        │
│  │  • Index on-chain events    │    │  • Audit storage proofs     │        │
│  │  • Query storage metadata   │    │  • Trigger challenges       │        │
│  │  • PostgreSQL backend       │    │  • Detect misbehavior       │        │
│  └─────────────────────────────┘    └─────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### How Storage Works

1. **Upload**: User selects an MSP, creates a bucket, and uploads files. Files are chunked (8KB default), hashed into Merkle trees, and the root is anchored on-chain.
2. **Replication**: The MSP coordinates with BSPs to replicate data across the network based on the bucket's replication policy.
3. **Retrieval**: MSP returns files with Merkle proofs that users verify against on-chain commitments.
4. **Verification**: BSPs face periodic proof challenges — failure to prove data custody results in on-chain slashing via StorageHub pallets.

## Repository Structure

```
datahaven/
├── contracts/      # EigenLayer AVS smart contracts
│   ├── src/       # Service Manager, Rewards Registry, Slasher
│   ├── script/    # Deployment scripts
│   └── test/      # Foundry test suites
├── operator/       # Substrate-based DataHaven node
│   ├── node/      # Node implementation & chain spec
│   ├── pallets/   # Custom pallets (validators, rewards, transfers)
│   └── runtime/   # Runtime configurations (mainnet/stagenet/testnet)
├── test/           # E2E testing framework
│   ├── suites/    # Integration test scenarios
│   ├── framework/ # Test utilities and helpers
│   └── launcher/  # Network deployment automation
├── deploy/         # Kubernetes deployment charts
│   ├── charts/    # Helm charts for nodes and relayers
│   └── environments/ # Environment-specific configurations
├── tools/          # GitHub automation and release scripts
└── .github/        # CI/CD workflows
```

Each directory contains its own README with detailed information. See:
- [contracts/README.md](contracts/README.md) - Smart contract development
- [operator/README.md](operator/README.md) - Node building and runtime development
- [test/README.md](test/README.md) - E2E testing and network deployment
- [deploy/README.md](deploy/README.md) - Kubernetes deployment
- [tools/README.md](tools/README.md) - Development tools

## Quick Start

### Prerequisites

- [Kurtosis](https://docs.kurtosis.com/install) - Network orchestration
- [Bun](https://bun.sh/) v1.3.2+ - TypeScript runtime
- [Docker](https://www.docker.com/) - Container management
- [Foundry](https://getfoundry.sh/) - Solidity toolkit
- [Rust](https://www.rust-lang.org/tools/install) - For building the operator
- [Helm](https://helm.sh/) - Kubernetes deployments (optional)
- [Zig](https://ziglang.org/) - For macOS cross-compilation (macOS only)

### Launch Local Network

The fastest way to get started is with the interactive CLI:

```bash
cd test
bun i                    # Install dependencies
bun cli launch           # Interactive launcher with prompts
```

This deploys a complete environment including:
- **Ethereum network**: 2x EL clients (reth), 2x CL clients (lodestar)
- **Block explorers**: Blockscout (optional), Dora consensus explorer
- **DataHaven node**: Single validator with fast block times
- **Storage providers**: MSP and BSP nodes for decentralized storage
- **AVS contracts**: Deployed and configured on Ethereum
- **Snowbridge relayers**: Bidirectional message passing

For more options and detailed instructions, see the [test README](./test/README.md).

### Run Tests

```bash
cd test
bun test:e2e              # Run all integration tests
bun test:e2e:parallel     # Run with limited concurrency
```

NOTES: Adding the environment variable `INJECT_CONTRACTS=true` will inject the contracts when starting the tests to speed up setup.

### Development Workflows

**Smart Contract Development**:
```bash
cd contracts
forge build               # Compile contracts
forge test                # Run contract tests
```

**Node Development**:
```bash
cd operator
cargo build --release --features fast-runtime
cargo test
./scripts/run-benchmarks.sh
```

**After Making Changes**:
```bash
cd test
bun generate:wagmi        # Regenerate contract bindings
bun generate:types        # Regenerate runtime types
```

## Key Features

### Verifiable Decentralized Storage
Production-scale storage with cryptographic guarantees:
- **Buckets**: User-created containers managed by an MSP, summarized by a Merkle-Patricia trie root on-chain
- **Files**: Deterministically chunked, hashed into Merkle trees, with roots serving as immutable fingerprints
- **Proofs**: Merkle proofs enable verification of data integrity without trusting intermediaries
- **Audits**: BSPs prove ongoing data custody via randomized proof challenges

### Storage Provider Network
Two-tier provider model balancing performance and reliability:
- **MSPs**: User-selected providers offering data retrieval with competitive service offerings
- **BSPs**: Network-assigned backup providers ensuring data redundancy and availability, with on-chain slashing for failed proof challenges
- **Fisherman**: Auditing service that monitors proofs and triggers challenges for misbehavior
- **Indexer**: Indexes on-chain storage events for efficient querying

### EigenLayer Security
DataHaven validators secured through Ethereum restaking:
- Validators register as operators via `DataHavenServiceManager` contract
- Economic security through ETH restaking
- Slashing for validator misbehavior (separate from BSP slashing which is on-chain)
- Performance-based validator rewards through `RewardsRegistry`

### EVM Compatibility
Full Ethereum Virtual Machine support via Frontier pallets:
- Deploy Solidity smart contracts
- Use existing Ethereum tooling (MetaMask, Hardhat, etc.)
- Compatible with ERC-20, ERC-721, and other standards

### Cross-chain Communication
Trustless bridging via Snowbridge:
- Native token transfers between Ethereum ↔ DataHaven
- Cross-chain message passing
- Finality proofs via BEEFY consensus
- Three specialized relayers (beacon, BEEFY, execution)

## Use Cases

DataHaven is designed for applications requiring verifiable, tamper-proof data storage:

- **AI & Machine Learning**: Store training datasets, model weights, and agent configurations with cryptographic proofs of integrity — enabling federated learning and verifiable AI pipelines
- **DePIN (Decentralized Physical Infrastructure)**: Persistent storage for IoT sensor data, device configurations, and operational logs with provable data lineage
- **Real World Assets (RWAs)**: Immutable storage for asset documentation, ownership records, and compliance data with on-chain verification

## Docker Images

Production images published to [DockerHub](https://hub.docker.com/r/datahavenxyz/datahaven).

**Build optimizations**:
- [sccache](https://github.com/mozilla/sccache) - Rust compilation caching
- [cargo-chef](https://lpalmieri.com/posts/fast-rust-docker-builds/) - Dependency layer caching
- [BuildKit cache mounts](https://docs.docker.com/build/cache/optimize/#use-cache-mounts) - External cache restoration

**Build locally**:
```bash
cd test
bun build:docker:operator    # Creates datahavenxyz/datahaven:local
```

## Development Environment

### VS Code Configuration

IDE configurations are excluded from version control for personalization, but these settings are recommended for optimal developer experience. Add to your `.vscode/settings.json`:

**Rust Analyzer**:
```json
{
  "rust-analyzer.linkedProjects": ["./operator/Cargo.toml"],
  "rust-analyzer.cargo.allTargets": true,
  "rust-analyzer.procMacro.enable": false,
  "rust-analyzer.server.extraEnv": {
    "CARGO_TARGET_DIR": "target/.rust-analyzer",
    "SKIP_WASM_BUILD": 1
  },
  "rust-analyzer.diagnostics.disabled": ["unresolved-macro-call"],
  "rust-analyzer.cargo.buildScripts.enable": false
}
```

Optimizations:
- Links `operator/` directory as the primary Rust project
- Disables proc macros and build scripts for faster analysis (Substrate macros are slow)
- Uses dedicated target directory to avoid conflicts
- Skips WASM builds during development

**Solidity** ([Juan Blanco's extension](https://marketplace.visualstudio.com/items?itemName=JuanBlanco.solidity)):
```json
{
  "solidity.formatter": "forge",
  "solidity.compileUsingRemoteVersion": "v0.8.28+commit.7893614a",
  "[solidity]": {
    "editor.defaultFormatter": "JuanBlanco.solidity"
  }
}
```

Note: Solidity version must match [foundry.toml](./contracts/foundry.toml)

**TypeScript** ([Biome](https://github.com/biomejs/biome)):
```json
{
  "biome.lsp.bin": "test/node_modules/.bin/biome",
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome",
    "editor.codeActionsOnSave": {
      "source.organizeImports.biome": "always"
    }
  }
}
```

## CI/CD

### Local CI Testing

Run GitHub Actions workflows locally using [act](https://github.com/nektos/act):

```bash
# Run E2E workflow
act -W .github/workflows/e2e.yml -s GITHUB_TOKEN="$(gh auth token)"

# Run specific job
act -W .github/workflows/e2e.yml -j test-job-name
```

### Automated Workflows

The repository includes GitHub Actions for:
- **E2E Testing**: Full integration tests on PR and main branch
- **Contract Testing**: Foundry test suites for smart contracts
- **Rust Testing**: Unit and integration tests for operator
- **Docker Builds**: Multi-platform image builds with caching
- **Release Automation**: Version tagging and changelog generation

See `.github/workflows/` for workflow definitions.

## Contributing

### Development Cycle

1. **Make Changes**: Edit contracts, runtime, or tests
2. **Run Tests**: Component-specific tests (`forge test`, `cargo test`)
3. **Regenerate Types**: Update bindings if contracts/runtime changed
4. **Integration Test**: Run E2E tests to verify cross-component behavior
5. **Code Quality**: Format and lint (`cargo fmt`, `forge fmt`, `bun fmt:fix`)

### Common Pitfalls

- **Type mismatches**: Regenerate with `bun generate:types` after runtime changes
- **Contract changes not reflected**: Run `bun generate:wagmi` after modifications
- **Kurtosis issues**: Ensure Docker is running and Kurtosis engine is started
- **Slow development**: Use `--features fast-runtime` for shorter epochs/eras (block time stays 6s)
- **Network launch hangs**: Check Blockscout - forge output can appear frozen

See [CLAUDE.md](./CLAUDE.md) for detailed development guidance.

## License

GPL-3.0 - See LICENSE file for details

## Links

- [DataHaven Website](https://datahaven.xyz/)
- [DataHaven Documentation](https://docs.datahaven.xyz/)
- [StorageHub Repository](https://github.com/Moonsong-Labs/storage-hub)
- [EigenLayer Documentation](https://docs.eigenlayer.xyz/)
- [Substrate Documentation](https://docs.substrate.io/)
- [Snowbridge Documentation](https://docs.snowbridge.network/)
- [Foundry Book](https://book.getfoundry.sh/)
- [Polkadot-API Documentation](https://papi.how/)
- ---
## Contributors from Africa
DataHaven welcomes contributors from Lagos, Nigeria and across the continent! 🇳🇬
