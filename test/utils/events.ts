import { firstValueFrom, of } from "rxjs";
import { catchError, map, filter as rxFilter, take, tap, timeout } from "rxjs/operators";
import type { Abi, Address, Log, PublicClient } from "viem";
import { decodeEventLog } from "viem";
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
 * Result from waiting for a DataHaven event
 */
export interface DataHavenEventResult<T = unknown> {
  /** Pallet name */
  pallet: string;
  /** Event name */
  event: string;
  /** Event data payload (null if timeout or error) */
  data: T | null;
  /** Metadata about when/where event was emitted */
  meta: any | null;
}

/**
 * Options for waiting for a single DataHaven event
 */
export interface WaitForDataHavenEventOptions<T = unknown> {
  /** DataHaven API instance */
  api: DataHavenApi;
  /** Pallet name (e.g., "System", "Balances") */
  pallet: string;
  /** Event name (e.g., "ExtrinsicSuccess", "Transfer") */
  event: string;
  /** Optional filter function to match specific events */
  filter?: (event: T) => boolean;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Callback for matched event */
  onEvent?: (event: T) => void;
}

/**
 * Wait for a specific event on the DataHaven chain
 * @param options - Options for event waiting
 * @returns Event result with pallet, event name, and converted data
 */
export async function waitForDataHavenEvent<T = unknown>(
  options: WaitForDataHavenEventOptions<T>
): Promise<DataHavenEventResult<T>> {
  const { api, pallet, event, filter, timeout: timeoutMs = 30000, onEvent } = options;

  const eventWatcher = (api.event as any)?.[pallet]?.[event];
  if (!eventWatcher?.watch) {
    logger.warn(`Event ${pallet}.${event} not found`);
    return { pallet, event, data: null, meta: null };
  }

  let meta: any = null;
  let data: T | null = null;

  try {
    const matched: any = await firstValueFrom(
      eventWatcher.watch().pipe(
        // Log every raw emission from the watcher
        tap(() => {
          logger.debug(`Event ${pallet}.${event} received (raw)`);
        }),
        // Normalize to a consistent shape { payload, meta }
        map((raw: any) => ({ payload: raw?.payload ?? raw, meta: raw?.meta ?? null })),
        // Apply the optional filter BEFORE taking the first item
        rxFilter(({ payload }) => {
          if (!filter) return true;
          try {
            return filter(payload as T);
          } catch {
            return false;
          }
        }),
        // Stop on the first matching event
        take(1),
        // Enforce an overall timeout while waiting for a matching event
        timeout({
          first: timeoutMs,
          with: () => {
            logger.debug(`Timeout waiting for event ${pallet}.${event} after ${timeoutMs}ms`);
            return of(null);
          }
        }),
        catchError((error: unknown) => {
          logger.error(`Error in event subscription ${pallet}.${event}: ${error}`);
          return of(null);
        })
      )
    );

    if (matched) {
      meta = matched.meta;
      data = matched.payload as T;
      if (data) {
        onEvent?.(data);
      }
    }
  } catch (error) {
    logger.error(`Unexpected error waiting for event ${pallet}.${event}: ${error}`);
    data = null;
  }

  return { pallet, event, data, meta };
}

// ================== Ethereum Event Utilities ==================

/**
 * Result from waiting for an Ethereum event
 */
export interface EthereumEventResult {
  /** Contract address */
  address: Address;
  /** Event name */
  eventName: string;
  /** Event log (null if timeout or error) */
  log: Log | null;
}

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
 * Wait for a specific event on the Ethereum chain
 * @param options - Options for event waiting
 * @returns Event result with address, event name, and log
 */
export async function waitForEthereumEvent<TAbi extends Abi = Abi>(
  options: WaitForEthereumEventOptions<TAbi>
): Promise<EthereumEventResult> {
  const { client, address, abi, eventName, args, timeout = 30000, fromBlock, onEvent } = options;

  const log = await new Promise<Log | null>((resolve) => {
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

          // If args include non-indexed fields, viem cannot pre-filter them.
          // Post-filter by decoding logs and matching provided args if any.
          let selected: Log | null = null;
          if (args && Object.keys(args).length > 0) {
            for (const candidate of logs) {
              try {
                const decoded = decodeEventLog({
                  abi,
                  eventName: eventName as any,
                  data: candidate.data,
                  topics: candidate.topics
                });
                const decodedArgs = (decoded as any).args ?? {};
                const allMatch = Object.entries(args as Record<string, unknown>).every(
                  ([key, value]) => decodedArgs?.[key] === value
                );
                if (allMatch) {
                  selected = candidate;
                  break;
                }
              } catch {
                // Ignore decode errors and continue scanning
              }
            }
          }

          if (!selected && (!args || Object.keys(args).length === 0) && logs.length > 0) {
            // Only fallback to first log when no args filter provided
            selected = logs[0];
          }

          if (selected) {
            matchedLog = selected;
            if (onEvent) {
              onEvent(matchedLog);
            }
            cleanup();
            resolve(matchedLog);
          }
          // If no selected log matched, keep watching until timeout
        },
        onError: (error: unknown) => {
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

  return { address, eventName, log };
}
