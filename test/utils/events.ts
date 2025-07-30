import type { Abi, Address, Log, PublicClient } from "viem";
import { logger } from "./logger";
import type { DataHavenApi } from "./papi";

/**
 * Event utilities for DataHaven and Ethereum chains
 *
 * This module provides utilities for waiting for events on different chains:
 * - DataHaven events (substrate-based chain events)
 * - Ethereum events (using viem event filters)
 */

/**
 * Options for waiting for a single DataHaven event
 */
export interface WaitForDataHavenEventOptions<T = any> {
  /** DataHaven API instance */
  api: DataHavenApi;
  /** Event path in dot notation (e.g., "SnowbridgeSystemV2.RegisterToken") */
  eventPath: string;
  /** Optional filter function to match specific events */
  filter?: (event: T) => boolean;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Stop watching after first match (default: true) */
  stopOnFirst?: boolean;
  /** Callback for each matched event */
  onEvent?: (event: T) => void;
}

/**
 * Options for waiting for multiple DataHaven events
 */
export interface WaitForMultipleDataHavenEventsOptions {
  /** DataHaven API instance */
  api: DataHavenApi;
  /** Array of event configurations to watch */
  events: Array<{
    /** Event path in dot notation */
    path: string;
    /** Optional filter function */
    filter?: (event: any) => boolean;
    /** Stop watching this event after first match */
    stopOnMatch?: boolean;
  }>;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Callback for any matched event */
  onAnyEvent?: (eventPath: string, event: any) => void;
}

/**
 * Wait for a specific event on the DataHaven chain
 * @param options - Options for event waiting
 * @returns The first matched event or null if timeout
 */
export async function waitForDataHavenEvent<T = any>(
  options: WaitForDataHavenEventOptions<T>
): Promise<T | null> {
  const { api, eventPath, filter, timeout = 30000, stopOnFirst = true, onEvent } = options;

  return new Promise<T | null>((resolve) => {
    let unsubscribe: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let matchedEvent: T | null = null;

    const cleanup = () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    // Set up timeout
    timeoutId = setTimeout(() => {
      logger.debug(`Timeout waiting for event ${eventPath} after ${timeout}ms`);
      cleanup();
      resolve(matchedEvent);
    }, timeout);

    // Parse event path
    const parts = eventPath.split(".");
    if (parts.length !== 2) {
      logger.error(`Invalid event path format: ${eventPath}. Expected "Pallet.EventName"`);
      cleanup();
      resolve(null);
      return;
    }

    const [pallet, eventName] = parts;

    // Watch for events
    try {
      // Access the event directly from the API
      const eventWatcher = (api.event as any)[pallet]?.[eventName];
      if (!eventWatcher) {
        logger.warn(`Event ${eventPath} not found in API`);
        cleanup();
        resolve(null);
        return;
      }

      // Use polkadot-api's native filter parameter
      const subscription = eventWatcher.watch(filter).subscribe({
        next: (event: T) => {
          logger.debug(`Event ${eventPath} received`);

          // Event matched (already filtered by watch())
          matchedEvent = event;
          if (onEvent) {
            onEvent(event);
          }

          if (stopOnFirst) {
            cleanup();
            resolve(event);
          }
        },
        error: (error: any) => {
          logger.error(`Error in event subscription ${eventPath}: ${error}`);
          cleanup();
          resolve(null);
        }
      });

      // Store the unsubscribe function
      unsubscribe = () => subscription.unsubscribe();
    } catch (error) {
      logger.error(`Failed to watch event ${eventPath}: ${error}`);
      cleanup();
      resolve(null);
    }
  });
}

/**
 * Wait for multiple events on the DataHaven chain
 * @param options - Options for waiting for multiple events
 * @returns Map of event paths to arrays of matched events
 */
export async function waitForMultipleDataHavenEvents(
  options: WaitForMultipleDataHavenEventsOptions
): Promise<Map<string, any[]>> {
  const { api, events, timeout = 30000, onAnyEvent } = options;

  return new Promise<Map<string, any[]>>((resolve) => {
    const subscriptions: Array<{ unsubscribe: () => void; path: string }> = [];
    const eventResults = new Map<string, any[]>();
    let timeoutId: NodeJS.Timeout | null = null;

    // Initialize result map
    events.forEach((event) => {
      eventResults.set(event.path, []);
    });

    const cleanup = () => {
      subscriptions.forEach((sub) => sub.unsubscribe());
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    // Set up timeout
    timeoutId = setTimeout(() => {
      logger.debug(`Timeout waiting for events after ${timeout}ms`);
      cleanup();
      resolve(eventResults);
    }, timeout);

    // Set up watchers for each event
    let allEventsMatched = false;

    events.forEach((eventConfig) => {
      // Parse event path
      const parts = eventConfig.path.split(".");
      if (parts.length !== 2) {
        logger.error(`Invalid event path format: ${eventConfig.path}. Expected "Pallet.EventName"`);
        return;
      }

      const [pallet, eventName] = parts;

      try {
        // Access the event directly from the API
        const eventWatcher = (api.event as any)[pallet]?.[eventName];
        if (!eventWatcher) {
          logger.warn(`Event ${eventConfig.path} not found in API`);
          return;
        }

        // Use polkadot-api's native filter parameter
        const subscription = eventWatcher.watch(eventConfig.filter).subscribe({
          next: (event: any) => {
            logger.debug(`Event ${eventConfig.path} received`);

            // Store the event (already filtered by watch())
            const currentEvents = eventResults.get(eventConfig.path) || [];
            currentEvents.push(event);
            eventResults.set(eventConfig.path, currentEvents);

            if (onAnyEvent) {
              onAnyEvent(eventConfig.path, event);
            }

            // Check if we should stop watching this event
            if (eventConfig.stopOnMatch) {
              // Check if all events that should stop on match have been matched
              allEventsMatched = events
                .filter((e) => e.stopOnMatch)
                .every((e) => (eventResults.get(e.path) || []).length > 0);

              if (allEventsMatched) {
                cleanup();
                resolve(eventResults);
              }
            }
          },
          error: (error: any) => {
            logger.error(`Error in event subscription ${eventConfig.path}: ${error}`);
          }
        });

        subscriptions.push({
          unsubscribe: () => subscription.unsubscribe(),
          path: eventConfig.path
        });
      } catch (error) {
        logger.error(`Failed to watch event ${eventConfig.path}: ${error}`);
      }
    });

    // If no events to watch or all failed to set up, resolve immediately
    if (subscriptions.length === 0) {
      cleanup();
      resolve(eventResults);
    }
  });
}

/**
 * Submit a DataHaven transaction and wait for specific events
 * @param tx - Transaction to submit
 * @param signer - Transaction signer
 * @param eventPaths - Optional array of event paths to wait for after inclusion
 * @param timeout - Timeout in milliseconds
 * @returns Transaction result and any matched events
 */
export async function submitAndWaitForDataHavenEvents(
  tx: any,
  signer: any,
  eventPaths?: string[],
  timeout = 30000
): Promise<{
  txResult: any;
  events: Map<string, any[]>;
}> {
  // Submit transaction
  const txResult = await tx.signAndSubmit(signer);
  logger.debug(`Transaction submitted: ${txResult}`);

  // If no event paths specified, just return the tx result
  if (!eventPaths || eventPaths.length === 0) {
    return { txResult, events: new Map() };
  }

  // Wait for specified events
  const events = await waitForMultipleDataHavenEvents({
    api: tx._api || tx.api, // Handle different API access patterns
    events: eventPaths.map((path) => ({
      path,
      stopOnMatch: true
    })),
    timeout
  });

  return { txResult, events };
}

// ================== Ethereum Event Utilities ==================

/**
 * Options for waiting for a single Ethereum event
 */
export interface WaitForEthereumEventOptions<TAbi extends Abi = Abi> {
  /** Viem public client instance */
  client: PublicClient;
  /** Contract address */
  address: Address;
  /** Contract ABI */
  abi: TAbi;
  /** Event name to watch for */
  eventName: any;
  /** Optional event arguments to filter */
  args?: any;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Include events from past blocks */
  fromBlock?: bigint;
  /** Callback for each matched event */
  onEvent?: (log: Log) => void;
}

/**
 * Options for waiting for multiple Ethereum events
 */
export interface WaitForMultipleEthereumEventsOptions {
  /** Viem public client instance */
  client: PublicClient;
  /** Array of event configurations to watch */
  events: Array<{
    /** Contract address */
    address: Address;
    /** Contract ABI */
    abi: Abi;
    /** Event name */
    eventName: string;
    /** Optional event arguments */
    args?: any;
    /** Stop watching after first match */
    stopOnMatch?: boolean;
  }>;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Include events from past blocks */
  fromBlock?: bigint;
  /** Callback for any matched event */
  onAnyEvent?: (contractAddress: Address, eventName: string, log: Log) => void;
}

/**
 * Wait for a specific event on the Ethereum chain
 * @param options - Options for event waiting
 * @returns The first matched event log or null if timeout
 */
export async function waitForEthereumEvent<TAbi extends Abi = Abi>(
  options: WaitForEthereumEventOptions<TAbi>
): Promise<Log | null> {
  const { client, address, abi, eventName, args, timeout = 30000, fromBlock, onEvent } = options;

  return new Promise<Log | null>((resolve) => {
    let unwatch: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let matchedLog: Log | null = null;

    const cleanup = () => {
      if (unwatch) {
        unwatch();
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    // Set up timeout
    timeoutId = setTimeout(() => {
      logger.debug(`Timeout waiting for Ethereum event ${eventName} after ${timeout}ms`);
      cleanup();
      resolve(matchedLog);
    }, timeout);

    // Watch for events
    try {
      unwatch = client.watchContractEvent({
        address,
        abi,
        eventName,
        args,
        fromBlock,
        onLogs: (logs) => {
          logger.debug(`Ethereum event ${eventName} received: ${logs.length} logs`);

          if (logs.length > 0) {
            matchedLog = logs[0];
            if (onEvent) {
              onEvent(matchedLog);
            }
            cleanup();
            resolve(matchedLog);
          }
        },
        onError: (error) => {
          logger.error(`Error watching Ethereum event ${eventName}: ${error}`);
          cleanup();
          resolve(null);
        }
      });
    } catch (error) {
      logger.error(`Failed to watch Ethereum event ${eventName}: ${error}`);
      cleanup();
      resolve(null);
    }
  });
}

/**
 * Wait for multiple events on the Ethereum chain
 * @param options - Options for waiting for multiple events
 * @returns Map of event identifiers to arrays of matched logs
 */
export async function waitForMultipleEthereumEvents(
  options: WaitForMultipleEthereumEventsOptions
): Promise<Map<string, Log[]>> {
  const { client, events, timeout = 30000, fromBlock, onAnyEvent } = options;

  return new Promise<Map<string, Log[]>>((resolve) => {
    const unwatchers: Array<() => void> = [];
    const eventResults = new Map<string, Log[]>();
    let timeoutId: NodeJS.Timeout | null = null;

    // Initialize result map with event identifiers
    events.forEach((event) => {
      const key = `${event.address}:${event.eventName}`;
      eventResults.set(key, []);
    });

    const cleanup = () => {
      unwatchers.forEach((unwatch) => unwatch());
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    // Set up timeout
    timeoutId = setTimeout(() => {
      logger.debug(`Timeout waiting for Ethereum events after ${timeout}ms`);
      cleanup();
      resolve(eventResults);
    }, timeout);

    // Set up watchers for each event
    let allEventsMatched = false;

    events.forEach((eventConfig) => {
      const key = `${eventConfig.address}:${eventConfig.eventName}`;

      try {
        const unwatch = client.watchContractEvent({
          address: eventConfig.address,
          abi: eventConfig.abi,
          eventName: eventConfig.eventName,
          args: eventConfig.args,
          fromBlock,
          onLogs: (logs) => {
            logger.debug(`Ethereum event ${eventConfig.eventName} received: ${logs.length} logs`);

            // Store the logs
            const currentLogs = eventResults.get(key) || [];
            currentLogs.push(...logs);
            eventResults.set(key, currentLogs);

            if (onAnyEvent) {
              logs.forEach((log) => onAnyEvent(eventConfig.address, eventConfig.eventName, log));
            }

            // Check if we should stop watching
            if (eventConfig.stopOnMatch && logs.length > 0) {
              // Check if all events that should stop on match have been matched
              allEventsMatched = events
                .filter((e) => e.stopOnMatch)
                .every((e) => {
                  const k = `${e.address}:${e.eventName}`;
                  return (eventResults.get(k) || []).length > 0;
                });

              if (allEventsMatched) {
                cleanup();
                resolve(eventResults);
              }
            }
          },
          onError: (error) => {
            logger.error(`Error watching Ethereum event ${eventConfig.eventName}: ${error}`);
          }
        });

        unwatchers.push(unwatch);
      } catch (error) {
        logger.error(`Failed to watch Ethereum event ${eventConfig.eventName}: ${error}`);
      }
    });

    // If no events to watch or all failed to set up, resolve immediately
    if (unwatchers.length === 0) {
      cleanup();
      resolve(eventResults);
    }
  });
}

/**
 * Wait for a transaction receipt and optionally wait for specific events
 * @param client - Viem public client
 * @param hash - Transaction hash
 * @param eventConfigs - Optional array of event configurations to wait for
 * @param timeout - Timeout in milliseconds
 * @returns Transaction receipt and any matched events
 */
export async function waitForTransactionAndEvents(
  client: PublicClient,
  hash: Address,
  eventConfigs?: Array<{
    address: Address;
    abi: Abi;
    eventName: string;
    args?: any;
  }>,
  timeout = 30000
): Promise<{
  receipt: any;
  events: Map<string, Log[]>;
}> {
  // Wait for transaction receipt
  const receipt = await client.waitForTransactionReceipt({ hash });
  logger.debug(`Transaction ${hash} confirmed in block ${receipt.blockNumber}`);

  // If no event configs specified, just return the receipt
  if (!eventConfigs || eventConfigs.length === 0) {
    return { receipt, events: new Map() };
  }

  // Wait for specified events starting from the transaction block
  const events = await waitForMultipleEthereumEvents({
    client,
    events: eventConfigs.map((config) => ({
      ...config,
      stopOnMatch: true
    })),
    fromBlock: receipt.blockNumber,
    timeout
  });

  return { receipt, events };
}
