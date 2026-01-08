import { beforeAll, describe, expect, it } from "bun:test";
import { FixedSizeBinary } from "polkadot-api";
import {
  CROSS_CHAIN_TIMEOUTS,
  getEvmEcdsaSigner,
  logger,
  SUBSTRATE_FUNDED_ACCOUNTS
} from "utils";
import { type Address } from "viem";
import { BaseTestSuite } from "../framework";
import { getContractInstance, parseDeploymentsFile } from "../utils/contracts";
import { waitForDataHavenEvent } from "../utils/events";

/**
 * Temporary helper to set V2 rewards parameters via sudo.
 * This is needed until the launcher properly configures these parameters.
 */
async function setV2RewardsParameters(dhApi: any) {
  const signer = getEvmEcdsaSigner(SUBSTRATE_FUNDED_ACCOUNTS.ALITH.privateKey);

  // Get addresses from deployments
  const deployments = await parseDeploymentsFile();
  const whaveTokenAddress =
    deployments.DeployedStrategies?.[0]?.underlyingToken ??
    "0x95401dc811bb5740090279Ba06cfA8fcF6113778";
  const strategyAddress =
    deployments.DeployedStrategies?.[0]?.address ??
    "0x0000000000000000000000000000000000000000";
  const serviceManagerAddress = deployments.ServiceManager;

  // Set RewardsGenesisTimestamp to 1 day ago (aligned to day boundary) to ensure valid rewards periods
  const genesisTimestamp = Math.floor((Date.now() / 1000 - 86400) / 86400) * 86400;

  logger.debug(
    `Setting V2 rewards parameters:\n` +
    `  WHAVETokenAddress=${whaveTokenAddress}\n` +
    `  StrategyAddress=${strategyAddress}\n` +
    `  ServiceManagerAddress=${serviceManagerAddress}\n` +
    `  RewardsGenesisTimestamp=${genesisTimestamp}`
  );

  // Build sudo calls to set parameters
  const calls = [
    // Set ServiceManager address (required for rewards submission)
    dhApi.tx.Parameters.set_parameter({
      key_value: {
        type: "RuntimeConfig",
        value: {
          type: "DatahavenServiceManagerAddress",
          value: [new FixedSizeBinary(Buffer.from(serviceManagerAddress.slice(2), "hex"))]
        }
      }
    }).decodedCall,
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
    }).decodedCall,
    // Set strategies and multipliers: [(strategy_address, multiplier)]
    dhApi.tx.Parameters.set_parameter({
      key_value: {
        type: "RuntimeConfig",
        value: {
          type: "RewardsStrategiesAndMultipliers",
          value: [[[new FixedSizeBinary(Buffer.from(strategyAddress.slice(2), "hex")), 1n]]]
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

  it("should wait for era end and emit RewardsMessageSent", async () => {
    // Get current era for event filtering
    const currentEra = await dhApi.query.ExternalValidators.ActiveEra.getValue();
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
  });

  it("should verify reward points were recorded for the era", async () => {
    // Verify reward points were recorded on DataHaven side
    const rewardPoints =
      await dhApi.query.ExternalValidatorsRewards.RewardPointsForEra.getValue(eraIndex);
    expect(rewardPoints).toBeDefined();
    expect(rewardPoints.total).toBeGreaterThan(0);

    const validatorsWithPoints = rewardPoints.individual.length;
    logger.debug(
      `Era ${eraIndex}: ${validatorsWithPoints} validators earned ${rewardPoints.total} total points`
    );
  });
});
