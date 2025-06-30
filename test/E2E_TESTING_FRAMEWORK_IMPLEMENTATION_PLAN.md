# E2E Testing Framework Implementation Plan

## Overview

This document outlines the implementation plan for the DataHaven E2E testing framework. The framework enables parallel test execution with isolated environments for each test suite, leveraging the refactored launcher modules without modifying them.

## Context

The DataHaven project recently underwent a refactoring where functionality was moved from `cli/handlers/` to `launcher/` modules. The E2E testing framework needs to be updated to use these refactored modules while supporting:
- Parallel test suite execution
- Complete network isolation
- Automated setup and teardown
- No user interaction during tests

## Current State (Updated)

### Completed Refactoring
- `launcher/datahaven.ts` - DataHaven node management
- `launcher/kurtosis.ts` - Kurtosis/Ethereum network management
- `launcher/contracts.ts` - Smart contract deployment
- `launcher/validators.ts` - Validator setup and management
- `launcher/parameters.ts` - DataHaven parameter configuration
- `launcher/relayers.ts` - Snowbridge relayer management

### Completed Implementation
- ✅ `launcher/network/index.ts` - `launchNetwork` function implemented
- ✅ `launcher/index.ts` - Exports updated
- ✅ Network ID validation implemented
- ✅ Cleanup function implemented
- ✅ Dynamic port assignment for parallel execution
- ✅ Framework updates (`framework/connectors.ts` and `framework/suite.ts`)

### Remaining Work
- Test suite integration examples
- Documentation updates

## Part 1: Network Launch Implementation (COMPLETED)

### 1. `launchNetwork` Function ✅

**Location**: `/test/launcher/network/index.ts`

**Status**: IMPLEMENTED

The function orchestrates all launcher modules in the correct order:
1. Check base dependencies
2. Validate network ID uniqueness
3. Launch DataHaven nodes
4. Launch Kurtosis/Ethereum network
5. Deploy contracts
6. Fund validators
7. Setup validators
8. Set DataHaven parameters
9. Launch relayers
10. Update validator set (after relayers)

### 2. Network ID Validation ✅

**Status**: IMPLEMENTED

The validation checks for:
- Existing DataHaven containers
- Existing relayer containers
- Existing Kurtosis enclaves
- Existing Docker networks

### 3. Cleanup Implementation ✅

**Status**: IMPLEMENTED

The cleanup function:
- Stops and removes relayer containers
- Stops and removes DataHaven containers
- Removes Docker network
- Removes Kurtosis enclave
- Handles errors gracefully

### 4. Type Definitions ✅

**Status**: UPDATED

```typescript
// From launcher/types/index.ts
export interface LaunchNetworkResult {
  launchedNetwork: LaunchedNetwork;
  dataHavenRpcUrl: string;
  ethereumRpcUrl: string;
  ethereumClEndpoint: string;
  cleanup: () => Promise<void>;
}
```

### 5. Dynamic Port Assignment ✅

**Status**: IMPLEMENTED

The implementation solves the parallel execution blocking issue:

1. **Container Launch** - Changed from `-p 9944:9944` to `-p 9944` to let Docker auto-assign ports
2. **Port Query** - Added `getAssignedPort` function that uses `docker port` command
3. **Port Storage** - Port is stored in LaunchedNetwork immediately after container starts
4. **Port Usage** - All services use the dynamic port from LaunchedNetwork
5. **Verification** - Created `test-parallel-launch.ts` to verify parallel execution works

Key changes:
- `launcher/datahaven.ts`: Auto-assigned ports and port querying
- `launcher/network/index.ts`: Uses dynamic port for connectors
- `framework/connectors.ts`: Already compatible with dynamic ports
- `cli/handlers/launch/summary.ts`: Uses dynamic port from LaunchedNetwork

## Part 2: Framework Implementation (COMPLETED)

### 1. Framework Architecture Overview

The testing framework provides:
- **BaseTestSuite**: Abstract class that test suites extend
- **Network Isolation**: Each test suite gets its own network with unique ID
- **Parallel Execution**: Multiple test suites can run simultaneously
- **Automatic Setup/Teardown**: Networks are launched before tests and cleaned up after
- **Test Connectors**: Easy-to-use clients for interacting with both chains

### 2. Key Components to Update

#### 2.1 BaseTestSuite Class (`framework/suite.ts`)
**Current State**: Partially updated by linter to use new types

**Required Updates**:
- Ensure proper use of `LaunchNetworkResult` type
- Handle cleanup function correctly
- Maintain error handling in setup/teardown

#### 2.2 ConnectorFactory Class (`framework/connectors.ts`)
**Purpose**: Create test-friendly clients for interacting with networks

**Key Features**:
- Create Ethereum clients (publicClient, walletClient) using viem
- Create DataHaven/Substrate clients using polkadot-api
- **NOTE**: DataHaven only needs RPC connector for papi client (no separate WS needed)
- Handle connection cleanup

**Required Updates**:
- Update to work with new `LaunchNetworkResult` interface
- Use `dataHavenRpcUrl` directly for papi client
- Remove any WebSocket URL references for DataHaven

#### 2.3 TestSuiteManager (`framework/manager.ts`)
**Status**: Already well-implemented, no changes needed

### 3. Test Suite Usage Pattern

Test suites will use the framework like this:

```typescript
import { describe, test } from "bun:test";
import { BaseTestSuite } from "../framework";

class MyE2ETestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "my-e2e-test",
      networkOptions: {
        slotTime: 1,
        blockscout: true,
        datahavenImageTag: "moonsonglabs/datahaven:local",
        relayerImageTag: "moonsonglabs/snowbridge-relay:latest"
      }
    });
    this.setupHooks();
  }
}

const suite = new MyE2ETestSuite();

describe("My E2E Tests", () => {
  test("should interact with both networks", async () => {
    const { dhApi, publicClient } = suite.getTestConnectors();
    // Test implementation
  });
});
```

### 4. Implementation Steps

1. **Update ConnectorFactory** to handle the new type structure
   - Use `dataHavenRpcUrl` for papi client connection
   - Ensure all clients are properly typed
   - Remove WebSocket URL handling for DataHaven

2. **Verify BaseTestSuite** works with new `launchNetwork`
   - Already partially updated
   - Ensure proper cleanup flow
   - Add better error messages

3. **Create helper utilities** for common test operations
   - Waiting for blocks
   - Checking balances
   - Cross-chain message verification

### 5. Expected TestConnectors Interface

```typescript
export interface TestConnectors {
  // Ethereum connectors
  publicClient: PublicClient;
  walletClient: WalletClient<any, any, Account>;

  // DataHaven connectors
  papiClient: PolkadotClient;
  dhApi: DataHavenApi;

  // Raw URLs
  elRpcUrl: string;
  dhRpcUrl: string;  // Changed from dhWsUrl
}
```

## Important Constraints

1. **DO NOT MODIFY** files in `launcher/` directory without explicit confirmation
2. **DO NOT MODIFY** files in `cli/handlers/` directory without explicit confirmation
3. All implementation work happens in the test framework layer
4. Launcher modules are used as-is (they already support programmatic usage)

## Error Handling

- Network ID conflicts result in immediate error
- Component launch failures trigger cleanup of already-launched components
- Cleanup failures are logged but don't fail the test suite
- Clear error messages for debugging

## Testing the Implementation

1. Run a single test suite and verify network launches
2. Run multiple test suites in parallel to verify isolation
3. Kill a test mid-run and verify cleanup warnings from TestSuiteManager
4. Run same test twice to verify network ID conflict detection

## Benefits

1. **Parallel Execution**: Multiple test suites run simultaneously
2. **Complete Isolation**: Each test gets its own network
3. **Automated**: No manual intervention required
4. **Reliable**: Clean state guaranteed for each test
5. **Maintainable**: Clear separation of concerns

## Next Steps

1. Update `framework/connectors.ts` to use RPC URLs correctly
2. Verify `framework/suite.ts` integration
3. Test with a simple test suite to verify everything works
4. Document the usage pattern for test writers

## Notes for Implementation

- DataHaven uses RPC URL for papi client (no separate WebSocket needed)
- Use `LaunchedNetwork` class to track network state
- ParameterCollection is handled internally by `launchNetwork`
- Validator set update happens after relayers are running
- All Docker containers and networks include the networkId in their names
- Kurtosis enclave is named `eth-${networkId}`

## Reference Files

- Cleanup logic inspiration: `/test/cli/handlers/stop/index.ts`
- Network launch flow: `/test/cli/handlers/launch/index.ts`
- Test framework: `/test/framework/suite.ts`
- Launcher modules: `/test/launcher/` directory
- Implemented launchNetwork: `/test/launcher/network/index.ts`

This plan provides all necessary information to implement the E2E testing framework that leverages the refactored launcher modules while supporting parallel test execution with proper isolation and cleanup.