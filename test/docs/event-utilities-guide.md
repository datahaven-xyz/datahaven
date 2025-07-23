# Event Utilities Usage Guide

This guide demonstrates how to use the event waiting utilities for both DataHaven (Substrate) and Ethereum chains in your tests.

## DataHaven Event Utilities

### Basic Usage

#### Wait for a Single Event

```typescript
import { waitForDataHavenEvent } from "utils";

const transferEvent = await waitForDataHavenEvent({
  api: connectors.dhApi,
  eventPath: "Balances.Transfer",
  timeout: 10000,
  filter: (event) => event.from === senderAddress,
  onEvent: (event) => {
    console.log(`Transfer of ${event.amount} detected`);
  }
});
```

#### Wait for Multiple Events

```typescript
import { waitForMultipleDataHavenEvents } from "utils";

const eventResults = await waitForMultipleDataHavenEvents({
  api: connectors.dhApi,
  events: [
    {
      path: "System.ExtrinsicSuccess",
      stopOnMatch: true
    },
    {
      path: "Balances.Transfer",
      stopOnMatch: false // Collect all transfer events
    }
  ],
  timeout: 15000
});

const transfers = eventResults.get("Balances.Transfer") || [];
console.log(`Captured ${transfers.length} transfer events`);
```

#### Submit Transaction and Wait for Events

```typescript
import { submitAndWaitForDataHavenEvents } from "utils";

const tx = api.tx.System.remark({ remark: "Hello" });

const { txResult, events } = await submitAndWaitForDataHavenEvents(
  tx,
  signer,
  ["System.ExtrinsicSuccess", "System.Remarked"],
  20000
);
```

### Advanced Patterns

#### Filtering Events by Multiple Criteria

```typescript
const event = await waitForDataHavenEvent({
  api,
  eventPath: "DataHavenNativeTransfer.TokensTransferredToEthereum",
  filter: (event) => {
    return event.from === myAddress && 
           event.amount > parseEther("10") &&
           event.recipient === targetAddress;
  }
});
```

#### Handling Timeouts Gracefully

```typescript
const event = await waitForDataHavenEvent({
  api,
  eventPath: "SomeRareEvent",
  timeout: 5000
});

if (!event) {
  console.log("Event did not occur within timeout period");
  // Handle timeout case
} else {
  // Process event
}
```

## Ethereum Event Utilities

### Basic Usage

#### Wait for a Single Contract Event

```typescript
import { waitForEthereumEvent } from "utils";

const transferLog = await waitForEthereumEvent({
  client: publicClient,
  address: tokenAddress,
  abi: erc20Abi,
  eventName: "Transfer",
  timeout: 30000,
  onEvent: (log) => {
    console.log(`Transfer detected in block ${log.blockNumber}`);
  }
});
```

#### Wait for Events with Argument Filtering

```typescript
const approvalLog = await waitForEthereumEvent({
  client: publicClient,
  address: tokenAddress,
  abi: erc20Abi,
  eventName: "Approval",
  args: {
    owner: myAddress,
    spender: spenderAddress
  }
});
```

#### Wait for Multiple Events from Different Contracts

```typescript
import { waitForMultipleEthereumEvents } from "utils";

const eventResults = await waitForMultipleEthereumEvents({
  client: publicClient,
  events: [
    {
      address: gatewayAddress,
      abi: gatewayAbi,
      eventName: "MessageReceived",
      stopOnMatch: true
    },
    {
      address: tokenAddress,
      abi: erc20Abi,
      eventName: "Transfer",
      args: { to: myAddress },
      stopOnMatch: false
    }
  ],
  timeout: 20000
});

// Access results by key (address:eventName)
const messages = eventResults.get(`${gatewayAddress}:MessageReceived`) || [];
const transfers = eventResults.get(`${tokenAddress}:Transfer`) || [];
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
console.log(`Transfer events: ${events.get(`${tokenAddress}:Transfer`)?.length}`);
```

### Advanced Patterns

#### Historical Event Queries

```typescript
const currentBlock = await publicClient.getBlockNumber();
const fromBlock = currentBlock - 1000n; // Last 1000 blocks

const events = await waitForMultipleEthereumEvents({
  client: publicClient,
  events: [{
    address: contractAddress,
    abi: contractAbi,
    eventName: "StateChanged",
    stopOnMatch: false
  }],
  fromBlock,
  timeout: 10000
});
```

#### Complex Event Filtering

```typescript
const complexFilter = await waitForEthereumEvent({
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
```

## Cross-Chain Event Coordination

### Example: Snowbridge Message Flow

```typescript
// 1. Send message from DataHaven
const dhTx = api.tx.EthereumOutboundQueue.sendMessage({...});
const { events: dhEvents } = await submitAndWaitForDataHavenEvents(
  dhTx,
  signer,
  ["EthereumOutboundQueue.MessageQueued"]
);

const messageId = dhEvents.get("EthereumOutboundQueue.MessageQueued")?.[0]?.message_id;

// 2. Wait for message on Ethereum
const ethEvent = await waitForEthereumEvent({
  client: publicClient,
  address: gatewayAddress,
  abi: gatewayAbi,
  eventName: "InboundMessageDispatched",
  filter: (log) => log.args.messageId === messageId,
  timeout: 60000 // Cross-chain can take time
});

if (ethEvent) {
  console.log("Message successfully bridged!");
}
```

### Parallel Event Watching

```typescript
// Watch for events on both chains simultaneously
const [dhEvents, ethEvents] = await Promise.all([
  waitForMultipleDataHavenEvents({
    api: dhApi,
    events: [
      { path: "System.ExtrinsicSuccess", stopOnMatch: true },
      { path: "DataHavenNativeTransfer.TokensLocked", stopOnMatch: true }
    ]
  }),
  waitForMultipleEthereumEvents({
    client: publicClient,
    events: [
      { 
        address: gatewayAddress, 
        abi: gatewayAbi, 
        eventName: "TokenMinted",
        stopOnMatch: true 
      }
    ]
  })
]);
```

## Best Practices

1. **Always Set Reasonable Timeouts**: Don't use excessive timeouts that could make tests hang.

2. **Use Filters When Possible**: Filtering events reduces noise and ensures you get the exact event you're looking for.

3. **Handle Null Returns**: Always check if an event was actually found before using it.

4. **Log Event Details**: Use the `onEvent` callback to log important details for debugging.

5. **Clean Event Data**: Events from different chains have different structures - normalize as needed.

6. **Consider Event Ordering**: When waiting for multiple events, be aware that they might arrive in any order.

7. **Use Type-Safe ABIs**: Import ABIs from generated contract bindings for type safety.

## Common Patterns

### Retry Pattern
```typescript
async function waitForEventWithRetry(options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const event = await waitForDataHavenEvent(options);
    if (event) return event;
    console.log(`Retry ${i + 1}/${maxRetries}`);
  }
  throw new Error("Event not found after retries");
}
```

### Event Collection Pattern
```typescript
// Collect all events during a time period
const collectionPeriod = 10000; // 10 seconds
const startTime = Date.now();

const events = await waitForMultipleDataHavenEvents({
  api,
  events: [
    { path: "Balances.Transfer", stopOnMatch: false }
  ],
  timeout: collectionPeriod
});

console.log(`Collected ${events.get("Balances.Transfer")?.length} transfers in ${Date.now() - startTime}ms`);
```

### Event Verification Pattern
```typescript
async function verifyEventSequence(api, expectedEvents) {
  const results = await waitForMultipleDataHavenEvents({
    api,
    events: expectedEvents.map(e => ({ path: e, stopOnMatch: true })),
    timeout: 30000
  });

  // Verify all expected events occurred
  for (const expectedEvent of expectedEvents) {
    const events = results.get(expectedEvent) || [];
    expect(events.length).toBeGreaterThan(0);
  }
}
```