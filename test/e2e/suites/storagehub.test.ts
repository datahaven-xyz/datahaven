/**
 * StorageHub E2E Tests
 *
 * Tests the uploading a file to storage through Datahaven
 *
 * Prerequisites:
 * - DataHaven network with StoraheHub service running
 * - Storage hub MSP and BSP
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { Binary } from "polkadot-api";
import { createPapiConnectors, logger } from "utils";
import { SUBSTRATE_FUNDED_ACCOUNTS } from "utils/constants";
import { getEvmEcdsaSigner } from "utils/papi";
import { launchLocalDataHavenSolochain } from "../../launcher/datahaven";
import {
  launchBspNode,
  launchMspNode,
  launchStorageHubPostgres
} from "../../launcher/storagehub-docker";
import { LaunchedNetwork } from "../../launcher/types/launchedNetwork";
import { registerProviders } from "../../scripts/register-providers";

const TEST_AUTHORITY_IDS = ["alice", "bob"] as const;
const networkId = `storagehub-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

describe("test uploading file to storage hub", () => {
  let aliceUrl: string;
  let _mspUrl: string;

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
    aliceUrl = await launchLocalDataHavenSolochain(options, run);

    // 2. Launch PostgreSQL database
    logger.info("🗄️ Launching StorageHub PostgreSQL...");
    await launchStorageHubPostgres(options, run);

    // 3. Launch MSP node
    logger.info("📦 Launching MSP node...");
    _mspUrl = await launchMspNode(options, run);

    // 4. Launch BSP node
    logger.info("📦 Launching BSP node...");
    await launchBspNode(options, run);

    // // 5. Launch Indexer node
    // logger.info("📦 Launching Indexer node...");
    // await launchIndexerNode(options, run);

    // // 6. Launch Fisherman node
    // logger.info("📦 Launching Fisherman node...");
    // await launchFishermanNode(options, run);

    // Register providers
    logger.info("📝 Registering providers...");
    await registerProviders({ launchedNetwork: run });
  });

  it("works", async () => {
    const { typedApi: dhApi } = createPapiConnectors(aliceUrl);

    const mspCount = await dhApi.query.Providers.MspCount.getValue();
    const bspCount = await dhApi.query.Providers.BspCount.getValue();

    expect(mspCount).toBe(1);
    expect(bspCount).toBe(1);

    const msp_id = await dhApi.query.Providers.AccountIdToMainStorageProviderId.getValue(
      SUBSTRATE_FUNDED_ACCOUNTS.CHARLETH.publicKey
    );
    expect(msp_id).toBeDefined();
    if (!msp_id) {
      throw new Error("mspId for Charleth not found");
    }

    const value_prop_id =
      await dhApi.apis.StorageProvidersApi.query_value_propositions_for_msp(msp_id);

    const call = await dhApi.tx.FileSystem.create_bucket({
      msp_id,
      name: Binary.fromText("bucket"),
      private: false,
      value_prop_id: value_prop_id[0].id
    });
    const aliceSigner = getEvmEcdsaSigner(SUBSTRATE_FUNDED_ACCOUNTS.ALITH.privateKey);
    const mspResult = await call.signAndSubmit(aliceSigner);
    expect(mspResult.ok).toBeTrue();
  }, 30000);

  afterAll(async () => {
    // Delete all the containers started by this test suite
    await $`docker container stop $(docker container ls -q --filter name=${networkId})`;
  });
});
