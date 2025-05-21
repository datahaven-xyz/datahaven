import path from "node:path";
import { datahaven } from "@polkadot-api/descriptors";
import { $ } from "bun";
import { createClient, type PolkadotClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import invariant from "tiny-invariant";
import {
  ANVIL_FUNDED_ACCOUNTS,
  confirmWithTimeout,
  getEvmEcdsaSigner,
  getPortFromKurtosis,
  killExistingContainers,
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
import type { LaunchOptions } from ".";
import type { LaunchedNetwork } from "./launchedNetwork";

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

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
 * Launches Snowbridge relayers for the DataHaven network.
 *
 * @param options - Configuration options for launching the relayers.
 * @param launchedNetwork - An instance of LaunchedNetwork to track the network's state.
 */
export const launchRelayers = async (options: LaunchOptions, launchedNetwork: LaunchedNetwork) => {
  printHeader("Starting Snowbridge Relayers");

  let shouldLaunchRelayers = options.relayer;
  if (shouldLaunchRelayers === undefined) {
    shouldLaunchRelayers = await confirmWithTimeout(
      "Do you want to launch the Snowbridge relayers?",
      true,
      10
    );
  } else {
    logger.info(
      `🏳️ Using flag option: ${shouldLaunchRelayers ? "will launch" : "will not launch"} Snowbridge relayers`
    );
  }

  if (!shouldLaunchRelayers) {
    logger.info("👍  Snowbridge relayers launch. Done!");
    printDivider();
    return;
  }

  // Get DataHaven node port
  const dhNodes = launchedNetwork.containers.filter((container) =>
    container.name.includes("datahaven")
  );
  let substrateWsPort: number;
  let substrateNodeId: string;

  if (dhNodes.length === 0) {
    logger.warn(
      "⚠️ No DataHaven nodes found in launchedNetwork. Assuming DataHaven is running and defaulting to port 9944 for relayers."
    );
    substrateWsPort = 9944;
    substrateNodeId = "default (assumed)";
  } else {
    const firstDhNode = dhNodes[0];
    substrateWsPort = firstDhNode.publicPorts.ws;
    substrateNodeId = firstDhNode.name;
    logger.info(
      `🔌 Using DataHaven node ${substrateNodeId} on port ${substrateWsPort} for relayers and BEEFY check.`
    );
  }

  invariant(options.relayerImageTag, "❌ relayerImageTag is required");
  await killExistingContainers(options.relayerImageTag);

  // Check if BEEFY is ready before proceeding
  await waitBeefyReady(launchedNetwork, 2000, 60000);

  const anvilDeployments = await parseDeploymentsFile();
  const beefyClientAddress = anvilDeployments.BeefyClient;
  const gatewayAddress = anvilDeployments.Gateway;
  invariant(beefyClientAddress, "❌ BeefyClient address not found in anvil.json");
  invariant(gatewayAddress, "❌ Gateway address not found in anvil.json");

  logger.debug(`Ensuring output directory exists: ${RELAYER_CONFIG_DIR}`);
  await $`mkdir -p ${RELAYER_CONFIG_DIR}`.quiet();

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

    const ethWsPort = await getPortFromKurtosis("el-1-reth-lighthouse", "ws");
    const ethHttpPort = await getPortFromKurtosis("cl-1-lighthouse-reth", "http");
    logger.debug(
      `Fetched ports: ETH WS=${ethWsPort}, ETH HTTP=${ethHttpPort}, Substrate WS=${substrateWsPort} (from DataHaven node)`
    );

    if (type === "beacon") {
      const cfg = parseRelayConfig(json, type);
      cfg.source.beacon.endpoint = `http://host.docker.internal:${ethHttpPort}`;
      cfg.source.beacon.stateEndpoint = `http://host.docker.internal:${ethHttpPort}`;
      cfg.source.beacon.datastore.location = "/data";
      cfg.sink.parachain.endpoint = `ws://${substrateNodeId}:${substrateWsPort}`;

      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beacon config written to ${outputFilePath}`);
    } else {
      const cfg = parseRelayConfig(json, type);
      cfg.source.polkadot.endpoint = `ws://${substrateNodeId}:${substrateWsPort}`;
      cfg.sink.ethereum.endpoint = `ws://host.docker.internal:${ethWsPort}`;
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

      const hostConfigFilePath = path.resolve(config);
      const containerConfigFilePath = `/${config}`;
      const networkName = launchedNetwork.networkName;
      invariant(networkName, "❌ Docker network name not found in LaunchedNetwork instance");

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

      launchedNetwork.addContainer(containerName);

      await waitForContainerToStart(containerName);

      // TODO: Re-enable when we know what we want to tail for
      // await waitForLog({
      //   searchString: "<LOG LINE TO WAIT FOR>",
      //   containerName,
      //   timeoutSeconds: 30,
      //   tail: 1
      // });

      logger.debug(`Started relayer ${name} with process ${process.pid}`);
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
  const maxAttempts = Math.floor(timeoutMs / pollIntervalMs);

  logger.info(`⌛️ Waiting for BEEFY to be ready on port ${port}...`);

  let client: PolkadotClient | undefined;
  try {
    client = createClient(withPolkadotSdkCompat(getWsProvider(wsUrl)));

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.debug(`Attempt ${attempt}/${maxAttempts} to check beefy_getFinalizedHead`);
        const finalizedHeadHex = await client._request<string>("beefy_getFinalizedHead", []);

        if (finalizedHeadHex && finalizedHeadHex !== ZERO_HASH) {
          logger.info(`🥩 BEEFY is ready. Finalized head: ${finalizedHeadHex}`);
          client.destroy();
          return;
        }

        logger.debug(
          `BEEFY not ready or finalized head is zero. Retrying in ${pollIntervalMs / 1000}s...`
        );
      } catch (rpcError) {
        logger.warn(`RPC error checking BEEFY status: ${rpcError}. Retrying...`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    logger.error(`❌ BEEFY failed to become ready after ${timeoutMs / 1000} seconds`);
    if (client) client.destroy();
    throw new Error("BEEFY protocol not ready. Relayers cannot be launched.");
  } catch (error) {
    logger.error(`❌ Failed to connect to DataHaven node for BEEFY check: ${error}`);
    if (client) {
      client.destroy();
    }
    throw new Error("BEEFY protocol not ready. Relayers cannot be launched.");
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
  options: LaunchOptions,
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
  let initialBeaconBlock = ZERO_HASH;
  let attempts = 0;
  let keepPolling = true;
  const maxAttempts = timeoutMs / pollIntervalMs;

  logger.trace("Waiting for beacon chain to be ready...");

  while (keepPolling) {
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
      invariant(data.data.finalized.root, "❌ No finalised block root returned from beacon chain");
      initialBeaconBlock = data.data.finalized.root;
    } catch (error) {
      logger.error(`Failed to fetch beacon chain state: ${error}`);
    }

    if (initialBeaconBlock === ZERO_HASH) {
      attempts++;

      if (attempts >= maxAttempts) {
        throw new Error(`Beacon chain is not ready after ${maxAttempts} attempts`);
      }

      logger.info(`⌛️ Retrying beacon chain state fetch in ${pollIntervalMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } else {
      keepPolling = false;
    }
  }

  logger.info(`⏲️ Beacon chain is ready with finalised block: ${initialBeaconBlock}`);
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
