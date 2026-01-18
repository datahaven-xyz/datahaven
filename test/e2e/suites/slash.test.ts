import { beforeAll, describe, expect, it } from "bun:test";
import { FixedSizeBinary } from "polkadot-api";
import { CROSS_CHAIN_TIMEOUTS, getPapiSigner, logger } from "utils";
import type { Address } from "viem";
import { getContractInstance, parseDeploymentsFile } from "../../utils/contracts";
import { waitForDataHavenEvent } from "../../utils/events";
import { BaseTestSuite } from "../framework";

class SlashTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "slash"
    });

    // Set up hooks in constructor
    this.setupHooks();
  }
}

// Create the test suite instance
const suite = new SlashTestSuite();

describe("Should slash an operator", () => {
  let publicClient: any;
  let dhApi: any;

  beforeAll(async () => {
    const connectors = suite.getTestConnectors();

    publicClient = connectors.publicClient;
    dhApi = connectors.dhApi;

    const deployments = await parseDeploymentsFile();
    const strategyAddress =
      deployments.DeployedStrategies?.[0]?.address ?? "0x0000000000000000000000000000000000000000";

    logger.info(
      "Setting slashing required parameters:\n" +
        `  StrategyAddress=${strategyAddress}\n` +
        `  ServiceManagerAddress=${deployments.ServiceManager}\n`
    );

    // Build sudo calls to set parameters
    const calls = [
      // Set DatahavenServiceManagerAddress address (required to call the slash operator function)
      dhApi.tx.Parameters.set_parameter({
        key_value: {
          type: "RuntimeConfig",
          value: {
            type: "DatahavenServiceManagerAddress",
            value: [new FixedSizeBinary(Buffer.from(deployments.ServiceManager.slice(2), "hex"))]
          }
        }
      }).decodedCall,
      // Set strategies and multipliers: [(strategy_address, multiplier)] (we use the same rewards strategy for the slashing logic)
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

    const alithSigner = getPapiSigner("ALITH");
    const result = await tx.signAndSubmit(alithSigner);
    if (!result.ok) {
      throw new Error("Failed to set slasher required parameters");
    }

    logger.info("slashing required parameters set successfully");
  });

  it("verify we have the agent origin set", async () => {
    const gateway = await getContractInstance("Gateway");
    const serviceManager = await getContractInstance("ServiceManager");

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
    logger.info(`ServiceManager rewardsInitiator: ${rewardsInitiator}`);
  });

  it("Activate slashing", async () => {
    const mode = await dhApi.query.ExternalValidatorsSlashes.SlashingMode.getValue();
    expect(mode.type).toBe("LogOnly");
    mode.type = "Enabled";

    const sudoSlashCall = dhApi.tx.ExternalValidatorsSlashes.set_slashing_mode({
      mode
    });
    const sudoTx = dhApi.tx.Sudo.sudo({
      call: sudoSlashCall.decodedCall
    });
    const alithSigner = getPapiSigner("ALITH");
    const result = await sudoTx.signAndSubmit(alithSigner);
    expect(result.ok).toBeTruthy();

    const mode2 = await dhApi.query.ExternalValidatorsSlashes.SlashingMode.getValue();
    expect(mode2.type).toBe("Enabled");
  }, 40000);

  it("use sudo to slash operator", async () => {
    // get era number
    const activeEra = await dhApi.query.ExternalValidators.ActiveEra.getValue();

    if (activeEra === undefined) {
      throw new Error("couldn't get current era");
    }

    // need operator address to slash
    const validator = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    const sudoSlashCall = dhApi.tx.ExternalValidatorsSlashes.force_inject_slash({
      validator,
      era: activeEra?.index || 0, // Will fail if active era is 0. !! Important !! Sometimes for the inject to work (because of some latency) we need to inject in the `activeEra.index + 1`
      percentage: 20
    });
    const sudoTx = dhApi.tx.Sudo.sudo({
      call: sudoSlashCall.decodedCall
    });
    const alithSigner = getPapiSigner("ALITH");
    const resultSubmitTx = await sudoTx.signAndSubmit(alithSigner);
    expect(resultSubmitTx.ok).toBeTruthy();

    logger.info("Transaction submitted !");

    // look for event inject event
    const resultEventSlashInjected =
      await dhApi.event.ExternalValidatorsSlashes.SlashInjected.pull();
    if (resultEventSlashInjected.length === 0) {
      throw new Error("SlashInjected event not found");
    }
    logger.info("Slash injected");

    const resultEventSlashesMessageSent = await waitForDataHavenEvent<{ message_id: any }>({
      api: dhApi,
      pallet: "ExternalValidatorsSlashes",
      event: "SlashesMessageSent",
      timeout: CROSS_CHAIN_TIMEOUTS.DH_TO_ETH_MS
    });
    if (!resultEventSlashesMessageSent) {
      throw new Error("SlashesMessageSent event not found");
    }
    logger.info("Slashes message sent");
  }, 560000);
});
