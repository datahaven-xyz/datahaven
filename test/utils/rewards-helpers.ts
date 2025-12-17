import validatorSet from "../configs/validator-set.json";
import { waitForDataHavenEvent } from "./events";
import { logger } from "./logger";
import type { DataHavenApi } from "./papi";

// Small hex helper
const toHex = (x: unknown): `0x${string}` => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyX: any = x as any;
  if (anyX?.asHex) return anyX.asHex();
  const s = anyX?.toString?.() ?? "";
  return `0x${s}` as `0x${string}`;
};

// External Validators Rewards Events (normalized)
export interface RewardsMessageSent {
  messageId: `0x${string}`;
  merkleRoot: `0x${string}`;
  eraIndex: number;
  totalPoints: bigint;
  inflation: bigint;
}

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

// Merkle proof generation using DataHaven runtime API
export interface ValidatorProofData {
  validatorAccount: string;
  operatorAddress: string;
  points: number;
  proof: string[];
  leaf: string;
  numberOfLeaves: number;
  leafIndex: number;
}

export async function generateMerkleProofForValidator(
  dhApi: DataHavenApi,
  validatorAccount: string,
  eraIndex: number
): Promise<{ proof: string[]; leaf: string; numberOfLeaves: number; leafIndex: number } | null> {
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
    const proof = merkleProof.proof.map((node: unknown) => toHex(node));

    const leaf = toHex(merkleProof.leaf);

    const numberOfLeaves = Number(merkleProof.number_of_leaves as bigint);
    const leafIndex = Number(merkleProof.leaf_index as bigint);

    return { proof, leaf, numberOfLeaves, leafIndex };
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
  // Get era reward points
  const eraPoints = await getEraRewardPoints(dhApi, eraIndex);
  if (!eraPoints) {
    logger.warn(`No reward points found for era ${eraIndex}`);
    return new Map();
  }

  const entries = await Promise.all(
    [...eraPoints.individual].map(async ([validatorAccount, points]) => {
      const merkleData = await generateMerkleProofForValidator(dhApi, validatorAccount, eraIndex);
      if (!merkleData) return null;
      const credentials = getValidatorCredentials(validatorAccount);
      const value: ValidatorProofData = {
        validatorAccount,
        operatorAddress: credentials.operatorAddress,
        points,
        proof: merkleData.proof,
        leaf: merkleData.leaf,
        numberOfLeaves: merkleData.numberOfLeaves,
        leafIndex: merkleData.leafIndex
      };
      return [credentials.operatorAddress, value] as const;
    })
  );

  const filtered = entries.filter(Boolean) as [string, ValidatorProofData][];
  const proofs = new Map(filtered);
  logger.info(`Generated ${proofs.size} merkle proofs for era ${eraIndex}`);
  return proofs;
}