import { parseRewardsInfoFile } from "./contracts";
import { waitForDataHavenEvent } from "./events";
import { logger } from "./logger";
import type { DataHavenApi } from "./papi";

// External Validators Rewards Events - normalized with string hex values
export interface RewardsMessageSentEvent {
  message_id: string; // Always a hex string
  era_index: number;
  total_points: bigint;
  inflation_amount: bigint;
  rewards_merkle_root: string; // Always a hex string
}

// Era tracking utilities
export async function getCurrentEra(dhApi: DataHavenApi): Promise<number> {
  // Get the active era from ExternalValidators pallet
  const activeEra = await dhApi.query.ExternalValidators.ActiveEra.getValue();

  // ActiveEra can be null at chain genesis
  if (!activeEra) {
    return 0;
  }

  return activeEra.index;
}

export function getEraLengthInBlocks(dhApi: DataHavenApi): number {
  // Read constants directly from runtime metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const consts: any = (dhApi as unknown as { consts?: unknown }).consts ?? {};
  const epochDuration = Number(consts?.Babe?.EpochDuration ?? 10); // blocks per session
  const sessionsPerEra = Number(consts?.ExternalValidators?.SessionsPerEra ?? 1);
  return epochDuration * sessionsPerEra;
}

export async function getBlocksUntilEraEnd(dhApi: DataHavenApi): Promise<number> {
  const currentBlock = await dhApi.query.System.Number.getValue();
  const eraLength = getEraLengthInBlocks(dhApi) || 10;
  const mod = currentBlock % eraLength;
  return mod === 0 ? eraLength : eraLength - mod;
}

export async function waitForEraEnd(dhApi: DataHavenApi): Promise<void> {
  const blocksToWait = await getBlocksUntilEraEnd(dhApi);
  await waitForBlocks(dhApi, blocksToWait);
}

// Validator monitoring
export async function getValidatorPoints(
  dhApi: DataHavenApi,
  era: number
): Promise<Map<string, number>> {
  // TODO: Get era points from correct storage
  // const eraPoints = await dhApi.query.RewardPointsForEra?
  return new Map();
}

export async function getBlockAuthor(dhApi: DataHavenApi, blockNumber: number): Promise<string> {
  // TODO: Get block author from block header
  return "";
}

export async function trackBlockProduction(
  dhApi: DataHavenApi,
  startBlock: number,
  endBlock: number
): Promise<Map<string, number>> {
  const production = new Map<string, number>();
  // TODO: Subscribe to blocks and track authors
  return production;
}

// Message tracking
export async function waitForSnowbridgeMessage(
  dhApi: DataHavenApi,
  messageId: string,
  timeout = 120000
): Promise<any> {
  return waitForDataHavenEvent({
    api: dhApi,
    pallet: "SnowbridgeOutboundQueueV2",
    event: "MessageQueued",
    filter: (event: any) => event.id === messageId,
    timeout
  });
}

// Merkle proof generation
export interface MerkleProof {
  leaf: string;
  proof: string[];
  root: string;
}

export async function generateMerkleProof(
  validatorPoints: Map<string, number>,
  operator: string
): Promise<MerkleProof> {
  // TODO: Implement merkle tree generation
  // Will need to use keccak256 and proper encoding
  return {
    leaf: "",
    proof: [],
    root: ""
  };
}

export function verifyMerkleProof(proof: MerkleProof): boolean {
  // TODO: Implement merkle proof verification
  return false;
}

// Rewards validation
export function calculateExpectedRewards(
  points: bigint,
  totalPoints: bigint,
  inflation: bigint
): bigint {
  if (totalPoints === 0n) return 0n;
  return (inflation * points) / totalPoints;
}

// Helper to normalize hex values from polkadot-api
function normalizeHex(value: any): string {
  if (typeof value === "string") {
    return value.startsWith("0x") ? value : `0x${value}`;
  }
  if (value && typeof value === "object") {
    if (typeof value.toHex === "function") return value.toHex();
    if (typeof value.asHex === "function") return value.asHex();
    if (typeof value.toString === "function") {
      const str = value.toString();
      return str.startsWith("0x") ? str : `0x${str}`;
    }
  }
  return String(value);
}

// Wait for rewards message sent event
export async function waitForRewardsMessageSent(
  dhApi: DataHavenApi,
  expectedEra?: number,
  timeout = 120000
): Promise<RewardsMessageSentEvent | null> {
  const result = await waitForDataHavenEvent({
    api: dhApi,
    pallet: "ExternalValidatorsRewards",
    event: "RewardsMessageSent",
    filter: expectedEra !== undefined ? (event: any) => event.era_index === expectedEra : undefined,
    timeout
  });

  if (!result?.data) return null;

  // Normalize the data to ensure hex fields are always strings
  const normalized: RewardsMessageSentEvent = {
    message_id: normalizeHex(result.data.message_id),
    era_index: result.data.era_index,
    total_points: result.data.total_points,
    inflation_amount: result.data.inflation_amount,
    rewards_merkle_root: normalizeHex(result.data.rewards_merkle_root)
  };

  return normalized;
}

// Block utilities
export async function waitForBlocks(dhApi: DataHavenApi, numberOfBlocks: number): Promise<void> {
  const startBlock = await dhApi.query.System.Number.getValue();
  const targetBlock = startBlock + numberOfBlocks;

  logger.info(`Waiting for ${numberOfBlocks} blocks (${startBlock} -> ${targetBlock})`);

  // Poll for block number changes
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const currentBlock = await dhApi.query.System.Number.getValue();
      if (currentBlock >= targetBlock) {
        clearInterval(interval);
        resolve();
      }
    }, 1000); // Check every second
  });
}
