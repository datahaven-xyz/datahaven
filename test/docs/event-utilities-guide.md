# Event Utilities Usage Guide

This guide demonstrates how to use the event waiting utilities for both DataHaven (Substrate) and Ethereum chains in your tests.

## Event Utilities Overview

The event utilities module provides a unified interface for waiting for blockchain events across both DataHaven (Substrate-based) and Ethereum chains. The API is designed to be simple, composable, and type-safe.

### Core Features
- **Single event watchers**: `waitForDataHavenEvent` and `waitForEthereumEvent` for individual events
- **Descriptive results**: Events return structured objects containing event identification (pallet/event name or address/event name) along with the event data
- **Composable design**: Use standard JavaScript `Promise.all()` for multiple events instead of dedicated wrapper functions
- **Transaction helper**: `waitForTransactionAndEvents` for Ethereum transaction + event patterns
- **Timeout handling**: All functions support configurable timeouts with graceful null returns
- **Type safety**: Full TypeScript support with generic types for event data

### Return Types
- `waitForDataHavenEvent` returns `DataHavenEventResult<T>` with `{ pallet, event, data }`
- `waitForEthereumEvent` returns `EthereumEventResult` with `{ address, eventName, log }`

### Timeout Behavior
- Functions return `null` for data/log on timeout instead of throwing errors
- This allows graceful handling in `Promise.all()` scenarios
- Check for `null` values to detect timeouts

## DataHaven Event Utilities

### Basic Usage

#### Wait for a Single Event

```typescript
import { waitForDataHavenEvent } from "utils";

const result = await waitForDataHavenEvent({
  api: connectors.dhApi,
  pallet: "Balances",
  event: "Transfer",
  timeout: 10000,
  filter: (event) => event.from === senderAddress,
  onEvent: (event) => {
    console.log(`Transfer of ${event.amount} detected`);
  }
});

// Result structure:
// {
//   pallet: "Balances",
//   event: "Transfer", 
//   data: { from: "...", to: "...", amount: "..." } | null
// }

if (result.data) {
  console.log(`Transfer amount: ${result.data.amount}`);
} else {
  console.log("Transfer event timed out");
}
```

#### Wait for Multiple Events

```typescript
import { waitForDataHavenEvent } from "utils";

// Use Promise.all() to wait for multiple events
const results = await Promise.all([
  waitForDataHavenEvent({
    api: connectors.dhApi,
    pallet: "System",
    event: "ExtrinsicSuccess",
    timeout: 15000
  }),
  waitForDataHavenEvent({
    api: connectors.dhApi,
    pallet: "Balances",
    event: "Transfer",
    timeout: 15000
  })
]);

// Results array maintains order
const [extrinsicResult, transferResult] = results;

// Easy to identify events by their properties
results.forEach(result => {
  console.log(`${result.pallet}.${result.event}: ${result.data ? 'Success' : 'Timeout'}`);
});

// Filter successful events
const successfulEvents = results.filter(r => r.data !== null);
```
### Advanced Patterns

#### Filtering Events by Multiple Criteria

```typescript
const result = await waitForDataHavenEvent({
  api,
  pallet: "DataHavenNativeTransfer",
  event: "TokensTransferredToEthereum",
  filter: (event) => {
    return event.from === myAddress && 
           event.amount > parseEther("10") &&
           event.recipient === targetAddress;
  }
});

if (result.data) {
  console.log(`Transferred ${result.data.amount} tokens`);
}
```

#### Handling Timeouts Gracefully

When an event times out, the functions return `null` for the data/log property rather than throwing an error. This allows graceful handling:

```typescript
const result = await waitForDataHavenEvent({
  api,
  pallet: "SomePallet",
  event: "SomeRareEvent",
  timeout: 5000
});

if (!result.data) {
  console.log(`Event ${result.pallet}.${result.event} did not occur within timeout period`);
  // Handle timeout case - no error thrown
} else {
  // Process event data
  console.log(`Event data:`, result.data);
}
```

**Important**: The functions return `null` on timeout instead of throwing errors. This design choice:
- Prevents unexpected exceptions in Promise.all scenarios
- Allows you to handle timeouts alongside successful events
- Makes it easy to filter out timed-out events from results

## Ethereum Event Utilities

### Basic Usage

#### Wait for a Single Contract Event

```typescript
import { waitForEthereumEvent } from "utils";

const result = await waitForEthereumEvent({
  client: publicClient,
  address: tokenAddress,
  abi: erc20Abi,
  eventName: "Transfer",
  timeout: 30000,
  onEvent: (log) => {
    console.log(`Transfer detected in block ${log.blockNumber}`);
  }
});

// Result structure:
// {
//   address: "0x...",
//   eventName: "Transfer",
//   log: { blockNumber, transactionHash, args, ... } | null
// }

if (result.log) {
  console.log(`Transfer from ${result.log.args.from} to ${result.log.args.to}`);
}
```

#### Wait for Events with Argument Filtering

```typescript
const result = await waitForEthereumEvent({
  client: publicClient,
  address: tokenAddress,
  abi: erc20Abi,
  eventName: "Approval",
  args: {
    owner: myAddress,
    spender: spenderAddress
  }
});

if (result.log) {
  console.log(`Approval amount: ${result.log.args.value}`);
}
```

#### Wait for Multiple Events from Different Contracts

```typescript
import { waitForEthereumEvent } from "utils";

// Use Promise.all() for multiple events
const results = await Promise.all([
  waitForEthereumEvent({
    client: publicClient,
    address: gatewayAddress,
    abi: gatewayAbi,
    eventName: "MessageReceived",
    timeout: 20000
  }),
  waitForEthereumEvent({
    client: publicClient,
    address: tokenAddress,
    abi: erc20Abi,
    eventName: "Transfer",
    args: { to: myAddress },
    timeout: 20000
  })
]);

const [messageResult, transferResult] = results;

// Easy to identify by properties
results.forEach(result => {
  console.log(`${result.eventName} at ${result.address}: ${result.log ? 'Found' : 'Timeout'}`);
});
```

#### Wait for Transaction and Events

```typescript
import { waitForTransactionAndEvents } from "utils";

// Send a transaction
const hash = await walletClient.sendTransaction({...});

// Wait for confirmation and events
const { receipt, events } = await waitForTransactionAndEvents(
  publicClient,
  hash,
  [
    {
      address: tokenAddress,
      abi: erc20Abi,
      eventName: "Transfer"
    },
    {
      address: gatewayAddress,
      abi: gatewayAbi,
      eventName: "MessageSent"
    }
  ]
);

console.log(`Transaction confirmed: ${receipt.status}`);

// events is now an array of EthereumEventResult
const [transferResult, messageResult] = events;

if (transferResult.log) {
  console.log(`Transfer detected: ${transferResult.log.args.value}`);
}
```

### Advanced Patterns

#### Historical Event Queries

```typescript
const currentBlock = await publicClient.getBlockNumber();
const fromBlock = currentBlock - 1000n; // Last 1000 blocks

const result = await waitForEthereumEvent({
  client: publicClient,
  address: contractAddress,
  abi: contractAbi,
  eventName: "StateChanged",
  fromBlock,
  timeout: 10000
});

if (result.log) {
  console.log(`Found StateChanged event in block ${result.log.blockNumber}`);
}
```

#### Complex Event Filtering

```typescript
const result = await waitForEthereumEvent({
  client: publicClient,
  address: dexAddress,
  abi: dexAbi,
  eventName: "Swap",
  args: {
    // Can filter by specific argument values
    tokenIn: wethAddress,
    tokenOut: usdcAddress
  },
  onEvent: (log) => {
    const { amountIn, amountOut } = log.args;
    const rate = amountOut / amountIn;
    console.log(`Swap rate: ${rate}`);
  }
});

if (result.log) {
  console.log(`Swap executed at ${result.address}`);
}
```

## Cross-Chain Event Coordination

### Example: Snowbridge Message Flow

```typescript
// 1. Send message from DataHaven
const dhTx = api.tx.EthereumOutboundQueue.sendMessage({...});
const txResult = await dhTx.signAndSubmit(signer);

// Wait for the message to be queued
const queuedEvent = await waitForDataHavenEvent({
  api,
  pallet: "EthereumOutboundQueue",
  event: "MessageQueued",
  timeout: 30000
});

const messageId = queuedEvent.data?.message_id;

// 2. Wait for message on Ethereum
const ethResult = await waitForEthereumEvent({
  client: publicClient,
  address: gatewayAddress,
  abi: gatewayAbi,
  eventName: "InboundMessageDispatched",
  args: { messageId },
  timeout: 60000 // Cross-chain can take time
});

if (ethResult.log) {
  console.log("Message successfully bridged!");
}
```

### Parallel Event Watching

```typescript
// Watch for events on both chains simultaneously
const [dhSuccess, dhTokensLocked, ethTokenMinted] = await Promise.all([
  waitForDataHavenEvent({
    api: dhApi,
    pallet: "System",
    event: "ExtrinsicSuccess"
  }),
  waitForDataHavenEvent({
    api: dhApi,
    pallet: "DataHavenNativeTransfer",
    event: "TokensLocked"
  }),
  waitForEthereumEvent({
    client: publicClient,
    address: gatewayAddress,
    abi: gatewayAbi,
    eventName: "TokenMinted"
  })
]);

// Check results
if (dhSuccess.data && dhTokensLocked.data && ethTokenMinted.log) {
  console.log("Cross-chain transfer completed successfully!");
}
```

## Best Practices

1. **Always Set Reasonable Timeouts**: Don't use excessive timeouts that could make tests hang.

2. **Use Filters When Possible**: Filtering events reduces noise and ensures you get the exact event you're looking for.

3. **Handle Null Returns**: Always check if `result.data` (DataHaven) or `result.log` (Ethereum) is not null before using it.

4. **Log Event Details**: Use the `onEvent` callback to log important details for debugging.

5. **Clean Event Data**: Events from different chains have different structures - normalize as needed.

6. **Consider Event Ordering**: When waiting for multiple events, be aware that they might arrive in any order.

7. **Use Type-Safe ABIs**: Import ABIs from generated contract bindings for type safety.

## Common Patterns

### Retry Pattern
```typescript
async function waitForEventWithRetry(options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await waitForDataHavenEvent(options);
    if (result.data) return result;
    console.log(`Retry ${i + 1}/${maxRetries}`);
  }
  throw new Error(`Event ${options.pallet}.${options.event} not found after retries`);
}
```

### Event Collection Pattern
```typescript
// Collect events during a specific time period using Promise.race
const collectionPeriod = 10000; // 10 seconds
const startTime = Date.now();

const result = await Promise.race([
  waitForDataHavenEvent({
    api,
    pallet: "Balances",
    event: "Transfer",
    timeout: collectionPeriod
  }),
  new Promise<DataHavenEventResult<any>>(resolve => 
    setTimeout(() => resolve({ 
      pallet: "Balances", 
      event: "Transfer", 
      data: null 
    }), collectionPeriod)
  )
]);

console.log(`Event search completed in ${Date.now() - startTime}ms`);
```

### Event Verification Pattern
```typescript
async function verifyEventSequence(api, expectedEvents) {
  const results = await Promise.all(
    expectedEvents.map(({ pallet, event }) => 
      waitForDataHavenEvent({
        api,
        pallet,
        event,
        timeout: 30000
      })
    )
  );

  // Verify all expected events occurred
  results.forEach((result, index) => {
    const expected = expectedEvents[index];
    expect(result.data).not.toBeNull();
    expect(result.pallet).toBe(expected.pallet);
    expect(result.event).toBe(expected.event);
  });
}
```

### Understanding Timeouts and Promise.all Behavior

When using `Promise.all`, it's important to understand how timeouts work:

```typescript
// When using Promise.all, all promises complete before returning
const results = await Promise.all([
  waitForDataHavenEvent({ api, pallet: "System", event: "ExtrinsicSuccess", timeout: 5000 }),
  waitForDataHavenEvent({ api, pallet: "Invalid", event: "NonExistent", timeout: 5000 })
]);

// Even if one times out quickly, Promise.all waits for all
// Results might be:
// [
//   { pallet: "System", event: "ExtrinsicSuccess", data: {...} },  // Success
//   { pallet: "Invalid", event: "NonExistent", data: null }         // Timeout/Not found
// ]

// IMPORTANT: No errors are thrown on timeout - check for null data/log
const successfulEvents = results.filter(r => r.data !== null);
const timedOutEvents = results.filter(r => r.data === null);

// For fail-fast behavior, use Promise.race with a timeout:
const raceResult = await Promise.race([
  Promise.all([...eventPromises]),
  new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
]);
```

**Key Points:**
- Timeouts return `null` values, not errors
- `Promise.all` waits for all events to complete or timeout
- Filter results to separate successful events from timeouts
- Use `Promise.race` if you need fail-fast behavior