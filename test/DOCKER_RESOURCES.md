# Docker Resource Configuration for E2E Tests

## Overview

The E2E testing framework launches multiple resource-intensive services including:

- DataHaven nodes (2 per test suite)
- Ethereum nodes via Kurtosis (multiple reth, lodestar instances)
- Snowbridge relayers (4 per test suite)
- Additional services (dora, blockscout, etc.)

Running all test suites in parallel can exhaust Docker's allocated CPU and memory resources.

## Docker Desktop Resource Settings

### macOS

1. Open Docker Desktop
2. Click the gear icon (Settings)
3. Navigate to "Resources" → "Advanced"
4. Adjust the following settings:
   - **CPUs**: Set to at least 6 (preferably 8 or more)
   - **Memory**: Set to at least 8 GB (preferably 12 GB or more)
   - **Swap**: Set to at least 2 GB
   - **Disk image size**: Ensure you have at least 60 GB

### Linux

On Linux, Docker uses the host's resources directly. Ensure your system has:

- At least 8 CPU cores available
- At least 16 GB RAM
- At least 60 GB free disk space

## Test Execution Strategies

### 1. Parallel Execution with Concurrency Limit (Default)

The `bun test:e2e:parallel` script now limits concurrent test execution to 2 test suites at a time to prevent resource exhaustion.

To adjust the concurrency limit, edit `scripts/test-parallel.ts`:

```typescript
const MAX_CONCURRENT_TESTS = 2; // Adjust based on your system resources
```

### 2. Sequential Execution (Most Reliable)

For systems with limited resources:

```bash
bun test:e2e
```

This runs all test suites sequentially, ensuring no resource contention.

### 3. Individual Test Suite Execution

Run specific test suites individually:

```bash
bun test suites/contracts.test.ts
bun test suites/ethereum-basic.test.ts
bun test suites/datahaven-substrate.test.ts
bun test suites/cross-chain.test.ts
```

## Monitoring Resources

### During Test Execution

Monitor Docker resource usage:

```bash
# Real-time container stats
docker stats

# Check Docker system resources
docker system df

# List all running containers
docker ps
```

### Cleanup After Tests

If tests fail or are interrupted:

```bash
# Stop all test-related containers
bun stop:e2e

# Clean up Docker resources
docker system prune -f

# Remove all Kurtosis enclaves
kurtosis enclave ls | grep eth- | awk '{print $2}' | xargs -I {} kurtosis enclave stop {}
```

## Troubleshooting

### "service requires X millicores of cpu but... only have 0 millicores available"

This error indicates Docker has run out of CPU resources. Solutions:

1. Increase Docker Desktop CPU allocation
2. Reduce MAX_CONCURRENT_TESTS in test-parallel.ts
3. Run tests sequentially with `bun test:e2e`

### Docker Desktop becomes unresponsive

1. Force quit Docker Desktop
2. Clean up any orphaned containers:
   ```bash
   docker ps -q | xargs docker kill
   docker system prune -a -f
   ```
3. Restart Docker Desktop with increased resources

### Tests timeout frequently

This can indicate insufficient resources causing slow container startup:

1. Increase TEST_TIMEOUT in test scripts
2. Ensure Docker has adequate CPU and memory
3. Check disk I/O performance (SSD recommended)

## Recommended Configurations

### Minimum (Sequential Execution Only)

- 4 CPUs
- 8 GB Memory
- 40 GB Disk

### Standard (2 Concurrent Tests)

- 6 CPUs
- 12 GB Memory
- 60 GB Disk

### High Performance (4 Concurrent Tests)

- 12 CPUs
- 24 GB Memory
- 100 GB Disk
