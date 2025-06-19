import path from "node:path";
import { datahaven } from "@polkadot-api/descriptors";
import { $ } from "bun";
import { createClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { getPapiSigner, logger } from "utils";
import { waitFor } from "utils/waits";
import type { LaunchedNetwork } from "../types/launched-network";
import { getPublicWsPort } from "../types/launched-network";

const INITIAL_CHECKPOINT_FILE = "initial-checkpoint.json";
const INITIAL_CHECKPOINT_DIR = "tmp/snowbridge-initial-checkpoint";

export async function initEthClientPallet(
  beaconConfigPath: string,
  relayerImageTag: string,
  datastorePath: string,
  launchedNetwork: LaunchedNetwork
): Promise<void> {
  await waitBeaconChainReady(beaconConfigPath, relayerImageTag);
  await forceCheckpoint(launchedNetwork);
  logger.success("Ethereum Beacon Client pallet initialised");
}

async function waitBeaconChainReady(
  beaconConfigPath: string,
  relayerImageTag: string
): Promise<void> {
  const checkpointPath = path.join(INITIAL_CHECKPOINT_DIR, INITIAL_CHECKPOINT_FILE);

  await waitFor({
    lambda: async () => {
      const exitCode = await generateInitialCheckpoint(
        beaconConfigPath,
        relayerImageTag,
        checkpointPath
      );
      if (exitCode === 0) {
        const checkpoint = await Bun.file(checkpointPath).json();
        const hash = checkpoint.finalizedBlockRoot;
        logger.info(`⏲️ Beacon chain is ready with finalised block: ${hash}`);
        return true;
      }
      return false;
    },
    errorMessage: "Beacon chain not ready",
    iterations: 300,
    delay: 1000
  });
}

async function generateInitialCheckpoint(
  beaconConfigPath: string,
  relayerImageTag: string,
  outputPath: string
): Promise<number> {
  const outputDir = path.dirname(outputPath);
  const outputFile = path.basename(outputPath);

  const { exitCode } = await $`docker run --rm \
    -v ${path.resolve(beaconConfigPath)}:/tmp/beacon-relay.json \
    -v ${path.resolve(outputDir)}:/tmp/output \
    --entrypoint /bin/sh \
    ${relayerImageTag} \
    -c "snowbridge-relay generate-beacon-checkpoint --config /tmp/beacon-relay.json > /tmp/output/${outputFile}"`
    .quiet()
    .nothrow();

  return exitCode;
}

async function forceCheckpoint(launchedNetwork: LaunchedNetwork): Promise<void> {
  const checkpointPath = path.join(INITIAL_CHECKPOINT_DIR, INITIAL_CHECKPOINT_FILE);
  const checkpoint = await Bun.file(checkpointPath).json();

  const signer = getPapiSigner();
  const dhWsPort = getPublicWsPort(launchedNetwork);
  const client = createClient(withPolkadotSdkCompat(getWsProvider(`ws://127.0.0.1:${dhWsPort}`)));
  const dhApi = client.getTypedApi(datahaven);

  const tx = dhApi.tx.EthereumBeaconClient.force_checkpoint({
    update: checkpoint
  });

  const result = await tx.signAndSubmit(signer);
  logger.info(
    `📪 "force_checkpoint" transaction with hash ${result.txHash} submitted successfully and finalised in block ${result.block.hash}`
  );

  client.destroy();
}
