import fs from "node:fs";
import path from "node:path";
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
  getPortFromKurtosis,
  logger,
  parseDeploymentsFile,
  parseRelayConfig,
  printDivider,
  printHeader
} from "utils";
import type { LaunchOptions } from ".";
import type { LaunchedNetwork } from "./launchedNetwork";

type RelayerSpec = {
  name: string;
  type: RelayerType;
  config: string;
  pk: { type: "ethereum" | "substrate"; value: string };
};

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
  const dhNodes = launchedNetwork.getDHNodes();
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
    substrateWsPort = firstDhNode.port;
    substrateNodeId = firstDhNode.id;
    logger.info(
      `🔌 Using DataHaven node ${substrateNodeId} on port ${substrateWsPort} for relayers and BEEFY check.`
    );
  }

  // Kill any pre-existing relayer processes if they exist
  await $`pkill snowbridge-relay`.nothrow().quiet();

  // Check if BEEFY is ready before proceeding
  await isBeefyReady(substrateWsPort);

  const anvilDeployments = await parseDeploymentsFile();
  const beefyClientAddress = anvilDeployments.BeefyClient;
  const gatewayAddress = anvilDeployments.Gateway;
  invariant(beefyClientAddress, "❌ BeefyClient address not found in anvil.json");
  invariant(gatewayAddress, "❌ Gateway address not found in anvil.json");

  const outputDir = "tmp/configs";
  logger.debug(`Ensuring output directory exists: ${outputDir}`);
  await $`mkdir -p ${outputDir}`.quiet();

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
      config: "beefy-relay.json",
      pk: {
        type: "ethereum",
        value: ANVIL_FUNDED_ACCOUNTS[1].privateKey
      }
    },
    {
      name: "relayer-🥓",
      type: "beacon",
      config: "beacon-relay.json",
      pk: {
        type: "substrate",
        value: SUBSTRATE_FUNDED_ACCOUNTS.GOLIATH.privateKey
      }
    }
  ];

  for (const { config: configFileName, type, name } of relayersToStart) {
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
        path.join("tmp/configs", config),
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

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Checks if the BEEFY protocol is ready on the given port.
 *
 * @param port - The port to check.
 * @param retries - The number of retries to make.
 * @param delay - The delay between retries in milliseconds.
 */
export const isBeefyReady = async (port: number, retries = 30, delay = 2000): Promise<void> => {
  logger.info(`Checking BEEFY readiness on port ${port}...`);
  const wsUrl = `ws://127.0.0.1:${port}`;
  let client: PolkadotClient | undefined;
  try {
    client = createClient(withPolkadotSdkCompat(getWsProvider(wsUrl)));

    for (let i = 0; i < retries; i++) {
      try {
        logger.debug(`Attempt ${i + 1}/${retries} to check beefy_getFinalizedHead on port ${port}`);
        // beefy_getFinalizedHead returns a hex string
        const finalizedHeadHex = await client._request<string>("beefy_getFinalizedHead", []);
        if (finalizedHeadHex && finalizedHeadHex !== ZERO_HASH) {
          logger.success(`🥩 BEEFY is ready on port ${port}. Finalized head: ${finalizedHeadHex}`);
          await client.destroy();
          return;
        }
        logger.debug(
          `BEEFY not ready on port ${port}, or finalized head is zero. Retrying in ${delay / 1000}s...`
        );
      } catch (rpcError) {
        logger.warn(`RPC error checking BEEFY status on port ${port}: ${rpcError}. Retrying...`);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    logger.error(`❌ BEEFY failed to become ready on port ${port} after ${retries} attempts.`);
    if (client) await client.destroy(); // Destroy after loop if not returned true
    throw new Error(`BEEFY protocol not ready on port ${port}. Relayers cannot be launched.`);
  } catch (error) {
    logger.error(
      `❌ Failed to connect to DataHaven node on port ${port} for BEEFY check: ${error}`
    );
    if (client) {
      await client.destroy(); // Ensure client is destroyed on outer catch too
    }
    throw new Error(`BEEFY protocol not ready on port ${port}. Relayers cannot be launched.`);
  }
};
