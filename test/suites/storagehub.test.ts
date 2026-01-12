/**
 * StorageHub E2E Tests
 *
 * Tests the uploading a file to storage through Datahaven
 *
 * Prerequisites:
 * - DataHaven network with StoraheHub service running
 * - Storage hub MSP and BSP
 */

import { afterAll, beforeAll, describe, it } from "bun:test";
import { $ } from "bun";
import { logger } from "utils";
import { launchLocalDataHavenSolochain } from "../launcher/datahaven";
import {
  launchBspNode,
  launchFishermanNode,
  launchIndexerNode,
  launchMspNode,
  launchStorageHubPostgres
} from "../launcher/storagehub-docker";
import { LaunchedNetwork } from "../launcher/types/launchedNetwork";

const TEST_AUTHORITY_IDS = ["alice", "bob"] as const;
const networkId = `storagehub-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

describe("test uploading file to storage hub", () => {
  beforeAll(async () => {
    const datahavenImageTag = "datahavenxyz/datahaven:local";
    const relayerImageTag = "datahavenxyz/snowbridge-relay:latest";
    const authorityIds = TEST_AUTHORITY_IDS;
    const buildDatahaven = false;
    const datahavenBuildExtraArgs = "";

    const options = {
      networkId,
      datahavenImageTag,
      relayerImageTag,
      authorityIds,
      buildDatahaven,
      datahavenBuildExtraArgs
    };

    const run = new LaunchedNetwork();

    // 1. Launch DataHaven validator nodes
    logger.info("📦 Launching DataHaven validator nodes...");
    await launchLocalDataHavenSolochain(options, run);

    // 2. Launch PostgreSQL database
    logger.info("🗄️ Launching StorageHub PostgreSQL...");
    await launchStorageHubPostgres(options, run);

    // 3. Launch MSP node
    logger.info("📦 Launching MSP node...");
    await launchMspNode(options, run);

    // 4. Launch BSP node
    logger.info("📦 Launching BSP node...");
    await launchBspNode(options, run);

    // 5. Launch Indexer node
    logger.info("📦 Launching Indexer node...");
    await launchIndexerNode(options, run);

    // 6. Launch Fisherman node
    logger.info("📦 Launching Fisherman node...");
    await launchFishermanNode(options, run);
  });

  it("works", () => {});

  afterAll(async () => {
    // Delete all the containers started by this test suite
    await $`docker container stop $(docker container ls -q --filter name=${networkId})`;
  });
});
