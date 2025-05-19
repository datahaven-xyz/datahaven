import fs from "node:fs";
import path from "node:path";
import { datahaven } from "@polkadot-api/descriptors";
import { $ } from "bun";
import { type PolkadotClient, createClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import invariant from "tiny-invariant";
import {
  ANVIL_FUNDED_ACCOUNTS,
  type RelayerType,
  SUBSTRATE_FUNDED_ACCOUNTS,
  confirmWithTimeout,
  getEvmEcdsaSigner,
  getPortFromKurtosis,
  logger,
  parseDeploymentsFile,
  parseRelayConfig,
  printDivider,
  printHeader
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
  secondaryPk?: { type: "ethereum" | "substrate"; value: string };
};

const RELAYER_CONFIG_DIR = "tmp/configs";
const RELAYER_CONFIG_PATHS = {
  BEACON: path.join(RELAYER_CONFIG_DIR, "beacon-relay.json"),
  BEEFY: path.join(RELAYER_CONFIG_DIR, "beefy-relay.json"),
  SOLOCHAIN: path.join(RELAYER_CONFIG_DIR, "solochain-relay.json")
};
const INITIAL_CHECKPOINT_PATH = "./dump-initial-checkpoint.json";

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
      `Using flag option: ${shouldLaunchRelayers ? "will launch" : "will not launch"} Snowbridge relayers`
    );
  }

  if (!shouldLaunchRelayers) {
    logger.info("Skipping Snowbridge relayers launch. Done!");
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

  // Kill any pre-existing relayer processes if they exist
  await $`pkill snowbridge-relay`.nothrow().quiet();

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

  const logsPath = `tmp/logs/${launchedNetwork.getRunId()}/`;
  logger.debug(`Ensuring logs directory exists: ${logsPath}`);
  await $`mkdir -p ${logsPath}`.quiet();

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
    },
    {
      name: "relayer-⛓️",
      type: "solochain",
      config: RELAYER_CONFIG_PATHS.SOLOCHAIN,
      pk: {
        type: "ethereum",
        value: ANVIL_FUNDED_ACCOUNTS[1].privateKey
      },
      secondaryPk: {
        type: "substrate",
        value: SUBSTRATE_FUNDED_ACCOUNTS.ALITH.privateKey
      }
    }
  ];

  for (const { config, type, name } of relayersToStart) {
    const configFileName = path.basename(config);

    logger.debug(`Creating config for ${name}`);
    const templateFilePath = `configs/snowbridge/${configFileName}`;
    const outputFilePath = `tmp/configs/${configFileName}`;
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
      cfg.source.beacon.endpoint = `http://127.0.0.1:${ethHttpPort}`;
      cfg.source.beacon.stateEndpoint = `http://127.0.0.1:${ethHttpPort}`;

      cfg.source.beacon.datastore.location = datastorePath;

      cfg.sink.parachain.endpoint = `ws://127.0.0.1:${substrateWsPort}`;
      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beacon config written to ${outputFilePath}`);
    } else if (type === "beefy") {
      const cfg = parseRelayConfig(json, type);
      cfg.source.polkadot.endpoint = `ws://127.0.0.1:${substrateWsPort}`;
      cfg.sink.ethereum.endpoint = `ws://127.0.0.1:${ethWsPort}`;
      cfg.sink.contracts.BeefyClient = beefyClientAddress;
      cfg.sink.contracts.Gateway = gatewayAddress;
      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beefy config written to ${outputFilePath}`);
    } else if (type === "solochain") {
      const cfg = parseRelayConfig(json, type);
      cfg.source.ethereum.endpoint = `ws://127.0.0.1:${ethWsPort}`;
      cfg.source.solochain.endpoint = `ws://127.0.0.1:${substrateWsPort}`;
      cfg.source.contracts.BeefyClient = beefyClientAddress;
      cfg.source.contracts.Gateway = gatewayAddress;
      cfg.source.beacon.endpoint = `http://127.0.0.1:${ethHttpPort}`;
      cfg.source.beacon.stateEndpoint = `http://127.0.0.1:${ethHttpPort}`;
      cfg.source.beacon.datastore.location = datastorePath;
      cfg.sink.ethereum.endpoint = `ws://127.0.0.1:${ethWsPort}`;
      cfg.sink.contracts.Gateway = gatewayAddress;
      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated solochain config written to ${outputFilePath}`);
    }
  }

  logger.info("Spawning Snowbridge relayers processes");

  invariant(options.relayerBinPath, "❌ Relayer binary path not defined");
  invariant(
    await Bun.file(options.relayerBinPath).exists(),
    `❌ Relayer binary does not exist at ${options.relayerBinPath}`
  );

  await initEthClientPallet(options, launchedNetwork);

  for (const { config, name, type, pk, secondaryPk } of relayersToStart) {
    try {
      logger.info(`Starting relayer ${name} ...`);
      const logFileName = `${type}-${name.replace(/[^a-zA-Z0-9-]/g, "")}.log`;
      const logFilePath = path.join(logsPath, logFileName);
      logger.debug(`Writing logs to ${logFilePath}`);

      const fd = fs.openSync(logFilePath, "a");

      const spawnCommand = [
        options.relayerBinPath,
        "run",
        type,
        "--config",
        config,
        type === "beacon" ? "--substrate.private-key" : "--ethereum.private-key",
        pk.value
      ];

      if (type === "solochain" && secondaryPk) {
        spawnCommand.push("--substrate.private-key", secondaryPk.value);
      }

      logger.debug(`Spawning command: ${spawnCommand.join(" ")}`);

      const process = Bun.spawn(spawnCommand, {
        stdout: fd,
        stderr: fd
      });

      process.unref();

      launchedNetwork.addFileDescriptor(fd);
      launchedNetwork.addProcess(process);
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

  logger.info(`Waiting for BEEFY to be ready on port ${port}...`);

  let client: PolkadotClient | undefined;
  try {
    client = createClient(withPolkadotSdkCompat(getWsProvider(wsUrl)));

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.debug(`Attempt ${attempt}/${maxAttempts} to check beefy_getFinalizedHead`);
        const finalizedHeadHex = await client._request<string>("beefy_getFinalizedHead", []);

        if (finalizedHeadHex && finalizedHeadHex !== ZERO_HASH) {
          logger.success(`🥩 BEEFY is ready. Finalized head: ${finalizedHeadHex}`);
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
  // Poll the beacon chain until it's ready every 10 seconds for 5 minutes
  await waitBeaconChainReady(launchedNetwork, 10000, 300000);

  // Generate the initial checkpoint for the CL client in Substrate
  const { stdout, stderr, exitCode } =
    await $`${options.relayerBinPath} generate-beacon-checkpoint --config ${RELAYER_CONFIG_PATHS.BEACON} --export-json`
      .nothrow()
      .quiet();
  if (exitCode !== 0) {
    logger.error(stderr);
    throw new Error("Error generating beacon checkpoint");
  }
  logger.trace(`Beacon checkpoint stdout: ${stdout}`);

  // Load the checkpoint into a JSON object and clean it up
  const initialCheckpointRaw = fs.readFileSync(INITIAL_CHECKPOINT_PATH, "utf-8");
  const initialCheckpoint = parseJsonToBeaconCheckpoint(JSON.parse(initialCheckpointRaw));
  fs.unlinkSync(INITIAL_CHECKPOINT_PATH);

  logger.trace("Initial checkpoint:");
  logger.trace(initialCheckpoint.toJSON());

  // Send the checkpoint to the Substrate runtime
  const substrateRpcUrl = `http://127.0.0.1:${launchedNetwork.getPublicWsPort()}`;
  await sendCheckpointToSubstrate(substrateRpcUrl, initialCheckpoint);
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
