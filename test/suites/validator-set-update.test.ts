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
  isValidatorNodeRunning,
  launchDatahavenValidator,
  logger,
  parseDeploymentsFile
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

  it("should verify validators are running", async () => {
    const isAliceRunning = await isValidatorNodeRunning("alice", suite.getNetworkId());
    const isBobRunning = await isValidatorNodeRunning("bob", suite.getNetworkId());
    const isCharlieRunning = await isValidatorNodeRunning("charlie", suite.getNetworkId());
    const isDaveRunning = await isValidatorNodeRunning("dave", suite.getNetworkId());

    expect(isAliceRunning).toBe(true);
    expect(isBobRunning).toBe(true);
    expect(isCharlieRunning).toBe(true);
    expect(isDaveRunning).toBe(true);
  });

  it("should verify initial test setup", async () => {
    const connectors = suite.getTestConnectors();

    // Verify Ethereum side connectivity
    const ethBlockNumber = await connectors.publicClient.getBlockNumber();
    expect(ethBlockNumber).toBeGreaterThan(0);
    logger.success(`Ethereum network connected at block: ${ethBlockNumber}`);

    // Verify DataHaven substrate connectivity
    const dhBlockHeader = await connectors.papiClient.getBlockHeader();
    expect(dhBlockHeader.number).toBeGreaterThan(0);
    logger.success(`DataHaven substrate connected at block: ${dhBlockHeader.number}`);

    // Verify contract deployments
    expect(deployments.ServiceManager).toBeDefined();
    logger.success(`ServiceManager deployed at: ${deployments.ServiceManager}`);
  });

  it("should verify initial validator set state", async () => {
    const connectors = suite.getTestConnectors();

    logger.info("🔍 Verifying initial validator set state...");

    // Check that only initial validators have mappings set
    for (const validator of initialValidators) {
      const solochainAddress = await connectors.publicClient.readContract({
        address: deployments.ServiceManager as `0x${string}`,
        abi: dataHavenServiceManagerAbi,
        functionName: "validatorEthAddressToSolochainAddress",
        args: [validator.publicKey as `0x${string}`]
      });

      expect(solochainAddress.toLowerCase()).toBe(validator.solochainAddress.toLowerCase());
      logger.success(`Validator ${validator.publicKey} mapped to ${solochainAddress}`);
    }
  });

  it("should verify new validators are not yet registered", async () => {
    const connectors = suite.getTestConnectors();

    // Verify that new validators are not yet registered
    for (const validator of newValidators) {
      const solochainAddress = await connectors.publicClient.readContract({
        address: deployments.ServiceManager as `0x${string}`,
        abi: dataHavenServiceManagerAbi,
        functionName: "validatorEthAddressToSolochainAddress",
        args: [validator.publicKey as `0x${string}`]
      });

      expect(solochainAddress).toBe("0x0000000000000000000000000000000000000000");
      logger.success(`Validator ${validator.publicKey} not yet registered (as expected)`);
    }

    logger.success("Initial validator set state verified: only Alice and Bob are active");
  });

  it("should add new validators to allowlist", async () => {
    logger.info("📤 Adding Charlie and Dave to allowlist...");

    // Add Charlie and Dave to the allowlist
    await addValidatorToAllowlist("charlie", suite.getValidatorOptions());
    await addValidatorToAllowlist("dave", suite.getValidatorOptions());

    // Verification of allowlist status
    logger.info("🔍 Verification of allowlist status...");
    const charlieAllowlisted = await isValidatorInAllowlist("charlie", suite.getValidatorOptions());
    const daveAllowlisted = await isValidatorInAllowlist("dave", suite.getValidatorOptions());

    expect(charlieAllowlisted).toBe(true);
    expect(daveAllowlisted).toBe(true);

    logger.success("Both validators successfully added to allowlist");
  }, 60_000);

  it("should register new validators as operators", async () => {
    logger.info("📤 Registering Charlie and Dave as operators...");

    // Register Charlie and Dave as operators
    await registerSingleOperator("charlie", suite.getValidatorOptions());
    await registerSingleOperator("dave", suite.getValidatorOptions());

    // Verify both validators are properly registered in ServiceManager
    const charlieRegistered = await serviceManagerHasOperator("charlie", suite.getValidatorOptions());
    expect(charlieRegistered).toBe(true);
    logger.success("Charlie is registered as operator");

    const daveRegistered = await serviceManagerHasOperator("dave", suite.getValidatorOptions());
    expect(daveRegistered).toBe(true);
    logger.success("Dave is registered as operator");
  }, 60_000); // 1 minute timeout

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
