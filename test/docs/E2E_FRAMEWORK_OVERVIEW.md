# E2E Testing Framework Overview

This document provides a concise overview of the DataHaven E2E testing framework architecture and usage.

## Architecture

The E2E testing framework creates isolated test environments for comprehensive integration testing of the DataHaven network, including EigenLayer AVS integration, EVM compatibility, and cross-chain functionality.

### Directory Structure

```
test/
├── e2e/                    # E2E testing framework
│   ├── framework/          # Base classes and test utilities
│   │   ├── suite.ts        # BaseTestSuite with SuiteType support
│   │   ├── connectors.ts   # Typed connectors per suite type
│   │   └── manager.ts      # Test environment manager
│   └── suites/             # Test files grouped by type
│       ├── datahaven/      # DataHaven-only tests (no Ethereum)
│       ├── storagehub/     # StorageHub integration tests
│       └── ethereum/       # Full cross-chain tests
├── moonwall/               # Moonwall single-node tests
├── launcher/               # Network orchestration code
│   ├── network/            # Modular launch functions
│   └── types/              # SuiteType enum & result types
├── utils/                  # Common helpers and utilities
├── configs/                # Component configuration files
├── scripts/                # Automation scripts
└── cli/                    # Interactive network management
```

### Suite Types

The framework supports three suite types that determine which components are launched:

| Suite Type | Components | Use Case |
|------------|------------|----------|
| `DATAHAVEN` | 2 validator nodes | Multi-node consensus, P2P, validator tests |
| `STORAGEHUB` | 2 validators + MSP/BSP/Indexer | StorageHub integration tests |
| `ETHEREUM` | 2 validators + Ethereum + relayers | Cross-chain messaging tests |

### Test Isolation

- Each test suite extends `BaseTestSuite` for lifecycle management
- Unique network IDs prevent resource conflicts (format: `suiteName-timestamp`)
- Automatic setup/teardown via `beforeAll`/`afterAll` hooks
- Independent Docker networks per test suite

## Infrastructure Stack

### Core Components

1. **Kurtosis**: Orchestrates Ethereum test networks

   - Runs EL (reth) and CL (lodestar) clients
   - Configurable parameters (slot time, validators)
   - Optional Blockscout explorer integration

2. **Docker**: Containerizes all components

   - DataHaven validator nodes
   - Snowbridge relayers
   - Test infrastructure
   - Cross-platform support (Linux/macOS)

3. **Bun**: TypeScript runtime and test runner
   - Parallel test execution
   - Resource management
   - Interactive CLI tooling

## Network Launch Sequence

The `launchNetwork` function orchestrates the following steps:

1. **Validation**: Check dependencies, create unique network ID
2. **DataHaven Launch**: Start validator nodes (Alice, Bob) in Docker
3. **Ethereum Network**: Spin up via Kurtosis with fast slot times
4. **Contract Deployment**: Deploy EigenLayer AVS contracts via Forge
5. **Configuration**: Fund accounts, setup validators, set parameters
6. **Snowbridge**: Launch relayers for cross-chain messaging
7. **Cleanup**: Automatic teardown on completion/failure

## Test Development

### Basic Test Structure

```typescript
import { BaseTestSuite, SuiteType } from "../../framework";

// DataHaven-only test (no Ethereum network)
class DataHavenTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "my-datahaven-test",
      suiteType: SuiteType.DATAHAVEN,  // Only launches validator nodes
      networkOptions: { slotTime: 1 }
    });
    this.setupHooks();
  }
}

const suite = new DataHavenTestSuite();

describe("DataHaven Tests", () => {
  test("should query chain", async () => {
    const connectors = suite.getDataHavenTestConnectors();
    // Use connectors.dhApi, papiClient, dhRpcUrl
  });
});
```

```typescript
// Full Ethereum cross-chain test
class EthereumTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "my-ethereum-test",
      suiteType: SuiteType.ETHEREUM,  // Default - full setup
    });
    this.setupHooks();
  }
}

const suite = new EthereumTestSuite();

describe("Cross-Chain Tests", () => {
  test("should interact with Ethereum", async () => {
    const connectors = suite.getEthereumTestConnectors();
    // Use connectors.publicClient, walletClient, dhApi, papiClient
  });
});
```

### Available Connectors by Suite Type

**DataHaven Connectors** (`getDataHavenTestConnectors()`):
- `dhApi`: DataHaven Substrate API
- `papiClient`: Polkadot-API client
- `dhRpcUrl`: DataHaven RPC URL

**StorageHub Connectors** (`getStorageHubTestConnectors()`):
- All DataHaven connectors, plus:
- `mspRpcUrl`: MSP node RPC URL
- `bspRpcUrl`: BSP node RPC URL
- `indexerRpcUrl`: Indexer node RPC URL

**Ethereum Connectors** (`getEthereumTestConnectors()`):
- All DataHaven connectors, plus:
- `publicClient`: Viem public client for Ethereum reads
- `walletClient`: Viem wallet client for transactions
- `elRpcUrl`: Ethereum RPC URL

## Key Tools & Dependencies

### Blockchain Interaction

- **Viem**: Ethereum client library
- **Wagmi**: Contract TypeScript bindings
- **Polkadot-API**: Substrate chain interactions
- **Forge**: Smart contract toolchain

### Development Tools

- **TypeScript**: Type safety
- **Biome**: Code formatting/linting
- **Zod**: Runtime validation
- **Commander**: CLI framework

## Common Commands

```bash
# Install dependencies
bun i

# Launch interactive network manager
bun cli

# Run all E2E tests
bun test:e2e

# Run specific suite types (can run in parallel on CI)
bun test:e2e:datahaven    # DataHaven-only tests
bun test:e2e:storagehub   # StorageHub integration tests
bun test:e2e:ethereum     # Full cross-chain tests

# Run tests with concurrency limit
bun test:e2e:parallel

# Run specific test file
bun test e2e/suites/ethereum/native-token-transfer.test.ts

# Run Moonwall tests
bun moonwall:test

# Generate contract bindings
bun generate:wagmi

# Generate Polkadot types
bun generate:types

# Format code
bun fmt:fix

# Type checking
bun typecheck
```

NOTES: Adding the environment variable `INJECT_CONTRACTS=true` will inject the contracts when starting the tests to speed up setup.


## Network Configuration

### Default Test Network

- **DataHaven**: 2 validator nodes (Alice, Bob)
- **Ethereum**: 2 EL/CL pairs, 1-second slots
- **Contracts**: Full EigenLayer AVS deployment
- **Snowbridge**: Beacon and Ethereum relayers

### Customization Options

- Build local Docker images
- Enable Blockscout verification
- Adjust slot times
- Configure validator counts

## Troubleshooting

1. **Dependency Issues**: Ensure Docker, Kurtosis, and Bun are installed
2. **Port Conflicts**: Check for existing services on required ports
3. **Resource Limits**: Adjust test concurrency if running out of resources
4. **Cleanup Failures**: Use `bun cli stop --A` to manually clean up networks

## Best Practices

1. Always extend `BaseTestSuite` for proper lifecycle management
2. Choose the appropriate `SuiteType` to minimize test setup time:
   - Use `DATAHAVEN` for tests that don't need Ethereum
   - Use `STORAGEHUB` for StorageHub integration tests
   - Use `ETHEREUM` only when cross-chain testing is required
3. Use typed connector accessors (`getEthereumTestConnectors()`, etc.)
4. Use unique suite names to avoid conflicts
5. Keep tests isolated and independent
6. Clean up resources in test teardown
7. Use the interactive CLI for debugging network issues
8. Regenerate types after contract or runtime changes
