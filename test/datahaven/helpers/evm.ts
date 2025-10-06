/**
 * EVM-related helper utilities for DataHaven tests
 * Adapted from Moonbeam test helpers
 */

import type { DevModeContext } from "@moonwall/cli";
import { expect } from "bun:test";
import type { EventRecord } from "@polkadot/types/interfaces";
import type {
  EvmCoreErrorExitError,
  EvmCoreErrorExitFatal,
  EvmCoreErrorExitReason,
  EvmCoreErrorExitRevert,
  EvmCoreErrorExitSucceed,
} from "@polkadot/types/lookup";

export type Errors = {
  Succeed: EvmCoreErrorExitSucceed["type"];
  Error: EvmCoreErrorExitError["type"];
  Revert: EvmCoreErrorExitRevert["type"];
  Fatal: EvmCoreErrorExitFatal["type"];
};

/**
 * Validate EVM execution result from Ethereum.Executed events
 * 
 * @param events - Array of event records from block execution
 * @param resultType - Expected result type (Succeed, Error, Revert, Fatal)
 * @param reason - Optional specific reason within the result type
 * 
 * @example
 * ```ts
 * expectEVMResult(result.events, "Succeed");
 * expectEVMResult(result.events, "Revert", "Reverted");
 * ```
 */
export function expectEVMResult<T extends Errors, Type extends keyof T>(
  events: EventRecord[],
  resultType: Type,
  reason?: T[Type]
) {
  expect(events, "Missing events, probably failed execution").toHaveLength;
  expect(events.length).toBeGreaterThan(0);
  
  const ethereumExecuted = events.find(
    ({ event: { section, method } }) => section === "ethereum" && method === "Executed"
  );
  
  expect(ethereumExecuted, "Ethereum.Executed event not found").toBeDefined();
  
  const ethereumResult = ethereumExecuted!.event.data[3] as EvmCoreErrorExitReason;

  const foundReason = ethereumResult.isError
    ? ethereumResult.asError.type
    : ethereumResult.isFatal
      ? ethereumResult.asFatal.type
      : ethereumResult.isRevert
        ? ethereumResult.asRevert.type
        : ethereumResult.asSucceed.type;

  expect(ethereumResult.type).toBe(resultType);
  
  if (reason) {
    if (ethereumResult.isError) {
      expect(ethereumResult.asError.type).toBe(reason);
    } else if (ethereumResult.isFatal) {
      expect(ethereumResult.asFatal.type).toBe(reason);
    } else if (ethereumResult.isRevert) {
      expect(ethereumResult.asRevert.type).toBe(reason);
    } else {
      expect(ethereumResult.asSucceed.type).toBe(reason);
    }
  }
}

/**
 * Extract signature parameters (r, s, v) from a hex signature string
 * 
 * @param signature - Hex signature string
 * @returns Object containing r, s, v components
 */
export function getSignatureParameters(signature: string): {
  r: string;
  s: string;
  v: number;
} {
  const r = signature.slice(0, 66); // 32 bytes
  const s = `0x${signature.slice(66, 130)}`; // 32 bytes
  let v = Number.parseInt(signature.slice(130, 132), 16); // 1 byte

  if (![27, 28].includes(v)) {
    v += 27;
  }

  return { r, s, v };
}

/**
 * Get transaction receipt with retry logic for async block production
 * 
 * @param context - Moonwall dev context
 * @param hash - Transaction hash
 * @param options - Retry configuration
 * @returns Transaction receipt
 */
export async function getTransactionReceiptWithRetry(
  context: DevModeContext,
  hash: `0x${string}`,
  options?: {
    maxAttempts?: number;
    delayMs?: number;
    exponentialBackoff?: boolean;
  }
) {
  const maxAttempts = options?.maxAttempts ?? 4;
  const delayMs = options?.delayMs ?? 2000;
  const exponentialBackoff = options?.exponentialBackoff ?? true;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const receipt = await context.viem().getTransactionReceipt({ hash });
      return receipt;
    } catch (error: unknown) {
      lastError = error as Error;

      // Check if it's the specific error we want to retry
      if (
        (error as Error).name === "TransactionReceiptNotFoundError" ||
        (error as Error).message?.includes("Transaction receipt with hash") ||
        (error as Error).message?.includes("could not be found")
      ) {
        if (attempt < maxAttempts) {
          const delay = exponentialBackoff ? delayMs * 1.5 ** (attempt - 1) : delayMs;
          await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 10000)));
          continue;
        }
      }

      // If it's a different error, throw immediately
      throw error;
    }
  }

  // If we've exhausted all attempts, throw the last error
  throw lastError || new Error(`Failed to get transaction receipt after ${maxAttempts} attempts`);
}

/**
 * Calculate total transaction fees (gasUsed * effectiveGasPrice)
 * 
 * @param context - Moonwall dev context
 * @param hash - Transaction hash
 * @returns Total fees in wei
 */
export async function getTransactionFees(context: DevModeContext, hash: string): Promise<bigint> {
  const receipt = await getTransactionReceiptWithRetry(context, hash as `0x${string}`);
  return receipt.gasUsed * receipt.effectiveGasPrice;
}

