import { parseRewardsInfoFile } from "./contracts";
import { waitForDataHavenEvent } from "./events";
import { logger } from "./logger";
import type { DataHavenApi } from "./papi";

// Era tracking utilities
export async function getCurrentEra(dhApi: DataHavenApi): Promise<number> {
  // TODO: Check correct storage key for current era
  // May need to use RewardPointsForEra or other storage
  return 0;
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

// Wait for rewards message sent event
export async function waitForRewardsMessageSent(
  dhApi: DataHavenApi,
  era?: number,
  timeout = 120000
): Promise<any> {
  return waitForDataHavenEvent({
    api: dhApi,
    pallet: "ExternalValidatorsRewards",
    event: "RewardsMessageSent",
    filter: era !== undefined ? (event: any) => event.era_index === era : undefined,
    timeout
  });
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
