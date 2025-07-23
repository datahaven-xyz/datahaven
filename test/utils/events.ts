import { logger } from "./logger";

/**
 * Event utilities for DataHaven and Ethereum chains
 *
 * This module provides utilities for waiting for events on different chains:
 * - DataHaven events (substrate-based chain events)
 * - Ethereum events (coming soon - will use viem/ethers event filters)
 */

/**
 * Options for waiting for a single DataHaven event
 */
export interface WaitForDataHavenEventOptions<T = any> {
  /** DataHaven API instance */
  api: any;
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
  api: any;
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
 * Get DataHaven event watcher from dot-notation path
 * @param api - DataHaven API instance
 * @param eventPath - Event path like "Pallet.EventName"
 * @returns Event watcher object or null if not found
 */
function getDataHavenEventWatcher(api: any, eventPath: string): any {
  try {
    const parts = eventPath.split(".");
    if (parts.length !== 2) {
      throw new Error(`Invalid event path format: ${eventPath}. Expected "Pallet.EventName"`);
    }

    const [pallet, eventName] = parts;

    // Navigate through the API structure
    if (!api.event) {
      throw new Error("API does not have event property");
    }

    if (!api.event[pallet]) {
      throw new Error(`Pallet ${pallet} not found in API`);
    }

    if (!api.event[pallet][eventName]) {
      throw new Error(`Event ${eventName} not found in pallet ${pallet}`);
    }

    return api.event[pallet][eventName];
  } catch (error) {
    logger.debug(`Failed to get event watcher for ${eventPath}: ${error}`);
    return null;
  }
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

    // Get event watcher
    const eventWatcher = getDataHavenEventWatcher(api, eventPath);
    if (!eventWatcher) {
      logger.warn(`Event ${eventPath} not found in API`);
      cleanup();
      resolve(null);
      return;
    }

    // Watch for events
    try {
      unsubscribe = eventWatcher.watch((event: T) => {
        logger.debug(`Event ${eventPath} received`);

        // Apply filter if provided
        if (filter && !filter(event)) {
          return false; // Continue watching
        }

        // Event matched
        matchedEvent = event;
        if (onEvent) {
          onEvent(event);
        }

        if (stopOnFirst) {
          cleanup();
          resolve(event);
          return true; // Stop watching
        }

        return false; // Continue watching
      });
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
      const eventWatcher = getDataHavenEventWatcher(api, eventConfig.path);
      if (!eventWatcher) {
        logger.warn(`Event ${eventConfig.path} not found in API`);
        return;
      }

      try {
        const unsubscribe = eventWatcher.watch((event: any) => {
          logger.debug(`Event ${eventConfig.path} received`);

          // Apply filter if provided
          if (eventConfig.filter && !eventConfig.filter(event)) {
            return false; // Continue watching
          }

          // Store the event
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
              return true; // Stop watching
            }
          }

          return false; // Continue watching
        });

        subscriptions.push({ unsubscribe, path: eventConfig.path });
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
