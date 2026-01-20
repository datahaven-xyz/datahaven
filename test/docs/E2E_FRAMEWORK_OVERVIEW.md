# E2E Testing Framework Overview

This document provides a concise overview of the DataHaven E2E testing framework architecture and usage.

## Architecture

The E2E testing framework creates isolated test environments for comprehensive integration testing of the DataHaven network, including EigenLayer AVS integration, EVM compatibility, and cross-chain functionality.

### Directory Structure

```
test/
├── e2e/
│   ├── suites/      # E2E test files (*.test.ts)
│   └── framework/   # Base classes and test utilities
├── moonwall/        # Moonwall single-node tests
├── launcher/        # Network orchestration code
├── utils/           # Common helpers and utilities
├── configs/         # Component configuration files
├── scripts/         # Automation scripts
└── cli/             # Interactive network management
```

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
import { BaseTestSuite } from "../e2e/framework";

class MyTestSuite extends BaseTestSuite {
  constructor() {
    super({ suiteName: "my-test" });
    this.setupHooks(); // Manages lifecycle
  }
}

const suite = new MyTestSuite();

describe("My Test Suite", () => {
  test("should do something", async () => {
    const connectors = suite.getTestConnectors();
    // Use connectors.publicClient, walletClient, dhApi, papiClient
  });
});
```

### Available Connectors

- `publicClient`: Viem public client for Ethereum reads
- `walletClient`: Viem wallet client for transactions
- `dhApi`: DataHaven Substrate API
- `papiClient`: Polkadot-API client

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

# Run tests with concurrency limit
bun test:e2e:parallel

# Run specific test suite
bun test suites/contracts.test.ts

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
2. Use unique suite names to avoid conflicts
3. Keep tests isolated and independent
4. Clean up resources in test teardown
5. Use the interactive CLI for debugging network issues
6. Regenerate types after contract or runtime changes
