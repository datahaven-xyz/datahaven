# E2E Testing Framework

This document describes the end-to-end testing framework for DataHaven, which allows running isolated test suites with complete network stacks.

## Architecture

The testing framework is organized into three main components:

### 1. Launcher (`test/launcher/`)

Shared network launching functionality used by both the CLI and test suites:

- **DataHavenLauncher**: Manages DataHaven node deployment
- **EthereumLauncher**: Handles Kurtosis Ethereum network setup
- **ContractsLauncher**: Deploys smart contracts
- **ValidatorsLauncher**: Manages validator operations
- **RelayersLauncher**: Handles Snowbridge relayer deployment
- **NetworkLauncher**: Orchestrates the complete network stack

### 2. Framework (`test/framework/`)

Core testing infrastructure:

- **BaseTestSuite**: Abstract base class for test suites with setup/teardown hooks
- **ConnectorFactory**: Creates typed clients for Ethereum and DataHaven interactions
- **TestSuiteManager**: Tracks running test suites for proper cleanup

### 3. Test Suites (`test/suites/`)

Actual test implementations organized by functionality:

- `ethereum-basic.test.ts`: Basic Ethereum operations
- `datahaven-substrate.test.ts`: DataHaven substrate chain tests
- `contracts.test.ts`: Smart contract interactions
- `cross-chain.test.ts`: Cross-chain communication tests

## Key Features

### Network Isolation

Each test suite launches its own isolated network with unique identifiers:

- Separate Docker networks and containers
- Independent Kurtosis enclaves
- No interference between parallel test executions

### Automatic Setup/Teardown

The framework handles:

- Complete network launch before tests
- Client connector initialization
- Automatic cleanup after test completion
- Graceful error handling

### Typed Connectors

Test suites get pre-configured connectors:

- Viem clients for Ethereum (public & wallet)
- Polkadot-API clients for DataHaven
- Direct access to WebSocket/RPC URLs

## Writing Test Suites

### Basic Example

```typescript
import { describe, expect, it } from "bun:test";
import { BaseTestSuite } from "../framework";

class MyTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "my-tests",
      networkOptions: {
        slotTime: 6, // Optional: custom slot time
        blockscout: true, // Optional: enable Blockscout
        buildDatahaven: false, // Optional: skip building
      },
    });

    // IMPORTANT: Call setupHooks in constructor
    this.setupHooks();
  }

  // Optional: Additional setup after network launch
  async onSetup(): Promise<void> {
    // Custom setup logic
  }

  // Optional: Cleanup before network teardown
  async onTeardown(): Promise<void> {
    // Custom cleanup logic
  }
}

const suite = new MyTestSuite();

describe("My Tests", () => {
  it("should interact with Ethereum", async () => {
    const connectors = suite.getTestConnectors();

    // Use connectors.publicClient for read operations
    const blockNumber = await connectors.publicClient.getBlockNumber();

    // Use connectors.walletClient for transactions
    const hash = await connectors.walletClient.sendTransaction({
      to: "0x...",
      value: parseEther("1"),
    });
  });

  it("should interact with DataHaven", async () => {
    const connectors = suite.getTestConnectors();

    // Use connectors.dhApi for typed API calls
    const balance =
      await connectors.dhApi.query.System.Account.getValue("0x...");

    // Use connectors.papiClient for lower-level operations
    const block = await connectors.papiClient.getBlock();
  });
});
```

## Running Tests

### Run all E2E tests:

```bash
bun test:e2e
```

### Run specific test suite:

```bash
bun test test/suites/ethereum-basic.test.ts
```

### Run tests in watch mode:

```bash
bun test --watch test/suites/
```

### Run tests with debug output:

```bash
LOG_LEVEL=debug bun test:e2e
```

## Parallel Execution

Test suites can run in parallel safely due to network isolation:

```bash
# Run multiple suites in parallel
bun test test/suites/*.test.ts
```

Each suite gets:

- Unique container names (prefixed with suite ID)
- Separate Docker networks
- Independent Kurtosis enclaves
- Isolated configuration directories

## Best Practices

1. **Always call `setupHooks()`** in the test suite constructor
2. **Use typed connectors** instead of creating new clients
3. **Keep tests focused** - one feature per test suite
4. **Handle async properly** - use async/await for all operations
5. **Clean up resources** in `onTeardown()` if you create any
6. **Check prerequisites** - some tests may require waiting for services

## Troubleshooting

### Tests fail with "Network connectors not initialized"

- Ensure `setupHooks()` is called in the constructor
- Check that the network launched successfully

### Container conflicts

- The framework should handle cleanup automatically
- If issues persist, manually clean up: `docker ps -a | grep datahaven`

### Timeout errors

- Increase timeout in test options if needed
- Check Docker/Kurtosis logs for issues
- Ensure all dependencies are running

### Port conflicts

- The framework finds available ports automatically
- If specific ports are needed, ensure they're not in use

## Advanced Usage

### Custom Network Configuration

```typescript
super({
  suiteName: "advanced-test",
  networkOptions: {
    slotTime: 3, // 3-second blocks
    blockscout: true, // Enable Blockscout
    buildDatahaven: true, // Build fresh image
    datahavenImageTag: "custom:latest", // Custom image
    relayerImageTag: "custom:relay", // Custom relayer
  },
});
```

### Accessing Internal Components

```typescript
// Get network ID for debugging
const networkId = suite["networkId"];

// Access launcher internals if needed
const launcher = suite["networkLauncher"];
```

### Waiting for Services

```typescript
async onSetup(): Promise<void> {
  // Wait for relayers to initialize
  await Bun.sleep(10000);

  // Or wait for specific condition
  await waitFor({
    lambda: async () => {
      // Check if service is ready
      return await checkServiceReady();
    },
    iterations: 30,
    delay: 1000
  });
}
```
