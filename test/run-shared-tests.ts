#!/usr/bin/env bun
/**
 * Test runner that configures and uses a shared network instance
 * for all E2E test suites to avoid restarting Kurtosis between suites.
 */

import { $ } from "bun";
import { SharedNetworkManager } from "./framework/shared-network";
import { logger } from "./utils";

async function runSharedTests() {
  logger.info("🚀 Starting E2E tests with shared network");

  // Configure the shared network before any tests run
  const sharedNetwork = SharedNetworkManager.getInstance();
  sharedNetwork.configure({
    networkId: `shared-e2e-${Date.now()}`,
    datahavenImageTag: "datahavenxyz/datahaven:local",
    relayerImageTag: "datahavenxyz/snowbridge-relay:latest",
    buildDatahaven: false, // Use pre-built image for speed
    slotTime: 2, // 2-second slot time for faster test execution
    blockscout: false // Disable blockscout for tests
  });

  try {
    // Run all test suites with the shared network
    // The --timeout is important for the network launch
    const result = await $`bun test ./suites --timeout 900000`.nothrow();

    if (result.exitCode !== 0) {
      logger.error("❌ Tests failed");
      process.exit(result.exitCode);
    }

    logger.success("✅ All tests passed with shared network");
  } catch (error) {
    logger.error("Failed to run tests:", error);
    process.exit(1);
  } finally {
    // Cleanup will be handled by the process exit handler in SharedNetworkManager
    logger.info("🧹 Cleaning up shared network...");
    await sharedNetwork.cleanup();
  }
}

// Run the tests
runSharedTests();
