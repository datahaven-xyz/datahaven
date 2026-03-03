/**
 * StorageHub E2E Tests
 *
 * Tests the uploading a file to storage through Datahaven
 *
 * Prerequisites:
 * - DataHaven network with StoraheHub service running
 * - Storage hub MSP and BSP
 */
import "@storagehub/api-augment";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { TypeRegistry } from "@polkadot/types";
import {
  FileManager,
  initWasm,
  ReplicationLevel,
  SH_FILE_SYSTEM_PRECOMPILE_ADDRESS,
  StorageHubClient
} from "@storagehub-sdk/core";
import { MspClient } from "@storagehub-sdk/msp-client";
import { $ } from "bun";
import { Binary } from "polkadot-api";
import { createPapiConnectors, logger } from "utils";
import { CHAIN_ID, SUBSTRATE_FUNDED_ACCOUNTS } from "utils/constants";
import { getEvmEcdsaSigner } from "utils/papi";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { launchLocalDataHavenSolochain } from "../../launcher/datahaven";
import {
  launchBackend,
  launchBspNode,
  launchIndexerNode,
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
  let backendUrl: string;

  beforeAll(async () => {
    await initWasm();

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

    // 6. Launch Indexer node
    logger.info("📦 Launching Indexer node...");
    await launchIndexerNode(options, run);

    // // 7. Launch Fisherman node
    // logger.info("📦 Launching Fisherman node...");
    // await launchFishermanNode(options, run);

    // Register providers
    logger.info("📝 Registering providers...");
    await registerProviders({ launchedNetwork: run });

    // Launch Storage Hub Backend
    logger.info("📦 Launching Storage hub backend...");
    backendUrl = await launchBackend(options, run);
  });

  it("Create a bucket", async () => {
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
    console.log(mspResult);
  }, 30000);

  it("Send a request", async () => {
    const { typedApi: dhApi } = createPapiConnectors(aliceUrl);

    const msp_id = await dhApi.query.Providers.AccountIdToMainStorageProviderId.getValue(
      SUBSTRATE_FUNDED_ACCOUNTS.CHARLETH.publicKey
    );
    expect(msp_id).toBeDefined();
    if (!msp_id) {
      throw new Error("mspId for Charleth not found");
    }

    const buckets = await dhApi.apis.StorageProvidersApi.query_buckets_for_msp(msp_id);
    if (!buckets.success) {
      throw new Error("Bucket not found for the registered msp");
    }
    expect(buckets.value.length).toBe(1);

    const bucketId = buckets.value[0].asHex();
    const fileContent = "foo bar";
    const location = "foo/bar.txt";

    // Build FileManager from in-memory file content
    const fileBytes = new TextEncoder().encode(fileContent);
    const fileManager = new FileManager({
      size: fileBytes.length,
      stream: () =>
        new ReadableStream({
          start(controller) {
            controller.enqueue(fileBytes);
            controller.close();
          }
        }) as ReadableStream<Uint8Array>
    });

    // Compute fingerprint and file key from the file metadata
    const registry = new TypeRegistry();
    const account = privateKeyToAccount(SUBSTRATE_FUNDED_ACCOUNTS.ALITH.privateKey);
    const owner = registry.createType("AccountId20", account.address);
    const bucketIdH256 = registry.createType("H256", bucketId);
    const fingerprint = await fileManager.getFingerprint();
    const _fileKey = await fileManager.computeFileKey(owner, bucketIdH256, location);

    // Set up EVM clients
    const httpUrl = aliceUrl.replace("ws://", "http://");
    const chain = defineChain({
      id: CHAIN_ID,
      name: "DataHaven",
      nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
      rpcUrls: { default: { http: [httpUrl] } }
    });
    const walletClient = createWalletClient({ account, chain, transport: http(httpUrl) });
    const publicClient = createPublicClient({ chain, transport: http(httpUrl) });
    const storageHubClient = new StorageHubClient({
      rpcUrl: httpUrl,
      chain,
      walletClient,
      filesystemContractAddress: SH_FILE_SYSTEM_PRECOMPILE_ADDRESS
    });

    // Issue storage request
    const txHash = await storageHubClient.issueStorageRequest(
      bucketId as `0x${string}`,
      location,
      fingerprint.toHex() as `0x${string}`,
      BigInt(fileBytes.length),
      msp_id.asHex() as `0x${string}`,
      [],
      ReplicationLevel.Basic,
      1
    );

    // Wait for storage request transaction
    // Don't proceed until receipt is confirmed on chain
    if (!txHash) {
      throw new Error("Storage request transaction was not submitted");
    }
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`Storage request failed: ${txHash}`);
    }
    console.log("issueStorageRequest() txReceipt:", receipt);

    // Authenticate with the backend via SIWE and upload the file
    const mspClient = await MspClient.connect({ baseUrl: backendUrl }, async () =>
      sessionToken
        ? ({ token: sessionToken, user: { address: account.address } } as const)
        : undefined
    );

    const domain = new URL(backendUrl).host;
    const siweSession = await mspClient.auth.SIWE(walletClient, domain, backendUrl);
    const sessionToken = (siweSession as { token: string }).token;
    expect(sessionToken).toBeDefined();

    // const uploadReceipt = await mspClient.files.uploadFile(
    //   bucketId,
    //   fileKey.toHex(),
    //   await fileManager.getFileBlob(),
    //   account.address,
    //   location
    // );
    // expect(uploadReceipt.status).toBe("upload_successful");
  }, 60000);

  afterAll(async () => {
    // Delete all the containers started by this test suite
    await $`docker container stop $(docker container ls -q --filter name=${networkId})`;
  });
});
