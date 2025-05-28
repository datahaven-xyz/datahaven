import path from "node:path";
import { datahaven } from "@polkadot-api/descriptors";
import { $ } from "bun";
import { createClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import invariant from "tiny-invariant";
import { getEvmEcdsaSigner, logger, parseRelayConfig, SUBSTRATE_FUNDED_ACCOUNTS } from "utils";
import type { BeaconCheckpoint, FinalityCheckpointsResponse } from "utils/types";
import { parseJsonToBeaconCheckpoint } from "utils/types";
import { waitFor } from "utils/waits";
import { ZERO_HASH } from "./consts";
import type { LaunchedNetwork } from "./launchedNetwork";

export type BeaconConfig = {
  type: "beacon";
  ethClEndpoint: string;
  substrateWsEndpoint: string;
};

export type BeefyConfig = {
  type: "beefy";
  ethElRpcEndpoint: string;
  substrateWsEndpoint: string;
  beefyClientAddress: string;
  gatewayAddress: string;
};

export type ExecutionConfig = {
  type: "execution";
  // TODO: Add execution config
};

export type SolochainConfig = {
  type: "solochain";
  // TODO: Add solochain config
};

export type RelayerConfigType = BeaconConfig | BeefyConfig | ExecutionConfig | SolochainConfig;

export type RelayerSpec = {
  name: string;
  configFilePath: string;
  templateFilePath?: string;
  config: RelayerConfigType;
  pk: { type: "ethereum" | "substrate"; value: string };
};

export const INITIAL_CHECKPOINT_FILE = "dump-initial-checkpoint.json";
export const INITIAL_CHECKPOINT_DIR = "tmp/beacon-checkpoint";
export const INITIAL_CHECKPOINT_PATH = path.join(INITIAL_CHECKPOINT_DIR, INITIAL_CHECKPOINT_FILE);

/**
 * Generates configuration files for relayers.
 *
 * @param relayerSpec - The relayer specification containing name, type, and config path.
 * @param environment - The environment to use for template files (e.g., "local", "stagenet", "testnet", "mainnet").
 * @param configDir - The directory where config files should be written.
 */
export const generateRelayerConfig = async (
  relayerSpec: RelayerSpec,
  environment: string,
  configDir: string
) => {
  const { name, configFilePath, templateFilePath: _templateFilePath, config } = relayerSpec;
  const { type } = config;
  const configFileName = path.basename(configFilePath);

  logger.debug(`Creating config for ${name}`);
  const templateFilePath =
    _templateFilePath ?? `configs/snowbridge/${environment}/${configFileName}`;
  const outputFilePath = path.resolve(configDir, configFileName);
  logger.debug(`Reading config file ${templateFilePath}`);
  const file = Bun.file(templateFilePath);

  if (!(await file.exists())) {
    logger.error(`File ${templateFilePath} does not exist`);
    throw new Error("Error reading snowbridge config file");
  }
  const json = await file.json();

  logger.debug(`Generating ${type} relayer configuration for ${name}`);

  switch (type) {
    case "beacon": {
      const cfg = parseRelayConfig(json, type);
      cfg.source.beacon.endpoint = config.ethClEndpoint;
      cfg.source.beacon.stateEndpoint = config.ethClEndpoint;
      cfg.source.beacon.datastore.location = "/data";
      cfg.sink.parachain.endpoint = config.substrateWsEndpoint;

      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beacon config written to ${outputFilePath}`);
      break;
    }
    case "beefy": {
      const cfg = parseRelayConfig(json, type);
      cfg.source.polkadot.endpoint = config.substrateWsEndpoint;
      cfg.sink.ethereum.endpoint = config.ethElRpcEndpoint;
      cfg.sink.contracts.BeefyClient = config.beefyClientAddress;
      cfg.sink.contracts.Gateway = config.gatewayAddress;

      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beefy config written to ${outputFilePath}`);
      break;
    }
    case "execution": {
      throw new Error("Execution relayers are not supported yet");
    }
    case "solochain": {
      throw new Error("Solochain relayers are not supported yet");
    }
    default:
      throw new Error(`Unsupported relayer type with config: \n${JSON.stringify(config)}`);
  }
};

/**
 * Waits for the beacon chain to be ready by polling its finality checkpoints.
 *
 * @param launchedNetwork - An instance of LaunchedNetwork to get the CL endpoint.
 * @param pollIntervalMs - The interval in milliseconds to poll the beacon chain.
 * @param timeoutMs - The total time in milliseconds to wait before timing out.
 * @throws Error if the beacon chain is not ready within the timeout.
 */
export const waitBeaconChainReady = async (
  launchedNetwork: LaunchedNetwork,
  pollIntervalMs: number,
  timeoutMs: number
) => {
  const iterations = Math.floor(timeoutMs / pollIntervalMs);

  logger.trace("Waiting for beacon chain to be ready...");

  await waitFor({
    lambda: async () => {
      try {
        const response = await fetch(
          `${launchedNetwork.clEndpoint}/eth/v1/beacon/states/head/finality_checkpoints`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = (await response.json()) as FinalityCheckpointsResponse;
        logger.debug(`Beacon chain state: ${JSON.stringify(data)}`);

        invariant(data.data, "❌ No data returned from beacon chain");
        invariant(data.data.finalized, "❌ No finalised block returned from beacon chain");
        invariant(
          data.data.finalized.root,
          "❌ No finalised block root returned from beacon chain"
        );

        const initialBeaconBlock = data.data.finalized.root;

        if (initialBeaconBlock && initialBeaconBlock !== ZERO_HASH) {
          logger.info(`⏲️ Beacon chain is ready with finalised block: ${initialBeaconBlock}`);
          return true;
        }

        logger.info(`⌛️ Retrying beacon chain state fetch in ${pollIntervalMs / 1000}s...`);
        return false;
      } catch (error) {
        logger.error(`Failed to fetch beacon chain state: ${error}`);
        return false;
      }
    },
    iterations,
    delay: pollIntervalMs,
    errorMessage: "Beacon chain is not ready. Relayers cannot be launched."
  });
};

/**
 * Initialises the Ethereum Beacon Client pallet on the Substrate chain.
 * It waits for the beacon chain to be ready, generates an initial checkpoint,
 * and submits this checkpoint to the Substrate runtime via a sudo call.
 *
 * @param beaconConfigHostPath - The host path to the beacon configuration file.
 * @param relayerImageTag - The Docker image tag for the relayer.
 * @param launchedNetwork - An instance of LaunchedNetwork to interact with the running network.
 * @throws If there's an error generating the beacon checkpoint or submitting it to Substrate.
 */
export const initEthClientPallet = async (
  beaconConfigHostPath: string,
  relayerImageTag: string,
  launchedNetwork: LaunchedNetwork
) => {
  logger.debug("Initialising eth client pallet");
  // Poll the beacon chain until it's ready every 10 seconds for 5 minutes
  await waitBeaconChainReady(launchedNetwork, 10000, 300000);

  const beaconConfigContainerPath = "/app/beacon-relay.json";
  const checkpointHostPath = path.resolve(INITIAL_CHECKPOINT_PATH);
  const checkpointContainerPath = `/app/${INITIAL_CHECKPOINT_FILE}`;

  logger.debug("Generating beacon checkpoint");
  // Pre-create the checkpoint file so that Docker doesn't interpret it as a directory
  await Bun.write(INITIAL_CHECKPOINT_PATH, "");

  logger.debug("Removing 'generate-beacon-checkpoint' container if it exists");
  logger.debug(await $`docker rm -f generate-beacon-checkpoint`.text());

  logger.debug("Generating beacon checkpoint");
  invariant(
    launchedNetwork.networkName,
    "❌ Docker network name not found in LaunchedNetwork instance"
  );
  const command = `docker run \
      -v ${beaconConfigHostPath}:${beaconConfigContainerPath}:ro \
      -v ${checkpointHostPath}:${checkpointContainerPath} \
      --name generate-beacon-checkpoint \
      --workdir /app \
      --add-host host.docker.internal:host-gateway \
      --network ${launchedNetwork.networkName} \
      ${relayerImageTag} \
      generate-beacon-checkpoint --config beacon-relay.json --export-json`;
  logger.debug(`Running command: ${command}`);
  logger.debug(await $`sh -c "${command}"`.text());

  // Load the checkpoint into a JSON object and clean it up
  const initialCheckpointFile = Bun.file(INITIAL_CHECKPOINT_PATH);
  const initialCheckpointRaw = await initialCheckpointFile.text();
  const initialCheckpoint = parseJsonToBeaconCheckpoint(JSON.parse(initialCheckpointRaw));
  await initialCheckpointFile.delete();

  logger.trace("Initial checkpoint:");
  logger.trace(initialCheckpoint.toJSON());

  // Send the checkpoint to the Substrate runtime
  const substrateRpcUrl = `http://127.0.0.1:${launchedNetwork.getPublicWsPort()}`;
  await sendCheckpointToSubstrate(substrateRpcUrl, initialCheckpoint);
  logger.success("Ethereum Beacon Client pallet initialised");
};

/**
 * Sends the beacon checkpoint to the Substrate runtime, waiting for the transaction to be finalised and successful.
 *
 * @param networkRpcUrl - The RPC URL of the Substrate network.
 * @param checkpoint - The beacon checkpoint to send.
 * @throws If the transaction signing fails, it becomes an invalid transaction, or the transaction is included but fails.
 */
const sendCheckpointToSubstrate = async (networkRpcUrl: string, checkpoint: BeaconCheckpoint) => {
  logger.trace("Sending checkpoint to Substrate...");

  const client = createClient(withPolkadotSdkCompat(getWsProvider(networkRpcUrl)));
  const dhApi = client.getTypedApi(datahaven);

  logger.trace("Client created");

  const signer = getEvmEcdsaSigner(SUBSTRATE_FUNDED_ACCOUNTS.ALITH.privateKey);
  logger.trace("Signer created");

  const forceCheckpointCall = dhApi.tx.EthereumBeaconClient.force_checkpoint({
    update: checkpoint
  });

  logger.debug("Force checkpoint call:");
  logger.debug(forceCheckpointCall.decodedCall);

  const tx = dhApi.tx.Sudo.sudo({
    call: forceCheckpointCall.decodedCall
  });

  logger.debug("Sudo call:");
  logger.debug(tx.decodedCall);

  try {
    const txFinalisedPayload = await tx.signAndSubmit(signer);

    if (!txFinalisedPayload.ok) {
      throw new Error("❌ Beacon checkpoint transaction failed");
    }

    logger.info(
      `📪 "force_checkpoint" transaction with hash ${txFinalisedPayload.txHash} submitted successfully and finalised in block ${txFinalisedPayload.block.hash}`
    );
  } catch (error) {
    logger.error(`Failed to submit checkpoint transaction: ${error}`);
    throw new Error(`Failed to submit checkpoint: ${error}`);
  } finally {
    client.destroy();
    logger.debug("Destroyed client");
  }
};
