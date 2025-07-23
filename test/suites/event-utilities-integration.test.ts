/**
 * E2E Tests for Event Utilities
 * 
 * Demonstrates usage of DataHaven and Ethereum event waiting utilities
 * with practical examples and different scenarios.
 */

import { describe, expect, it } from "bun:test";
import { FixedSizeBinary, Binary } from "polkadot-api";
import { parseEther, getContract } from "viem";
import { 
  ANVIL_FUNDED_ACCOUNTS,
  SUBSTRATE_FUNDED_ACCOUNTS,
  getPapiSigner,
  logger,
  parseDeploymentsFile,
  waitForDataHavenEvent,
  waitForMultipleDataHavenEvents,
  submitAndWaitForDataHavenEvents,
  waitForEthereumEvent,
  waitForMultipleEthereumEvents,
  waitForTransactionAndEvents
} from "utils";
import { gatewayAbi } from "../contract-bindings";
import { BaseTestSuite } from "../framework";

// Test constants
const TEST_TIMEOUT = 30000;

describe("Event Utilities", () => {
  const suite = new BaseTestSuite({
    suiteName: "event-utilities",
    launchMode: "minimal"
  });

  // ============== DataHaven Event Tests ==============

  describe("DataHaven Events", () => {
    it("should wait for a single DataHaven event", async () => {
      const connectors = suite.getTestConnectors();
      const alithSigner = getPapiSigner("ALITH");
      const baltatharSigner = getPapiSigner("BALTATHAR");

      // Transfer some tokens to trigger an event
      const amount = parseEther("10");
      const tx = connectors.dhApi.tx.Balances.transfer_keep_alive({
        dest: {
          type: "Id",
          value: SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.publicKey
        },
        value: amount
      });

      // Submit transaction
      const txPromise = tx.signAndSubmit(alithSigner);

      // Wait for the Transfer event
      const transferEvent = await waitForDataHavenEvent({
        api: connectors.dhApi,
        eventPath: "Balances.Transfer",
        timeout: 10000,
        filter: (event) => {
          // Filter for transfers from Alith
          return event.from === SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey;
        },
        onEvent: (event) => {
          logger.info(`Transfer event captured: ${event.amount} from ${event.from}`);
        }
      });

      await txPromise;

      expect(transferEvent).toBeDefined();
      expect(transferEvent?.from).toBe(SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey);
      expect(transferEvent?.to).toBe(SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.publicKey);
      expect(transferEvent?.amount).toBe(amount);

      logger.success("Single DataHaven event test passed");
    });

    it("should wait for multiple DataHaven events", async () => {
      const connectors = suite.getTestConnectors();
      const alithSigner = getPapiSigner("ALITH");

      // Perform batch transfer to trigger multiple events
      const batch = [
        connectors.dhApi.tx.Balances.transfer_keep_alive({
          dest: {
            type: "Id",
            value: SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.publicKey
          },
          value: parseEther("5")
        }),
        connectors.dhApi.tx.Balances.transfer_keep_alive({
          dest: {
            type: "Id",
            value: SUBSTRATE_FUNDED_ACCOUNTS.CHARLETH.publicKey
          },
          value: parseEther("3")
        })
      ];

      const batchTx = connectors.dhApi.tx.Utility.batch({ calls: batch.map(t => t.decodedCall) });
      
      // Submit transaction
      const txPromise = batchTx.signAndSubmit(alithSigner);

      // Wait for multiple events
      const eventResults = await waitForMultipleDataHavenEvents({
        api: connectors.dhApi,
        events: [
          {
            path: "Balances.Transfer",
            stopOnMatch: false // Collect all Transfer events
          },
          {
            path: "Utility.BatchCompleted",
            stopOnMatch: true
          },
          {
            path: "System.ExtrinsicSuccess",
            stopOnMatch: true
          }
        ],
        timeout: 10000,
        onAnyEvent: (eventPath, event) => {
          logger.debug(`Event ${eventPath} received`);
        }
      });

      await txPromise;

      // Verify we got the expected events
      const transferEvents = eventResults.get("Balances.Transfer") || [];
      const batchEvents = eventResults.get("Utility.BatchCompleted") || [];
      const successEvents = eventResults.get("System.ExtrinsicSuccess") || [];

      expect(transferEvents.length).toBeGreaterThanOrEqual(2);
      expect(batchEvents.length).toBe(1);
      expect(successEvents.length).toBeGreaterThan(0);

      logger.success(`Captured ${transferEvents.length} transfer events`);
    });

    it("should handle DataHaven event timeout gracefully", async () => {
      const connectors = suite.getTestConnectors();

      // Wait for an event that won't happen
      const event = await waitForDataHavenEvent({
        api: connectors.dhApi,
        eventPath: "Balances.Transfer",
        timeout: 2000, // Short timeout
        filter: () => false // Filter that never matches
      });

      expect(event).toBeNull();
      logger.info("Timeout handled gracefully");
    });

    it("should submit transaction and wait for events", async () => {
      const connectors = suite.getTestConnectors();
      const alithSigner = getPapiSigner("ALITH");

      // Create a remark transaction
      const remarkTx = connectors.dhApi.tx.System.remark({ remark: Binary.fromText("Test remark") });

      // Submit and wait for events
      const { txResult, events } = await submitAndWaitForDataHavenEvents(
        remarkTx,
        alithSigner,
        ["System.ExtrinsicSuccess", "System.Remarked"],
        10000
      );

      expect(txResult).toBeDefined();
      expect(events.get("System.ExtrinsicSuccess")?.length).toBeGreaterThan(0);
      expect(events.get("System.Remarked")?.length).toBe(1);

      logger.success("Submit and wait for events test passed");
    });
  });

  // ============== Ethereum Event Tests ==============

  describe("Ethereum Events", () => {
    it("should wait for a single Ethereum event", async () => {
      const connectors = suite.getTestConnectors();
      const deployments = await parseDeploymentsFile();
      
      // Skip if no Gateway deployed
      if (!deployments.Gateway) {
        logger.warn("Gateway not deployed, skipping Ethereum event test");
        return;
      }

      // Get Gateway contract
      const gateway = getContract({
        address: deployments.Gateway,
        abi: gatewayAbi,
        client: connectors.publicClient
      });

      // Create a promise to wait for event before transaction
      const eventPromise = waitForEthereumEvent({
        client: connectors.publicClient,
        address: deployments.Gateway,
        abi: gatewayAbi,
        eventName: "OperatingModeChanged",
        timeout: 20000,
        onEvent: (log) => {
          logger.info(`OperatingModeChanged event captured in block ${log.blockNumber}`);
        }
      });

      // Note: In a real test, you would trigger a transaction that emits this event
      // For demonstration, we'll just wait for timeout
      const event = await Promise.race([
        eventPromise,
        new Promise(resolve => setTimeout(() => resolve(null), 3000))
      ]);

      // Event would be null if no operating mode change happened
      if (event) {
        logger.success("Captured OperatingModeChanged event");
      } else {
        logger.info("No OperatingModeChanged event (expected in demo)");
      }
    });

    it("should wait for multiple Ethereum events from different contracts", async () => {
      const connectors = suite.getTestConnectors();
      const deployments = await parseDeploymentsFile();

      // Skip if no contracts deployed
      if (!deployments.Gateway || !deployments.BeefyClient) {
        logger.warn("Required contracts not deployed, skipping test");
        return;
      }

      // Set up event watchers for multiple contracts
      const eventPromise = waitForMultipleEthereumEvents({
        client: connectors.publicClient,
        events: [
          {
            address: deployments.Gateway,
            abi: gatewayAbi,
            eventName: "InboundMessageDispatched",
            stopOnMatch: false
          },
          {
            address: deployments.BeefyClient,
            abi: [], // Would use actual BeefyClient ABI
            eventName: "NewMMRRoot",
            stopOnMatch: true
          }
        ],
        timeout: 5000,
        onAnyEvent: (address, eventName, log) => {
          logger.debug(`Event ${eventName} from ${address} at block ${log.blockNumber}`);
        }
      });

      // Wait for events (will timeout in demo)
      const eventResults = await eventPromise;

      // Check results
      const gatewayEvents = eventResults.get(`${deployments.Gateway}:InboundMessageDispatched`) || [];
      const beefyEvents = eventResults.get(`${deployments.BeefyClient}:NewMMRRoot`) || [];

      logger.info(`Captured ${gatewayEvents.length} Gateway events`);
      logger.info(`Captured ${beefyEvents.length} BeefyClient events`);
    });

    it("should wait for transaction and its events", async () => {
      const connectors = suite.getTestConnectors();
      const deployments = await parseDeploymentsFile();
      
      // Skip if no Gateway deployed
      if (!deployments.Gateway) {
        logger.warn("Gateway not deployed, skipping transaction event test");
        return;
      }

      // For demo purposes, we'll just wait for a transaction receipt
      // In a real test, you would send an actual transaction
      logger.info("Transaction event test - demo mode (no real transaction)");
      
      // Example structure for when you have a real transaction:
      /*
      const hash = await someTransaction();
      const { receipt, events } = await waitForTransactionAndEvents(
        connectors.publicClient,
        hash,
        [
          {
            address: deployments.Gateway,
            abi: gatewayAbi,
            eventName: "InboundMessageDispatched"
          }
        ],
        20000
      );
      */
    });

    it("should filter Ethereum events by arguments", async () => {
      const connectors = suite.getTestConnectors();
      const deployments = await parseDeploymentsFile();
      
      if (!deployments.Gateway) {
        logger.warn("Gateway not deployed, skipping filtered event test");
        return;
      }

      // Example of filtering Gateway events by specific arguments
      const eventPromise = waitForEthereumEvent({
        client: connectors.publicClient,
        address: deployments.Gateway,
        abi: gatewayAbi,
        eventName: "InboundMessageDispatched",
        args: {
          // In a real scenario, you might filter by channelID or messageID
        },
        timeout: 5000,
        onEvent: (log) => {
          logger.info(`Filtered Gateway event: ${JSON.stringify(log.args)}`);
        }
      });

      // In a real test, you would trigger events here
      const event = await eventPromise;

      if (event) {
        logger.success("Event filtering demonstration complete");
      } else {
        logger.info("No matching Gateway events (expected in demo)");
      }
    });

    it("should handle past Ethereum events with fromBlock", async () => {
      const connectors = suite.getTestConnectors();
      const deployments = await parseDeploymentsFile();
      
      if (!deployments.Gateway) {
        logger.warn("Gateway not deployed, skipping past events test");
        return;
      }

      // Get current block
      const currentBlock = await connectors.publicClient.getBlockNumber();
      
      // Look for events from 100 blocks ago (or genesis)
      const fromBlock = currentBlock > 100n ? currentBlock - 100n : 0n;

      const events = await waitForMultipleEthereumEvents({
        client: connectors.publicClient,
        events: [
          {
            address: deployments.Gateway,
            abi: gatewayAbi,
            eventName: "Initialized",
            stopOnMatch: true
          }
        ],
        fromBlock,
        timeout: 5000
      });

      const initEvents = events.get(`${deployments.Gateway}:Initialized`) || [];
      
      if (initEvents.length > 0) {
        logger.success(`Found ${initEvents.length} historical Initialized events`);
      } else {
        logger.info("No historical Initialized events found");
      }
    });
  });

  // ============== Cross-chain Event Coordination ==============

  describe("Cross-chain Event Coordination", () => {
    it("should coordinate DataHaven and Ethereum events", async () => {
      const connectors = suite.getTestConnectors();
      const deployments = await parseDeploymentsFile();
      
      // This demonstrates how you might wait for events on both chains
      // In a real cross-chain test, you would trigger a cross-chain message

      // Start watching for events on both chains
      const dhEventPromise = waitForDataHavenEvent({
        api: connectors.dhApi,
        eventPath: "EthereumOutboundQueue.MessageQueued",
        timeout: 5000
      });

      const ethEventPromise = deployments.Gateway ? waitForEthereumEvent({
        client: connectors.publicClient,
        address: deployments.Gateway,
        abi: gatewayAbi,
        eventName: "InboundMessageDispatched",
        timeout: 5000
      }) : Promise.resolve(null);

      // Wait for both (will timeout in demo)
      const [dhEvent, ethEvent] = await Promise.all([dhEventPromise, ethEventPromise]);

      logger.info(`DataHaven event: ${dhEvent ? "captured" : "none"}`);
      logger.info(`Ethereum event: ${ethEvent ? "captured" : "none"}`);

      // In a real test, you would verify the events are related
      // e.g., same message ID, matching parameters, etc.
    });
  });
});