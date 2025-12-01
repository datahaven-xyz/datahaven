# DataHaven 🫎

An EVM-compatible Substrate blockchain secured by EigenLayer, bridging Ethereum and Substrate ecosystems through trustless cross-chain communication.

## Overview

DataHaven is an EigenLayer Actively Validated Service (AVS) that combines:

- **EVM Compatibility**: Full Ethereum support via Frontier pallets for smart contracts and dApps
- **EigenLayer Security**: Validator set secured by Ethereum's economic security through restaking
- **Cross-chain Bridge**: Seamless asset and message transfers with Ethereum via Snowbridge
- **Dynamic Validators**: Operator registry managed on-chain through EigenLayer contracts
- **Performance Rewards**: Validator incentives distributed cross-chain from Ethereum

## Architecture

DataHaven bridges two major blockchain ecosystems:

```
┌───────────────────────────────────────────────────────────────┐
│                       Ethereum (L1)                           │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  EigenLayer AVS Contracts                              │   │
│  │  • DataHavenServiceManager (operator lifecycle)        │   │
│  │  • RewardsRegistry (performance tracking)              │   │
│  │  • VetoableSlasher (misbehavior penalties)             │   │
│  └────────────────────────────────────────────────────────┘   │
│                            ↕                                  │
│                  Snowbridge Protocol                          │
└───────────────────────────────────────────────────────────────┘
                             ↕
┌───────────────────────────────────────────────────────────────┐
│                    DataHaven (Substrate)                      │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Custom Pallets                                        │   │
│  │  • External Validators (sync validator set)            │   │
│  │  • Native Transfer (cross-chain tokens)                │   │
│  │  • Rewards (distribute validator rewards)              │   │
│  │  • Frontier (EVM compatibility)                        │   │
│  └────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

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

### EVM Compatibility
Full Ethereum Virtual Machine support via Frontier pallets:
- Deploy Solidity smart contracts
- Use existing Ethereum tooling (MetaMask, Hardhat, etc.)
- Compatible with ERC-20, ERC-721, and other standards

### EigenLayer Integration
Validator security anchored to Ethereum:
- Operators register via `DataHavenServiceManager` contract
- Economic security through ETH restaking
- Slashing protection with veto period via `VetoableSlasher`
- Performance-based rewards through `RewardsRegistry`

### Cross-chain Communication
Trustless bridging via Snowbridge:
- Native token transfers between Ethereum ↔ DataHaven
- Cross-chain message passing
- Finality proofs via BEEFY consensus
- Three specialized relayers (beacon, BEEFY, execution)

### Dynamic Validator Set
Validator management synchronized with Ethereum:
- EigenLayer operator registry as source of truth
- On-chain validator set updates via External Validators pallet
- Automatic consensus participation changes
- Cross-chain coordination for validator lifecycle

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

- [EigenLayer Documentation](https://docs.eigenlayer.xyz/)
- [Substrate Documentation](https://docs.substrate.io/)
- [Snowbridge Documentation](https://docs.snowbridge.network/)
- [Foundry Book](https://book.getfoundry.sh/)
- [Polkadot-API Documentation](https://papi.how/)
