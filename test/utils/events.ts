import { firstValueFrom, of } from "rxjs";
import { catchError, take, tap, timeout } from "rxjs/operators";
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
 * Result from waiting for a DataHaven event
 */
export interface DataHavenEventResult<T = unknown> {
  /** Pallet name */
  pallet: string;
  /** Event name */
  event: string;
  /** Event data payload (null if timeout or error) */
  data: T | null;
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
 * @returns Event result with pallet, event name, and data
 */
export async function waitForDataHavenEvent<T = unknown>(
  options: WaitForDataHavenEventOptions<T>
): Promise<DataHavenEventResult<T>> {
  const { api, pallet, event, filter, timeout: timeoutMs = 30000, onEvent } = options;

  const eventWatcher = (api.event as any)?.[pallet]?.[event];
  if (!eventWatcher?.watch) {
    logger.warn(`Event ${pallet}.${event} not found`);
    return { pallet, event, data: null };
  }

  let data: T | null;
  try {
    data = await firstValueFrom(
      eventWatcher.watch(filter).pipe(
        tap((eventData: T) => {
          logger.debug(`Event ${pallet}.${event} received`);
          onEvent?.(eventData);
        }),
        take(1), // Always stop on first event
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
  } catch {
    data = null;
  }

  return { pallet, event, data };
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
      if (timeoutId) clearTimeout(timeoutId);
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
          if (logs.length > 0) {
            matchedLog = logs[0];
            if (onEvent) {
              onEvent(matchedLog);
            }
            cleanup();
            resolve(matchedLog);
          }
        },
        onError: (error: unknown) => {
          logger.debug(`Error watching Ethereum event ${eventName}: ${error}`);
          cleanup();
          resolve(null);
        }
      });
    } catch (error) {
      logger.debug(`Failed to watch Ethereum event ${eventName}: ${error}`);
      cleanup();
      resolve(null);
    }
  });

  return { address, eventName, log };
}
