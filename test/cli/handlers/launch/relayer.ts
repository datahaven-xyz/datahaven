import fs from "node:fs";
import path from "node:path";
import { $ } from "bun";
import invariant from "tiny-invariant";
import {
  ANVIL_FUNDED_ACCOUNTS,
  type RelayerType,
  SUBSTRATE_FUNDED_ACCOUNTS,
  confirmWithTimeout,
  getPortFromKurtosis,
  logger,
  parseDeploymentsFile,
  parseRelayConfig,
  printDivider,
  printHeader
} from "utils";
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

  // Kill any pre-existing relayer processes if they exist
  await $`pkill snowbridge-relay`.nothrow().quiet();

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
    const substrateWsPort = 9944;
    logger.debug(
      `Fetched ports: ETH WS=${ethWsPort}, ETH HTTP=${ethHttpPort}, Substrate WS=${substrateWsPort} (hardcoded)`
    );

    if (type === "beacon") {
      const cfg = parseRelayConfig(json, type);
      cfg.source.beacon.endpoint = `http://127.0.0.1:${ethHttpPort}`;
      cfg.source.beacon.stateEndpoint = `http://127.0.0.1:${ethHttpPort}`;

      cfg.source.beacon.datastore.location = datastorePath;

      cfg.sink.parachain.endpoint = `ws://127.0.0.1:${substrateWsPort}`;
      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beacon config written to ${outputFilePath}`);
    } else {
      const cfg = parseRelayConfig(json, type);
      cfg.source.polkadot.endpoint = `ws://127.0.0.1:${substrateWsPort}`;
      cfg.sink.ethereum.endpoint = `ws://127.0.0.1:${ethWsPort}`;
      cfg.sink.contracts.BeefyClient = beefyClientAddress;
      cfg.sink.contracts.Gateway = gatewayAddress;
      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beefy config written to ${outputFilePath}`);
    }
  }

  logger.info("Spawning Snowbridge relayers processes");

  invariant(options.relayerBinPath, "❌ Relayer binary path not defined");
  invariant(
    await Bun.file(options.relayerBinPath).exists(),
    `❌ Relayer binary does not exist at ${options.relayerBinPath}`
  );

  for (const { config, name, type, pk } of relayersToStart) {
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

export const initEthClientPallet = async (
  options: LaunchOptions,
  launchedNetwork: LaunchedNetwork
) => {
  // Poll the beacon chain until it's ready every 2 seconds for 20 seconds
  await waitBeaconChainReady(launchedNetwork, 2000, 20000);

  // Generate the initial checkpoint for the CL client in Substrate
  const clInitialCheckpoint =
    await $`${options.relayerBinPath} generate-beacon-checkpoint --config ${RELAYER_CONFIG_PATHS.BEACON} --export-json`
      .nothrow()
      .text();

  logger.trace(`CL initial checkpoint: ${clInitialCheckpoint}`);

  // Load the checkpoint into a JSON object and clean it up
  const initialCheckpointRaw = fs.readFileSync(INITIAL_CHECKPOINT_PATH, "utf-8");
  const initialCheckpointJson = JSON.parse(initialCheckpointRaw);
  fs.unlinkSync(INITIAL_CHECKPOINT_PATH);

  console.log(initialCheckpointJson);
};

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

  while (keepPolling && attempts < maxAttempts) {
    try {
      const response = await fetch(
        `${launchedNetwork.getClEndpoint()}/eth/v1/beacon/states/head/finality_checkpoints`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = (await response.json()) as FinalityCheckpointsResponse;
      logger.trace(`Beacon chain state: ${JSON.stringify(data)}`);

      invariant(data.data, "❌ No data returned from beacon chain");
      invariant(data.data.finalized, "❌ No finalised block returned from beacon chain");
      invariant(data.data.finalized.root, "❌ No finalised block root returned from beacon chain");
      initialBeaconBlock = data.data.finalized.root;
    } catch (error) {
      logger.debug(`Failed to fetch beacon chain state: ${error}`);
    }

    if (initialBeaconBlock === ZERO_HASH) {
      attempts++;
      logger.debug(`Retrying beacon chain state fetch in ${pollIntervalMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } else {
      keepPolling = false;
    }
  }

  logger.trace(`Beacon chain is ready with finalised block: ${initialBeaconBlock}`);
};

/**
 * Type definition for the response from the /eth/v1/beacon/states/head/finality_checkpoints endpoint.
 */
interface FinalityCheckpointsResponse {
  execution_optimistic: boolean;
  finalized: boolean;
  data: {
    previous_justified: {
      epoch: string;
      root: string;
    };
    current_justified: {
      epoch: string;
      root: string;
    };
    finalized: {
      epoch: string;
      root: string;
    };
  };
}
