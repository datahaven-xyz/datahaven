import { beforeAll, describe, expect, it } from "bun:test";
import { logger } from "utils";
import { padHex, isAddressEqual, decodeEventLog, type Address, type Hex, BaseError, ContractFunctionRevertedError } from "viem";
import { BaseTestSuite } from "../framework";
import { getContractInstance, parseRewardsInfoFile } from "../utils/contracts";
import { waitForEthereumEvent } from "../utils/events";
import * as rewardsHelpers from "../utils/rewards-helpers";

// Test configuration constants
const TEST_CONFIG = {
  TIMEOUTS: {
    ERA_END_WAIT: 600000, // 10 minutes - increased for era transitions
    MESSAGE_EXECUTION: 120000, // 2 minutes  
    ROOT_UPDATE: 180000, // 3 minutes
    CLAIM_EVENT: 30000, // 30 seconds - increased for reliability
    OVERALL_TEST: 900000 // 15 minutes - increased for full suite
  },
  DELAYS: {
    RELAYER_INIT: 10000 // 10 seconds
  }
} as const;

class RewardsMessageTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "rewards-message"
    });

    this.setupHooks();
  }
}

const suite = new RewardsMessageTestSuite();

let rewardsRegistry!: any;
let serviceManager!: any;
let gateway!: any;
let publicClient!: any;
let dhApi!: any;
let eraIndex!: number;
let messageId!: Hex;
let merkleRoot!: Hex;
let totalPoints!: bigint;
let newRootIndex!: bigint;
let validatorProofs!: Map<string, rewardsHelpers.ValidatorProofData>;

describe("Rewards Message Flow", () => {
  beforeAll(async () => {
    logger.info("Starting rewards message flow tests");

    // Get test connectors once for all tests
    const connectors = suite.getTestConnectors();
    publicClient = connectors.publicClient;
    dhApi = connectors.dhApi;

    // Acquire core contracts once for all tests
    [rewardsRegistry, serviceManager, gateway] = await Promise.all([
      getContractInstance("RewardsRegistry"),
      getContractInstance("ServiceManager"),
      getContractInstance("Gateway")
    ]);
  });

  describe("Infrastructure Setup", () => {
    it("should verify rewards infrastructure deployment", async () => {

      // Fetch rewards info
      const rewardsInfo = await parseRewardsInfoFile();

      expect(rewardsRegistry.address).toBeDefined();
      expect(rewardsInfo.RewardsAgent).toBeDefined();
      expect(gateway.address).toBeDefined();

      // Validate configuration
      const [agentAddress, avsAddress] = await Promise.all([
        publicClient.readContract({
          address: rewardsRegistry.address,
          abi: rewardsRegistry.abi,
          functionName: "rewardsAgent",
          args: []
        }) as Promise<Address>,
        publicClient.readContract({
          address: rewardsRegistry.address,
          abi: rewardsRegistry.abi,
          functionName: "avs",
          args: []
        }) as Promise<Address>
      ]);

      expect(isAddressEqual(agentAddress, rewardsInfo.RewardsAgent as Address)).toBe(true);
      expect(isAddressEqual(avsAddress, serviceManager.address as Address)).toBe(true);

      // Check DataHaven connectivity
      const currentBlock = await dhApi.query.System.Number.getValue();
      expect(currentBlock > 0).toBe(true);

      logger.success("Rewards infrastructure verified");
    });
  });

  describe("Era Transition and Message Emission", () => {
    it("should wait for era end and capture rewards message", async () => {
      // Track current era and blocks until era end
      const [currentBlock, currentEra, blocksUntilEraEnd] = await Promise.all([
        dhApi.query.System.Number.getValue(),
        rewardsHelpers.getCurrentEra(dhApi),
        rewardsHelpers.getBlocksUntilEraEnd(dhApi)
      ]);

      logger.info(`Era transition tracking:`);
      logger.info(`  Current block: ${currentBlock}`);
      logger.info(`  Current era: ${currentEra}`);
      logger.info(`  Blocks until era end: ${blocksUntilEraEnd}`);

      // Wait for era to end and capture the rewards message event
      logger.info("⏳ Waiting for era to end and rewards message to be sent...");

      const timeout = blocksUntilEraEnd * 6000 + TEST_CONFIG.DELAYS.RELAYER_INIT * 3;
      const rewardsMessageEvent = await rewardsHelpers.waitForRewardsMessageSent(
        dhApi,
        currentEra,
        timeout
      );

      expect(rewardsMessageEvent).not.toBeNull();

      // Store event data
      messageId = rewardsMessageEvent!.messageId as Hex;
      merkleRoot = rewardsMessageEvent!.merkleRoot as Hex;
      totalPoints = rewardsMessageEvent!.totalPoints;
      eraIndex = rewardsMessageEvent!.eraIndex;

      // Validate event data
      expect(messageId).toBeDefined();
      expect(merkleRoot).toBeDefined();
      expect(totalPoints > 0n).toBe(true);

      logger.success(`Rewards message emitted for era ${eraIndex}`);
    }, TEST_CONFIG.TIMEOUTS.ERA_END_WAIT);
  });

  describe("Cross-Chain Message Execution", () => {
    it("should execute rewards message on Ethereum via Gateway", async () => {

      logger.info("⏳ Waiting for message execution on Gateway...");

      // Start watching from current block to avoid matching historical events
      const fromBlock = await publicClient.getBlockNumber();

      const executedEvent = await waitForEthereumEvent({
        client: publicClient,
        address: gateway.address,
        abi: gateway.abi,
        eventName: "MessageExecuted",
        fromBlock,
        timeout: TEST_CONFIG.TIMEOUTS.MESSAGE_EXECUTION
      });

      expect(executedEvent.log).not.toBeNull();
      const log = executedEvent.log!;
      const decoded = decodeEventLog({
        abi: gateway.abi,
        data: log.data,
        topics: log.topics,
        eventName: "MessageExecuted"
      }) as any;

      logger.success(`Message executed on Ethereum:`);
      logger.info(`  Block: ${log.blockNumber}`);
      logger.info(`  Transaction: ${log.transactionHash}`);

    }, TEST_CONFIG.TIMEOUTS.MESSAGE_EXECUTION);
  });

  describe("Merkle Root Update", () => {
    it("should update RewardsRegistry with new merkle root", async () => {

      const expectedRoot: Hex = padHex(merkleRoot, { size: 32 });
      const fromBlock = await publicClient.getBlockNumber();

      logger.info("⏳ Waiting for merkle root update in RewardsRegistry...");

      const rootUpdatedEvent = await waitForEthereumEvent({
        client: publicClient,
        address: rewardsRegistry.address,
        abi: rewardsRegistry.abi,
        eventName: "RewardsMerkleRootUpdated",
        args: { newRoot: expectedRoot },
        fromBlock,
        timeout: TEST_CONFIG.TIMEOUTS.ROOT_UPDATE
      });

      expect(rootUpdatedEvent.log).not.toBeNull();
      const rootLog = rootUpdatedEvent.log!;
      const rootDecoded = decodeEventLog({
        abi: rewardsRegistry.abi,
        data: rootLog.data,
        topics: rootLog.topics
      }) as { args: { oldRoot: Hex; newRoot: Hex; newRootIndex: bigint } };
      const updateArgs = rootDecoded.args;

      // Store the new root index for claiming tests
      newRootIndex = updateArgs.newRootIndex;

      logger.success(`Merkle root updated:`);
      logger.info(`  Index: ${updateArgs.newRootIndex}`);
      logger.info(`  Old root: ${updateArgs.oldRoot}`);
      logger.info(`  New root: ${updateArgs.newRoot}`);

      // Verify the stored root matches the expected root
      const storedRoot: Hex = await publicClient.readContract({
        address: rewardsRegistry.address,
        abi: rewardsRegistry.abi,
        functionName: "merkleRootHistory",
        args: [updateArgs.newRootIndex]
      }) as Hex;

      expect(storedRoot.toLowerCase()).toEqual(updateArgs.newRoot.toLowerCase());
      expect(storedRoot.toLowerCase()).toEqual(expectedRoot.toLowerCase());
    }, TEST_CONFIG.TIMEOUTS.ROOT_UPDATE);
  });

  describe("Merkle Proof Generation", () => {
    it("should generate valid merkle proofs for all validators", async () => {

      logger.info(`📊 Generating merkle proofs for era ${eraIndex}...`);

      // Get era reward points and generate proofs in parallel
      const [eraPoints, proofMap] = await Promise.all([
        rewardsHelpers.getEraRewardPoints(dhApi, eraIndex),
        rewardsHelpers.generateMerkleProofsForEra(dhApi, eraIndex)
      ]);

      expect(eraPoints).toBeDefined();
      expect(eraPoints!.total > 0).toBe(true);
      expect(proofMap.size > 0).toBe(true);

      // Store proofs for claiming tests
      validatorProofs = proofMap;

      logger.success(`Generated merkle proofs`);

      // Validate proof data structure (spot check)
      const firstProofMaybe = validatorProofs.values().next().value;
      expect(firstProofMaybe).toBeDefined();
      const firstProof = firstProofMaybe!;
      expect(firstProof.proof).toBeDefined();
      expect(firstProof.points > 0).toBe(true);
      expect(firstProof.numberOfLeaves > 0).toBe(true);
    });
  });

  describe("Rewards Claiming", () => {
    it("should fund RewardsRegistry for payouts", async () => {

      logger.info("💰 Funding RewardsRegistry for reward payouts...");

      const { walletClient: fundingWallet } = suite.getTestConnectors();
      const fundingAmount = totalPoints;

      const fundingTx = await fundingWallet.sendTransaction({
        to: rewardsRegistry.address as Address,
        value: fundingAmount,
        chain: null
      });

      const fundingReceipt = await publicClient.waitForTransactionReceipt({ hash: fundingTx });
      expect(fundingReceipt.status).toBe("success");

      // Verify contract balance
      const contractBalance = await publicClient.getBalance({
        address: rewardsRegistry.address
      });

      expect(contractBalance > 0n).toBe(true);

      logger.success(`RewardsRegistry funded:`);
      logger.info(`  Amount: ${fundingAmount} wei`);
      logger.info(`  Transaction: ${fundingTx}`);
      logger.info(`  Contract balance: ${contractBalance} wei`);
    });

    it("should successfully claim rewards for validator", async () => {
      logger.info("🎯 Claiming rewards for validator...");

      // Ensure prerequisites
      expect(validatorProofs).toBeDefined();
      expect(newRootIndex).toBeDefined();
      if (newRootIndex === undefined) {
        throw new Error("Merkle root not updated yet; cannot claim rewards");
      }

      // Select first validator to claim
      const firstEntry = validatorProofs.entries().next();
      expect(firstEntry.value).toBeDefined();
      const entry = firstEntry.value!;
      const [, proofData] = entry;

      // Get validator credentials and create operator wallet
      const factory = suite.getConnectorFactory();
      const credentials = rewardsHelpers.getValidatorCredentials(proofData.validatorAccount);
      expect(credentials.privateKey).toBeDefined();
      if (!credentials.privateKey) throw new Error("missing validator private key");
      const operatorWallet = factory.createWalletClient(credentials.privateKey as `0x${string}`);
      const resolvedOperator: Address = operatorWallet.account.address;

      // Record initial balance for validation
      const balanceBefore = await publicClient.getBalance({ address: resolvedOperator });

      // Submit claim transaction
      const claimTx = await operatorWallet.writeContract({
        address: serviceManager.address as Address,
        abi: serviceManager.abi,
        functionName: "claimOperatorRewards",
        chain: null,
        args: [
          0, // strategy index
          newRootIndex,
          BigInt(proofData.points),
          BigInt(proofData.numberOfLeaves),
          BigInt(proofData.leafIndex),
          proofData.proof as readonly Hex[]
        ]
      });

      logger.info(`📝 Claim transaction submitted: ${claimTx}`);

      // Wait for transaction confirmation
      const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: claimTx });
      expect(claimReceipt.status).toBe("success");

      // Wait for and validate claim event
      const claimEvent = await waitForEthereumEvent({
        client: publicClient,
        address: rewardsRegistry.address,
        abi: rewardsRegistry.abi,
        eventName: "RewardsClaimedForIndex",
        fromBlock: claimReceipt.blockNumber - 1n,
        timeout: TEST_CONFIG.TIMEOUTS.CLAIM_EVENT
      });

      expect(claimEvent.log).toBeDefined();
      const claimLog = claimEvent.log!;
      const claimDecoded = decodeEventLog({
        abi: rewardsRegistry.abi,
        data: claimLog.data,
        topics: claimLog.topics
      }) as { args: { operatorAddress: Address; rootIndex: bigint; points: bigint; rewardsAmount: bigint } };
      const claimArgs = claimDecoded.args;

      // Validate claim event data
      expect(isAddressEqual(claimArgs.operatorAddress, resolvedOperator)).toBe(true);
      expect(claimArgs.rootIndex).toEqual(newRootIndex);
      expect(claimArgs.points).toEqual(BigInt(proofData.points));
      expect(claimArgs.rewardsAmount > 0n).toBe(true);

      logger.success(`Rewards claimed successfully:`);
      logger.info(`  Operator: ${resolvedOperator}`);
      logger.info(`  Points: ${claimArgs.points}`);
      logger.info(`  Rewards: ${claimArgs.rewardsAmount} wei`);
      logger.info(`  Root index: ${claimArgs.rootIndex}`);

      // Validate balance change accounting for gas costs
      const balanceAfter = await publicClient.getBalance({ address: resolvedOperator });
      const actualBalanceIncrease = balanceAfter - balanceBefore;
      const gasUsedWei = claimReceipt.gasUsed * claimReceipt.effectiveGasPrice;
      const adjustedIncrease = actualBalanceIncrease + gasUsedWei;

      logger.info(`💰 Balance validation:`);
      logger.info(`  Gas used: ${gasUsedWei} wei`);
      logger.info(`  Adjusted balance increase: ${adjustedIncrease} wei`);

      expect(BigInt(adjustedIncrease)).toEqual(claimArgs.rewardsAmount);
      expect(claimArgs.rewardsAmount).toEqual(BigInt(proofData.points));
    }, TEST_CONFIG.TIMEOUTS.CLAIM_EVENT);

    it("should prevent double claiming of rewards", async () => {

      logger.info("🚫 Testing double-claim prevention...");

      // Use the same validator from the previous claim
      const firstEntry = validatorProofs.entries().next();
      expect(firstEntry.value).toBeDefined();
      const entry2 = firstEntry.value!;
      const [, proofData] = entry2;

      const factory = suite.getConnectorFactory();
      const credentials = rewardsHelpers.getValidatorCredentials(proofData.validatorAccount);
      expect(credentials.privateKey).toBeDefined();
      if (!credentials.privateKey) throw new Error("missing validator private key");
      const operatorWallet = factory.createWalletClient(credentials.privateKey as `0x${string}`);

      // Attempt second claim - this should fail
      await expect(
        operatorWallet.writeContract({
          address: serviceManager.address as Address,
          abi: serviceManager.abi,
          functionName: "claimOperatorRewards",
          chain: null,
          args: [
            0,
            newRootIndex,
            BigInt(proofData.points),
            BigInt(proofData.numberOfLeaves),
            BigInt(proofData.leafIndex),
            proofData.proof as readonly Hex[]
          ]
        })
      ).rejects.toThrow();
      logger.success("Double-claim prevention verified - second claim properly rejected");
    }, TEST_CONFIG.TIMEOUTS.CLAIM_EVENT);
  });
});
