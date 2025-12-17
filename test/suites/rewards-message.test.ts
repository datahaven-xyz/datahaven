import { beforeAll, describe, expect, it } from "bun:test";
import { firstValueFrom } from "rxjs";
import { filter } from "rxjs/operators";
import { CROSS_CHAIN_TIMEOUTS, logger } from "utils";
import {
  type Address,
  decodeEventLog,
  type Hex,
  isAddressEqual,
  padHex
} from "viem";
import { BaseTestSuite } from "../framework";
import validatorSet from "../configs/validator-set.json";
import { getContractInstance, parseRewardsInfoFile } from "../utils/contracts";
import { waitForEthereumEvent } from "../utils/events";
import { generateMerkleProofForValidator, getEraRewardPoints } from "../utils/rewards-helpers";

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
let publicClient!: any;
let dhApi!: any;
let eraIndex!: number;
let totalPoints!: bigint;
let newRootIndex!: bigint;

describe("Rewards Message Flow", () => {
  beforeAll(async () => {
    const connectors = suite.getTestConnectors();
    publicClient = connectors.publicClient;
    dhApi = connectors.dhApi;

    rewardsRegistry = await getContractInstance("RewardsRegistry");
    serviceManager = await getContractInstance("ServiceManager");
  });

  describe("Infrastructure Setup", () => {
    it("should verify rewards infrastructure deployment", async () => {
      const rewardsInfo = await parseRewardsInfoFile();
      const gateway = await getContractInstance("Gateway");

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
      const { papiClient } = suite.getTestConnectors();

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

      logger.debug(`Waiting for era ${currentEra?.index} to end at block ${eraEndBlock}`);

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
      const merkleRoot: Hex = payload.rewards_merkle_root.asHex() as Hex;
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

  describe("Rewards Claiming", () => {
    beforeAll(async () => {
      // Fund RewardsRegistry for reward payouts
      const { walletClient: fundingWallet } = suite.getTestConnectors();
      const fundingTx = await fundingWallet.sendTransaction({
        to: rewardsRegistry.address as Address,
        value: totalPoints,
        chain: null
      });
      const fundingReceipt = await publicClient.waitForTransactionReceipt({ hash: fundingTx });
      expect(fundingReceipt.status).toBe("success");
    });

    it(
      "should successfully claim rewards for validator",
      async () => {
        // Get era reward points and pick one validator
        const eraPoints = await getEraRewardPoints(dhApi, eraIndex);
        expect(eraPoints.total).toBeGreaterThan(0);

        const [validatorAccount, points] = eraPoints.individual.entries().next().value!;

        // Generate merkle proof for just this validator
        const merkleData = await generateMerkleProofForValidator(dhApi, validatorAccount, eraIndex);

        // Get validator credentials and create operator wallet
        const factory = suite.getConnectorFactory();
        const match = validatorSet.validators.find(
          (v) => v.solochainAddress.toLowerCase() === validatorAccount.toLowerCase()
        );
        const operatorWallet = factory.createWalletClient(match!.privateKey as `0x${string}`);
        const resolvedOperator: Address = operatorWallet.account.address;

        // Record initial balance for validation
        const balanceBefore = BigInt(await publicClient.getBalance({ address: resolvedOperator }));

        // Submit claim transaction
        const claimTx = await operatorWallet.writeContract({
          address: serviceManager.address as Address,
          abi: serviceManager.abi,
          functionName: "claimOperatorRewards",
          chain: null,
          args: [
            0, // strategy index
            newRootIndex,
            BigInt(points),
            BigInt(merkleData!.numberOfLeaves),
            BigInt(merkleData!.leafIndex),
            merkleData!.proof as readonly Hex[]
          ]
        });

        // Wait for transaction confirmation
        const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: claimTx });
        expect(claimReceipt.status).toBe("success");

        // Decode and validate claim event from receipt
        const claimLog = claimReceipt.logs.find(
          (log: { address: string }) => log.address.toLowerCase() === rewardsRegistry.address.toLowerCase()
        )!;
        const { args: claimArgs } = decodeEventLog({
          abi: rewardsRegistry.abi,
          data: claimLog.data,
          topics: claimLog.topics
        }) as { args: { operatorAddress: Address; rootIndex: bigint; points: bigint; rewardsAmount: bigint } };

        expect(isAddressEqual(claimArgs.operatorAddress, resolvedOperator)).toBe(true);
        expect(claimArgs.rootIndex).toEqual(newRootIndex);
        expect(claimArgs.points).toEqual(BigInt(points));
        expect(claimArgs.rewardsAmount).toBeGreaterThan(0n);

        // Validate balance change accounting for gas costs
        const balanceAfter = BigInt(await publicClient.getBalance({ address: resolvedOperator }));
        const gasUsedWei = BigInt(claimReceipt.gasUsed) * BigInt(claimReceipt.effectiveGasPrice);
        const adjustedIncrease = balanceAfter - balanceBefore + gasUsedWei;

        expect(adjustedIncrease).toEqual(claimArgs.rewardsAmount);
        expect(claimArgs.rewardsAmount).toEqual(BigInt(points));
      },
    );
  });
});
