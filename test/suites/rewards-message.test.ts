import { beforeAll, describe, expect, it } from "bun:test";
import { FixedSizeBinary } from "polkadot-api";
import {
  CROSS_CHAIN_TIMEOUTS,
  getEvmEcdsaSigner,
  logger,
  SUBSTRATE_FUNDED_ACCOUNTS
} from "utils";
import { type Address, decodeEventLog } from "viem";
import { BaseTestSuite } from "../framework";
import { getContractInstance, parseDeploymentsFile } from "../utils/contracts";
import { waitForDataHavenEvent, waitForEthereumEvent } from "../utils/events";

/**
 * Temporary helper to set V2 rewards parameters via sudo.
 * This is needed until the launcher properly configures these parameters.
 */
async function setV2RewardsParameters(dhApi: any) {
  const signer = getEvmEcdsaSigner(SUBSTRATE_FUNDED_ACCOUNTS.ALITH.privateKey);

  // Get wHAVE token address from deployments (use TestToken as wHAVE for testing)
  const deployments = await parseDeploymentsFile();
  const whaveTokenAddress =
    deployments.DeployedStrategies?.[0]?.underlyingToken ??
    "0x95401dc811bb5740090279Ba06cfA8fcF6113778";

  // Set RewardsGenesisTimestamp to 1 day ago to ensure valid rewards periods
  const genesisTimestamp = Math.floor(Date.now() / 1000) - 86400;

  logger.debug(
    `Setting V2 rewards parameters: WHAVETokenAddress=${whaveTokenAddress}, RewardsGenesisTimestamp=${genesisTimestamp}`
  );

  // Build sudo calls to set parameters
  const calls = [
    dhApi.tx.Parameters.set_parameter({
      key_value: {
        type: "RuntimeConfig",
        value: {
          type: "WHAVETokenAddress",
          value: [new FixedSizeBinary(Buffer.from(whaveTokenAddress.slice(2), "hex"))]
        }
      }
    }).decodedCall,
    dhApi.tx.Parameters.set_parameter({
      key_value: {
        type: "RuntimeConfig",
        value: {
          type: "RewardsGenesisTimestamp",
          value: [genesisTimestamp]
        }
      }
    }).decodedCall
  ];

  const tx = dhApi.tx.Sudo.sudo({
    call: dhApi.tx.Utility.batch_all({ calls }).decodedCall
  });

  const result = await tx.signAndSubmit(signer);
  if (!result.ok) {
    throw new Error("Failed to set V2 rewards parameters");
  }

  logger.debug("V2 rewards parameters set successfully");
}

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
  let serviceManager!: any;
  let publicClient!: any;
  let dhApi!: any;
  let eraIndex!: number;
  let totalPoints!: bigint;
  let totalRewardsAmount!: bigint;
  let operatorCount!: bigint;

  beforeAll(async () => {
    const connectors = suite.getTestConnectors();
    publicClient = connectors.publicClient;
    dhApi = connectors.dhApi;

    serviceManager = await getContractInstance("ServiceManager");

    // Set V2 rewards parameters (temporary until launcher configures them)
    await setV2RewardsParameters(dhApi);
  });

  it("should verify rewards infrastructure deployment", async () => {
    const gateway = await getContractInstance("Gateway");

    expect(serviceManager.address).toBeDefined();
    expect(gateway.address).toBeDefined();

    const rewardsInitiator = (await publicClient.readContract({
      address: serviceManager.address,
      abi: serviceManager.abi,
      functionName: "rewardsInitiator",
      args: []
    })) as Address;

    // ServiceManager must have a rewardsInitiator configured for EigenLayer rewards submission
    expect(rewardsInitiator).toBeDefined();
    logger.debug(`ServiceManager rewardsInitiator: ${rewardsInitiator}`);
  });

  it("should wait for era end and submit rewards to EigenLayer", async () => {
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
    totalPoints = payload.total_points;
    eraIndex = payload.era_index;
    expect(totalPoints).toBeGreaterThan(0n);
    logger.debug(`RewardsMessageSent received: era=${eraIndex}, totalPoints=${totalPoints}`);

    // Wait for RewardsSubmitted event on ServiceManager (V2 flow via EigenLayer)
    logger.debug("Waiting for RewardsSubmitted event on ServiceManager");
    const rewardsSubmittedEvent = await waitForEthereumEvent({
      client: publicClient,
      address: serviceManager.address,
      abi: serviceManager.abi,
      eventName: "RewardsSubmitted",
      fromBlock,
      timeout: CROSS_CHAIN_TIMEOUTS.DH_TO_ETH_MS
    });

    const rewardsDecoded = decodeEventLog({
      abi: serviceManager.abi,
      data: rewardsSubmittedEvent.data,
      topics: rewardsSubmittedEvent.topics
    }) as { args: { totalAmount: bigint; operatorCount: bigint } };

    // Store values for subsequent tests
    totalRewardsAmount = rewardsDecoded.args.totalAmount;
    operatorCount = rewardsDecoded.args.operatorCount;

    logger.debug(
      `RewardsSubmitted received: totalAmount=${totalRewardsAmount}, operatorCount=${operatorCount}`
    );

    // Verify rewards were submitted with valid values
    expect(totalRewardsAmount).toBeGreaterThan(0n);
    expect(operatorCount).toBeGreaterThan(0n);
  });

  it("should verify rewards were submitted to EigenLayer with correct parameters", async () => {
    // Verify the RewardsSubmitted event parameters match expected values
    // The values were stored from the previous test

    // Verify operator count matches the number of validators with reward points
    const rewardPoints =
      await dhApi.query.ExternalValidatorsRewards.RewardPointsForEra.getValue(eraIndex);
    expect(rewardPoints).toBeDefined();
    expect(rewardPoints.total).toBeGreaterThan(0);

    // The operator count should match the number of validators that earned points
    const validatorsWithPoints = rewardPoints.individual.length;
    expect(operatorCount).toEqual(BigInt(validatorsWithPoints));

    // Verify total rewards amount is greater than 0
    expect(totalRewardsAmount).toBeGreaterThan(0n);

    // Log summary for debugging
    logger.debug(
      `Rewards verification: ${validatorsWithPoints} validators received ${totalRewardsAmount} total rewards for era ${eraIndex}`
    );
  });
});
