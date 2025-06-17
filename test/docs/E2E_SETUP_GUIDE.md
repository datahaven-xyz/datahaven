# E2E Testing Framework Setup Guide

This guide walks through setting up and using the DataHaven E2E testing framework.

## Prerequisites

### Required Software

1. **Bun** (v1.0+)
   - See installation instructions at [https://bun.sh/docs/installation](https://bun.sh/docs/installation)

2. **Docker** (v20.10+)
   - Install Docker Desktop or Docker Engine
   - Ensure Docker daemon is running

3. **Kurtosis** (v1.0+)
   ```bash
   brew install kurtosis-tech/tap/kurtosis-cli
   # or
   curl -fsSL https://get.kurtosis.com | bash
   ```

4. **Git** with submodules support

### System Requirements

- **CPU**: 4+ cores recommended
- **RAM**: 16GB minimum (32GB recommended for parallel tests)
- **Disk**: 50GB free space
- **OS**: macOS, Linux, or WSL2

## Initial Setup

### 1. Clone Repository

```bash
git clone --recursive https://github.com/your-org/datahaven.git
cd datahaven
```

### 2. Install Dependencies

```bash
cd test
bun install
```

This will:
- Install all npm dependencies
- Generate Polkadot-API types
- Set up contract bindings

### 3. Build Prerequisites

#### DataHaven Node Image

Option A: Use pre-built image
```bash
docker pull moonsonglabs/datahaven:latest
docker tag moonsonglabs/datahaven:latest moonsonglabs/datahaven:local
```

Option B: Build locally
```bash
bun build:docker:operator
```

#### Smart Contracts (Optional)

If you plan to test contract interactions:
```bash
cd ../contracts
forge build
cd ../test
```

### 4. Start Kurtosis Engine

```bash
kurtosis engine start
```

Verify it's running:
```bash
kurtosis engine status
```

## Running Tests

### Basic Commands

Run all E2E tests:
```bash
bun test:e2e
```

Run specific test suite:
```bash
bun test test/suites/ethereum-basic.test.ts
```

Run tests in watch mode:
```bash
bun test --watch test/suites/
```

Run with debug output:
```bash
LOG_LEVEL=debug bun test test/suites/ethereum-basic.test.ts
```

### Test Execution Options

#### Timeout Configuration
```bash
# Increase timeout for slower systems
bun test test/suites/contracts.test.ts --timeout 600000  # 10 minutes
```

#### Parallel Execution
```bash
# Run multiple suites in parallel
bun test test/suites/*.test.ts --parallel
```

#### Specific Test Selection
```bash
# Run tests matching pattern
bun test test/suites/ -t "should send ETH"
```

## Writing Tests

### 1. Create Test Suite

Create a new file in `test/suites/`:

```typescript
// test/suites/my-feature.test.ts
import { describe, expect, it } from "bun:test";
import { BaseTestSuite } from "../framework";
import { parseEther } from "viem";
import { logger } from "utils";

class MyFeatureTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "my-feature",
      networkOptions: {
        // Optional configuration
        slotTime: 6,           // Block time in seconds
        blockscout: true,      // Enable block explorer
        buildDatahaven: false  // Use existing image
      }
    });
    
    // IMPORTANT: Must call setupHooks
    this.setupHooks();
  }
  
  // Optional: Additional setup after network launch
  override async onSetup(): Promise<void> {
    logger.info("Performing custom setup...");
    // Custom initialization
  }
  
  // Optional: Cleanup before network teardown
  override async onTeardown(): Promise<void> {
    logger.info("Performing custom cleanup...");
    // Custom cleanup
  }
}

// Create suite instance
const suite = new MyFeatureTestSuite();

describe("My Feature Tests", () => {
  it("should interact with Ethereum", async () => {
    const { publicClient, walletClient } = suite.getTestConnectors();
    
    // Your test logic here
    const blockNumber = await publicClient.getBlockNumber();
    expect(blockNumber).toBeGreaterThan(0n);
  });
  
  it("should interact with DataHaven", async () => {
    const { dhApi } = suite.getTestConnectors();
    
    // Your test logic here
    const account = await dhApi.query.System.Account.getValue("0x...");
    expect(account.data.free).toBeGreaterThan(0n);
  });
});
```

### 2. Use Test Connectors

The framework provides pre-configured connectors:

```typescript
const connectors = suite.getTestConnectors();

// Ethereum - Read operations
const balance = await connectors.publicClient.getBalance({ 
  address: "0x..." 
});

// Ethereum - Write operations
const hash = await connectors.walletClient.sendTransaction({
  to: "0x...",
  value: parseEther("1")
});

// DataHaven - Query storage
const systemInfo = await connectors.dhApi.query.System.Number.getValue();

// DataHaven - Submit extrinsic
const tx = connectors.dhApi.tx.Balances.transfer_allow_death({
  dest: "0x...",
  value: parseEther("1")
});
await tx.signAndSubmit(signer);
```

### 3. Access Multiple Accounts

```typescript
const factory = suite.getConnectorFactory();

// Create wallet for different account
const wallet2 = factory.createWalletClient(ANVIL_FUNDED_ACCOUNTS[1].privateKey);

// Use multiple accounts
await wallet2.sendTransaction({
  to: recipient,
  value: amount
});
```

## Troubleshooting

### Common Issues

#### 1. "Network connectors not initialized"
**Cause**: `setupHooks()` not called in constructor

**Solution**:
```typescript
constructor() {
  super({ suiteName: "my-test" });
  this.setupHooks(); // Add this line
}
```

#### 2. "No available ports found"
**Cause**: Too many test suites running or ports in use

**Solution**:
```bash
# Check for running containers
docker ps | grep datahaven

# Clean up orphaned containers
docker rm -f $(docker ps -aq --filter "name=datahaven-")
```

#### 3. "Kurtosis engine is not running"
**Cause**: Kurtosis not started

**Solution**:
```bash
kurtosis engine start
kurtosis engine status
```

#### 4. "Image moonsonglabs/datahaven:local not found"
**Cause**: DataHaven image not built/pulled

**Solution**:
```bash
# Build locally
bun build:docker:operator

# Or pull and tag
docker pull moonsonglabs/datahaven:latest
docker tag moonsonglabs/datahaven:latest moonsonglabs/datahaven:local
```

#### 5. Test Timeouts
**Cause**: Network takes too long to start

**Solution**:
```bash
# Increase timeout
bun test test/suites/my-test.ts --timeout 600000

# Or check logs
docker logs datahaven-<test-id>-alice
```

### Debugging Techniques

#### 1. Enable Debug Logging
```bash
LOG_LEVEL=debug bun test test/suites/my-test.ts
```

#### 2. Check Container Logs
```bash
# Find containers for your test
docker ps -a | grep <your-test-name>

# View logs
docker logs <container-name>
```

#### 3. Inspect Network State
```bash
# List Kurtosis enclaves
kurtosis enclave ls

# Inspect specific enclave
kurtosis enclave inspect <enclave-name>
```

#### 4. Keep Network Running
```typescript
override async onTeardown(): Promise<void> {
  // Comment out cleanup for debugging
  // await super.onTeardown();
  
  logger.info("Network kept running for debugging");
  logger.info(`DataHaven WS: ${this.getTestConnectors().dhWsUrl}`);
  logger.info(`Ethereum RPC: ${this.getTestConnectors().elRpcUrl}`);
}
```

### Resource Cleanup

#### Manual Cleanup
```bash
# Stop all DataHaven containers
docker rm -f $(docker ps -aq --filter "name=datahaven-")

# Remove all test networks
docker network prune

# Clean Kurtosis
kurtosis clean -a

# Full Docker cleanup (careful!)
docker system prune -a
```

#### Automatic Cleanup Script
```bash
#!/bin/bash
# cleanup-tests.sh

echo "Cleaning up test resources..."

# Stop containers
docker rm -f $(docker ps -aq --filter "name=datahaven-") 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=snowbridge-") 2>/dev/null || true

# Remove networks
docker network ls | grep "datahaven-net-" | awk '{print $2}' | xargs -r docker network rm

# Clean Kurtosis
kurtosis clean -a

echo "Cleanup complete!"
```

## Performance Optimization

### 1. Reuse Built Images
```typescript
// Always use pre-built images in tests
networkOptions: {
  buildDatahaven: false
}
```

### 2. Minimize Network Components
```typescript
// Skip unnecessary components
networkOptions: {
  blockscout: false,      // Skip if not testing explorer
  relayerImageTag: null   // Skip relayers if not needed
}
```

### 3. Parallel Test Execution
```bash
# Run independent test suites in parallel
bun test test/suites/*.test.ts --parallel
```

### 4. Use Faster Block Times
```typescript
networkOptions: {
  slotTime: 3  // Faster for testing
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
      with:
        submodules: recursive
    
    - uses: oven-sh/setup-bun@v1
      with:
        bun-version: latest
    
    - name: Start Docker
      run: |
        sudo systemctl start docker
        docker version
    
    - name: Install Kurtosis
      run: |
        curl -fsSL https://get.kurtosis.com | bash
        kurtosis engine start
    
    - name: Install Dependencies
      working-directory: ./test
      run: bun install
    
    - name: Pull DataHaven Image
      run: |
        docker pull moonsonglabs/datahaven:latest
        docker tag moonsonglabs/datahaven:latest moonsonglabs/datahaven:local
    
    - name: Run E2E Tests
      working-directory: ./test
      run: |
        LOG_LEVEL=info bun test:e2e
      timeout-minutes: 30
    
    - name: Upload Logs on Failure
      if: failure()
      uses: actions/upload-artifact@v3
      with:
        name: test-logs
        path: |
          test/tmp/
          /tmp/kurtosis-*
```

### Resource Limits

For CI environments with limited resources:

```typescript
// ci-test-suite.ts
class CITestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "ci-tests",
      networkOptions: {
        slotTime: 6,
        blockscout: false,
        buildDatahaven: false,
        // Use lighter configurations
      }
    });
    this.setupHooks();
  }
}
```

## Next Steps

1. **Explore Examples**: Check `test/suites/` for test patterns
2. **Read Architecture**: See `E2E_FRAMEWORK_ARCHITECTURE.md`
3. **Write Tests**: Start with simple tests and expand
4. **Contribute**: Add new test patterns and improvements

For questions or issues, please check the repository issues or documentation.