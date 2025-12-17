import { beforeAll, describe, expect, it } from "bun:test";
import type { PolkadotClient } from "polkadot-api";
import { firstValueFrom } from "rxjs";
import { filter } from "rxjs/operators";
import { CROSS_CHAIN_TIMEOUTS, logger } from "utils";
import {
  type Address,
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  decodeEventLog,
  type Hex,
  isAddressEqual,
  padHex
} from "viem";
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
}

const suite = new RewardsMessageTestSuite();

let rewardsRegistry!: any;
let serviceManager!: any;
let gateway!: any;
let publicClient!: any;
let dhApi!: any;
let papiClient!: PolkadotClient;
let eraIndex!: number;
let merkleRoot!: Hex;
let totalPoints!: bigint;
let newRootIndex!: bigint;
let validatorProofs!: Map<string, rewardsHelpers.ValidatorProofData>;
// Persisted state from first successful claim for double-claim test
let claimedOperatorAddress!: Address;
let claimedProofData!: rewardsHelpers.ValidatorProofData;
let firstClaimGasUsed!: bigint;
let firstClaimBlockNumber!: bigint;

describe("Rewards Message Flow", () => {
  beforeAll(async () => {
    const connectors = suite.getTestConnectors();
    publicClient = connectors.publicClient;
    dhApi = connectors.dhApi;
    papiClient = connectors.papiClient;

    rewardsRegistry = await getContractInstance("RewardsRegistry");
    serviceManager = await getContractInstance("ServiceManager");
    gateway = await getContractInstance("Gateway");
  });

  describe("Infrastructure Setup", () => {
    it("should verify rewards infrastructure deployment", async () => {
      // Fetch rewards info
      const rewardsInfo = await parseRewardsInfoFile();

      expect(rewardsRegistry.address).toBeDefined();
      expect(rewardsInfo.RewardsAgent).toBeDefined();
      expect(gateway.address).toBeDefined();

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
    });
  });

  describe("Era Transition and Merkle Root Update", () => {
    it("should wait for era end and update merkle root on Ethereum", async () => {
      // Get current era and block
      const [currentEra, currentBlock, fromBlock] = await Promise.all([
        dhApi.query.ExternalValidators.ActiveEra.getValue(),
        dhApi.query.System.Number.getValue(),
        publicClient.getBlockNumber()
      ]);

      // Calculate era end block
      const sessionsPerEra = Number(dhApi.constants.ExternalValidators.SessionsPerEra);
      const blocksPerSession = Number(dhApi.constants.Babe.EpochDuration);
      const eraLength = sessionsPerEra * blocksPerSession;
      const eraEndBlock = Math.ceil((currentBlock + 1) / eraLength) * eraLength;

      logger.info(`Waiting for era ${currentEra?.index} to end at block ${eraEndBlock}`);

      // Wait for era end block
      const eraEndBlockInfo = await firstValueFrom(
        papiClient.finalizedBlock$.pipe(filter((block) => block.number === eraEndBlock))
      );

      // Fetch RewardsMessageSent event from era end block
      const events = await dhApi.query.System.Events.getValue({ at: eraEndBlockInfo.hash });
      const payload = events.find(
        (e: any) => e.type === "ExternalValidatorsRewards" && e.value?.type === "RewardsMessageSent"
      )?.value?.value;

      expect(payload).toBeDefined();
      merkleRoot = payload.rewards_merkle_root.asHex() as Hex;
      totalPoints = payload.total_points;
      eraIndex = payload.era_index;
      expect(totalPoints).toBeGreaterThan(0n);

      // Wait for RewardsMerkleRootUpdated
      const expectedRoot: Hex = padHex(merkleRoot, { size: 32 });
      const rootUpdatedEvent = await waitForEthereumEvent({
        client: publicClient,
        address: rewardsRegistry.address,
        abi: rewardsRegistry.abi,
        eventName: "RewardsMerkleRootUpdated",
        args: { newRoot: expectedRoot },
        fromBlock,
        timeout: CROSS_CHAIN_TIMEOUTS.DH_TO_ETH_MS
      });

      const rootDecoded = decodeEventLog({
        abi: rewardsRegistry.abi,
        data: rootUpdatedEvent.data,
        topics: rootUpdatedEvent.topics
      }) as { args: { oldRoot: Hex; newRoot: Hex; newRootIndex: bigint } };

      // Store the new root index for claiming tests
      newRootIndex = rootDecoded.args.newRootIndex;

      // Verify the stored root matches
      const storedRoot: Hex = (await publicClient.readContract({
        address: rewardsRegistry.address,
        abi: rewardsRegistry.abi,
        functionName: "merkleRootHistory",
        args: [newRootIndex]
      })) as Hex;

      expect(storedRoot.toLowerCase()).toEqual(expectedRoot.toLowerCase());
    });
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
      if (!eraPoints) throw new Error("Expected era points to be defined");
      expect(eraPoints.total > 0).toBe(true);
      expect(proofMap.size > 0).toBe(true);

      // Store proofs for claiming tests
      validatorProofs = proofMap;

      logger.success("Generated merkle proofs");

      // Validate proof data structure (spot check)
      const firstProofMaybe = validatorProofs.values().next().value;
      expect(firstProofMaybe).toBeDefined();
      if (!firstProofMaybe) throw new Error("Expected first proof to be defined");
      const firstProof = firstProofMaybe;
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

      logger.success("RewardsRegistry funded:");
      logger.info(`  Amount: ${fundingAmount} wei`);
      logger.info(`  Transaction: ${fundingTx}`);
      logger.info(`  Contract balance: ${contractBalance} wei`);
    });

    it(
      "should successfully claim rewards for validator",
      async () => {
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
        if (!firstEntry.value) throw new Error("Expected entry to be defined");
        const entry = firstEntry.value;
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

        // Persist state for the double-claim test
        claimedOperatorAddress = resolvedOperator;
        claimedProofData = proofData;
        firstClaimGasUsed = claimReceipt.gasUsed;
        firstClaimBlockNumber = claimReceipt.blockNumber;

        // Wait for and validate claim event
        const claimEvent = await waitForEthereumEvent({
          client: publicClient,
          address: rewardsRegistry.address,
          abi: rewardsRegistry.abi,
          eventName: "RewardsClaimedForIndex",
          fromBlock: claimReceipt.blockNumber - 1n,
          timeout: CROSS_CHAIN_TIMEOUTS.EVENT_CONFIRMATION_MS
        });

        expect(claimEvent).toBeDefined();
        if (!claimEvent) throw new Error("Expected log to be defined");
        const claimLog = claimEvent;
        const claimDecoded = decodeEventLog({
          abi: rewardsRegistry.abi,
          data: claimLog.data,
          topics: claimLog.topics
        }) as {
          args: {
            operatorAddress: Address;
            rootIndex: bigint;
            points: bigint;
            rewardsAmount: bigint;
          };
        };
        const claimArgs = claimDecoded.args;

        // Validate claim event data
        expect(isAddressEqual(claimArgs.operatorAddress, resolvedOperator)).toBe(true);
        expect(claimArgs.rootIndex).toEqual(newRootIndex);
        expect(claimArgs.points).toEqual(BigInt(proofData.points));
        expect(claimArgs.rewardsAmount > 0n).toBe(true);

        logger.success("Rewards claimed successfully:");
        logger.info(`  Operator: ${resolvedOperator}`);
        logger.info(`  Points: ${claimArgs.points}`);
        logger.info(`  Rewards: ${claimArgs.rewardsAmount} wei`);
        logger.info(`  Root index: ${claimArgs.rootIndex}`);

        // Validate balance change accounting for gas costs
        const balanceAfter = await publicClient.getBalance({ address: resolvedOperator });
        const actualBalanceIncrease = balanceAfter - balanceBefore;
        const gasUsedWei = claimReceipt.gasUsed * claimReceipt.effectiveGasPrice;
        const adjustedIncrease = actualBalanceIncrease + gasUsedWei;

        logger.info("💰 Balance validation:");
        logger.info(`  Gas used: ${gasUsedWei} wei`);
        logger.info(`  Adjusted balance increase: ${adjustedIncrease} wei`);

        expect(BigInt(adjustedIncrease)).toEqual(claimArgs.rewardsAmount);
        expect(claimArgs.rewardsAmount).toEqual(BigInt(proofData.points));
      },
      CROSS_CHAIN_TIMEOUTS.EVENT_CONFIRMATION_MS
    );

    it(
      "should prevent double claiming of rewards",
      async () => {
        logger.info("🚫 Testing double-claim prevention (on-chain revert)...");

        // Preconditions from previous test
        expect(claimedProofData).toBeDefined();
        expect(claimedOperatorAddress).toBeDefined();
        expect(firstClaimGasUsed).toBeDefined();
        expect(firstClaimBlockNumber).toBeDefined();
        expect(newRootIndex).toBeDefined();
        if (newRootIndex === undefined) throw new Error("Merkle root not updated yet");

        const factory = suite.getConnectorFactory();
        const credentials = rewardsHelpers.getValidatorCredentials(
          claimedProofData.validatorAccount
        );
        if (!credentials.privateKey) throw new Error("missing validator private key");
        const operatorWallet = factory.createWalletClient(credentials.privateKey as `0x${string}`);

        // Send a real transaction expected to revert. Provide explicit gas to avoid estimation/simulation.
        const gasLimit = firstClaimGasUsed + 100_000n;

        const revertTxHash = await operatorWallet.writeContract({
          address: serviceManager.address as Address,
          abi: serviceManager.abi,
          functionName: "claimOperatorRewards",
          args: [
            0,
            newRootIndex,
            BigInt(claimedProofData.points),
            BigInt(claimedProofData.numberOfLeaves),
            BigInt(claimedProofData.leafIndex),
            claimedProofData.proof as readonly Hex[]
          ],
          gas: gasLimit,
          chain: null
        });

        const revertReceipt = await publicClient.waitForTransactionReceipt({ hash: revertTxHash });
        expect(revertReceipt.status).toBe("reverted");

        // Verify custom error using eth_call at the same block
        let decodedErrorName = "";
        try {
          await publicClient.simulateContract({
            account: operatorWallet.account,
            address: serviceManager.address as Address,
            abi: serviceManager.abi,
            functionName: "claimOperatorRewards",
            args: [
              0,
              newRootIndex,
              BigInt(claimedProofData.points),
              BigInt(claimedProofData.numberOfLeaves),
              BigInt(claimedProofData.leafIndex),
              claimedProofData.proof as readonly Hex[]
            ],
            blockNumber: revertReceipt.blockNumber
          });
          throw new Error("Expected simulateContract to revert");
        } catch (err: any) {
          if (err instanceof BaseError) {
            const revertError = err.walk((e) => e instanceof ContractFunctionRevertedError);
            if (revertError instanceof ContractFunctionRevertedError) {
              // First try viem's decoded data (only works if ABI included the error)
              decodedErrorName = revertError.data?.errorName ?? "";
              // Fallback: decode the raw revert data using an ABI that includes the custom error
              if (!decodedErrorName) {
                const rawData = revertError.raw as Hex | undefined;
                if (rawData) {
                  try {
                    const unionAbi = [
                      ...(serviceManager.abi as any[]),
                      ...(rewardsRegistry.abi as any[])
                    ];
                    const decoded = decodeErrorResult({ abi: unionAbi as any, data: rawData });
                    decodedErrorName = decoded.errorName;
                  } catch (_e) {
                    // ignore secondary decode errors
                  }
                }
              }
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
        expect(decodedErrorName).toBe("RewardsAlreadyClaimedForIndex");

        logger.success(
          "Double-claim prevention verified (on-chain revert and correct custom error)"
        );
      },
      CROSS_CHAIN_TIMEOUTS.EVENT_CONFIRMATION_MS
    );
  });
});
