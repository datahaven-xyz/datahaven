# E2E Testing Framework Architecture

This document provides a detailed overview of the DataHaven E2E testing framework architecture, implementation details, and design decisions.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Core Components](#core-components)
4. [Implementation Details](#implementation-details)
5. [Design Decisions](#design-decisions)
6. [Extension Points](#extension-points)

## Overview

The E2E testing framework is designed to enable comprehensive integration testing of the DataHaven network stack. It provides:

- **Complete network isolation** - Each test suite runs its own isolated network
- **Automated lifecycle management** - Networks are automatically launched and cleaned up
- **Type-safe connectors** - Pre-configured clients for Ethereum and DataHaven interactions
- **Shared infrastructure** - Reuses network launching logic from the CLI tools

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Test Suites                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Ethereum   │  │  DataHaven  │  │ Cross-Chain │  ...        │
│  │   Tests     │  │    Tests    │  │    Tests    │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                 │                 │                    │
│         └─────────────────┴─────────────────┘                   │
│                           │                                      │
│                           ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Test Framework                          │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │ │
│  │  │BaseTestSuite│  │ConnectorFactory│ │TestSuiteManager│  │ │
│  │  └──────┬──────┘  └───────┬──────┘  └────────┬───────┘  │ │
│  │         │                  │                   │          │ │
│  │         └──────────────────┴───────────────────┘         │ │
│  └─────────────────────────────┬─────────────────────────────┘ │
│                                 │                                │
│                                 ▼                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                  Network Launchers                         │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │ │
│  │  │DataHaven │ │ Ethereum │ │Contracts │ │ Relayers │    │ │
│  │  │ Launcher │ │ Launcher │ │ Launcher │ │ Launcher │    │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │ │
│  │                    NetworkLauncher (Orchestrator)         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                 │                                │
│                                 ▼                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Infrastructure Services                       │ │
│  │    Docker    │    Kurtosis    │    Substrate    │  ...   │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Test Framework Layer (`test/framework/`)

#### BaseTestSuite
The abstract base class that all test suites extend.

```typescript
export abstract class BaseTestSuite {
  protected networkId: string;
  protected connectors?: NetworkConnectors;
  protected testConnectors?: TestConnectors;
  
  constructor(options: TestSuiteOptions) {
    // Generates unique network ID
    // Registers with TestSuiteManager
  }
  
  protected setupHooks(): void {
    // Configures beforeAll/afterAll hooks
    // Launches network
    // Creates connectors
  }
}
```

**Key responsibilities:**
- Manages test lifecycle (setup/teardown)
- Generates unique network IDs for isolation
- Provides access to network connectors
- Handles error recovery and cleanup

#### ConnectorFactory
Creates and manages client connections to the launched networks.

```typescript
export class ConnectorFactory {
  async createTestConnectors(): Promise<TestConnectors> {
    // Creates viem clients for Ethereum
    // Creates PAPI clients for DataHaven
    // Returns typed, ready-to-use connectors
  }
}
```

**Key features:**
- Type-safe client creation
- Automatic configuration from network endpoints
- Support for multiple wallet accounts
- Connection cleanup utilities

#### TestSuiteManager
Singleton that tracks all running test suites.

```typescript
export class TestSuiteManager {
  private suites: Map<string, TestSuiteRegistry>;
  
  registerSuite(suiteId: string, networkId: string): void
  completeSuite(suiteId: string): void
  failSuite(suiteId: string): void
}
```

**Key responsibilities:**
- Prevents resource leaks
- Tracks test execution status
- Provides debugging information
- Handles process exit cleanup

### 2. Launcher Layer (`test/launcher/`)

#### NetworkLauncher
Orchestrates the complete network stack deployment.

```typescript
export class NetworkLauncher {
  async launch(): Promise<NetworkConnectors> {
    // 1. Launch DataHaven network
    // 2. Launch Ethereum/Kurtosis
    // 3. Deploy contracts
    // 4. Setup validators
    // 5. Launch relayers
    // Returns connection endpoints
  }
}
```

**Deployment sequence:**
1. Create parameter collection
2. Launch DataHaven nodes
3. Launch Ethereum network via Kurtosis
4. Deploy smart contracts
5. Fund and setup validators
6. Set runtime parameters
7. Launch Snowbridge relayers
8. Update validator set

#### Component Launchers
Each component has its own launcher with specific logic:

- **DataHavenLauncher**: Manages substrate nodes, Docker networks, port allocation
- **EthereumLauncher**: Handles Kurtosis enclave setup, configures EL/CL clients
- **ContractsLauncher**: Deploys smart contracts, handles verification
- **ValidatorsLauncher**: Funds accounts, registers in EigenLayer, updates sets
- **RelayersLauncher**: Configures and launches different relayer types

### 3. Test Suites Layer (`test/suites/`)

Example test suite structure:

```typescript
class MyTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "my-tests",
      networkOptions: {
        // Optional network configuration
      }
    });
    this.setupHooks(); // MUST be called
  }
  
  // Optional lifecycle hooks
  override async onSetup(): Promise<void> { }
  override async onTeardown(): Promise<void> { }
}

const suite = new MyTestSuite();

describe("My Tests", () => {
  it("should test something", async () => {
    const { publicClient, dhApi } = suite.getTestConnectors();
    // Test implementation
  });
});
```

## Implementation Details

### Network Isolation

Each test suite gets isolated resources:

1. **Unique Network ID**: Generated from suite name + timestamp
   ```typescript
   networkId = `${suiteName}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
   ```

2. **Isolated Docker Networks**: 
   ```
   datahaven-net-{networkId}
   ```

3. **Unique Container Names**:
   ```
   datahaven-{networkId}-alice
   datahaven-{networkId}-bob
   snowbridge-{networkId}-beefy-relay
   ```

4. **Separate Kurtosis Enclaves**:
   ```
   eth-{networkId}
   ```

### Port Management

The framework automatically finds available ports:

```typescript
private async getAvailablePort(): Promise<number> {
  const basePort = 9944;
  let port = basePort;
  
  while (port < basePort + 100) {
    const result = await $`lsof -i :${port}`.quiet().nothrow();
    if (result.exitCode !== 0) {
      return port; // Port is available
    }
    port++;
  }
  throw new Error("No available ports found");
}
```

### Error Handling

Multiple levels of error handling ensure cleanup:

1. **Try-catch in launchers**: Each launcher handles its own errors
2. **Cleanup functions**: Returned by launchers for guaranteed cleanup
3. **Test suite manager**: Tracks failed suites
4. **Process exit handlers**: Ensure cleanup on unexpected exit

### Connection Management

Pre-configured connectors provide easy access:

```typescript
interface TestConnectors {
  // Ethereum
  publicClient: PublicClient;      // Read operations
  walletClient: WalletClient;      // Write operations
  
  // DataHaven
  papiClient: PolkadotClient;      // Low-level client
  dhApi: DataHavenApi;             // Typed API
  
  // Raw endpoints
  elRpcUrl: string;
  dhWsUrl: string;
}
```

## Design Decisions

### 1. Shared Launcher Infrastructure

**Decision**: Extract network launching logic into shared components used by both CLI and tests.

**Rationale**:
- Maintains consistency between CLI and test environments
- Reduces code duplication
- Ensures fixes benefit both use cases
- Allows CLI to keep interactive features

### 2. Full Network Isolation

**Decision**: Each test suite launches its own complete network stack.

**Rationale**:
- Enables true parallel test execution
- Prevents test interference
- Simplifies debugging
- Provides clean state for each suite

**Trade-offs**:
- Higher resource usage
- Longer test startup time
- More complex cleanup logic

### 3. Abstract Base Class Pattern

**Decision**: Use abstract base class for test suites rather than composition.

**Rationale**:
- Enforces consistent structure
- Provides clear extension points
- Simplifies test writing
- TypeScript support for overrides

### 4. Connector Factory Pattern

**Decision**: Separate connector creation into factory class.

**Rationale**:
- Centralizes client configuration
- Enables connector reuse
- Simplifies testing different accounts
- Clean separation of concerns

### 5. Automatic Cleanup

**Decision**: Implement multiple cleanup mechanisms.

**Rationale**:
- Prevents resource leaks
- Handles various failure scenarios
- Supports debugging (can disable cleanup)
- Works with test runner lifecycle

## Extension Points

### Adding New Components

1. **Create launcher** in `test/launcher/{component}/`:
   ```typescript
   export class MyComponentLauncher {
     async launch(launchedNetwork: LaunchedNetwork): Promise<LaunchResult> {
       // Implementation
     }
   }
   ```

2. **Update NetworkLauncher** to include new component

3. **Add cleanup logic** to ensure proper teardown

### Adding New Test Patterns

1. **Create base class** for specific test types:
   ```typescript
   export abstract class PerformanceTestSuite extends BaseTestSuite {
     // Add performance-specific utilities
   }
   ```

2. **Add utilities** to ConnectorFactory for new patterns

3. **Document patterns** in test suite examples

### Custom Network Configurations

1. **Extend NetworkLaunchOptions** with new fields

2. **Update launchers** to respect new options

3. **Add validation** in NetworkLauncher constructor

### Integration with CI/CD

1. **Parallel execution**: Use test runner's parallel features
   ```bash
   bun test test/suites/*.test.ts --parallel
   ```

2. **Resource limits**: Configure based on CI environment

3. **Artifact collection**: Gather logs on failure

4. **Reporting**: Integrate with test reporting tools

## Best Practices

1. **Always call setupHooks()** in constructor
2. **Use typed connectors** instead of creating clients
3. **Implement cleanup** in onTeardown() for custom resources
4. **Check prerequisites** before assuming availability
5. **Use descriptive test suite names** for debugging
6. **Handle async operations** properly with await
7. **Log important information** for debugging
8. **Keep tests focused** on specific functionality
9. **Use timeouts** appropriately for network operations
10. **Document special requirements** in test comments