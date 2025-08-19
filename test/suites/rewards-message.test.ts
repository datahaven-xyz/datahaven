import { beforeAll, describe, expect, it } from "bun:test";
import { logger } from "utils";
import { padHex } from "viem";
import { BaseTestSuite } from "../framework";
import { getContractInstance, parseRewardsInfoFile } from "../utils/contracts";
import { waitForEthereumEvent } from "../utils/events";
import * as rewardsHelpers from "../utils/rewards-helpers";

class RewardsMessageTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "rewards-message"
    });

    this.setupHooks();
  }

  override async onSetup(): Promise<void> {
    logger.info("Rewards message test setup complete");
  }
}

const suite = new RewardsMessageTestSuite();

describe("Rewards Message Flow", () => {
  beforeAll(async () => {
    logger.info("Starting rewards message flow tests");
  });

  it("should have rewards infrastructure ready", async () => {
    const { publicClient, dhApi } = suite.getTestConnectors();

    // Verify RewardsRegistry is deployed
    const rewardsRegistry = await getContractInstance("RewardsRegistry");
    expect(rewardsRegistry.address).toBeDefined();

    // Verify rewards agent is set
    const rewardsInfo = await parseRewardsInfoFile();
    expect(rewardsInfo.RewardsAgent).toBeDefined();

    // Read rewards agent from contract
    const agentAddress = await publicClient.readContract({
      address: rewardsRegistry.address,
      abi: rewardsRegistry.abi,
      functionName: "rewardsAgent"
    });

    expect(agentAddress).toBe(rewardsInfo.RewardsAgent);

    // Check ServiceManager is set
    const serviceManager = await getContractInstance("ServiceManager");
    const avsAddress = await publicClient.readContract({
      address: rewardsRegistry.address,
      abi: rewardsRegistry.abi,
      functionName: "avs"
    });
    expect(avsAddress).toBe(serviceManager.address);

    // Check Gateway is deployed
    const gateway = await getContractInstance("Gateway");
    expect(gateway.address).toBeDefined();

    // Check current block on DataHaven
    const currentBlock = await dhApi.query.System.Number.getValue();
    logger.info(`DataHaven current block: ${currentBlock}`);

    logger.success("✅ Rewards infrastructure ready:");
    logger.info(`  - RewardsRegistry: ${rewardsRegistry.address}`);
    logger.info(`  - RewardsAgent: ${rewardsInfo.RewardsAgent}`);
    logger.info(`  - ServiceManager: ${serviceManager.address}`);
    logger.info(`  - Gateway: ${gateway.address}`);
  });

  it("should complete basic rewards flow from era end to claim", async () => {
    const { dhApi, publicClient } = suite.getTestConnectors();

    // Step 1: Track current era and blocks until era end
    const currentBlock = await dhApi.query.System.Number.getValue();
    const currentEra = await rewardsHelpers.getCurrentEra(dhApi);
    const blocksUntilEraEnd = await rewardsHelpers.getBlocksUntilEraEnd(dhApi);

    logger.info(
      `Current block: ${currentBlock}, era: ${currentEra}, blocks until era end: ${blocksUntilEraEnd}`
    );

    // Step 2: Wait for era to end and capture the rewards message event
    logger.info("Waiting for era to end and rewards message to be sent...");

    const rewardsMessageEvent = await rewardsHelpers.waitForRewardsMessageSent(
      dhApi,
      currentEra,
      blocksUntilEraEnd * 6000 + 30000
    );

    if (!rewardsMessageEvent) {
      throw new Error("No rewards message event received - era ended without rewards message");
    }

    const messageIdHex = rewardsMessageEvent.message_id;
    const merkleRootHex = rewardsMessageEvent.rewards_merkle_root;
    const totalPoints = rewardsMessageEvent.total_points;
    const eraIndex = rewardsMessageEvent.era_index;

    logger.debug(
      `Rewards message sent for era ${eraIndex}: ${totalPoints} points, merkle root: ${merkleRootHex}`
    );

    expect(messageIdHex).toBeDefined();
    expect(merkleRootHex).toBeDefined();
    expect(totalPoints).toBeGreaterThan(0n);

    // Step 3: Monitor Gateway execution on Ethereum
    const gateway = await getContractInstance("Gateway");
    logger.info("Waiting for message execution on Gateway...");

    // Start watching from current block to avoid matching unrelated historical events
    const fromBlock = await publicClient.getBlockNumber();

    const executedEvent = await waitForEthereumEvent({
      client: publicClient,
      address: gateway.address,
      abi: gateway.abi,
      eventName: "MessageExecuted",
      fromBlock,
      timeout: 120000
    });

    expect(executedEvent.log).toBeDefined();
    logger.info(`Message executed on Ethereum at block ${executedEvent.log?.blockNumber}`);

    // Step 4: Verify RewardsRegistry update
    const rewardsRegistry = await getContractInstance("RewardsRegistry");

    const expectedRoot = padHex(merkleRootHex as `0x${string}`, { size: 32 });

    const rootUpdatedEvent = await waitForEthereumEvent({
      client: publicClient,
      address: rewardsRegistry.address,
      abi: rewardsRegistry.abi,
      eventName: "RewardsMerkleRootUpdated",
      args: { newRoot: expectedRoot },
      fromBlock,
      timeout: 180000
    });

    expect(rootUpdatedEvent.log).toBeDefined();
    const { oldRoot, newRoot, newRootIndex } = (rootUpdatedEvent.log as any).args as {
      oldRoot: `0x${string}`;
      newRoot: `0x${string}`;
      newRootIndex: bigint;
    };

    logger.info(`Merkle root updated at index ${newRootIndex.toString()}`);
    logger.info(`Old merkle root: ${oldRoot}`);
    logger.info(`New merkle root (from event): ${newRoot}`);

    // Verify the stored root matches the emitted newRoot on Ethereum
    const storedRoot = (await publicClient.readContract({
      address: rewardsRegistry.address,
      abi: rewardsRegistry.abi,
      functionName: "merkleRootHistory",
      args: [newRootIndex]
    })) as `0x${string}`;
    expect(storedRoot.toLowerCase()).toBe(newRoot.toLowerCase());
    expect(storedRoot.toLowerCase()).toBe(expectedRoot.toLowerCase());

    logger.success("✅ Rewards message successfully propagated from DataHaven to Ethereum");

    // Step 8: Generate Merkle Proofs
    logger.info("Generating merkle proofs for validators...");

    // Get era reward points
    const eraPoints = await rewardsHelpers.getEraRewardPoints(dhApi, eraIndex);
    expect(eraPoints).toBeDefined();
    expect(eraPoints?.total).toBeGreaterThan(0);

    logger.info(`Era ${eraIndex} points distribution:`);
    logger.info(`  Total points: ${eraPoints?.total}`);
    logger.info(`  Validators with points: ${eraPoints?.individual.size}`);

    // Generate merkle proofs for all validators
    const validatorProofs = await rewardsHelpers.generateMerkleProofsForEra(dhApi, eraIndex);

    // Verify we have at least one validator with proofs
    expect(validatorProofs.size).toBeGreaterThan(0);

    // Log proof details for debugging
    for (const [operatorAddress, proofData] of validatorProofs) {
      logger.debug("Validator proof generated:");
      logger.debug(`  Operator: ${operatorAddress}`);
      logger.debug(`  Points: ${proofData.points}`);
      logger.debug(`  Proof elements: ${proofData.proof.length}`);
      logger.debug(`  Leaf: ${proofData.leaf}`);
    }

    logger.success(`✅ Generated merkle proofs for ${validatorProofs.size} validators`);

    // TODO: Implement Step 9-11 (claiming rewards and verification)
    // This requires Service Manager interaction and token balance checks
  }, 300000);
});
