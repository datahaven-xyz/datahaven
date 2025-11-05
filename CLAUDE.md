# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DataHaven is an EVM-compatible Substrate blockchain secured by EigenLayer. It bridges Ethereum and Substrate ecosystems through:
- **EigenLayer AVS**: Operator registration, slashing, and rewards on Ethereum L1
- **Snowbridge**: Trustless bidirectional bridge for assets and messages
- **Frontier pallets**: Full EVM compatibility for Ethereum dApps
- **Dynamic validators**: Validator set synchronized from EigenLayer contracts
- **Custom pallets**: External validators, native transfers, rewards distribution

## Prerequisites

- [Kurtosis](https://docs.kurtosis.com/install): Network orchestration for Ethereum test networks
- [Bun](https://bun.sh/) v1.2+: TypeScript runtime and package manager
- [Docker](https://www.docker.com/): Container management (required by Kurtosis)
- [Foundry](https://getfoundry.sh/): Solidity compilation and deployment
- [Rust](https://www.rust-lang.org/tools/install): For building the operator/node
- [Helm](https://helm.sh/): Kubernetes package manager (optional, for production deployment)
- [Zig](https://ziglang.org/) (macOS only): For cross-compiling x86_64 binaries on ARM Macs

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
bun test:e2e                      # Run all E2E test suites (Bun native)
bun test:e2e:parallel             # Run tests with limited concurrency (CI-optimized)
bun test ./suites/ethereum-basic.test.ts  # Run a single test suite
bun moonwall:test                 # Run Moonwall tests (dev_datahaven foundation)
bun moonwall:run                  # Run Moonwall network without tests
```

### Rust/Operator Development

```bash
cd operator
cargo build --release --features fast-runtime    # Development build (faster epochs/eras)
cargo build --release                           # Production build
cargo test                                      # Run all tests
cargo test -p pallet-external-validators        # Test specific pallet
cargo fmt                                       # Format Rust code
cargo clippy                                    # Lint Rust code
./scripts/run-benchmarks.sh                     # Run runtime benchmarks
```

**Note**: The `fast-runtime` feature reduces epoch duration (1 hour → 1 minute) and sessions per era (6 → 3) for faster validator rotation testing. Block time remains 6 seconds in both modes.

### Smart Contracts (from `/contracts` directory)

```bash
forge clean                        # Clean build artifacts
forge build                        # Build contracts
forge test                         # Run tests
forge test -vvv                    # Run tests with stack traces
forge test --match-contract DataHavenServiceManagerTest  # Run specific test contract
forge fmt                          # Format Solidity code
```

## Architecture Essentials

### Repository Structure
```
datahaven/
├── contracts/                     # EigenLayer AVS smart contracts
│   ├── src/                      # Service Manager, Rewards Registry, Slasher
│   ├── script/                   # Foundry deployment scripts
│   └── test/                     # Foundry test suites
├── operator/                      # Substrate-based DataHaven node
│   ├── node/                     # Node binary and chain specifications
│   ├── pallets/                  # Custom pallets:
│   │   ├── datahaven-native-transfer/     # Cross-chain token transfers
│   │   ├── external-validators/           # Validator set management
│   │   ├── external-validators-rewards/   # Reward distribution
│   │   ├── ethereum-client/               # Snowbridge Ethereum light client
│   │   ├── inbound-queue-v2/             # Snowbridge inbound messages
│   │   └── outbound-queue-v2/            # Snowbridge outbound messages
│   └── runtime/                  # Runtime configurations:
│       ├── mainnet/             # Production (12s blocks)
│       ├── stagenet/            # Staging environment
│       ├── testnet/             # Development (supports fast-runtime)
│       └── common/              # Shared runtime configuration
├── test/                         # E2E testing framework
│   ├── suites/                  # Integration test scenarios (Bun native tests)
│   ├── datahaven/               # Moonwall-based tests (legacy/dev tests)
│   │   ├── suites/             # Moonwall test suites
│   │   ├── contracts/          # Test contracts for Moonwall
│   │   └── helpers/            # Moonwall test helpers
│   ├── framework/               # BaseTestSuite, ConnectorFactory
│   ├── launcher/                # Network orchestration (Kurtosis + Docker)
│   ├── scripts/                 # Utility scripts
│   └── cli/                     # Interactive CLI tool
├── deploy/                       # Kubernetes deployment
│   ├── charts/                  # Helm charts (node, relay)
│   └── environments/            # Environment configs
└── tools/                        # GitHub automation scripts
```

### Cross-Component Communication Flow

**Ethereum → DataHaven** (Validator Set Updates):
1. EigenLayer operator registers via `DataHavenServiceManager.registerOperatorToAVS()`
2. Contract builds SCALE-encoded message via `DataHavenSnowbridgeMessages` library
3. Message sent to Snowbridge `IGatewayV2.sendMessage()` with `VALIDATORS_SET_ID = 0`
4. Snowbridge execution relay picks up event from Ethereum logs
5. DataHaven inbound-queue-v2 pallet receives message
6. External-validators pallet processes validator set update
7. New validators participate in BEEFY consensus and block production

**DataHaven → Ethereum** (Performance Reports):
1. External-validators-rewards pallet builds outbound message
2. Outbound-queue-v2 queues message with BEEFY finality proof
3. Snowbridge BEEFY relay submits to Ethereum
4. `RewardsRegistry` contract receives validator performance data
5. Rewards distributed based on performance metrics

### Key Components

**Smart Contracts** (`contracts/src/`):
1. **DataHavenServiceManager.sol**:
   - Manages three operator sets (validators, BSPs, MSPs)
   - Builds SCALE-encoded messages for cross-chain communication
   - Integrates with EigenLayer AllocationManager and RewardsCoordinator

2. **RewardsRegistry.sol**:
   - Tracks validator performance metrics
   - Distributes rewards based on cross-chain reports

3. **VetoableSlasher.sol**:
   - Slashing with configurable veto period
   - Protection against malicious slashing

**Custom Pallets** (`operator/pallets/`):
1. **external-validators**:
   - Maintains validator set synchronized from Ethereum
   - Era-based rotation (inspired by pallet_staking)
   - Separates whitelisted (governance) and external (EigenLayer) validators

2. **datahaven-native-transfer**:
   - Cross-chain token transfers via Snowbridge
   - Uses Snowbridge's `Command::MintForeignToken` for message construction
   - Locks tokens in sovereign account during outbound transfers

3. **external-validators-rewards**:
   - Processes reward messages from Ethereum
   - Distributes to validators based on performance

**Snowbridge Integration** (custom fork in `operator/pallets/`):
- Modified from upstream to support solochain (non-parachain) architecture
- Three relay services: beacon, BEEFY, execution, solochain
- Ethereum light client for trustless verification

### Testing

**Three-Layer Testing Strategy**:

1. **Unit Tests**: Component-level testing
   - `cargo test` - Pallets and runtime logic
   - `forge test` - Smart contract functionality

2. **Integration Tests**: Two frameworks for different purposes

   | Aspect | Bun Tests (`/test/suites/`) | Moonwall Tests (`/test/datahaven/`) |
   |--------|---------------------------|-----------------------------------|
   | **Purpose** | Full system integration, cross-chain flows | EVM compatibility, basic operations |
   | **Network** | Full stack (Ethereum + DataHaven + Relayers) | Single node with manual sealing |
   | **Block Production** | Automatic (BABE consensus) | Manual (`context.createBlock()`) |
   | **Use Cases** | Validator updates, cross-chain transfers | Gas estimation, RPC compatibility |
   | **Run Command** | `bun test:e2e` | `bun moonwall:test` |
   | **Best For** | Real-world integration scenarios | Quick EVM feature testing, porting tests |

3. **CI/CD**: Automated in GitHub Actions
   - E2E tests (`task-e2e.yml`), contract tests (`task-foundry-tests.yml`), pallet tests (`task-rust-tests.yml`)

**Framework Components** (`/test/framework/`):

- **BaseTestSuite**: Manages test lifecycle
  - Launches full network: Kurtosis (Ethereum) → DataHaven (Docker) → Contracts (Foundry) → Relayers
  - Automatic cleanup via `beforeAll`/`afterAll` hooks
  - Override `onSetup`/`onTeardown` for custom initialization
  - Use `keepAlive: true` to inspect network after tests

- **ConnectorFactory**: Creates and manages connections
  - `publicClient`/`walletClient` (viem) for Ethereum
  - `papiClient`/`dhApi` (polkadot-api) for DataHaven
  - Handles cleanup automatically

**Writing Bun Tests**:
```typescript
import { describe, it, expect } from "bun:test";
import { BaseTestSuite } from "../framework";

class MyTestSuite extends BaseTestSuite {
  constructor() {
    super({ suiteName: "my-test" });  // Unique network ID
    this.setupHooks();
  }
}

const suite = new MyTestSuite();

describe("My Tests", () => {
  it("should verify cross-chain flow", async () => {
    const { publicClient, dhApi } = suite.getTestConnectors();

    // Ethereum: Send transaction
    const hash = await walletClient.writeContract({...});
    await publicClient.waitForTransactionReceipt({ hash });

    // Wait for cross-chain propagation (~30-60s)
    await new Promise(resolve => setTimeout(resolve, 60_000));

    // DataHaven: Verify state change
    const result = await dhApi.query.SomePallet.SomeValue();
    expect(result).toBe(expectedValue);
  });
});
```

**Key Patterns**:
- Each test suite gets isolated network (unique ID prevents conflicts)
- Use `getTestConnectors()` - never create clients manually
- Cross-chain tests: Send on Ethereum → Wait 30-60s → Verify on DataHaven
- Network naming: `{suiteName}-{timestamp}` (e.g., `my-test-1699234567890`)
- Port allocation: Alice node uses `9944` (RPC) / `30333` (P2P), others random

### Development Workflow

**Standard Development Cycle**:
1. Make changes to relevant component
2. Run component-specific tests and linters
3. **Regenerate bindings** if contracts/runtime changed:
   - `bun generate:wagmi` after contract changes (generates TypeScript bindings from ABI)
   - `bun generate:types` after runtime changes (generates polkadot-api descriptors from WASM)
4. Build Docker image for operator changes: `bun build:docker:operator`
5. Run E2E tests to verify integration: `bun test:e2e`
6. Use `bun cli launch --verified --blockscout` for manual testing

**When to Regenerate Types**:
- After modifying any contract in `contracts/src/` → Run `bun generate:wagmi`
- After changing pallet logic or runtime config → Run `bun generate:types`
- Type mismatches in tests are usually solved by regeneration

**Important**: The type generation commands must be run from the `/test` directory.

### Common Pitfalls & Solutions

**Type Mismatches**:
- **Symptom**: TypeScript errors about missing properties or incompatible types
- **Solution**: Regenerate types from `/test` directory:
  - Contract changes: `bun generate:wagmi`
  - Runtime changes: `bun generate:types` (or `bun generate:types:fast` for faster builds)

**Kurtosis Issues**:
- **Symptom**: `Error: Kurtosis engine not running` or network launch failures
- **Solution**:
  - Ensure Docker daemon is running
  - Start Kurtosis engine: `kurtosis engine start`
  - Clean stale enclaves: `kurtosis enclave rm -a`

**Forge Build Errors**:
- **Symptom**: Contract compilation fails with cache errors
- **Solution**: `forge clean && forge build`

**Network Conflicts**:
- **Symptom**: `Network ID already exists` or port binding errors
- **Solution**:
  - Use `bun cli stop --all` to cleanup all resources
  - Check for orphaned containers: `docker ps -a | grep datahaven`
  - Remove stale networks: `docker network prune`

**Slow Development Cycle**:
- **Issue**: Long wait times for validator rotation and era changes during testing
- **Solution**: Use `--features fast-runtime` for faster epochs and eras
  - `cargo build --release --features fast-runtime`
  - `bun generate:types:fast`
  - Epochs: 1 minute instead of 1 hour
  - Eras: 3 minutes instead of 6 hours
  - Block time: Still 6 seconds (unchanged)

**Network Launch Appears Frozen**:
- **Issue**: `bun cli launch` hangs with no output
- **Cause**: Blockscout deployment can take 2-3 minutes and produces no intermediate output
- **Solution**: Be patient, or use `--no-blockscout` flag for faster launches

**macOS Cross-compilation Failures**:
- **Symptom**: Linker errors when building Docker images on ARM Macs
- **Solution**: Install Zig for cross-compilation: `brew install zig`

**Rust Analyzer Slow/Unresponsive**:
- **Issue**: IDE becomes sluggish when working with Substrate code
- **Solution**: Configure VS Code settings (see README.md):
  - Skip WASM builds: `"SKIP_WASM_BUILD": 1`
  - Use separate target dir: `"CARGO_TARGET_DIR": "target/.rust-analyzer"`
  - Disable proc macros for faster analysis

**Test Failures After Runtime Changes**:
- **Symptom**: E2E tests fail with RPC errors or unexpected behavior
- **Checklist**:
  1. Rebuild runtime: `cargo build --release --features fast-runtime`
  2. Regenerate types: `bun generate:types:fast`
  3. Rebuild Docker image: `bun build:docker:operator`
  4. Clean old networks: `bun cli stop --all`
  5. Re-run tests: `bun test:e2e`

## Important Technical Details

### Runtime Configurations

DataHaven supports **three runtime configurations** in `operator/runtime/`:
- **mainnet/**: Production runtime (6s block time, BABE + GRANDPA consensus)
- **stagenet/**: Staging environment for pre-production testing
- **testnet/**: Development runtime with `fast-runtime` feature support

**Block Time**: All runtimes use **6 seconds per block** (6000ms)

The `fast-runtime` feature (available in all runtimes) accelerates validator rotation by modifying:
- **Epoch duration**: 1 hour (600 blocks) → 1 minute (10 blocks)
- **Sessions per era**: 6 sessions → 3 sessions
- **Bonding duration**: 28 eras → 3 eras

This means with `fast-runtime`:
- Epochs complete in 1 minute instead of 1 hour
- Eras complete in 3 minutes instead of 6 hours
- Validator set rotations happen much faster

**Usage**: Always develop with `--features fast-runtime` for faster validator rotation testing. Block time stays the same (6s), but governance/staking timings are dramatically reduced.

### EigenLayer Operator Sets

`DataHavenServiceManager` manages **three operator sets**:
- **`VALIDATORS_SET_ID = 0`**: Validators securing the network
- **`BSPS_SET_ID = 1`**: Backup Storage Providers (future use)
- **`MSPS_SET_ID = 2`**: Main Storage Providers (future use)

When sending cross-chain messages, always use the correct operator set ID. Validator updates use `VALIDATORS_SET_ID`.

### SCALE Encoding for Cross-Chain Messages

Messages from Ethereum → DataHaven must be SCALE-encoded. The `DataHavenSnowbridgeMessages` library provides encoding helpers:

```solidity
// Build validator set update message
bytes memory message = DataHavenSnowbridgeMessages.buildValidatorSetUpdate(
    operatorAddresses,
    block.timestamp
);

// Send via Snowbridge Gateway
IGatewayV2(gateway).sendMessage{value: msg.value}(
    destination,  // DataHaven location on Snowbridge
    message
);
```

DataHaven decodes these messages in the inbound-queue-v2 pallet using parity-scale-codec.

### Docker Images

**Two Dockerfiles** for different purposes:

1. **Production** (`operator/Dockerfile`):
   - Minimal Debian-slim image
   - Expects pre-built binary in `build/` directory
   - Used for releases and CI (binary compiled separately in GitHub Actions)
   - Multi-stage build for minimal final image size

2. **Development** (`docker/datahaven-dev.Dockerfile`):
   - Ubuntu-based with debugging tools (optional)
   - Expects pre-built binary from local `cargo build`
   - Includes librocksdb-dev for local development
   - Built via: `bun build:docker:operator` (from `/test` directory)

**Build Optimization** (GitHub Actions):
- **sccache**: Used in CI workflows to cache Rust compilation artifacts between runs
- Binary compiled once, then copied into minimal Docker image
- Typical build times: ~30 minutes (first) → ~10 minutes (cached)
