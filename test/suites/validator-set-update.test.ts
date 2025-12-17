/**
 * Validator Set Update E2E: Ethereum → Snowbridge → DataHaven
 *
 * Exercises:
 * - Start network and ensure 4 validator nodes are running (Alice, Bob, Charlie, Dave).
 * - Confirm initial mapping exists only for Alice/Bob on `ServiceManager`.
 * - Allowlist and register Charlie/Dave as operators on Ethereum.
 * - Send updated validator set via `ServiceManager.sendNewValidatorSet`, assert Gateway `OutboundMessageAccepted`.
 * - Observe `ExternalValidators.ExternalValidatorsSet` on DataHaven (substrate), confirming propagation.
 */
import { beforeAll, describe, expect, it } from "bun:test";
import {
  addValidatorToAllowlist,
  getOwnerAccount,
  isValidatorInAllowlist,
  registerSingleOperator,
  serviceManagerHasOperator
} from "launcher/validators";
import {
  type Deployments,
  isValidatorRunning,
  launchDatahavenValidator,
  logger,
  parseDeploymentsFile,
  ZERO_ADDRESS
} from "utils";
import { waitForDataHavenEvent } from "utils/events";
import { waitForDataHavenStorageContains } from "utils/storage";
import { decodeEventLog, parseEther } from "viem";
import validatorSet from "../configs/validator-set.json";
import { dataHavenServiceManagerAbi, gatewayAbi } from "../contract-bindings";
import { BaseTestSuite } from "../framework";

const getValidator = (name: string) => {
  const v = validatorSet.validators.find((v) => v.solochainAuthorityName === name);
  if (!v) throw new Error(`Validator ${name} not found`);
  return v;
};

class ValidatorSetUpdateTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "validator-set-update",
    });

    this.setupHooks();
  }

  override async onSetup(): Promise<void> {
    logger.info("Waiting for cross-chain infrastructure to stabilize...");

    // Launch to new nodes to be authorities
    console.log("Launching Charlie...");
    await launchDatahavenValidator("charlie", {
      launchedNetwork: this.getConnectors().launchedNetwork
    });

    console.log("Launching Dave...");
    await launchDatahavenValidator("dave", {
      launchedNetwork: this.getConnectors().launchedNetwork
    });
  }

  public getNetworkId(): string {
    return this.getConnectors().launchedNetwork.networkId;
  }

  public getValidatorOptions() {
    return {
      rpcUrl: this.getConnectors().launchedNetwork.elRpcUrl,
      connectors: this.getTestConnectors(),
      deployments
    };
  }
}

// Create the test suite instance
const suite = new ValidatorSetUpdateTestSuite();
let deployments: Deployments;

describe("Validator Set Update", () => {
  const initialValidators = [getValidator("alice"), getValidator("bob")];
  const newValidators = [getValidator("charlie"), getValidator("dave")];

  beforeAll(async () => {
    deployments = await parseDeploymentsFile();
  });

  it("should verify test environment", async () => {
    const networkId = suite.getNetworkId();
    const { publicClient, papiClient } = suite.getTestConnectors();

    // Validators running
    expect(await isValidatorRunning("alice", networkId)).toBe(true);
    expect(await isValidatorRunning("bob", networkId)).toBe(true);
    expect(await isValidatorRunning("charlie", networkId)).toBe(true);
    expect(await isValidatorRunning("dave", networkId)).toBe(true);

    // Chain connectivity
    expect(await publicClient.getBlockNumber()).toBeGreaterThan(0);
    expect((await papiClient.getBlockHeader()).number).toBeGreaterThan(0);

    // Contract deployed
    expect(deployments.ServiceManager).toBeDefined();
  });

  it("should verify initial validator set state", async () => {
    const { publicClient } = suite.getTestConnectors();
    const readSolochainAddress = (validator: (typeof initialValidators)[0]) =>
      publicClient.readContract({
        address: deployments.ServiceManager as `0x${string}`,
        abi: dataHavenServiceManagerAbi,
        functionName: "validatorEthAddressToSolochainAddress",
        args: [validator.publicKey as `0x${string}`]
      });

    // Check initial validators have correct mappings and new validators are not registered
    const [initialResults, newResults] = await Promise.all([
      Promise.all(initialValidators.map(readSolochainAddress)),
      Promise.all(newValidators.map(readSolochainAddress))
    ]);

    expect(initialResults).toEqual(initialValidators.map((v) => v.solochainAddress as `0x${string}`));
    expect(newResults).toEqual(newValidators.map(() => ZERO_ADDRESS));
  });

  it("should allowlist and register new validators as operators", async () => {
    const opts = suite.getValidatorOptions();

    // Add to allowlist and register as operators
    await Promise.all([
      addValidatorToAllowlist("charlie", opts),
      addValidatorToAllowlist("dave", opts)
    ]);
    await Promise.all([
      registerSingleOperator("charlie", opts),
      registerSingleOperator("dave", opts)
    ]);

    // Verify allowlist and registration status
    const [charlieAllowlisted, daveAllowlisted, charlieRegistered, daveRegistered] =
      await Promise.all([
        isValidatorInAllowlist("charlie", opts),
        isValidatorInAllowlist("dave", opts),
        serviceManagerHasOperator("charlie", opts),
        serviceManagerHasOperator("dave", opts)
      ]);

    expect([charlieAllowlisted, daveAllowlisted]).toEqual([true, true]);
    expect([charlieRegistered, daveRegistered]).toEqual([true, true]);
  }, 60_000);

  it("should send updated validator set to DataHaven", async () => {
    const connectors = suite.getTestConnectors();

    // proceed directly to sending, allowlist/register already covered in previous tests
    logger.info("📤 Sending updated validator set (Charlie, Dave) to DataHaven...");

    // Build the updated validator set message
    // Debug: Check what validators are registered in the ServiceManager contract
    logger.info("🔍 Checking registered validators in DataHavenServiceManager...");

    // Check all validators (initial + new)
    const allValidators = [...initialValidators, ...newValidators];
    for (const validator of allValidators) {
      const registeredAddress = await connectors.publicClient.readContract({
        address: deployments.ServiceManager as `0x${string}`,
        abi: dataHavenServiceManagerAbi,
        functionName: "validatorEthAddressToSolochainAddress",
        args: [validator.publicKey as `0x${string}`]
      });

      const isRegistered = registeredAddress !== "0x0000000000000000000000000000000000000000";
      logger.info(`  ${validator.publicKey} -> ${registeredAddress} (registered: ${isRegistered})`);
    }

    logger.info("🔍 Building validator set message...");
    const updatedMessageBytes = await connectors.publicClient.readContract({
      address: deployments.ServiceManager as `0x${string}`,
      abi: dataHavenServiceManagerAbi,
      functionName: "buildNewValidatorSetMessage",
      args: []
    });

    logger.info(`📊 Updated validator set message size: ${updatedMessageBytes.length} bytes`);
    logger.info(`📊 Message bytes (first 100): ${updatedMessageBytes.slice(0, 100)}`);

    // Verify that new validators are properly registered before sending message
    logger.info("🔍 Verifying new validators are registered before sending message...");
    for (const validator of newValidators) {
      const registeredAddress = await connectors.publicClient.readContract({
        address: deployments.ServiceManager as `0x${string}`,
        abi: dataHavenServiceManagerAbi,
        functionName: "validatorEthAddressToSolochainAddress",
        args: [validator.publicKey as `0x${string}`]
      });

      const isRegistered = registeredAddress !== "0x0000000000000000000000000000000000000000";
      if (!isRegistered) {
        throw new Error(
          `Validator ${validator.publicKey} is not registered in ServiceManager before sending message`
        );
      }
      logger.success(`${validator.publicKey} is registered -> ${registeredAddress}`);
    }

    // Log the expected validators that should be in the message
    logger.info("🔍 Expected validators in message:");
    for (let i = 0; i < newValidators.length; i++) {
      logger.info(`  Validator ${i}: ${newValidators[i].solochainAddress}`);
    }

    // Send the updated validator set
    const executionFee = parseEther("0.1");
    const relayerFee = parseEther("0.2");
    const totalValue = parseEther("0.3");

    logger.info(
      `Sending validator set with executionFee=${executionFee},
      relayerFee=${relayerFee},
      totalValue=${totalValue}`
    );

    try {
      const hash = await connectors.walletClient.writeContract({
        address: deployments.ServiceManager as `0x${string}`,
        abi: dataHavenServiceManagerAbi,
        functionName: "sendNewValidatorSet",
        args: [executionFee, relayerFee],
        value: totalValue,
        gas: 1000000n,
        account: getOwnerAccount(),
        chain: null
      });

      logger.info(`📝 Transaction hash for validator set update: ${hash}`);

      const receipt = await connectors.publicClient.waitForTransactionReceipt({ hash });
      logger.info(
        `📋 Validator set update receipt: status=${receipt.status}, gasUsed=${receipt.gasUsed}`
      );

      if (receipt.status === "success") {
        logger.success(`Transaction sent: ${hash}`);
        logger.info(`⛽ Gas used: ${receipt.gasUsed}`);
      } else {
        logger.error(`Transaction failed with status: ${receipt.status}`);
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      logger.info("🔍 Checking for OutboundMessageAccepted event in transaction receipt...");

      const hasOutboundAccepted = (receipt.logs ?? []).some((log: any) => {
        try {
          const decoded = decodeEventLog({ abi: gatewayAbi, data: log.data, topics: log.topics });
          return decoded.eventName === "OutboundMessageAccepted";
        } catch {
          return false;
        }
      });

      if (hasOutboundAccepted) {
        logger.success("OutboundMessageAccepted event found in transaction receipt!");
      } else {
        throw new Error("OutboundMessageAccepted event not found in transaction receipt");
      }
    } catch (error) {
      logger.error(`Error sending validator set update: ${error}`);
      throw error;
    }
  }, 300_000);

  it("should verify validator set update on DataHaven substrate", async () => {
    const connectors = suite.getTestConnectors();

    logger.info("🔍 Verifying validator set on DataHaven substrate chain...");

    logger.info("⏳ Waiting for ExternalValidatorsSet event...");
    await waitForDataHavenEvent({
      api: connectors.dhApi,
      pallet: "ExternalValidators",
      event: "ExternalValidatorsSet",
      timeout: 600_000
    });
    logger.success("ExternalValidatorsSet event found");

    logger.info(
      "🔍 Checking the new validators are present in the ExternalValidators pallet storage..."
    );

    const expectedAddresses = newValidators.map((v) => v.solochainAddress as `0x${string}`);

    const storageResult = await waitForDataHavenStorageContains({
      api: connectors.dhApi,
      pallet: "ExternalValidators",
      storage: "ExternalValidators",
      contains: expectedAddresses,
      timeout: 10_000,
      failOnTimeout: true
    });

    if (!storageResult.value) {
      throw new Error("Failed to get ExternalValidators storage value");
    }

    logger.success("New validators are present in the ExternalValidators pallet storage");
  }, 600_000);
});
