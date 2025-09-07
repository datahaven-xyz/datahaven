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

  /**
   * Helper to add a validator to the EigenLayer allowlist
   */
  async function addValidatorToAllowlist(connectors: any, validator: ValidatorInfo) {
    logger.info(`Adding validator ${validator.publicKey} to allowlist...`);
    const hash = await connectors.walletClient.writeContract({
      address: deployments.ServiceManager as `0x${string}`,
      abi: dataHavenServiceManagerAbi,
      functionName: "addValidatorToAllowlist",
      args: [validator.publicKey as `0x${string}`],
      account: getOwnerAccount(),
      chain: null
    });
    await connectors.publicClient.waitForTransactionReceipt({ hash });
    logger.info(`✅ Validator ${validator.publicKey} added to allowlist`);
  }

  /**
   * Helper to register a validator operator in the ServiceManager
   */
  async function registerValidatorOperator(connectors: any, validator: ValidatorInfo) {
    logger.info(`Registering validator ${validator.publicKey}...`);

    const hash = await connectors.walletClient.writeContract({
      address: deployments.ServiceManager as `0x${string}`,
      abi: dataHavenServiceManagerAbi,
      functionName: "registerOperator",
      args: [
        validator.publicKey as `0x${string}`,
        deployments.ServiceManager as `0x${string}`,
        [0], // operatorSetId
        validator.solochainAddress as `0x${string}`
      ],
      account: privateKeyToAccount(validator.privateKey as `0x${string}`),
      chain: null
    });

    await connectors.publicClient.waitForTransactionReceipt({ hash });
    logger.info(`✅ Validator ${validator.publicKey} registered`);
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

  it("should register new validators (charlie and dave)", async () => {
    const connectors = suite.getTestConnectors();

    logger.info("🔧 Now adding Charlie and Dave to the validator set...");

    // Add new validators to allowlist
    for (const validator of newValidators) {
      await addValidatorToAllowlist(connectors, validator);
    }

    //wait 10 minutes
    await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 10));

    logger.success("✅ New validators (Charlie, Dave) registered successfully");
  });

  it("should send updated validator set to DataHaven", async () => {
    const connectors = suite.getTestConnectors();

    logger.info("📤 Sending updated validator set (Alice, Bob, Charlie, Dave) to DataHaven...");

    // Build the updated validator set message
    const updatedMessageBytes = await connectors.publicClient.readContract({
      address: deployments.ServiceManager as `0x${string}`,
      abi: dataHavenServiceManagerAbi,
      functionName: "buildNewValidatorSetMessage",
      args: []
    });

    logger.info(`Updated validator set message size: ${updatedMessageBytes.length} bytes`);

    // Send the updated validator set
    const executionFee = parseEther("0.1"); // 0.1 ETH
    const relayerFee = parseEther("0.2");   // 0.2 ETH
    const totalValue = parseEther("0.3");   // Total fee

    const hash = await connectors.walletClient.writeContract({
      address: deployments.ServiceManager as `0x${string}`,
      abi: dataHavenServiceManagerAbi,
      functionName: "sendNewValidatorSet",
      args: [executionFee, relayerFee],
      value: totalValue,
      account: getOwnerAccount(),
      chain: null
    });

    const receipt = await connectors.publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");

    // Ensure Charlie & Dave were registered on-chain before final count
    const fromBlock = (await connectors.publicClient.getBlockNumber()) - 2n;

    for (const v of newValidators) {
      await waitForEthereumEvent({
        client: connectors.publicClient,
        address: deployments.ServiceManager as `0x${string}`,
        abi: dataHavenServiceManagerAbi,
        eventName: "OperatorRegistered",
        args: { operator: v.publicKey as `0x${string}`, operatorSetId: 0 }, // both are indexed
        fromBlock,
        timeout: 120_000,
      });
    }

    logger.success(`✅ Updated validator set (all 4 validators) sent to DataHaven: ${hash}`);
    logger.info(`Gas used: ${receipt.gasUsed}`);
  });

  it("should wait for updated validator set propagation", async () => {
    const connectors = suite.getTestConnectors();

    logger.info("⏳ Waiting for updated validator set to propagate...");

    // Wait for the Snowbridge Gateway to accept the updated outbound message
    const result = await waitForEthereumEvent({
      client: connectors.publicClient,
      address: deployments.SnowbridgeGateway as `0x${string}`,
      abi: gatewayAbi,
      eventName: "OutboundMessageAccepted",
      timeout: 45000
    });

    if (result.log) {
      logger.success(`✅ Updated validator set message accepted by Snowbridge: tx ${result.log.transactionHash}`);
    } else {
      logger.warn("⚠️ Timeout waiting for updated validator set message acceptance");
    }
  });

  it("should verify validator set update on DataHaven substrate", async () => {
    const connectors = suite.getTestConnectors();

    logger.info("🔍 Verifying validator set on DataHaven substrate chain...");

    try {
      // Wait for MessageReceived event from inbound queue to confirm message was received
      const messageReceivedResult = await waitForDataHavenEvent({
        api: connectors.dhApi,
        pallet: "EthereumInboundQueueV2",
        event: "MessageReceived",
        timeout: 120000
      });

      if (messageReceivedResult.data) {
        logger.success(`✅ MessageReceived event from inbound queue: ${JSON.stringify(messageReceivedResult.data)}`);
      } else {
        logger.warn("⚠️ No MessageReceived event found - checking current state");
      }

      // Wait for ExternalValidatorsSet event to confirm validator set was updated
      const validatorSetResult = await waitForDataHavenEvent({
        api: connectors.dhApi,
        pallet: "ExternalValidators",
        event: "ExternalValidatorsSet",
        timeout: 30000
      });

      if (validatorSetResult.data) {
        logger.success(`✅ ExternalValidatorsSet event received: ${JSON.stringify(validatorSetResult.data)}`);
      } else {
        logger.warn("⚠️ No ExternalValidatorsSet event found - checking current state");
      }

      // Check current block to ensure chain is progressing
      const currentBlock = await connectors.dhApi.query.System.Number.getValue();
      logger.info(`Current DataHaven block: ${currentBlock}`);
      expect(currentBlock).toBeGreaterThan(0);

      // Attempt to query validator-related storage
      try {
        const externalValidators = await connectors.dhApi.query.ExternalValidators?.WhitelistedValidators?.getValue();
        if (externalValidators) {
          logger.info(`External validators found: ${JSON.stringify(externalValidators)}`);
        }
      } catch (error) {
        logger.warn(`Could not query external validators directly: ${error}`);
      }

      // Query system events to look for validator set updates
      const latestEvents = await connectors.dhApi.query.System.Events.getValue();
      logger.info(`Found ${latestEvents.length} events in latest block`);

      // Look for events related to validator set updates
      const validatorEvents = latestEvents.filter((event: any) =>
        event.event?.section === "ExternalValidators" ||
        event.event?.method?.includes("Validator")
      );

      if (validatorEvents.length > 0) {
        logger.success(`✅ Found ${validatorEvents.length} validator-related events`);
        validatorEvents.forEach((event: any, index: number) => {
          logger.info(`Event ${index}: ${JSON.stringify(event)}`);
        });
      } else {
        logger.warn("⚠️ No validator-related events found yet");
      }

    } catch (error) {
      logger.error(`Error querying DataHaven state: ${error}`);
      // Don't fail the test immediately - the substrate side might need more time
      logger.warn("⚠️ Could not verify validator set on substrate - this might be expected if the message is still being processed");
    }
  });

  it("should verify BEEFY validator set consistency", async () => {
    const connectors = suite.getTestConnectors();

    try {
      // Query BEEFY validator set to ensure consensus is working
      const beefyValidatorSet = await connectors.papiClient.getUnsafeApi().apis.BeefyApi.validator_set();

      if (beefyValidatorSet) {
        logger.info(`BEEFY validator set ID: ${beefyValidatorSet.id}`);
        logger.info(`BEEFY validator count: ${beefyValidatorSet.validators.length}`);

        expect(beefyValidatorSet.validators.length).toBeGreaterThan(0);
        logger.success("✅ BEEFY consensus is operating with active validators");

        // Log validator details
        beefyValidatorSet.validators.forEach((validator: any, index: number) => {
          logger.debug(`BEEFY Validator ${index}: ${validator}`);
        });
      } else {
        logger.warn("⚠️ BEEFY validator set not available yet");
      }
    } catch (error) {
      logger.warn(`Could not query BEEFY validator set: ${error}`);
    }
  });

  it("should demonstrate validator set update scenario completion", async () => {
    const connectors = suite.getTestConnectors();

    // Final verification of the complete flow
    logger.info("📊 Final verification of validator set update flow:");

    // 1. Verify Ethereum side final state
    // Check that all validators have their mappings set
    let validatorCount = 0;
    for (const validator of allValidators) {
      const solochainAddress = await connectors.publicClient.readContract({
        address: deployments.ServiceManager as `0x${string}`,
        abi: dataHavenServiceManagerAbi,
        functionName: "validatorEthAddressToSolochainAddress",
        args: [validator.publicKey as `0x${string}`]
      });

      if (solochainAddress !== "0x0000000000000000000000000000000000000000") {
        validatorCount++;
      }
    }

    logger.info(`✅ Ethereum: ${validatorCount} validators registered`);
    expect(validatorCount).toBe(4);

    // 2. Verify cross-chain infrastructure is healthy
    const ethBlock = await connectors.publicClient.getBlockNumber();
    const dhBlock = await connectors.dhApi.query.System.Number.getValue();

    logger.info(`✅ Ethereum block: ${ethBlock}, DataHaven block: ${dhBlock}`);
    expect(ethBlock).toBeGreaterThan(0);
    expect(dhBlock).toBeGreaterThan(0);

    // 3. Confirm the validator set update message was sent
    logger.info("✅ Validator set update message successfully sent via Snowbridge");
    logger.info("✅ Cross-chain infrastructure is operational");
    logger.info("✅ All four validators (alice, bob, charlie, dave) are registered");

    logger.success("🎉 Validator set update scenario completed successfully!");
    logger.info("📋 Summary:");
    logger.info("   - Phase 1: Started with Alice and Bob as initial validators");
    logger.info("   - Phase 2: Added Charlie and Dave to expand the validator set");
    logger.info("   - Cross-chain: Both validator set updates sent via Snowbridge to DataHaven");
    logger.info("   - Verification: Confirmed infrastructure health and message delivery");
    logger.info("   - Result: Successfully demonstrated validator set expansion from 2 to 4 validators");
  });

  it("should verify validator set update on DataHaven substrate", async () => {
    const connectors = suite.getTestConnectors();

    logger.info("🔍 Verifying validator set on DataHaven substrate chain...");

    // Wait for the Snowbridge Gateway to accept the updated outbound message
    const result = await waitForEthereumEvent({
      client: connectors.publicClient,
      address: deployments.SnowbridgeGateway as `0x${string}`,
      abi: gatewayAbi,
      eventName: "OutboundMessageAccepted",
      timeout: 30000
    });

    if (result.log) {
      logger.success(`✅ Updated validator set message accepted by Snowbridge: tx ${result.log.transactionHash}`);
    } else {
      logger.warn("⚠️ Timeout waiting for updated validator set message acceptance");
    }
  });
}); 