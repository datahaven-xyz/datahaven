import { firstValueFrom } from "rxjs";
import { take, timeout } from "rxjs/operators";
import type { Abi, Address, Log, PublicClient } from "viem";
import { logger } from "./logger";
import type { DataHavenApi } from "./papi";

export interface WaitForDataHavenEventOptions<T = unknown> {
  api: DataHavenApi;
  pallet: string;
  event: string;
  filter?: (event: T) => boolean;
  /** Default: 30000ms */
  timeout?: number;
}

/** Waits for a DataHaven chain event. Throws on timeout. */
export async function waitForDataHavenEvent<T = unknown>(
  options: WaitForDataHavenEventOptions<T>
): Promise<T> {
  const { api, pallet, event, filter, timeout: timeoutMs = 30000 } = options;

  const watcher = (api.event as any)?.[pallet]?.[event];
  if (!watcher?.watch) {
    throw new Error(`Event ${pallet}.${event} not found in API`);
  }

  const result = await firstValueFrom(
    watcher.watch(filter).pipe(
      take(1),
      timeout({
        first: timeoutMs,
        with: () => {
          throw new Error(`Timeout waiting for ${pallet}.${event} after ${timeoutMs}ms`);
        }
      })
    )
  ) as { payload: T };

  return result.payload;
}

export interface WaitForEthereumEventOptions<TAbi extends Abi = Abi> {
  client: PublicClient;
  address: Address;
  abi: TAbi;
  eventName: any;
  /** Only indexed event parameters can be filtered */
  args?: any;
  /** Default: 30000ms */
  timeout?: number;
  fromBlock?: bigint;
}

/** Waits for an Ethereum event, throws on timeout. */
export async function waitForEthereumEvent<TAbi extends Abi = Abi>(
  options: WaitForEthereumEventOptions<TAbi>
): Promise<Log> {
  const { client, address, abi, eventName, args, timeout = 30000, fromBlock } = options;

  let unwatch: () => void = () => { };
  let timeoutId!: Timer;

  const eventPromise = new Promise<Log>((resolve, reject) => {
    unwatch = client.watchContractEvent({
      address,
      abi,
      eventName,
      args,
      fromBlock,
      onLogs: (logs) => {
        logger.debug(`Ethereum event ${eventName} received: ${logs.length} logs`);
        resolve(logs[0]);
      },
      onError: (error) => {
        logger.error(`Error watching Ethereum event ${eventName} from ${address}: ${error}`);
        reject(error);
      }
    });
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Timeout waiting for ${eventName} from ${address} after ${timeout}ms`)),
      timeout
    );
  });

  try {
    return await Promise.race([eventPromise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
    unwatch();
  }
}

/** Extracts an event from DataHaven transaction result, throws if not found. */
export function requireDhEvent<T = unknown>(
  events: any[],
  pallet: string,
  eventType: string,
  filter?: (value: any) => boolean
): T {
  const event = events.find(
    (e) =>
      e.type === pallet &&
      e.value?.type === eventType &&
      (filter ? filter(e.value?.value) : true)
  );
  if (!event) {
    throw new Error(`Expected event ${pallet}.${eventType} not found`);
  }
  return event.value.value as T;
}
