import { beforeAll, describe, expect, it } from "bun:test";
import { ANVIL_FUNDED_ACCOUNTS, CROSS_CHAIN_TIMEOUTS, logger } from "utils";
import { type Address, decodeEventLog, type Hex, isAddressEqual, padHex } from "viem";
import validatorSet from "../configs/validator-set.json";
import { BaseTestSuite } from "../framework";
import { getContractInstance, parseRewardsInfoFile } from "../utils/contracts";
import { waitForDataHavenEvent, waitForEthereumEvent } from "../utils/events";

class RewardsMessageTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "rewards-message"
    });

    this.setupHooks();
  }
}

const suite = new RewardsMessageTestSuite();

describe("Rewards Message Flow", () => {
  let rewardsRegistry!: any;
  let serviceManager!: any;
  let publicClient!: any;
  let dhApi!: any;
  let eraIndex!: number;
  let totalPoints!: bigint;
  let newRootIndex!: bigint;

  beforeAll(async () => {
    const connectors = suite.getTestConnectors();
    publicClient = connectors.publicClient;
    dhApi = connectors.dhApi;

    rewardsRegistry = await getContractInstance("RewardsRegistry");
    serviceManager = await getContractInstance("ServiceManager");
  });

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

  it("should wait for era end and update merkle root on Ethereum", async () => {
    // Get current era and Ethereum block for event filtering
    const [currentEra, fromBlock] = await Promise.all([
      dhApi.query.ExternalValidators.ActiveEra.getValue(),
      publicClient.getBlockNumber()
    ]);

    const currentEraIndex = currentEra?.index ?? 0;
    logger.debug(`Waiting for RewardsMessageSent for era ${currentEraIndex}`);

    const payload = await waitForDataHavenEvent<any>({
      api: dhApi,
      pallet: "ExternalValidatorsRewards",
      event: "RewardsMessageSent",
      filter: (e) => e.era_index === currentEraIndex,
      timeout: CROSS_CHAIN_TIMEOUTS.DH_TO_ETH_MS
    });

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

  it("should successfully claim rewards for validator", async () => {
    // Fund RewardsRegistry for reward payouts
    const { walletClient: fundingWallet } = suite.getTestConnectors();
    const fundingTx = await fundingWallet.sendTransaction({
      to: rewardsRegistry.address as Address,
      value: totalPoints,
      chain: null
    });
    const fundingReceipt = await publicClient.waitForTransactionReceipt({ hash: fundingTx });
    expect(fundingReceipt.status).toBe("success");

    // Get era reward points and pick first validator
    const rewardPoints =
      await dhApi.query.ExternalValidatorsRewards.RewardPointsForEra.getValue(eraIndex);
    expect(rewardPoints).toBeDefined();
    expect(rewardPoints.total).toBeGreaterThan(0);

    const relayerEthAccount = ANVIL_FUNDED_ACCOUNTS[1].publicKey.toLowerCase();
    const pick = rewardPoints.individual.find(([account]: [any, any]) => {
      const v = validatorSet.validators.find(
        (cfg) => cfg.solochainAddress.toLowerCase() === String(account).toLowerCase()
      );
      return v && v.publicKey.toLowerCase() !== relayerEthAccount;
    });
    const [validatorAccount, points] = (pick ?? rewardPoints.individual[0]) as [any, any];
    const match = validatorSet.validators.find(
      (v) => v.solochainAddress.toLowerCase() === String(validatorAccount).toLowerCase()
    );
    if (!match) {
      throw new Error(
        `Validator config not found for solochain address ${String(validatorAccount)}`
      );
    }

    // Generate merkle proof via runtime API
    const merkleProof = await dhApi.apis.ExternalValidatorsRewardsApi.generate_rewards_merkle_proof(
      String(validatorAccount),
      eraIndex
    );
    expect(merkleProof).toBeDefined();

    // Get validator credentials and create operator wallet
    const factory = suite.getConnectorFactory();
    const operatorWallet = factory.createWalletClient(match!.privateKey as `0x${string}`);
    const resolvedOperator: Address = operatorWallet.account.address;

    // Ensure claim not already recorded
    const claimedBefore = (await publicClient.readContract({
      address: rewardsRegistry.address,
      abi: rewardsRegistry.abi,
      functionName: "hasClaimedByIndex",
      args: [resolvedOperator, newRootIndex]
    })) as boolean;
    expect(claimedBefore).toBe(false);

    // Record balances at a specific block to avoid stale RPC reads
    const balanceBlockNumber = Number(await publicClient.getBlockNumber());
    const operatorBalanceBefore = await publicClient.getBalance({
      address: resolvedOperator,
      blockNumber: balanceBlockNumber
    });
    const registryBalanceBefore = BigInt(
      await publicClient.getBalance({
        address: rewardsRegistry.address as Address,
        blockNumber: balanceBlockNumber
      })
    );

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
        BigInt(merkleProof.number_of_leaves),
        BigInt(merkleProof.leaf_index),
        merkleProof.proof.map((node: { asHex: () => string }) => node.asHex()) as readonly Hex[]
      ]
    });

    // Wait for transaction confirmation
    const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: claimTx });
    expect(claimReceipt.status).toBe("success");
    logger.debug(
      `Claim tx type: ${claimReceipt.type}, effectiveGasPrice: ${claimReceipt.effectiveGasPrice}, gasUsed: ${claimReceipt.gasUsed}`
    );

    // Decode and validate claim event from receipt
    const claimLog = claimReceipt.logs.find(
      (log: { address: string }) =>
        log.address.toLowerCase() === rewardsRegistry.address.toLowerCase()
    )!;
    const { args: claimArgs } = decodeEventLog({
      abi: rewardsRegistry.abi,
      data: claimLog.data,
      topics: claimLog.topics
    }) as {
      args: { operatorAddress: Address; rootIndex: bigint; points: bigint; rewardsAmount: bigint };
    };

    expect(isAddressEqual(claimArgs.operatorAddress, resolvedOperator)).toBe(true);
    expect(claimArgs.rootIndex).toEqual(newRootIndex);
    expect(claimArgs.points).toEqual(BigInt(points));
    expect(claimArgs.rewardsAmount).toBeGreaterThan(0n);

    const claimedAfter = (await publicClient.readContract({
      address: rewardsRegistry.address,
      abi: rewardsRegistry.abi,
      functionName: "hasClaimedByIndex",
      args: [resolvedOperator, newRootIndex]
    })) as boolean;
    expect(claimedAfter).toBe(true);

    // Validate RewardsRegistry balance decrease matches claimed rewards
    const claimBlockNumber = Number(claimReceipt.blockNumber);
    const registryBalanceAfter = await publicClient.getBalance({
      address: rewardsRegistry.address as Address,
      blockNumber: claimBlockNumber
    });
    expect(registryBalanceBefore - registryBalanceAfter).toEqual(claimArgs.rewardsAmount);
    expect(claimArgs.rewardsAmount).toEqual(BigInt(points));

    // Validate operator received rewards (accounting for gas)
    const operatorBalanceAfter = await publicClient.getBalance({
      address: resolvedOperator,
      blockNumber: claimBlockNumber
    });
    const gasCost = BigInt(claimReceipt.gasUsed) * BigInt(claimReceipt.effectiveGasPrice);
    const netBalanceChange = BigInt(operatorBalanceAfter) - BigInt(operatorBalanceBefore);
    // Operator balance should have changed by: rewards - gasCost
    expect(netBalanceChange + gasCost).toEqual(claimArgs.rewardsAmount);
  });
});
