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
  ANVIL_FUNDED_ACCOUNTS,
  getValidatorInfoByName,
  isValidatorNodeRunning,
  launchDatahavenValidator,
  logger,
  parseDeploymentsFile,
  TestAccounts,
  type ValidatorInfo
} from "utils";
import { waitForDataHavenEvent } from "utils/events";
import { decodeEventLog, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  allocationManagerAbi,
  dataHavenServiceManagerAbi,
  delegationManagerAbi,
  gatewayAbi
} from "../contract-bindings";
import { BaseTestSuite } from "../framework";

class ValidatorSetUpdateTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "validator-set-update",
      networkOptions: {
        slotTime: 2,
        blockscout: false
      }
    });

    this.setupHooks();
  }

  override async onSetup(): Promise<void> {
    logger.info("Waiting for cross-chain infrastructure to stabilize...");

    // Launch to new nodes to be authorities
    console.log("Launching Charlie...");
    await launchDatahavenValidator(TestAccounts.Charlie, {
      launchedNetwork: this.getConnectors().launchedNetwork
    });

    console.log("Launching Dave...");
    await launchDatahavenValidator(TestAccounts.Dave, {
      launchedNetwork: this.getConnectors().launchedNetwork
    });
  }

  public getNetworkId(): string {
    return this.getConnectors().launchedNetwork.networkId;
  }
}

// Create the test suite instance
const suite = new ValidatorSetUpdateTestSuite();
let deployments: any;

describe("Validator Set Update", () => {
  // Validator sets loaded from external JSON
  let initialValidators: ValidatorInfo[] = [];
  let newValidators: ValidatorInfo[] = [];

  function getOwnerAccount() {
    return privateKeyToAccount(ANVIL_FUNDED_ACCOUNTS[6].privateKey as `0x${string}`);
  }

  beforeAll(async () => {
    deployments = await parseDeploymentsFile();

    // Load validator set from JSON config
    const validatorSetPath = "./configs/validator-set.json";
    try {
      const validatorSetJson: any = await Bun.file(validatorSetPath).json();

      initialValidators = [
        getValidatorInfoByName(validatorSetJson, TestAccounts.Alice),
        getValidatorInfoByName(validatorSetJson, TestAccounts.Bob)
      ];

      newValidators = [
        getValidatorInfoByName(validatorSetJson, TestAccounts.Charlie),
        getValidatorInfoByName(validatorSetJson, TestAccounts.Dave)
      ];

      logger.success("Loaded validator set from JSON file");
    } catch (err) {
      logger.error(`Failed to load validator set from ${validatorSetPath}: ${err}`);
      throw err;
    }
  });

  it("should verify validators are running", async () => {
    const isAliceRunning = await isValidatorNodeRunning(TestAccounts.Alice, suite.getNetworkId());
    const isBobRunning = await isValidatorNodeRunning(TestAccounts.Bob, suite.getNetworkId());
    const isCharlieRunning = await isValidatorNodeRunning(
      TestAccounts.Charlie,
      suite.getNetworkId()
    );
    const isDaveRunning = await isValidatorNodeRunning(TestAccounts.Dave, suite.getNetworkId());

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
    const connectors = suite.getTestConnectors();

    logger.info("📤 Adding Charlie and Dave to allowlist...");

    // Add Charlie and Dave to the allowlist
    for (let i = 0; i < newValidators.length; i++) {
      const validator = newValidators[i];
      logger.info(
        `🔧 Adding validator ${i + 1}/${newValidators.length} (${validator.publicKey}) to allowlist...`
      );

      let retryCount = 0;
      const maxRetries = 3;

      try {
        const hash = await connectors.walletClient.writeContract({
          address: deployments.ServiceManager as `0x${string}`,
          abi: dataHavenServiceManagerAbi,
          functionName: "addValidatorToAllowlist",
          args: [validator.publicKey as `0x${string}`],
          account: getOwnerAccount(),
          chain: null
        });

        logger.info(`📝 Transaction hash for allowlist: ${hash}`);

        const receipt = await connectors.publicClient.waitForTransactionReceipt({ hash });
        logger.info(
          `📋 Allowlist transaction receipt: status=${receipt.status}, gasUsed=${receipt.gasUsed}`
        );

        if (receipt.status === "success") {
          logger.success(`Added ${validator.publicKey} to allowlist`);
          break; // Success, exit retry loop
        }
        logger.error(`Failed to add ${validator.publicKey} to allowlist`);
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      } catch (error) {
        retryCount++;
        logger.warn(
          `Attempt ${retryCount}/${maxRetries} failed for ${validator.publicKey}: ${error}`
        );

        if (retryCount >= maxRetries) {
          logger.error(`All retry attempts failed for ${validator.publicKey}`);
          throw error;
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 2000 * retryCount));
      }
    }
  }, 60_000);

  it("should register new validators as operators", async () => {
    const connectors = suite.getTestConnectors();

    logger.info("📤 Registering Charlie and Dave as operators...");

    // Register Charlie and Dave as operators
    for (let i = 0; i < newValidators.length; i++) {
      const validator = newValidators[i];
      logger.info(
        `🔧 Registering validator ${i + 1}/${newValidators.length} (${validator.publicKey}) as operator...`
      );

      let retryCount = 0;
      const maxRetries = 3;

      try {
        // Step 1: Register as EigenLayer operator first
        logger.info(`🔧 Registering ${validator.publicKey} as EigenLayer operator...`);
        const operatorHash = await connectors.walletClient.writeContract({
          address: deployments.DelegationManager as `0x${string}`,
          abi: delegationManagerAbi,
          functionName: "registerAsOperator",
          args: [
            "0x0000000000000000000000000000000000000000", // initDelegationApprover (no approver)
            0, // allocationDelay
            "" // metadataURI
          ],
          account: privateKeyToAccount(validator.privateKey as `0x${string}`),
          chain: null
        });

        const operatorReceipt = await connectors.publicClient.waitForTransactionReceipt({
          hash: operatorHash
        });
        if (operatorReceipt.status !== "success") {
          throw new Error(
            `EigenLayer operator registration failed with status: ${operatorReceipt.status}`
          );
        }
        logger.success(`Registered ${validator.publicKey} as EigenLayer operator`);

        // Step 2: Register for operator sets
        logger.info(`🔧 Registering ${validator.publicKey} for operator sets...`);
        const hash = await connectors.walletClient.writeContract({
          address: deployments.AllocationManager as `0x${string}`,
          abi: allocationManagerAbi,
          functionName: "registerForOperatorSets",
          args: [
            validator.publicKey as `0x${string}`,
            {
              avs: deployments.ServiceManager as `0x${string}`,
              operatorSetIds: [0],
              data: validator.solochainAddress as `0x${string}`
            }
          ],
          account: privateKeyToAccount(validator.privateKey as `0x${string}`),
          chain: null
        });

        logger.info(`📝 Transaction hash for operator set registration: ${hash}`);

        const receipt = await connectors.publicClient.waitForTransactionReceipt({ hash });
        logger.info(
          `📋 Operator set registration receipt: status=${receipt.status}, gasUsed=${receipt.gasUsed}`
        );

        if (receipt.status === "success") {
          logger.success(`Registered ${validator.publicKey} for operator sets`);
          break; // Success, exit retry loop
        }
        logger.error(`Failed to register ${validator.publicKey} for operator sets`);
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      } catch (error) {
        retryCount++;
        logger.warn(
          `Attempt ${retryCount}/${maxRetries} failed for ${validator.publicKey}: ${error}`
        );

        if (retryCount >= maxRetries) {
          logger.error(`All retry attempts failed for ${validator.publicKey}`);
          throw error;
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 2000 * retryCount));
      }
    }
  }, 60_000); // 1 minute timeout

  it("should send updated validator set to DataHaven", async () => {
    const connectors = suite.getTestConnectors();

    // proceed directly to sending, allowlist/register already covered in previous tests
    logger.info("📤 Sending updated validator set (Charlie, Dave) to DataHaven...");

    // Build the updated validator set message
    logger.info("🔍 Building validator set message...");
    const updatedMessageBytes = await connectors.publicClient.readContract({
      address: deployments.ServiceManager as `0x${string}`,
      abi: dataHavenServiceManagerAbi,
      functionName: "buildNewValidatorSetMessage",
      args: []
    });

    logger.info(`📊 Updated validator set message size: ${updatedMessageBytes.length} bytes`);
    logger.info(`📊 Message bytes (first 100): ${updatedMessageBytes.slice(0, 100)}`);

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
    const externalValidatorsSetEvent = await waitForDataHavenEvent({
      api: connectors.dhApi,
      pallet: "ExternalValidators",
      event: "ExternalValidatorsSet",
      timeout: 600_000,
      failOnTimeout: true
    });

    if (!externalValidatorsSetEvent.data) {
      logger.error("ExternalValidatorsSet event not found");
      throw new Error("ExternalValidatorsSet event not found");
    }
    logger.success("ExternalValidatorsSet event found");
  }, 600_000);
});
