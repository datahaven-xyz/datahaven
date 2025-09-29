import { firstValueFrom, of } from "rxjs";
import { catchError, map, filter as rxFilter, take, tap, timeout } from "rxjs/operators";
import { logger } from "./logger";
import type { DataHavenApi } from "./papi";

/**
 * Storage utilities for DataHaven chain
 *
 * This module provides utilities for waiting for storage changes on DataHaven:
 * - Storage value changes (using substrate storage queries)
 * - Storage value conditions (waiting for specific values or conditions)
 */

/**
 * Result from waiting for a DataHaven storage change
 */
export interface DataHavenStorageResult<T = unknown> {
  /** Pallet name */
  pallet: string;
  /** Storage name */
  storage: string;
  /** Storage value (null if timeout or error) */
  value: T | null;
  /** Metadata about when/where storage was updated */
  meta: any | null;
}

/**
 * Options for waiting for a DataHaven storage change
 */
export interface WaitForDataHavenStorageOptions<T = unknown> {
  /** DataHaven API instance */
  api: DataHavenApi;
  /** Pallet name (e.g., "System", "Balances") */
  pallet: string;
  /** Storage name (e.g., "Account", "TotalIssuance") */
  storage: string;
  /** Optional filter function to match specific storage values */
  filter?: (value: T) => boolean;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Callback for matched storage value */
  onValue?: (value: T) => void;
  /** Whether to fail on timeout (default: true) */
  failOnTimeout?: boolean;
}

/**
 * Wait for a specific storage value change on the DataHaven chain
 * @param options - Options for storage waiting
 * @returns Storage result with pallet, storage name, and value
 */
export async function waitForDataHavenStorage<T = unknown>(
  options: WaitForDataHavenStorageOptions<T>
): Promise<DataHavenStorageResult<T>> {
  const {
    api,
    pallet,
    storage,
    filter,
    timeout: timeoutMs = 30000,
    onValue,
    failOnTimeout = true
  } = options;

  const storageQuery = (api.query as any)?.[pallet]?.[storage];
  if (!storageQuery?.watchValue) {
    logger.warn(`Storage ${pallet}.${storage} not found or doesn't support watchValue`);
    return { pallet, storage, value: null, meta: null };
  }

  let meta: any = null;
  let value: T | null = null;

  try {
    const matched: any = await firstValueFrom(
      storageQuery.watchValue().pipe(
        // Log every raw emission from the storage watcher
        tap((raw: any) => {
          logger.debug(`Storage ${pallet}.${storage} changed (raw): ${JSON.stringify(raw)}`);
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
        // Stop on the first matching value
        take(1),
        // Enforce an overall timeout while waiting for a matching value
        timeout({
          first: timeoutMs,
          with: () => {
            if (failOnTimeout) {
              throw new Error(`Timeout waiting for storage ${pallet}.${storage} after ${timeoutMs}ms`);
            }
            logger.debug(`Timeout waiting for storage ${pallet}.${storage} after ${timeoutMs}ms`);
            return of(null);
          }
        }),
        catchError((error: unknown) => {
          logger.error(`Error in storage subscription ${pallet}.${storage}: ${error}`);
          return of(null);
        })
      )
    );

    if (matched) {
      meta = matched.meta;
      value = matched.payload as T;
      if (value !== null && value !== undefined) {
        onValue?.(value);
      }
    }
  } catch (error) {
    logger.error(`Unexpected error waiting for storage ${pallet}.${storage}: ${error}`);
    value = null;
  }

  return { pallet, storage, value, meta };
}

/**
 * Wait for a storage value to contain specific items (useful for arrays/sets)
 * @param options - Options for storage waiting with array containment check
 * @returns Storage result with pallet, storage name, and value
 */
export async function waitForDataHavenStorageContains<T = unknown>(
  options: WaitForDataHavenStorageOptions<T> & {
    /** Items that should be contained in the storage value */
    contains: T[];
  }
): Promise<DataHavenStorageResult<T>> {
  const { contains, api, pallet, storage, onValue, ...baseOptions } = options;

  const normalizeValue = (item: any): any => {
    if (item.toLowerCase) {
      return item.toLowerCase();
    }
    return item;
  };

  return waitForDataHavenStorage({
    ...baseOptions,
    api,
    pallet,
    storage,
    onValue,
    filter: (value: T) => {
      if (Array.isArray(value)) {
        const normalizedValue = value.map(normalizeValue);
        const normalizedContains = contains.map(normalizeValue);
        return normalizedContains.every(item => normalizedValue.includes(item));
      }
      return false;
    }
  });
}
