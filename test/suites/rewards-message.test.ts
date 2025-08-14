import { beforeAll, describe, expect, it } from "bun:test";
import { logger } from "utils";
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

    logger.info(`Current block: ${currentBlock}, era: ${currentEra}, blocks until era end: ${blocksUntilEraEnd}`);

    // Step 2: Wait for era to end and capture the rewards message event
    logger.info("Waiting for era to end and rewards message to be sent...");

    const rewardsMessageEvent = await rewardsHelpers.waitForRewardsMessageSent(
      dhApi, 
      currentEra,  // Wait for the current era's rewards message (sent when it ends)
      blocksUntilEraEnd * 6000 + 30000
    );

    if (!rewardsMessageEvent.data?.payload) {
      throw new Error("No rewards message event received - era ended without rewards message");
    }

    const eventPayload = rewardsMessageEvent.data.payload;

    // Extract fields from payload (hash fields need .toHex() conversion)
    const messageIdHex = eventPayload.message_id?.toHex?.() || eventPayload.message_id;
    const merkleRootHex = eventPayload.rewards_merkle_root?.toHex?.() || eventPayload.rewards_merkle_root;
    const totalPoints = eventPayload.total_points;
    const inflationAmount = eventPayload.inflation_amount;
    const eraIndex = eventPayload.era_index;

    logger.info(`Rewards message sent for era ${eraIndex}: ${totalPoints} points, merkle root: ${merkleRootHex}`);

    expect(messageIdHex).toBeDefined();
    expect(merkleRootHex).toBeDefined();
    expect(Number(totalPoints)).toBeGreaterThan(0);

    // Step 3: Track message through Snowbridge
    logger.info(`Waiting for message ${messageIdHex} to be queued in Snowbridge...`);
    const queuedEvent = await rewardsHelpers.waitForSnowbridgeMessage(dhApi, messageIdHex);
    expect(queuedEvent.data).toBeDefined();

    // Step 4: Monitor Gateway execution on Ethereum
    const gateway = await getContractInstance("Gateway");
    logger.info("Waiting for message execution on Gateway...");

    const executedEvent = await waitForEthereumEvent({
      client: publicClient,
      address: gateway.address,
      abi: gateway.abi,
      eventName: "MessageExecuted",
      timeout: 120000
    });

    expect(executedEvent.log).toBeDefined();
    logger.info(`Message executed on Ethereum at block ${executedEvent.log?.blockNumber}`);

    // Step 5: Verify RewardsRegistry update
    const rewardsRegistry = await getContractInstance("RewardsRegistry");

    const rootUpdatedEvent = await waitForEthereumEvent({
      client: publicClient,
      address: rewardsRegistry.address,
      abi: rewardsRegistry.abi,
      eventName: "RewardsMerkleRootUpdated",
      timeout: 30000
    });

    expect(rootUpdatedEvent.log).toBeDefined();
    const rootIndex = (rootUpdatedEvent.log as any)?.args?.index || 0;
    logger.info(`Merkle root updated at index ${rootIndex}`);

    // Step 6: Verify the stored root matches
    const storedRoot = await publicClient.readContract({
      address: rewardsRegistry.address,
      abi: rewardsRegistry.abi,
      functionName: "merkleRootHistory",
      args: [rootIndex]
    });

    expect(storedRoot).toBe(merkleRootHex);
    logger.success("✅ Rewards message successfully propagated from DataHaven to Ethereum");

    // TODO: Implement merkle proof generation and claiming
    // This requires validator point data and merkle tree library
  }, 300000);
});
