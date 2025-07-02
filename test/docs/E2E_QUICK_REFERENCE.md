# E2E Testing Framework Quick Reference

> **Note**: This document is being consolidated into the [E2E Testing Guide](./E2E_TESTING_GUIDE.md). Please refer there for the most current information.

## Quick Start

```bash
# Setup
cd test
bun install
kurtosis engine start

# Run tests
bun test:e2e                    # All tests in suites folder
bun test suites/my.test.ts      # Specific test
LOG_LEVEL=debug bun test:e2e    # With debug logs
```

## Test Suite Template

```typescript
import { describe, expect, it } from "bun:test";
import { BaseTestSuite } from "../framework";

class MyTestSuite extends BaseTestSuite {
  constructor() {
    super({ suiteName: "my-tests" });
    this.setupHooks(); // REQUIRED!
  }
}

const suite = new MyTestSuite();

describe("My Tests", () => {
  it("should test something", async () => {
    const { publicClient, walletClient, dhApi, papiClient } =
      suite.getTestConnectors();
    // Test implementation
  });
});
```

## Available Connectors

```typescript
const connectors = suite.getTestConnectors();

// Ethereum
connectors.publicClient; // PublicClient - read operations
connectors.walletClient; // WalletClient - write operations
connectors.elRpcUrl; // string - raw RPC URL

// DataHaven
connectors.dhApi; // DataHavenApi - typed API
connectors.papiClient; // PolkadotClient - low-level
connectors.dhWsUrl; // string - WebSocket URL
```

## Common Test Patterns

### Ethereum Tests

```typescript
// Check balance
const balance = await publicClient.getBalance({
  address: "0x...",
});

// Send transaction
const hash = await walletClient.sendTransaction({
  to: "0x...",
  value: parseEther("1"),
});

// Wait for confirmation
const receipt = await publicClient.waitForTransactionReceipt({ hash });

// Deploy contract
const hash = await walletClient.deployContract({
  abi: contractAbi,
  bytecode: contractBytecode,
  args: [],
});

// Call contract
const result = await publicClient.readContract({
  address: contractAddress,
  abi: contractAbi,
  functionName: "myFunction",
  args: [],
});
```

### DataHaven Tests

```typescript
// Query storage
const account = await dhApi.query.System.Account.getValue("0x...");
const blockNumber = await dhApi.query.System.Number.getValue();

// Submit extrinsic (finalized)
const tx = dhApi.tx.Balances.transfer_allow_death({
  dest: "0x...",
  value: parseEther("1"),
});
const result = await tx.signAndSubmit(signer);

// Submit extrinsic (best block - faster)
const result = await tx.signAndSubmit(signer, { at: "best" });

// Listen to events
const event = await dhApi.event.System.ExtrinsicSuccess.pull();

// Query at specific block
const balance = await dhApi.query.System.Account.getValue(address, {
  at: blockHash,
});
```

### Multiple Accounts

```typescript
// Get factory
const factory = suite.getConnectorFactory();

// Create wallet clients
const wallet1 = factory.createWalletClient(ANVIL_FUNDED_ACCOUNTS[1].privateKey);
const wallet2 = factory.createWalletClient(ANVIL_FUNDED_ACCOUNTS[2].privateKey);

// Use different signers for DataHaven
const signer1 = getPapiSigner("ALITH");
const signer2 = getPapiSigner("BALTATHAR");
```

## Network Options

```typescript
super({
  suiteName: "my-tests",
  networkOptions: {
    // Chain Configuration
    slotTime: 6, // Block time in seconds (default: 1)

    // Services
    blockscout: false, // Enable block explorer (default: false)
    verified: false, // Verify contracts (default: false)

    // Images
    buildDatahaven: false, // Build local image (default: false)
    datahavenImageTag: "...", // Custom image tag
    relayerImageTag: "...", // Custom relayer tag

    // Build Options
    datahavenBuildExtraArgs: "--features=fast-runtime",

    // Network Config
    kurtosisNetworkArgs: "key=value key2=value2",

    // External Networks (for non-local)
    elRpcUrl: "http://...", // External Ethereum RPC
    clEndpoint: "http://...", // External CL endpoint
  },
});
```

## Lifecycle Hooks

```typescript
class MyTestSuite extends BaseTestSuite {
  override async onSetup(): Promise<void> {
    // Called after network launch
    // Use for additional setup
    await someAsyncSetup();
  }

  override async onTeardown(): Promise<void> {
    // Called before network cleanup
    // Use for custom cleanup
    await someAsyncCleanup();
  }
}
```

## Debugging

### Keep Network Running

```typescript
override async onTeardown(): Promise<void> {
  console.log("Network endpoints:");
  console.log("DataHaven:", this.getTestConnectors().dhWsUrl);
  console.log("Ethereum:", this.getTestConnectors().elRpcUrl);
  // Skip cleanup: don't call super.onTeardown()
}
```

### Check Container Logs

```bash
# Find containers
docker ps -a | grep <test-name>

# View logs
docker logs <container-name>

# Follow logs
docker logs -f <container-name>
```

### Inspect Network State

```bash
# List all test networks
docker network ls | grep datahaven-net-

# List Kurtosis enclaves
kurtosis enclave ls

# Inspect enclave
kurtosis enclave inspect <enclave-name>
```

## Utilities

### Wait Helpers

```typescript
import { waitFor } from "utils/waits";

await waitFor({
  lambda: async () => {
    // Return true when condition met
    return await checkCondition();
  },
  iterations: 30, // Max attempts
  delay: 1000, // MS between attempts
  errorMessage: "Condition not met",
});
```

### Logger

```typescript
import { logger } from "utils";

logger.debug("Debug message");
logger.info("Info message");
logger.warn("Warning message");
logger.error("Error message");
logger.success("Success message");
```

### Constants

```typescript
import {
  ANVIL_FUNDED_ACCOUNTS, // Pre-funded Ethereum accounts
  SUBSTRATE_FUNDED_ACCOUNTS, // Pre-funded DataHaven accounts
} from "utils";

// Ethereum accounts
ANVIL_FUNDED_ACCOUNTS[0].privateKey; // 0xac09...
ANVIL_FUNDED_ACCOUNTS[0].publicKey; // 0xf39F...

// DataHaven accounts
SUBSTRATE_FUNDED_ACCOUNTS.ALITH.privateKey;
SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.privateKey;
```

## Common Issues

| Issue                                | Solution                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| "Network connectors not initialized" | Call `this.setupHooks()` in constructor                                         |
| "No available ports"                 | Clean up containers: `docker rm -f $(docker ps -aq --filter "name=datahaven-")` |
| "Kurtosis engine not running"        | Run: `kurtosis engine start`                                                    |
| "Image not found"                    | Build: `bun build:docker:operator`                                              |
| Test timeout                         | Increase: `--timeout 600000`                                                    |
| Port conflicts                       | Check: `lsof -i :9944`                                                          |

## Cleanup Commands

```bash
# Stop all test containers
docker rm -f $(docker ps -aq --filter "name=datahaven-")
docker rm -f $(docker ps -aq --filter "name=snowbridge-")

# Remove test networks
docker network prune

# Clean Kurtosis
kurtosis clean -a

# Full cleanup
docker system prune -a
```
