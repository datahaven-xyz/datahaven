import fs from "node:fs";
import path from "node:path";
import { keccak256, encodePacked } from "viem";
import { MerkleTree } from "merkletreejs";
import { logger, printHeader } from "../utils/index";

interface ValidatorReward {
  address: string;
  points: bigint;
}

interface RewardsTreeOutput {
  merkleRoot: string;
  validators: {
    address: string;
    points: string;
    proof: string[];
  }[];
}

/**
 * Creates a merkle tree for validator rewards and returns the root hash and proofs
 *
 * @param validators Array of validator addresses and their reward points
 * @returns The merkle root and proofs for each validator
 */
export function createRewardsTree(validators: ValidatorReward[]): RewardsTreeOutput {
  // Create hashes for each validator (address, points) pair
  const leaves = validators.map((validator) => {
    // Create the leaf value by encoding and hashing the validator address and points
    return keccak256(encodePacked(["address", "uint256"], [validator.address as `0x${string}`, validator.points]));
  });

  // Create the merkle tree
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getHexRoot();

  // Generate proofs for each validator
  const validatorsWithProofs = validators.map((validator, index) => {
    const leaf = leaves[index];
    const proof = tree.getHexProof(leaf);

    return {
      address: validator.address,
      points: validator.points.toString(),
      proof
    };
  });

  return {
    merkleRoot: root,
    validators: validatorsWithProofs
  };
}

/**
 * Saves the merkle tree data to a JSON file
 *
 * @param outputPath Path to save the JSON file
 * @param treeData The merkle tree data to save
 */
export function saveRewardsTree(outputPath: string, treeData: RewardsTreeOutput): void {
  fs.writeFileSync(outputPath, JSON.stringify(treeData, null, 2));
  logger.info(`Saved rewards tree to ${outputPath}`);
}

// Run this script directly with Node.js
if (import.meta.main) {
  printHeader("Creating Rewards Merkle Tree");

  // Parse command line args
  const args = process.argv.slice(2);
  const outputPath = args[0] || path.resolve(__dirname, "../configs/rewards-tree.json");

  // Load validators from validator-set.json
  const validatorSetPath = path.resolve(__dirname, "../configs/validator-set.json");
  logger.info(`Loading validators from ${validatorSetPath}`);

  if (!fs.existsSync(validatorSetPath)) {
    logger.error(`Validator set file not found: ${validatorSetPath}`);
    process.exit(1);
  }

  const validatorSetData = JSON.parse(fs.readFileSync(validatorSetPath, 'utf8'));
  const validators: ValidatorReward[] = validatorSetData.validators.map((validator: any) => ({
    address: validator.address,
    points: BigInt(validator.points || "100000000000000000n") // Default to 0.1 ETH worth of points if not specified
  }));

  logger.info(`Creating merkle tree for ${validators.length} validators`);

  // Create the merkle tree
  const treeData = createRewardsTree(validators);

  // Save the merkle tree data to a JSON file
  saveRewardsTree(outputPath, treeData);

  logger.info(`Merkle root: ${treeData.merkleRoot}`);
  logger.success("Rewards merkle tree created successfully");
}
