import validatorSet from "../configs/validator-set.json";
import { waitForDataHavenEvent } from "./events";
import { logger } from "./logger";
import type { DataHavenApi } from "./papi";

// External Validators Rewards Events
export interface RewardsMessageSentEvent {
  message_id: string;
  era_index: number;
  total_points: bigint;
  inflation_amount: bigint;
  rewards_merkle_root: string;
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

// Validator monitoring and rewards data
export interface EraRewardPoints {
  total: number;
  individual: Map<string, number>;
}

export async function getEraRewardPoints(
  dhApi: DataHavenApi,
  eraIndex: number
): Promise<EraRewardPoints | null> {
  try {
    const rewardPoints =
      await dhApi.query.ExternalValidatorsRewards.RewardPointsForEra.getValue(eraIndex);

    if (!rewardPoints) {
      return null;
    }

    // Convert the storage format to our interface
    const individual = new Map<string, number>();
    for (const [account, points] of rewardPoints.individual) {
      individual.set(account.toString(), points);
    }

    return {
      total: rewardPoints.total,
      individual
    };
  } catch (error) {
    logger.error(`Failed to get era reward points for era ${eraIndex}: ${error}`);
    return null;
  }
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

// Merkle proof generation using DataHaven runtime API
export interface ValidatorProofData {
  validatorAccount: string;
  operatorAddress: string;
  points: number;
  proof: string[];
  leaf: string;
}

export async function generateMerkleProofForValidator(
  dhApi: DataHavenApi,
  validatorAccount: string,
  eraIndex: number
): Promise<{ proof: string[]; leaf: string } | null> {
  try {
    // Call the runtime API to generate merkle proof
    const merkleProof = await dhApi.apis.ExternalValidatorsRewardsApi.generate_rewards_merkle_proof(
      validatorAccount,
      eraIndex
    );

    if (!merkleProof) {
      logger.debug(
        `No merkle proof available for validator ${validatorAccount} in era ${eraIndex}`
      );
      return null;
    }

    // Convert the proof to hex strings
    const proof = merkleProof.proof.map((node: any) =>
      node.asHex ? node.asHex() : `0x${node.toString()}`
    );

    const leaf = merkleProof.leaf.asHex
      ? merkleProof.leaf.asHex()
      : `0x${merkleProof.leaf.toString()}`;

    return { proof, leaf };
  } catch (error) {
    logger.error(`Failed to generate merkle proof for validator ${validatorAccount}: ${error}`);
    return null;
  }
}

/**
 * Validator credentials containing operator address and private key
 */
export interface ValidatorCredentials {
  operatorAddress: `0x${string}`;
  privateKey: `0x${string}` | null;
}

/**
 * Gets validator credentials (operator address and private key) by solochain address
 * @param validatorAccount The validator's solochain address
 * @returns The validator's credentials including operator address and private key
 */
export function getValidatorCredentials(validatorAccount: string): ValidatorCredentials {
  const normalizedAccount = validatorAccount.toLowerCase();

  // Find matching validator by solochain address
  const match = validatorSet.validators.find(
    (v) => v.solochainAddress.toLowerCase() === normalizedAccount
  );

  if (match) {
    return {
      operatorAddress: match.publicKey as `0x${string}`,
      privateKey: match.privateKey as `0x${string}`
    };
  }

  // Fallback: assume the input is already an Ethereum address, but no private key available
  logger.debug(`No mapping found for ${validatorAccount}, using as-is without private key`);
  return {
    operatorAddress: validatorAccount as `0x${string}`,
    privateKey: null
  };
}

// Generate merkle proofs for all validators in an era
export async function generateMerkleProofsForEra(
  dhApi: DataHavenApi,
  eraIndex: number
): Promise<Map<string, ValidatorProofData>> {
  const proofs = new Map<string, ValidatorProofData>();

  // Get era reward points
  const eraPoints = await getEraRewardPoints(dhApi, eraIndex);
  if (!eraPoints) {
    logger.warn(`No reward points found for era ${eraIndex}`);
    return proofs;
  }

  // Generate proofs for each validator
  for (const [validatorAccount, points] of eraPoints.individual) {
    const merkleData = await generateMerkleProofForValidator(dhApi, validatorAccount, eraIndex);
    if (!merkleData) continue;

    const credentials = getValidatorCredentials(validatorAccount);

    proofs.set(credentials.operatorAddress, {
      validatorAccount,
      operatorAddress: credentials.operatorAddress,
      points,
      proof: merkleData.proof,
      leaf: merkleData.leaf
    });
  }

  logger.info(`Generated ${proofs.size} merkle proofs for era ${eraIndex}`);
  return proofs;
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
// Typed payload from polkadot-api for the RewardsMessageSent event
type H256 = { asHex(): `0x${string}` };
interface RewardsMessageSentPayload {
  message_id: H256;
  rewards_merkle_root: H256;
  era_index: number;
  total_points: bigint;
  inflation_amount: bigint;
}

export async function waitForRewardsMessageSent(
  dhApi: DataHavenApi,
  expectedEra?: number,
  timeout = 120000
): Promise<RewardsMessageSentEvent | null> {
  const result = await waitForDataHavenEvent<RewardsMessageSentPayload>({
    api: dhApi,
    pallet: "ExternalValidatorsRewards",
    event: "RewardsMessageSent",
    filter: expectedEra !== undefined ? (event) => event.era_index === expectedEra : undefined,
    timeout
  });

  if (!result?.data) return null;

  return {
    message_id: result.data.message_id.asHex(),
    rewards_merkle_root: result.data.rewards_merkle_root.asHex(),
    era_index: result.data.era_index,
    total_points: result.data.total_points,
    inflation_amount: result.data.inflation_amount
  };
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
