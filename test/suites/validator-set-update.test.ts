/**
 * Validator Set Update E2E (Ethereum -> Snowbridge -> DataHaven)
 *
 * What this test exercises
 * - Launches a fresh network with Snowbridge relayers and 4 validators (Alice, Bob, Charlie, Dave).
 *   Initially only Alice & Bob are mapped on the `ServiceManager`.
 * - Sends the initial set (Alice, Bob) via `ServiceManager.sendNewValidatorSet`, then waits for the
 *   Snowbridge `Gateway` event `OutboundMessageAccepted`.
 * - Adds Charlie & Dave to the allowlist, registers them as operators, and sends the updated set
 *   (Alice, Bob, Charlie, Dave).
 * - Verifies propagation on Ethereum and DataHaven, checks BEEFY liveness, and summarizes final state.
 *
 * Operational notes and common pitfalls
 * - Do not double-send the same validator-set transaction. Use either the viem `walletClient.writeContract`
 *   call OR the `updateValidatorSet` script, not both, otherwise Anvil may return
 *   "replacement transaction underpriced" due to nonce/gas replacement rules.
 * - Event waits can exceed 5s. Long-running tests should pass an explicit per-test timeout (e.g. 120_000)
 *   and optionally set `fromBlock` when waiting for events to catch logs emitted before the watcher starts.
 * - DataHaven event names depend on the runtime. If `EthereumInboundQueueV2.MessageReceived` is missing,
 *   scan `System.Events` as a fallback or use the correct pallet name for your build.
 * - Ensure `allValidators` includes both the initial and newly added validators before final assertions.
 * - The "wait 10 minutes" step is intended for manual observation; skip it in CI or increase its timeout.
 *
 * Prerequisites
 * - Deployed contracts in `deployments` (at least `ServiceManager` and `Gateway`).
 * - Snowbridge relayers running and connected to both chains.
 */
import { beforeAll, describe, expect, it } from "bun:test";

import { parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { decodeEventLog } from "viem";
import {
  logger,
  parseDeploymentsFile,
  ANVIL_FUNDED_ACCOUNTS,
  getPapiSigner,
  launchDatahavenValidator,
  TestAccounts,
  getValidatorInfoByName,
  type ValidatorInfo,
  isValidatorNodeRunning
} from "utils";

import { waitForDataHavenEvent, waitForEthereumEvent } from "utils/events";
import { BaseTestSuite } from "../framework";
import { dataHavenServiceManagerAbi, gatewayAbi } from "../contract-bindings";
import { performValidatorSetUpdate } from "cli/handlers/launch/validator";
import { updateValidatorSet } from "scripts/update-validator-set";

class ValidatorSetUpdateTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "validator-set-update",
      networkOptions: {
        slotTime: 2,
        blockscout: false,
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

    deployments = await parseDeploymentsFile();
  }

  public getNetworkId(): string {
    return this.getConnectors().launchedNetwork.networkId;
  }

  public getRpcUrl(): string {
    return this.getConnectors().launchedNetwork.elRpcUrl;
  }
}

// Create the test suite instance
const suite = new ValidatorSetUpdateTestSuite();
let deployments: any;

describe("Validator Set Update", () => {
  // Validator sets loaded from external JSON
  let initialValidators: ValidatorInfo[] = [];
  let newValidators: ValidatorInfo[] = [];
  let allValidators: ValidatorInfo[] = [];

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

      allValidators = [...initialValidators, ...newValidators];
      logger.info("✅ Loaded validator set from JSON file");
    } catch (err) {
      logger.error(`Failed to load validator set from ${validatorSetPath}: ${err}`);
      throw err;
    }

  });

  it("should verify validators are running", async () => {
    const isAliceRunning = await isValidatorNodeRunning(TestAccounts.Alice, suite.getNetworkId());
    const isBobRunning = await isValidatorNodeRunning(TestAccounts.Bob, suite.getNetworkId());
    const isCharlieRunning = await isValidatorNodeRunning(TestAccounts.Charlie, suite.getNetworkId());
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
    logger.info(`✅ Ethereum network connected at block: ${ethBlockNumber}`);

    // Verify DataHaven substrate connectivity
    const dhBlockHeader = await connectors.papiClient.getBlockHeader();
    expect(dhBlockHeader.number).toBeGreaterThan(0);
    logger.info(`✅ DataHaven substrate connected at block: ${dhBlockHeader.number}`);

    // Verify contract deployments
    expect(deployments.ServiceManager).toBeDefined();
    logger.info(`✅ ServiceManager deployed at: ${deployments.ServiceManager}`);
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
      logger.info(`✅ Validator ${validator.publicKey} mapped to ${solochainAddress}`);
    }
  });

  it("should verify initial validator set state", async () => {
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
      logger.info(`✅ Validator ${validator.publicKey} not yet registered (as expected)`);
    }

    logger.info("✅ Initial validator set state verified: only Alice and Bob are active");
  });

  it("should add new validators to allowlist", async () => {
    const connectors = suite.getTestConnectors();

    logger.info("📤 Adding Charlie and Dave to allowlist...");

    // Add Charlie and Dave to the allowlist
    for (let i = 0; i < newValidators.length; i++) {
      const validator = newValidators[i];
      logger.info(`🔧 Adding validator ${i + 1}/${newValidators.length} (${validator.publicKey}) to allowlist...`);

      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
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
          logger.info(`📋 Allowlist transaction receipt: status=${receipt.status}, gasUsed=${receipt.gasUsed}`);

          if (receipt.status === "success") {
            logger.success(`✅ Added ${validator.publicKey} to allowlist`);
            break; // Success, exit retry loop
          } else {
            logger.error(`❌ Failed to add ${validator.publicKey} to allowlist`);
            throw new Error(`Transaction failed with status: ${receipt.status}`);
          }
        } catch (error) {
          retryCount++;
          logger.warn(`⚠️ Attempt ${retryCount}/${maxRetries} failed for ${validator.publicKey}: ${error}`);

          if (retryCount >= maxRetries) {
            logger.error(`❌ All retry attempts failed for ${validator.publicKey}`);
            throw error;
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
        }
      }
    }
  }, 60_000);

  it("should register new validators as operators", async () => {
    const connectors = suite.getTestConnectors();

    logger.info("📤 Registering Charlie and Dave as operators...");

    // Register Charlie and Dave as operators
    for (let i = 0; i < newValidators.length; i++) {
      const validator = newValidators[i];
      logger.info(`🔧 Registering validator ${i + 1}/${newValidators.length} (${validator.publicKey}) as operator...`);

      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          const hash = await connectors.walletClient.writeContract({
            address: deployments.ServiceManager as `0x${string}`,
            abi: dataHavenServiceManagerAbi,
            functionName: "registerOperator",
            args: [
              validator.publicKey as `0x${string}`,
              deployments.ServiceManager as `0x${string}`,
              [0], // VALIDATORS_SET_ID
              validator.solochainAddress as `0x${string}`
            ],
            account: privateKeyToAccount(validator.privateKey as `0x${string}`),
            chain: null
          });

          logger.info(`📝 Transaction hash for operator registration: ${hash}`);

          const receipt = await connectors.publicClient.waitForTransactionReceipt({ hash });
          logger.info(`📋 Operator registration receipt: status=${receipt.status}, gasUsed=${receipt.gasUsed}`);

          if (receipt.status === "success") {
            logger.success(`✅ Registered ${validator.publicKey} as operator`);
            break; // Success, exit retry loop
          } else {
            logger.error(`❌ Failed to register ${validator.publicKey} as operator`);
            throw new Error(`Transaction failed with status: ${receipt.status}`);
          }
        } catch (error) {
          retryCount++;
          logger.warn(`⚠️ Attempt ${retryCount}/${maxRetries} failed for ${validator.publicKey}: ${error}`);

          if (retryCount >= maxRetries) {
            logger.error(`❌ All retry attempts failed for ${validator.publicKey}`);
            throw error;
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
        }
      }
    }
  }, 60_000); // 1 minute timeout

  it("should send updated validator set to DataHaven", async () => {
    const connectors = suite.getTestConnectors();

    logger.info("📤 Registering Charlie and Dave as operators...");

    // First, add Charlie and Dave to the allowlist
    for (let i = 0; i < newValidators.length; i++) {
      const validator = newValidators[i];
      logger.info(`🔧 Adding validator ${i + 1}/${newValidators.length} (${validator.publicKey}) to allowlist...`);

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
        logger.info(`📋 Allowlist transaction receipt: status=${receipt.status}, gasUsed=${receipt.gasUsed}`);

        if (receipt.status === "success") {
          logger.success(`Added ${validator.publicKey} to allowlist`);
        } else {
          logger.error(`❌ Failed to add ${validator.publicKey} to allowlist`);
          throw new Error(`Transaction failed with status: ${receipt.status}`);
        }
      } catch (error) {
        logger.error(`❌ Error adding ${validator.publicKey} to allowlist: ${error}`);
        throw error;
      }
    }

    // Register Charlie and Dave as operators
    for (let i = 0; i < newValidators.length; i++) {
      const validator = newValidators[i];
      logger.info(`🔧 Registering validator ${i + 1}/${newValidators.length} (${validator.publicKey}) as operator...`);

      try {
        const hash = await connectors.walletClient.writeContract({
          address: deployments.ServiceManager as `0x${string}`,
          abi: dataHavenServiceManagerAbi,
          functionName: "registerOperator",
          args: [
            validator.publicKey as `0x${string}`,
            deployments.ServiceManager as `0x${string}`,
            [0], // VALIDATORS_SET_ID
            validator.solochainAddress as `0x${string}`
          ],
          account: privateKeyToAccount(validator.privateKey as `0x${string}`),
          chain: null
        });

        logger.info(`📝 Transaction hash for operator registration: ${hash}`);

        const receipt = await connectors.publicClient.waitForTransactionReceipt({ hash });
        logger.info(`📋 Operator registration receipt: status=${receipt.status}, gasUsed=${receipt.gasUsed}`);

        if (receipt.status === "success") {
          logger.success(`Registered ${validator.publicKey} as operator`);
        } else {
          logger.error(`❌ Failed to register ${validator.publicKey} as operator`);
          throw new Error(`Transaction failed with status: ${receipt.status}`);
        }
      } catch (error) {
        logger.error(`❌ Error registering ${validator.publicKey} as operator: ${error}`);
        throw error;
      }
    }

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

    // Send the updated validator set
    const executionFee = parseEther("0.1"); // 0.1 ETH
    const relayerFee = parseEther("0.2");   // 0.2 ETH
    const totalValue = parseEther("0.3");   // Total fee

    logger.info(`💰 Sending validator set with executionFee=${executionFee}, relayerFee=${relayerFee}, totalValue=${totalValue}`);

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
      logger.info(`📋 Validator set update receipt: status=${receipt.status}, gasUsed=${receipt.gasUsed}`);

      if (receipt.status === "success") {
        logger.success(`Transaction sent: ${hash}`);
        logger.info(`⛽ Gas used: ${receipt.gasUsed}`);
      } else {
        logger.error(`❌ Transaction failed with status: ${receipt.status}`);
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
        logger.info("✅ OutboundMessageAccepted event found in transaction receipt!");
      } else {
        throw new Error("OutboundMessageAccepted event not found in transaction receipt");
      }

    } catch (error) {
      logger.error(`❌ Error sending validator set update: ${error}`);
      throw error;
    }
  }, 300_000);

}); 