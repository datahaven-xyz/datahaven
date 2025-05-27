import path from "node:path";
import { datahaven } from "@polkadot-api/descriptors";
import { $ } from "bun";
import { createClient, type PolkadotClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import invariant from "tiny-invariant";
import {
  ANVIL_FUNDED_ACCOUNTS,
  getEvmEcdsaSigner,
  logger,
  parseDeploymentsFile,
  parseRelayConfig,
  printDivider,
  printHeader,
  type RelayerType,
  runShellCommandWithLogger,
  SUBSTRATE_FUNDED_ACCOUNTS,
  waitForContainerToStart
} from "utils";
import type { BeaconCheckpoint, FinalityCheckpointsResponse } from "utils/types";
import { parseJsonToBeaconCheckpoint } from "utils/types";
import { waitFor } from "utils/waits";
import { ZERO_HASH } from "../common/consts";
import type { LaunchedNetwork } from "../common/launchedNetwork";
import type { DeployOptions } from ".";

// Standard ports for the Ethereum network
const ETH_EL_RPC_PORT = 8546;
const ETH_CL_HTTP_PORT = 4000;

type RelayerSpec = {
  name: string;
  type: RelayerType;
  config: string;
  pk: { type: "ethereum" | "substrate"; value: string };
};

const RELAYER_CONFIG_DIR = "tmp/configs";
const RELAYER_CONFIG_PATHS = {
  BEACON: path.join(RELAYER_CONFIG_DIR, "beacon-relay.json"),
  BEEFY: path.join(RELAYER_CONFIG_DIR, "beefy-relay.json")
};
const INITIAL_CHECKPOINT_FILE = "dump-initial-checkpoint.json";
const INITIAL_CHECKPOINT_DIR = "tmp/beacon-checkpoint";
const INITIAL_CHECKPOINT_PATH = path.join(INITIAL_CHECKPOINT_DIR, INITIAL_CHECKPOINT_FILE);

/**
 * Deploys Snowbridge relayers for the DataHaven network in a Kubernetes namespace.
 *
 * @param options - Configuration options for launching the relayers.
 * @param launchedNetwork - An instance of LaunchedNetwork to track the network's state.
 */
export const deployRelayers = async (options: DeployOptions, launchedNetwork: LaunchedNetwork) => {
  printHeader("Starting Snowbridge Relayers");

  // Get DataHaven node port
  const dhNodes = launchedNetwork.containers.filter((container) =>
    container.name.includes("datahaven")
  );

  invariant(dhNodes.length > 0, "❌ No DataHaven nodes found in launchedNetwork");
  const firstDhNode = dhNodes[0];
  const substrateWsPort = firstDhNode.publicPorts.ws;
  const substrateNodeId = firstDhNode.name;
  logger.info(
    `🔌 Using DataHaven node ${substrateNodeId} on port ${substrateWsPort} for relayers and BEEFY check.`
  );

  invariant(options.relayerImageTag, "❌ relayerImageTag is required");

  // Check if BEEFY is ready before proceeding
  await waitBeefyReady(launchedNetwork, 2000, 60000);

  const anvilDeployments = await parseDeploymentsFile();
  const beefyClientAddress = anvilDeployments.BeefyClient;
  const gatewayAddress = anvilDeployments.Gateway;
  invariant(beefyClientAddress, "❌ BeefyClient address not found in anvil.json");
  invariant(gatewayAddress, "❌ Gateway address not found in anvil.json");

  // TODO: MAYBE REMOVE THIS
  logger.debug(`Ensuring output directory exists: ${RELAYER_CONFIG_DIR}`);
  await $`mkdir -p ${RELAYER_CONFIG_DIR}`.quiet();

  // TODO: MAYBE REMOVE THIS
  const datastorePath = "tmp/datastore";
  logger.debug(`Ensuring datastore directory exists: ${datastorePath}`);
  await $`mkdir -p ${datastorePath}`.quiet();

  const relayersToStart: RelayerSpec[] = [
    {
      name: "relayer-🥩",
      type: "beefy",
      config: RELAYER_CONFIG_PATHS.BEEFY,
      pk: {
        type: "ethereum",
        value: ANVIL_FUNDED_ACCOUNTS[1].privateKey
      }
    },
    {
      name: "relayer-🥓",
      type: "beacon",
      config: RELAYER_CONFIG_PATHS.BEACON,
      pk: {
        type: "substrate",
        value: SUBSTRATE_FUNDED_ACCOUNTS.ALITH.privateKey
      }
    }
  ];

  for (const { config, type, name } of relayersToStart) {
    const configFileName = path.basename(config);

    // TODO: CHANGE THIS SO THAT IT WRITE IN deployment/charts/bridges-common-relay/configs
    logger.debug(`Creating config for ${name}`);
    const templateFilePath = `configs/snowbridge/${configFileName}`;
    const outputFilePath = path.resolve(RELAYER_CONFIG_DIR, configFileName);
    logger.debug(`Reading config file ${templateFilePath}`);
    const file = Bun.file(templateFilePath);

    if (!(await file.exists())) {
      logger.error(`File ${templateFilePath} does not exist`);
      throw new Error("Error reading snowbridge config file");
    }
    const json = await file.json();

    // TODO: CHANGE THIS TO USE THE LAUNCHED NETWORK ENDPOINTS
    logger.debug(
      `Fetched ports: ETH WS=${ETH_EL_RPC_PORT}, ETH HTTP=${ETH_CL_HTTP_PORT}, Substrate WS=${substrateWsPort} (from DataHaven node)`
    );

    if (type === "beacon") {
      const cfg = parseRelayConfig(json, type);
      // TODO: CHANGE THIS TO USE THE LAUNCHED NETWORK ENDPOINTS
      cfg.source.beacon.endpoint = `http://host.docker.internal:${ethHttpPort}`;
      cfg.source.beacon.stateEndpoint = `http://host.docker.internal:${ethHttpPort}`;
      cfg.source.beacon.datastore.location = "/data";
      cfg.sink.parachain.endpoint = `ws://${substrateNodeId}:${substrateWsPort}`;

      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beacon config written to ${outputFilePath}`);
    } else {
      const cfg = parseRelayConfig(json, type);
      // TODO: CHANGE THIS TO USE THE LAUNCHED NETWORK ENDPOINTS
      cfg.source.polkadot.endpoint = `ws://${substrateNodeId}:${substrateWsPort}`;
      cfg.sink.ethereum.endpoint = `ws://host.docker.internal:${elWsPort}`;
      cfg.sink.contracts.BeefyClient = beefyClientAddress;
      cfg.sink.contracts.Gateway = gatewayAddress;
      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beefy config written to ${outputFilePath}`);
    }
  }

  invariant(options.relayerImageTag, "❌ Relayer image tag not defined");

  await initEthClientPallet(options, launchedNetwork);

  for (const { config, name, type, pk } of relayersToStart) {
    try {
      const containerName = `snowbridge-${type}-relay`;
      logger.info(`🚀 Starting relayer ${containerName} ...`);

      // TODO: ADD SECRET TO KUBERNETES

      const hostConfigFilePath = path.resolve(config);
      const containerConfigFilePath = `/${config}`;
      const networkName = launchedNetwork.networkName;
      invariant(networkName, "❌ Docker network name not found in LaunchedNetwork instance");

      // TODO: CHANGE THIS TO LAUNCH WITH HELM CHARTS
      const commandBase: string[] = [
        "docker",
        "run",
        "-d",
        "--platform",
        "linux/amd64",
        "--add-host",
        "host.docker.internal:host-gateway",
        "--name",
        containerName,
        "--network",
        networkName
      ];

      const volumeMounts: string[] = ["-v", `${hostConfigFilePath}:${containerConfigFilePath}`];

      if (type === "beacon") {
        const hostDatastorePath = path.resolve(datastorePath);
        const containerDatastorePath = "/data";
        volumeMounts.push("-v", `${hostDatastorePath}:${containerDatastorePath}`);
      }

      const relayerCommandArgs: string[] = [
        "run",
        type,
        "--config",
        config,
        type === "beacon" ? "--substrate.private-key" : "--ethereum.private-key",
        pk.value
      ];

      const command: string[] = [
        ...commandBase,
        ...volumeMounts,
        options.relayerImageTag,
        ...relayerCommandArgs
      ];

      logger.debug(`Running command: ${command.join(" ")}`);
      await runShellCommandWithLogger(command.join(" "), { logLevel: "debug" });

      // TODO: MAYBE REMOVE THIS
      launchedNetwork.addContainer(containerName);

      // TODO: MAYBE REMOVE THIS
      await waitForContainerToStart(containerName);

      logger.success(`Started relayer ${name}`);
    } catch (e) {
      logger.error(`Error starting relayer ${name}`);
      logger.error(e);
    }
  }

  logger.success("Snowbridge relayers started");
  printDivider();
};

/**
 * Waits for the BEEFY protocol to be ready by polling its finalized head.
 *
 * @param launchedNetwork - An instance of LaunchedNetwork to get the node endpoint.
 * @param pollIntervalMs - The interval in milliseconds to poll the BEEFY endpoint.
 * @param timeoutMs - The total time in milliseconds to wait before timing out.
 * @throws Error if BEEFY is not ready within the timeout.
 */
const waitBeefyReady = async (
  launchedNetwork: LaunchedNetwork,
  pollIntervalMs: number,
  timeoutMs: number
): Promise<void> => {
  const port = launchedNetwork.getPublicWsPort();
  const wsUrl = `ws://127.0.0.1:${port}`;
  const iterations = Math.floor(timeoutMs / pollIntervalMs);

  logger.info(`⌛️ Waiting for BEEFY to be ready on port ${port}...`);

  let client: PolkadotClient | undefined;
  const clientTimeoutMs = pollIntervalMs / 2;
  const delayMs = pollIntervalMs / 2;
  try {
    client = createClient(withPolkadotSdkCompat(getWsProvider(wsUrl)));

    await waitFor({
      lambda: async () => {
        try {
          logger.debug("Attempting to to check beefy_getFinalizedHead");

          // Add timeout to the RPC call to prevent hanging.
          const finalisedHeadPromise = client?._request<string>("beefy_getFinalizedHead", []);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("RPC call timeout")), clientTimeoutMs);
          });

          const finalisedHeadHex = await Promise.race([finalisedHeadPromise, timeoutPromise]);

          if (finalisedHeadHex && finalisedHeadHex !== ZERO_HASH) {
            logger.info(`🥩 BEEFY is ready. Finalised head: ${finalisedHeadHex}.`);
            return true;
          }

          logger.debug(
            `BEEFY not ready or finalised head is zero. Retrying in ${delayMs / 1000}s...`
          );
          return false;
        } catch (rpcError) {
          logger.warn(`RPC error checking BEEFY status: ${rpcError}. Retrying...`);
          return false;
        }
      },
      iterations,
      delay: delayMs,
      errorMessage: "BEEFY protocol not ready. Relayers cannot be launched."
    });
  } catch (error) {
    logger.error(`❌ Failed to connect to DataHaven node for BEEFY check: ${error}`);
    throw new Error("BEEFY protocol not ready. Relayers cannot be launched.");
  } finally {
    if (client) {
      client.destroy();
    }
  }
};

/**
 * Initialises the Ethereum Beacon Client pallet on the Substrate chain.
 * It waits for the beacon chain to be ready, generates an initial checkpoint,
 * and submits this checkpoint to the Substrate runtime via a sudo call.
 *
 * @param options - Launch options containing the relayer binary path.
 * @param launchedNetwork - An instance of LaunchedNetwork to interact with the running network.
 * @throws If there's an error generating the beacon checkpoint or submitting it to Substrate.
 */
export const initEthClientPallet = async (
  options: DeployOptions,
  launchedNetwork: LaunchedNetwork
) => {
  logger.debug("Initialising eth client pallet");
  // Poll the beacon chain until it's ready every 10 seconds for 5 minutes
  await waitBeaconChainReady(launchedNetwork, 10000, 300000);

  const beaconConfigHostPath = path.resolve(RELAYER_CONFIG_PATHS.BEACON);
  const beaconConfigContainerPath = `/app/${RELAYER_CONFIG_PATHS.BEACON}`;
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
      ${options.relayerImageTag} \
      generate-beacon-checkpoint --config ${RELAYER_CONFIG_PATHS.BEACON} --export-json`;
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
 * Waits for the beacon chain to be ready by polling its finality checkpoints.
 *
 * @param launchedNetwork - An instance of LaunchedNetwork to get the CL endpoint.
 * @param pollIntervalMs - The interval in milliseconds to poll the beacon chain.
 * @param timeoutMs - The total time in milliseconds to wait before timing out.
 * @throws Error if the beacon chain is not ready within the timeout.
 */
const waitBeaconChainReady = async (
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
