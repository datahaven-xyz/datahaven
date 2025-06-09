import { z } from "zod";
import { CONTAINER_NAMES, getPublicPort, logger } from "utils";

export const getRPCUrl = async (): Promise<string> => {
  const publicPort = await getPublicPort(CONTAINER_NAMES.EL1, 8545);
  return `http://127.0.0.1:${publicPort}`;
};

export const getWSUrl = async (): Promise<string> => {
  const publicPort = await getPublicPort(CONTAINER_NAMES.EL1, 8546);
  return `ws://127.0.0.1:${publicPort}`;
};

// Zod schemas for RPC response validation
const RPCErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
});

const SyncInfoSchema = z.object({
  startingBlock: z.string().optional(),
  currentBlock: z.string().optional(),
  highestBlock: z.string().optional(),
  pulledStates: z.string().optional(),
  knownStates: z.string().optional(),
});

const EthSyncingResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  result: z.union([z.literal(false), SyncInfoSchema]).optional(),
  error: RPCErrorSchema.optional(),
});

type SyncInfo = z.infer<typeof SyncInfoSchema>;


/**
 * Checks if the Ethereum node is syncing and waits until it's ready
 * @param rpcUrl - The RPC URL to check
 */
export const waitForNodeToSync = async (rpcUrl: string): Promise<void> => {
  const maxRetries = 60; // 1 minute with 1-second intervals
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_syncing",
          params: [],
          id: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawResult = await response.json();
      
      // Validate the RPC response structure
      const result = EthSyncingResponseSchema.parse(rawResult);

      if (result.error) {
        throw new Error(`RPC Error: ${result.error.message}`);
      }

      // eth_syncing returns false when not syncing, or an object with sync info when syncing
      if (result.result === false) {
        logger.success("✅ Node is fully synced and ready for transactions");
        return;
      }

      // Node is still syncing
      logger.info("⏳ Node is syncing...");

      retries++;
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      }
    } catch (error) {
      logger.warn(`⚠️ Failed to check sync status: ${error}. Retrying in 1 second...`);
      retries++;
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  logger.warn("⚠️ Node sync check timed out. Proceeding with deployment (this may fail if node is not ready)");
};