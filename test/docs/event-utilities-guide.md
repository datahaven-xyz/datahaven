# Event Utilities Usage Guide

This guide demonstrates how to use event utilities for waiting and handling blockchain events in DataHaven (Substrate) and Ethereum chains.

## Overview

The event utilities provide a unified, type-safe interface for handling blockchain events with:

- **Consistent API**: Similar patterns for both DataHaven and Ethereum
- **Composable design**: Use `Promise.all()` for parallel event waiting
- **Graceful timeouts**: Functions return `null` on timeout (no errors thrown)
- **Type safety**: Full TypeScript support with proper event typing

## Quick Start

### DataHaven Events
```typescript
import { waitForDataHavenEvent } from '@test/e2e-suite/utils/datahaven';

const result = await waitForDataHavenEvent({
  api: dhApi,
  pallet: "Balances",
  event: "Transfer",
  timeout: 10000
});

if (result.data) {
  console.log(`Transfer: ${result.data.amount}`);
}
```

### Ethereum Events
```typescript
import { waitForEthereumEvent } from '@test/e2e-suite/utils/ethereum';

const result = await waitForEthereumEvent({
  client: publicClient,
  address: tokenAddress,
  abi: erc20Abi,
  eventName: "Transfer",
  timeout: 10000
});

if (result.log) {
  console.log(`Transfer: ${result.log.args.value}`);
}
```

## DataHaven Event Handling

### Transaction Submission (Direct Events)

When you submit your own transaction, you can get immediate access to all events:

```typescript
const result = await dhApi.tx.Balances
  .transfer({ dest: recipient, value: amount })
  .signAndSubmit(signer);

// result type: TxFinalized
if (result.ok) {
  // Access all events from the transaction
  const transfer = result.events.find(
    e => e.pallet === "Balances" && e.name === "Transfer"
  );
  
  if (transfer) {
    console.log(`Transferred: ${transfer.value.amount}`);
  }
} else {
  console.error(`Failed:`, result.dispatchError);
}
```

**Use this approach when:**
- ✅ You're submitting the transaction yourself
- ✅ You need events from that specific transaction
- ✅ You want synchronous access to results

### Waiting for External Events

Use `waitForDataHavenEvent` when monitoring for events from other sources:

```typescript
const result = await waitForDataHavenEvent({
  api: dhApi,
  pallet: "Balances", 
  event: "Transfer",
  filter: (e) => e.to === myAddress,
  timeout: 10000
});

if (result.data) {
  console.log(`Received transfer: ${result.data.amount}`);
}
```

**Use this approach when:**
- ✅ Waiting for events from other transactions
- ✅ Monitoring cross-chain events
- ✅ Watching for external activity
- ✅ Implementing time-based conditions

#### With Filtering
```typescript
const result = await waitForDataHavenEvent({
  api: dhApi,
  pallet: "Balances",
  event: "Transfer",
  timeout: 10000,
  // Only match transfers from specific sender with amount > 1000
  filter: (event) => event.from === senderAddress && event.amount > 1000n
});
```

#### With Callbacks
```typescript
const result = await waitForDataHavenEvent({
  api: dhApi,
  pallet: "Staking",
  event: "Rewarded",
  timeout: 30000,
  // Real-time processing as events are found
  onEvent: (event) => {
    console.log(`✅ Reward received: ${event.amount}`);
    updateRewardsDisplay(event.amount);
    // Callback doesn't affect the return value
  }
});
```

### Multiple Events

Wait for multiple events in parallel:

```typescript
const [transfer, reward, slash] = await Promise.all([
  waitForDataHavenEvent({
    api: dhApi,
    pallet: "Balances",
    event: "Transfer",
    timeout: 10000,
    filter: (e) => e.to === myAddress
  }),
  waitForDataHavenEvent({
    api: dhApi,
    pallet: "Staking",
    event: "Rewarded",
    timeout: 5000 // Shorter timeout for optional event
  }),
  waitForDataHavenEvent({
    api: dhApi,
    pallet: "Staking",
    event: "Slashed",
    timeout: 5000
  })
]);

// Handle results - some may be null (timeout)
if (!transfer.data) {
  throw new Error("Expected transfer not received");
}

if (reward.data) {
  console.log(`Received reward: ${reward.data.amount}`);
} else {
  console.log("No rewards in this period (normal)");
}

if (slash.data) {
  console.warn(`Got slashed: ${slash.data.amount}`);
}
```

## Ethereum Event Handling

### Basic Usage

```typescript
const result = await waitForEthereumEvent({
  client: publicClient,
  address: contractAddress,
  abi: contractAbi,
  eventName: "StateChanged",
  timeout: 30000
});

if (result.log) {
  console.log(`New state: ${result.log.args.newState}`);
  console.log(`Block: ${result.log.blockNumber}`);
  console.log(`Tx: ${result.log.transactionHash}`);
}
```

### With Argument Filtering

Filter events by their arguments:

```typescript
const result = await waitForEthereumEvent({
  client: publicClient,
  address: tokenAddress,
  abi: erc20Abi,
  eventName: "Transfer",
  // Only match specific transfers
  args: {
    from: myAddress,      // Must be FROM myAddress
    to: recipientAddress  // Must be TO recipientAddress
    // Omit 'value' to match any amount
  },
  timeout: 30000
});
```

### With Callbacks

Process events in real-time:

```typescript
const result = await waitForEthereumEvent({
  client: publicClient,
  address: dexAddress,
  abi: dexAbi,
  eventName: "Swap",
  args: {
    tokenIn: wethAddress,
    tokenOut: usdcAddress
  },
  onEvent: (log) => {
    const { amountIn, amountOut } = log.args;
    const rate = Number(amountOut) / Number(amountIn);
    
    console.log(`Swap at rate: ${rate}`);
    console.log(`Block: ${log.blockNumber}`);
    
    // Update UI, send notifications, etc.
    updatePriceDisplay(rate);
  },
  timeout: 60000
});
```

## Error Handling

### Timeout Handling

Events that timeout return `null`, not an error:

```typescript
const result = await waitForDataHavenEvent({
  api: dhApi,
  pallet: "Staking",
  event: "Rewarded",
  timeout: 5000
});

if (!result.data) {
  // Timeout - decide how to handle
  console.log("No rewards within 5 seconds");
  
  // Option 1: Continue (if event is optional)
  // Option 2: Retry with longer timeout
  // Option 3: Fail the test
  throw new Error("Expected rewards not received");
}

// Safe to use result.data here
console.log(`Rewards: ${result.data.amount}`);
```

### Error vs Timeout

```typescript
try {
  const result = await waitForEthereumEvent({
    client: publicClient,
    address: tokenAddress,
    abi: erc20Abi,
    eventName: "Transfer",
    timeout: 10000
  });
  
  if (!result.log) {
    // Timeout - not an error
    console.log("No transfer within 10 seconds");
    // Handle based on your needs
  } else {
    // Event found
    processTransfer(result.log);
  }
} catch (error) {
  // Only actual errors reach here:
  // - Network issues
  // - Invalid parameters
  // - Contract/API errors
  console.error("Unexpected error:", error);
}
```