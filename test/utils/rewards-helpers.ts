import { logger } from "./logger";
import type { DataHavenApi } from "./papi";

const toHex = (x: unknown): `0x${string}` => {
  const anyX = x as { asHex?: () => string; toString?: () => string };
  if (anyX?.asHex) return anyX.asHex() as `0x${string}`;
  return `0x${anyX?.toString?.() ?? ""}` as `0x${string}`;
};

export interface EraRewardPoints {
  total: number;
  individual: Map<string, number>;
}

export async function getEraRewardPoints(
  dhApi: DataHavenApi,
  eraIndex: number
): Promise<EraRewardPoints> {
  const rewardPoints =
    await dhApi.query.ExternalValidatorsRewards.RewardPointsForEra.getValue(eraIndex);

  if (!rewardPoints) {
    throw new Error(`No reward points found for era ${eraIndex}`);
  }

  return {
    total: rewardPoints.total,
    individual: new Map(
      rewardPoints.individual.map(([account, points]: [unknown, number]) => [
        String(account),
        points
      ])
    )
  };
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
