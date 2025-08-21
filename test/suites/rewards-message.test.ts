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

    expect(rewardsMessageEvent).toBeDefined();
    const event = rewardsMessageEvent!;
    const messageIdHex = event.message_id;
    const merkleRootHex = event.rewards_merkle_root;
    const totalPoints = event.total_points;
    const eraIndex = event.era_index;

    logger.debug(
      `Rewards message sent for era ${eraIndex}: ${totalPoints} points, merkle root: ${merkleRootHex}, inflation amount: ${event.inflation_amount}`
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

    logger.success("Rewards message successfully propagated from DataHaven to Ethereum");

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

    logger.success(`Generated merkle proofs for ${validatorProofs.size} validators`);

    // Step 9: Claim Rewards
    logger.info("Claiming rewards for first validator...");

    // Before claiming, fund the RewardsRegistry with the era inflation amount so it can pay out rewards
    logger.info("Funding RewardsRegistry with era inflation amount for payouts...");
    const { walletClient: fundingWallet } = suite.getTestConnectors();
    const fundingTx = await fundingWallet.sendTransaction({
      chain: null,
      to: rewardsRegistry.address as `0x${string}`,
      value: eraPoints?.total ? BigInt(eraPoints.total) : 0n
    });
    await publicClient.waitForTransactionReceipt({ hash: fundingTx });

    // Get Service Manager contract
    const serviceManager = await getContractInstance("ServiceManager");

    // Select first validator to claim
    const firstEntry = validatorProofs.entries().next();
    expect(firstEntry.value).toBeDefined();
    const [operatorAddress, proofData] = firstEntry.value!;

    // Get validator credentials to create operator signer
    const factory = suite.getConnectorFactory();
    const credentials = rewardsHelpers.getValidatorCredentials(proofData.validatorAccount);

    expect(credentials.privateKey).toBeDefined();

    const operatorWallet = factory.createWalletClient(credentials.privateKey!);
    const resolvedOperator = operatorWallet.account.address as `0x${string}`;

    // Check the solochain address mapping in the contract
    const _mappedSolochainAddress = (await publicClient.readContract({
      address: serviceManager.address as `0x${string}`,
      abi: serviceManager.abi,
      functionName: "validatorEthAddressToSolochainAddress",
      args: [operatorAddress as `0x${string}`]
    })) as `0x${string}`;

    // Record initial ETH balance
    const balanceBefore = await publicClient.getBalance({ address: resolvedOperator });

    // Sign and send as the operator so ServiceManager derives the correct msg.sender
    const claimTx = await operatorWallet.writeContract({
      address: serviceManager.address as `0x${string}`,
      abi: serviceManager.abi,
      functionName: "claimOperatorRewards",
      chain: null,
      args: [
        0,
        newRootIndex,
        BigInt(proofData.points),
        BigInt(proofData.numberOfLeaves),
        BigInt(proofData.leafIndex),
        proofData.proof as readonly `0x${string}`[]
      ]
    });

    logger.info(`Claim transaction submitted: ${claimTx}`);

    // Wait for transaction receipt
    const claimReceipt = await publicClient.waitForTransactionReceipt({
      hash: claimTx
    });

    expect(claimReceipt.status).toBe("success");
    logger.info(`Claim transaction confirmed in block ${claimReceipt.blockNumber}`);

    // Get the claim event from RewardsRegistry
    const claimEvent = await waitForEthereumEvent({
      client: publicClient,
      address: rewardsRegistry.address,
      abi: rewardsRegistry.abi,
      eventName: "RewardsClaimedForIndex",
      fromBlock: claimReceipt.blockNumber - 1n,
      timeout: 10000
    });

    expect(claimEvent.log).toBeDefined();
    const claimArgs = (claimEvent.log as any).args as {
      operatorAddress: `0x${string}`;
      rootIndex: bigint;
      points: bigint;
      rewardsAmount: bigint;
    };

    // Verify event data
    expect(claimArgs.operatorAddress.toLowerCase()).toBe(resolvedOperator.toLowerCase());
    expect(claimArgs.rootIndex).toBe(newRootIndex);
    expect(claimArgs.points).toBe(BigInt(proofData.points));
    expect(claimArgs.rewardsAmount).toBeGreaterThan(0n);

    logger.success("Rewards claimed successfully");
    logger.info(`  Rewards amount: ${claimArgs.rewardsAmount} wei`);

    // Step 10: Validate Token Transfer
    logger.info("Validating reward transfer...");

    // Check ETH balance after claim
    const balanceAfter = await publicClient.getBalance({ address: resolvedOperator });

    // Calculate expected rewards (contract currently pays raw points in wei)
    const expectedRewards = BigInt(proofData.points);

    // Account for gas costs - the actual balance increase might be less due to gas
    // For the test account that sent the tx
    const actualBalanceIncrease = balanceAfter - balanceBefore;

    // Gas details and unified validation
    const gasUsedWei = claimReceipt.gasUsed * claimReceipt.effectiveGasPrice;
    const sameSender =
      operatorWallet.account &&
      resolvedOperator.toLowerCase() === operatorWallet.account.address.toLowerCase();

    // Adjust the observed increase by adding back gas if the operator paid for it
    const adjustedIncrease = actualBalanceIncrease + (sameSender ? gasUsedWei : 0n);

    // Logs to clarify payout vs gas
    logger.info(`  Gas used: ${gasUsedWei} wei`);
    logger.info(`  Same sender paid gas: ${sameSender}`);
    logger.info(`  Adjusted balance change (+gas if paid): ${adjustedIncrease} wei`);

    // Regardless of who paid for gas, the operator should net receive `rewardsAmount`
    expect(adjustedIncrease).toBe(claimArgs.rewardsAmount);

    // Verify rewards amount matches expected calculation
    expect(claimArgs.rewardsAmount).toBe(expectedRewards);

    logger.success("Reward transfer validated successfully");
    logger.info(`  Expected rewards: ${expectedRewards} wei`);
    logger.info(`  Actual rewards: ${claimArgs.rewardsAmount} wei`);
    logger.info(`  Balance increase: ${actualBalanceIncrease} wei`);

    // TODO: Implement Step 11 (double-claim prevention verification)
  }, 300000);
});
