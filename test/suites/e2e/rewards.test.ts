import { describe, expect, it, beforeAll } from "bun:test";
import { $ } from "bun";
import fs from "node:fs";
import path from "node:path";
import { encodePacked, formatEther, keccak256, parseEther } from "viem";
import { createDefaultClient, logger, printHeader, type ViemClientInterface } from "../../utils";
import { MerkleTree } from "merkletreejs";
import { fundRewardsRegistry } from "../../scripts/fund-rewards-registry";
import { createRewardsTree, saveRewardsTree } from "../../scripts/create-rewards-tree";

// Get the path to the workspace root directory
const rootDir = path.resolve(__dirname, "../../../");
const contractsDir = path.resolve(rootDir, "contracts");
const configsDir = path.resolve(rootDir, "test/configs");

// Operator set IDs (from ServiceManagerBase.sol)
const VALIDATORS_SET_ID = 0;

// Define validators for testing
const validatorAddresses = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Anvil test account 0
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Anvil test account 1
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" // Anvil test account 2
];

// Test points for each validator (in wei)
const validatorPoints = [
  parseEther("0.1"), // 0.1 ETH worth of points
  parseEther("0.2"), // 0.2 ETH worth of points
  parseEther("0.15") // 0.15 ETH worth of points
];

// Create validator rewards objects for merkle tree generation
const validatorRewards = validatorAddresses.map((address, index) => ({
  address,
  points: validatorPoints[index]
}));

describe("E2E: Rewards", () => {
  let api: ViemClientInterface;
  let rewardsTreeData: any;
  let rewardsRegistryAddress: string;
  let rewardsAgentAddress: string;
  let rewardsAgentId: string;
  let serviceManagerAddress: string;
  let gatewayAddress: string;

  // Set RPC URL for testing
  const rpcUrl = "http://localhost:53167";
  // Default network for deployment files
  const networkName = "anvil";

  beforeAll(async () => {
    printHeader("Setting up Rewards Integration Test");

    // Create viem client
    api = await createDefaultClient();

    // Create the rewards merkle tree
    logger.info("Creating rewards merkle tree");
    rewardsTreeData = createRewardsTree(validatorRewards);
    const rewardsTreeFile = path.resolve(configsDir, "rewards-tree.json");
    saveRewardsTree(rewardsTreeFile, rewardsTreeData);

    // Get the deployment information to find contract addresses
    const defaultDeploymentPath = path.resolve(`${contractsDir}/deployments/${networkName}.json`);

    if (!fs.existsSync(defaultDeploymentPath)) {
      throw new Error(`Deployment file not found: ${defaultDeploymentPath}`);
    }

    // Read deployment file
    logger.info(`Reading contract addresses from deployment file: ${defaultDeploymentPath}`);
    const deployments = JSON.parse(fs.readFileSync(defaultDeploymentPath, "utf8"));

    // Get ServiceManager address from deployment file
    serviceManagerAddress = deployments.ServiceManager;
    if (!serviceManagerAddress) {
      throw new Error("ServiceManager address not found in deployment file");
    }
    logger.info(`ServiceManager address: ${serviceManagerAddress}`);

    // Read RewardsRegistry address using ServiceManager contract
    const { stdout: registryOutput } =
      await $`cd ${contractsDir} && cast call ${serviceManagerAddress} "operatorSetToRewardsRegistry(uint32)(address)" ${VALIDATORS_SET_ID} --rpc-url ${rpcUrl}`.quiet();

    rewardsRegistryAddress = registryOutput.toString().trim();
    logger.info(`RewardsRegistry address: ${rewardsRegistryAddress}`);

    // Get Gateway address from deployment file
    gatewayAddress = deployments.Gateway;
    if (!gatewayAddress) {
      throw new Error("Gateway address not found in deployment file");
    }
    logger.info(`Gateway address: ${gatewayAddress}`);

    // Get the rewards agent from the rewards registry
    const { stdout: agentOutput } =
      await $`cd ${contractsDir} && cast call ${rewardsRegistryAddress} "rewardsAgent()(address)" --rpc-url ${rpcUrl}`.quiet();

    rewardsAgentAddress = agentOutput.toString().trim();
    logger.info(`RewardsAgent address: ${rewardsAgentAddress}`);

    // Fund rewards registry for validators
    logger.info("Funding rewards registry");
    await fundRewardsRegistry({
      rpcUrl,
      operatorSetId: VALIDATORS_SET_ID,
      amount: "1" // Fund with 1 ETH for testing
    });
  });

  it("should have funded the RewardsRegistry with ETH", async () => {
    const balance = await api.getBalance({ address: rewardsRegistryAddress as `0x${string}` });
    expect(balance).toBeGreaterThan(parseEther("0.9"));
    logger.info(`RewardsRegistry balance: ${formatEther(balance)} ETH`);
  });

  it("should update the rewards merkle root via mocked Gateway message", async () => {
    // Set up environment variables for the mock script
    const env = {
      OPERATOR_SET_ID: VALIDATORS_SET_ID.toString(),
      NEW_MERKLE_ROOT: rewardsTreeData.merkleRoot,
      NETWORK: networkName
    };

    // Run the script to mock a Gateway message to update the rewards root
    const { exitCode, stderr } =
      await $`cd ${contractsDir} && forge script script/transact/MockRewardsUpdateMessage.s.sol --rpc-url ${rpcUrl} --broadcast`
        .env(env)
        .nothrow();

    if (exitCode !== 0) {
      logger.error(`Failed to mock rewards update message: ${stderr.toString()}`);
      throw new Error("Failed to mock rewards update message");
    }

    logger.success("Successfully mocked Gateway message to update rewards root");

    /* 
    // COMMENTED OUT: Real implementation using substrate outbound queue
    // This would be used when the substrate solochain is available
    // It would send a message through the outbound queue pallet with:
    // - Command: CallContract
    // - Origin: Rewards Agent ID
    // - Data: encoded call to updateRewardsMerkleRoot with new root
    
    // The relayer would then submit this message to the Gateway
    // which would validate and process it
    */
  });

  it("should allow a validator to claim rewards", async () => {
    // Get validator data to claim rewards with
    const validatorIndex = 0; // Using the first validator for this test
    const validatorAddress = validatorRewards[validatorIndex].address;
    const validatorPoint = validatorRewards[validatorIndex].points;
    const proof = rewardsTreeData.validators[validatorIndex].proof;

    // Check validator's balance before claiming
    const balanceBefore = await api.getBalance({ address: validatorAddress as `0x${string}` });
    logger.info(`Validator balance before claiming: ${formatEther(balanceBefore)} ETH`);

    // Set up environment variables for calling claimOperatorRewards
    const env = {
      VALIDATOR_PRIVATE_KEY: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // First Anvil account
      VALIDATOR_POINTS: validatorPoint.toString(),
      OPERATOR_SET_ID: VALIDATORS_SET_ID.toString(),
      PROOF: JSON.stringify(proof),
      NETWORK: networkName
    };

    // Run script to claim rewards
    const { exitCode, stderr } =
      await $`cd ${contractsDir} && forge script script/transact/ClaimValidatorRewards.s.sol --rpc-url ${rpcUrl} --broadcast`
        .env(env)
        .nothrow();

    if (exitCode !== 0) {
      logger.error(`Failed to claim rewards: ${stderr.toString()}`);
      throw new Error("Failed to claim rewards");
    }

    // Check validator's balance after claiming
    const balanceAfter = await api.getBalance({ address: validatorAddress as `0x${string}` });
    logger.info(`Validator balance after claiming: ${formatEther(balanceAfter)} ETH`);

    // Expected reward is equal to the validator's points (1 point = 1 wei)
    const expectedReward = validatorPoint;

    // Account for gas costs when checking the balance increase
    // The increase should be at least 99% of the expected reward
    const minimumExpectedIncrease = (expectedReward * 99n) / 100n;
    const actualIncrease = balanceAfter - balanceBefore;

    expect(actualIncrease).toBeGreaterThanOrEqual(minimumExpectedIncrease);
    logger.success(`Validator claimed ${formatEther(actualIncrease)} ETH in rewards`);
  });

  it("should not allow a validator to claim rewards twice", async () => {
    // Try to claim rewards again for the same validator
    const validatorIndex = 0;
    const validatorAddress = validatorRewards[validatorIndex].address;
    const validatorPoint = validatorRewards[validatorIndex].points;
    const proof = rewardsTreeData.validators[validatorIndex].proof;

    // Set up environment variables for calling claimOperatorRewards
    const env = {
      VALIDATOR_PRIVATE_KEY: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // First Anvil account
      VALIDATOR_POINTS: validatorPoint.toString(),
      OPERATOR_SET_ID: VALIDATORS_SET_ID.toString(),
      PROOF: JSON.stringify(proof),
      NETWORK: networkName
    };

    // Run script to claim rewards again (should fail)
    const { exitCode } =
      await $`cd ${contractsDir} && forge script script/transact/ClaimValidatorRewards.s.sol --rpc-url ${rpcUrl} --broadcast`
        .env(env)
        .nothrow();

    // Should fail because the rewards were already claimed
    expect(exitCode).not.toBe(0);
    logger.success("Correctly failed to claim rewards twice");
  });
});
