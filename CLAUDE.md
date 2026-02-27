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
bun generate:types                 # Generate Polkadot-API types from runtime
bun generate:types:fast            # Generate types with fast-runtime feature

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

DataHaven uses a changeset-based versioning system for contracts with centralized tracking:

#### Key Files
- **`contracts/VERSION`**: Single source of truth for code version (e.g., `1.0.0`)
- **`contracts/versions-matrix.json`**: Tracks code version + deployed versions across chains
- **`contracts/.changesets/`**: PR-based version bump declarations with descriptions
- **`contracts/deployments/{chain}.json`**: Per-chain deployment info (addresses only)

#### Developer Workflow

1. **Make contract changes** in `contracts/src/`

2. **Declare version bump** (required for CI to pass):
   ```bash
   bun cli contracts bump --type [major|minor|patch] --description "Brief change description"
   ```
   - `major`: Breaking changes (X.0.0)
   - `minor`: New features, backwards compatible (0.X.0)
   - `patch`: Bug fixes, backwards compatible (0.0.X)
   - `--description`: Optional but recommended for clarity in release notes

   This creates a changeset file like `.changesets/pr-123.txt` containing:
   - Line 1: Bump type
   - Lines 2+: Description (optional)

3. **Commit changeset**:
   ```bash
   git add contracts/.changesets/
   git commit -m "feat: your changes"
   ```

4. **Before release** (manual process):
   - Trigger the "Contracts Versioning" GitHub Action manually
   - Action processes all accumulated changesets:
     - Aggregates multiple major bumps into single major version bump
     - Takes highest bump type across all changesets (major > minor > patch)
     - Updates `VERSION` file
     - Updates `versions-matrix.json` with new checksum
     - Creates a PR with version bump and all changeset descriptions
     - Deletes processed changesets in the PR

#### Upgrade/Deploy Commands

- **Upgrade** (uses VERSION file):
  ```bash
  bun cli contracts upgrade --chain hoodi --version latest
  ```
  - Validates checksum matches `versions-matrix.json`
  - Deploys new implementation contracts
  - Updates proxy via `upgradeToAndCall` with version update (saves gas)
  - Updates `versions-matrix.json` deployment info
  - Version is set on-chain during the upgrade transaction (no separate call)

- **Deploy** (MINOR bump):
  ```bash
  bun cli contracts deploy --chain anvil
  ```
  - Performs MINOR bump automatically
  - Updates both deployment file and `versions-matrix.json`

#### Validation Commands

- **Check versions across deployments**:
  ```bash
  bun cli contracts version-check --chain hoodi
  ```

- **Validate changesets (CI use)**:
  ```bash
  bun cli contracts validate-changesets
  ```
  Fails if contracts changed but no changeset exists

#### Version Matrix Structure

```json
{
  "code": {
    "version": "1.0.0",           // Current code version
    "checksum": "abc123...",       // SHA1 of contracts/src/
    "lastModified": "2026-02-05T..."
  },
  "deployments": {
    "anvil": { "version": "0.1.0", "lastDeployed": "..." },
    "hoodi": { "version": "1.0.0", "lastDeployed": "..." }
  }
}
```

#### Release Process

1. **Accumulate changesets**: Multiple PRs with contract changes create changeset files
2. **Trigger version bump**: Manually run "Contracts Versioning" GitHub Action
3. **Review PR**: Action creates PR with:
   - Updated VERSION and versions-matrix.json
   - All changeset descriptions in PR body
   - Deleted changeset files
4. **Upgrade contracts**: Checkout PR branch and run `bun cli contracts upgrade`
5. **Merge PR**: Complete the release by merging to main

#### If Version Out of Sync (Rare)
1. **Checksum mismatch**: Run `bun cli contracts apply-changesets` locally or update VERSION manually
2. **On-chain sync**: Upgrade command automatically sets version via `upgradeToAndCall`
3. **Generated reference**: Not used (versions are tracked in `versions-matrix.json`)

### Development Workflow
1. Make changes to relevant component
2. Run component-specific tests and linters
3. Regenerate bindings if contracts/runtime changed:
   - `bun generate:wagmi` for contract changes
   - `bun generate:types` for runtime changes
4. Build Docker image for operator changes: `bun build:docker:operator`
5. Run E2E tests to verify integration: `bun test:e2e`
6. Use `bun cli launch --verified --blockscout` for manual testing

### Common Pitfalls & Solutions
- **Types mismatch**: Regenerate with `bun generate:types` after runtime changes
- **Kurtosis not running**: Ensure Docker is running and Kurtosis engine is started
- **Contract changes not reflected**: Run `bun generate:wagmi` after modifications
- **Version out of sync**: Run `bun cli contracts apply-changesets` (CI) or update `VERSION` manually
- **Forge build errors**: Try `forge clean` then rebuild
- **Slow development cycle**: Use `--features fast-runtime` for faster block times
- **Network launch halts**: Check Blockscout - forge output can appear frozen
- **macOS crossbuild fails**: Ensure Zig is installed for cross-compilation
