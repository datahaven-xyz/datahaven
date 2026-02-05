# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DataHaven is an EVM-compatible Substrate blockchain secured by EigenLayer. It bridges Ethereum and Substrate ecosystems through:
- EigenLayer AVS integration for security
- Snowbridge for cross-chain communication
- Frontier pallets for EVM compatibility
- External validators with rewards system

## Pre-requisites

- [Kurtosis](https://docs.kurtosis.com/install): For launching test networks
- [Bun](https://bun.sh/) v1.2+: TypeScript runtime and package manager
- [Docker](https://www.docker.com/): For container management
- [Foundry](https://getfoundry.sh/): For smart contract compilation/deployment
- [Helm](https://helm.sh/): Kubernetes package manager
- [Zig](https://ziglang.org/) (macOS only): For crossbuilding the node

## Critical Development Commands

### E2E Testing Environment (from `/test` directory)

```bash
# Setup
bun i                               # Install dependencies
bun cli                            # Interactive CLI for test environment

# Code Quality
bun fmt:fix                        # Fix TypeScript formatting (Biome)
bun typecheck                      # TypeScript type checking

# Code Generation (run after contract/runtime changes)
bun generate:wagmi                 # Generate TypeScript contract bindings
bun generate:version               # Generate Solidity version constants from deployments
bun generate:types                 # Generate Polkadot-API types from runtime
bun generate:types:fast            # Generate types with fast-runtime feature
bun validate:versions              # Validate version consistency across codebase

# Local Development - Quick Start
bun cli launch                     # Interactive launcher (recommended)
bun start:e2e:local               # Launch full local test network
bun start:e2e:verified            # Launch with Blockscout + contract verification
bun start:e2e:ci                  # CI-optimized network launch

# Stopping Services
bun stop:e2e                      # Stop all test services (interactive)
bun stop:dh                       # Stop DataHaven only
bun stop:sb                       # Stop Snowbridge relayers only
bun stop:eth                      # Stop Ethereum network only

# Testing
bun test:e2e                      # Run all E2E test suites
bun test:e2e:parallel             # Run tests with limited       
```

### Rust/Operator Development

```bash
cd operator
cargo build --release --features fast-runtime    # Development build (faster)
cargo build --release                           # Production build
cargo test                                      # Run all tests
cargo fmt                                       # Format Rust code
cargo clippy                                    # Lint Rust code
```

### Smart Contracts (from `/contracts` directory)

```bash
forge clean                        # Clean build artifacts
forge build                        # Build contracts
forge test                         # Run tests
forge test -vvv                    # Run tests with stack traces
forge fmt                          # Format Solidity code
```

## Architecture Essentials

### Repository Structure
```
datahaven/
├── contracts/      # EigenLayer AVS smart contracts
├── operator/       # Substrate-based DataHaven node
│   ├── node/      # Node implementation
│   ├── pallets/   # Custom pallets (validators, rewards, transfers)
│   └── runtime/   # Runtime configurations (mainnet/stagenet/testnet)
├── test/          # E2E testing framework
│   ├── suites/    # Test scenarios
│   ├── framework/ # Test utilities
│   └── launcher/  # Network deployment tools
└── deploy/        # Kubernetes deployment charts
```

### Cross-Component Dependencies
- **Contracts → Operator**: AVS contracts register/slash operators via DataHavenServiceManager
- **Operator → Contracts**: Reads validator registry, submits performance data
- **Test → Both**: Deploys contracts, launches nodes, runs cross-chain scenarios
- **Snowbridge**: Bidirectional bridge for tokens/messages between Ethereum↔DataHaven

### Key Components
1. **DataHavenServiceManager**: Core AVS contract managing operator lifecycle
2. **RewardsRegistry**: Tracks validator performance and reward distribution
3. **External Validators Pallet**: Manages validator set on Substrate side
4. **Native Transfer Pallet**: Handles cross-chain token transfers via Snowbridge

### Testing Strategy
- **Unit Tests**: Component-specific (`cargo test`, `forge test`)
- **Integration Tests**: Full network scenarios in `/test/suites`
- **Kurtosis**: Orchestrates multi-container test environments
- **Parallel Testing**: Use `test:e2e:parallel` for faster CI runs

### Version Management

DataHaven uses automated version synchronization with flexible per-deployment versioning:

- **Source of Truth**: `contracts/deployments/{chain}.json` version field (anvil, hoodi, ethereum)
- **On-Chain Version**: Passed as initialization parameter during deployment (not hardcoded)
- **Update Mechanism**: Call `updateVersion()` after contract upgrades to sync on-chain version
- **Generated Reference**: `bun generate:version` creates `Version.sol` (for testing/tooling reference only)
- **Validation**: Use `bun run validate:versions` or `bun cli contracts checks --chain <chain>` to confirm on-chain version matches deployments
- **Multi-Environment**: Environments can share deployment files (e.g., stagenet-hoodi and testnet-hoodi both use hoodi.json)

#### Version Bump Flow (Fully Automated)
- **Deploy**: MINOR bump (X.Y.0 → X.(Y+1).0) via `bun cli contracts deploy`
  - Automatically sets initial version during contract initialization
- **Upgrade**: PATCH bump (X.Y.Z → X.Y.(Z+1)) via `bun cli contracts upgrade`
  - Automatically updates deployment file AND calls `updateVersion()` on-chain
  - No manual steps required!
- **Manual MAJOR**: Edit deployment JSON manually for breaking changes, then run upgrade

#### If Version Out of Sync (Rare)
1. For off-chain: Run `bun generate:version` to regenerate Version.sol reference
2. For on-chain: `cast send $SERVICE_MANAGER "updateVersion(string)" "X.Y.Z" --private-key $OWNER_KEY`
3. Run `bun generate:wagmi` if contract ABI changed

### Development Workflow
1. Make changes to relevant component
2. Run component-specific tests and linters
3. Regenerate bindings if contracts/runtime changed:
   - `bun generate:wagmi` for contract changes
   - `bun generate:version` for deployment version changes (auto-runs during build)
   - `bun generate:types` for runtime changes
4. Build Docker image for operator changes: `bun build:docker:operator`
5. Run E2E tests to verify integration: `bun test:e2e`
6. Use `bun cli launch --verified --blockscout` for manual testing

### Common Pitfalls & Solutions
- **Types mismatch**: Regenerate with `bun generate:types` after runtime changes
- **Kurtosis not running**: Ensure Docker is running and Kurtosis engine is started
- **Contract changes not reflected**: Run `bun generate:wagmi` after modifications
- **Version out of sync**: Run `bun generate:version` and commit the generated file
- **Forge build errors**: Try `forge clean` then rebuild
- **Slow development cycle**: Use `--features fast-runtime` for faster block times
- **Network launch halts**: Check Blockscout - forge output can appear frozen
- **macOS crossbuild fails**: Ensure Zig is installed for cross-compilation
