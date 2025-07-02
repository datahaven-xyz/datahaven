# DataHaven E2E Testing Guide

Comprehensive guide for the DataHaven end-to-end testing framework.

## Table of Contents
1. [Overview](#overview)
2. [Setup](#setup)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [Architecture](#architecture)
6. [Network Configuration](#network-configuration)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Topics](#advanced-topics)

## Overview

The DataHaven E2E testing framework provides automated testing for the complete system including:
- EigenLayer AVS integration
- Ethereum <-> DataHaven cross-chain operations
- Operator registration and validation
- Rewards distribution
- Slashing mechanisms

### Key Features
- **Parallel Execution**: Tests run concurrently with configurable limits
- **Network Isolation**: Each test gets its own isolated network
- **Automatic Cleanup**: Resources cleaned up after each test
- **Real Docker Images**: Tests use actual production Docker images
- **Interactive CLI**: User-friendly interface for test management

## Setup

### Prerequisites

1. **System Requirements**
   - Docker Desktop (with 8GB+ RAM allocated)
   - Bun (latest version)
   - 10GB+ free disk space
   - macOS users: Zig (`brew install zig`) for TypeScript bindings

2. **Kurtosis Engine**
   ```bash
   # Install Kurtosis (if not already installed)
   brew install kurtosis-tech/tap/kurtosis
   
   # Start Kurtosis engine
   kurtosis engine start
   ```

3. **Install Dependencies**
   ```bash
   cd test
   bun i
   ```

### Initial Setup

1. **Generate Contract Bindings** (after contract changes)
   ```bash
   bun generate:wagmi
   ```

2. **Generate Runtime Types** (after runtime changes)
   ```bash
   bun generate:types
   ```

3. **Build Local Operator** (if testing operator changes)
   ```bash
   bun build:docker:operator
   ```

## Running Tests

### Interactive CLI (Recommended)
```bash
bun cli
```
Provides menu-driven interface for:
- Running individual tests
- Managing test networks
- Viewing logs
- Cleaning up resources

### Command Line

```bash
# Run all tests in parallel
bun test:e2e

# Run specific test suite
bun test suites/basic-flow.test.ts

# Run with custom timeout
bun test suites/rewards.test.ts --timeout 300000

# Start persistent test network
bun start:e2e:local

# Stop all test services
bun stop:e2e
```

### Parallel Execution
Tests run in parallel with:
- Max 3 concurrent tests (configurable in `scripts/test-parallel.ts`)
- 1-second delay between test starts
- Automatic log collection in `tmp/e2e-test-logs/`
- Process cleanup on failure or interruption

## Writing Tests

### Basic Test Structure

```typescript
import { BaseTestSuite } from "../testSuite";

export default class MyTest extends BaseTestSuite {
  name = "My Test Suite";
  description = "Tests specific functionality";

  async run() {
    await this.setupHooks();

    test("should do something", async () => {
      const { ethereum, datahaven } = this.connector.getTestConnectors();
      
      // Your test logic here
      expect(result).toBe(expected);
    });
  }
}
```

### Test Lifecycle Hooks

```typescript
export default class MyTest extends BaseTestSuite {
  async onSetup() {
    // Called before tests run
    // Deploy contracts, setup accounts, etc.
  }

  async onTeardown() {
    // Called after tests complete
    // Cleanup resources
  }
  
  async run() {
    await this.setupHooks();
    // Tests go here
  }
}
```

### Common Test Patterns

1. **Contract Interaction**
   ```typescript
   const tx = await contracts.ServiceManager.write.registerOperator([
     operatorAddress,
     signature
   ]);
   await ethereum.publicClient.waitForTransactionReceipt({ hash: tx });
   ```

2. **Cross-Chain Testing**
   ```typescript
   // Send from Ethereum
   await snowbridge.sendMessage(ethereumAddress, datahavenAddress, amount);
   
   // Verify on DataHaven
   const balance = await datahaven.getBalance(datahavenAddress);
   expect(balance).toBeGreaterThan(0n);
   ```

3. **Multi-Account Testing**
   ```typescript
   const accounts = await generateAccounts(this.connector, 5);
   for (const account of accounts) {
     // Test with each account
   }
   ```

## Architecture

The framework consists of three main layers:

### 1. Test Launcher (`launcher.ts`)
- Manages Kurtosis package execution
- Handles network lifecycle
- Provides network information to tests

### 2. Test Framework (`testSuite.ts`)
- Base class for all test suites
- Manages test lifecycle hooks
- Provides utility methods

### 3. Test Suites (`suites/*.test.ts`)
- Individual test implementations
- Extend BaseTestSuite
- Focus on specific functionality

### Network Isolation
Each test runs in an isolated Kurtosis enclave with:
- Dedicated Ethereum network
- Separate DataHaven chain
- Independent Snowbridge deployment
- Isolated contract deployments

## Network Configuration

### Available Options

```typescript
interface NetworkOptions {
  slotTime?: number;           // Ethereum slot time (default: 1)
  blockscout?: boolean;        // Enable Blockscout explorer
  verified?: boolean;          // Deploy verified contracts
  ethChainId?: number;         // Ethereum chain ID
  privateMode?: boolean;       // Use invite-only network
  
  // Docker images
  datahavenImageTag?: string;  // Custom DataHaven image
  relayerImageTag?: string;    // Custom relayer image
  
  // Build options
  buildDatahaven?: boolean;    // Build from source
  datahavenBuildExtraArgs?: string[];
}
```

### Configuration Examples

```typescript
// Fast local testing
{ slotTime: 1, blockscout: false }

// Production-like environment
{ slotTime: 12, blockscout: true, verified: true }

// Custom builds
{ buildDatahaven: true, datahavenBuildExtraArgs: ["--features", "fast-runtime"] }
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Kurtosis engine not running" | Run `kurtosis engine start` |
| "Port already in use" | Stop other services or `bun stop:e2e` |
| "Out of disk space" | Run `docker system prune -a` |
| "Test timeout" | Increase timeout or check Docker resources |
| "Contract not verified" | Add `verified: true` to network options |

### Debugging Commands

```bash
# View Kurtosis enclaves
kurtosis enclave ls

# Inspect specific enclave
kurtosis enclave inspect <enclave-name>

# View service logs
kurtosis service logs <enclave-name> <service-name>

# Clean up all enclaves
kurtosis clean -a

# Check Docker resources
docker system df
```

### Log Files
- Test execution logs: `tmp/e2e-test-logs/<test-name>.log`
- Kurtosis logs: Run with `--log-level debug`
- Service logs: Available via `kurtosis service logs`

## Advanced Topics

### Custom Network Packages
Create custom Kurtosis packages:
```typescript
const customPackage = {
  packagePath: "./my-custom-package",
  args: { /* custom args */ }
};
```

### Performance Optimization
1. **Resource Allocation**: Increase Docker Desktop RAM to 16GB
2. **Parallel Limits**: Adjust `MAX_CONCURRENT_TESTS` in `test-parallel.ts`
3. **Cleanup**: Regular `docker system prune` to free space
4. **Local Builds**: Use `buildDatahaven: false` for faster starts

### CI/CD Integration
```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: |
    kurtosis engine start
    bun i
    bun test:e2e
  env:
    KURTOSIS_DISABLE_ANALYTICS: true
```

### Contract Verification
For Blockscout-verified contracts:
1. Enable in network options: `verified: true`
2. Ensure foundry is available
3. Contracts auto-verify on deployment

## Additional Resources

- [Architecture Details](./E2E_FRAMEWORK_ARCHITECTURE.md)
- [Deployment Guide](./deployment.md)
- [Docker Configuration](../DOCKER_RESOURCES.md)
- [Quick Reference](./E2E_QUICK_REFERENCE.md)