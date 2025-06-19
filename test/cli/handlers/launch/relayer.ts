import path from "node:path";
import { $ } from "bun";
import { createClient, type PolkadotClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import invariant from "tiny-invariant";
import {
  ANVIL_FUNDED_ACCOUNTS,
  confirmWithTimeout,
  getPortFromKurtosis,
  killExistingContainers,
  logger,
  parseDeploymentsFile,
  printDivider,
  printHeader,
  runShellCommandWithLogger,
  SUBSTRATE_FUNDED_ACCOUNTS,
  waitForContainerToStart
} from "utils";
import { waitFor } from "utils/waits";
import { initEthClientPallet } from "../../../launcher/relayers/init-pallet";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";
import { ZERO_HASH } from "../../../launcher/utils/constants";
import { generateRelayerConfig, type RelayerSpec } from "../common/relayer";
import type { LaunchOptions } from ".";

const RELAYER_CONFIG_DIR = "tmp/configs";
const RELAYER_CONFIG_PATHS = {
  BEACON: path.join(RELAYER_CONFIG_DIR, "beacon-relay.json"),
  BEEFY: path.join(RELAYER_CONFIG_DIR, "beefy-relay.json"),
  EXECUTION: path.join(RELAYER_CONFIG_DIR, "execution-relay.json"),
  SOLOCHAIN: path.join(RELAYER_CONFIG_DIR, "solochain-relay.json")
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

  const ethWsPort = await getPortFromKurtosis(
    "el-1-reth-lodestar",
    "ws",
    options.kurtosisEnclaveName
  );
  const ethHttpPort = await getPortFromKurtosis(
    "cl-1-lodestar-reth",
    "http",
    options.kurtosisEnclaveName
  );

  const ethElRpcEndpoint = `ws://host.docker.internal:${ethWsPort}`;
  const ethClEndpoint = `http://host.docker.internal:${ethHttpPort}`;
  const substrateWsEndpoint = `ws://${substrateNodeId}:${substrateWsPort}`;

  const relayersToStart: RelayerSpec[] = [
    {
      name: "relayer-🥩",
      configFilePath: RELAYER_CONFIG_PATHS.BEEFY,
      config: {
        type: "beefy",
        ethElRpcEndpoint,
        substrateWsEndpoint,
        beefyClientAddress,
        gatewayAddress
      },
      pk: {
        ethereum: ANVIL_FUNDED_ACCOUNTS[1].privateKey
      }
    },
    {
      name: "relayer-🥓",
      configFilePath: RELAYER_CONFIG_PATHS.BEACON,
      config: {
        type: "beacon",
        ethClEndpoint,
        substrateWsEndpoint
      },
      pk: {
        substrate: SUBSTRATE_FUNDED_ACCOUNTS.BALTATHAR.privateKey
      }
    },
    {
      name: "relayer-⛓️",
      configFilePath: RELAYER_CONFIG_PATHS.SOLOCHAIN,
      config: {
        type: "solochain",
        ethElRpcEndpoint,
        substrateWsEndpoint,
        beefyClientAddress,
        gatewayAddress,
        ethClEndpoint
      },
      pk: {
        ethereum: ANVIL_FUNDED_ACCOUNTS[1].privateKey,
        substrate: SUBSTRATE_FUNDED_ACCOUNTS.CHARLETH.privateKey
      }
    },
    {
      name: "relayer-⚙️",
      configFilePath: RELAYER_CONFIG_PATHS.EXECUTION,
      config: {
        type: "execution",
        ethElRpcEndpoint,
        ethClEndpoint,
        substrateWsEndpoint,
        gatewayAddress
      },
      pk: {
        substrate: SUBSTRATE_FUNDED_ACCOUNTS.DOROTHY.privateKey
      }
    }
  ];

  for (const relayerSpec of relayersToStart) {
    await generateRelayerConfig(relayerSpec, "local", RELAYER_CONFIG_DIR);
  }

  invariant(options.relayerImageTag, "❌ Relayer image tag not defined");
  invariant(
    launchedNetwork.networkName,
    "❌ Docker network name not found in LaunchedNetwork instance"
  );

  await initEthClientPallet(
    path.resolve(RELAYER_CONFIG_PATHS.BEACON),
    options.relayerImageTag,
    datastorePath,
    launchedNetwork
  );

  // Opportunistic pull - pull the image from Docker Hub only if it's not a local image
  const isLocal = options.relayerImageTag.endsWith(":local");

  for (const { configFilePath, name, config, pk } of relayersToStart) {
    try {
      const containerName = `snowbridge-${config.type}-relay`;
      logger.info(`🚀 Starting relayer ${containerName} ...`);

      const hostConfigFilePath = path.resolve(configFilePath);
      const containerConfigFilePath = `/${configFilePath}`;
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
        networkName,
        ...(isLocal ? [] : ["--pull", "always"])
      ];

      const volumeMounts: string[] = ["-v", `${hostConfigFilePath}:${containerConfigFilePath}`];

      if (config.type === "beacon" || config.type === "execution") {
        const hostDatastorePath = path.resolve(datastorePath);
        const containerDatastorePath = "/data";
        volumeMounts.push("-v", `${hostDatastorePath}:${containerDatastorePath}`);
      }

      const relayerCommandArgs: string[] = ["run", config.type, "--config", configFilePath];

      switch (config.type) {
        case "beacon":
          invariant(pk.substrate, "❌ Substrate private key is required for beacon relayer");
          relayerCommandArgs.push("--substrate.private-key", pk.substrate);
          break;
        case "beefy":
          invariant(pk.ethereum, "❌ Ethereum private key is required for beefy relayer");
          relayerCommandArgs.push("--ethereum.private-key", pk.ethereum);
          break;
        case "solochain":
          invariant(pk.ethereum, "❌ Ethereum private key is required for solochain relayer");
          relayerCommandArgs.push("--ethereum.private-key", pk.ethereum);
          if (pk.substrate) {
            relayerCommandArgs.push("--substrate.private-key", pk.substrate);
          } else {
            logger.warn(
              "⚠️ No substrate private key provided for solochain relayer. This might be an issue depending on the configuration."
            );
          }
          break;
        case "execution":
          invariant(pk.substrate, "❌ Substrate private key is required for execution relayer");
          relayerCommandArgs.push("--substrate.private-key", pk.substrate);
          break;
      }

      const command: string[] = [
        ...commandBase,
        ...volumeMounts,
        options.relayerImageTag,
        ...relayerCommandArgs
      ];

      logger.debug(`Running command: ${command.join(" ")}`);
      await runShellCommandWithLogger(command.join(" "), { logLevel: "debug" });

      launchedNetwork.addContainer(containerName, { ws: 0, rpc: 0 });

      await waitForContainerToStart(containerName);

      // TODO: Re-enable when we know what we want to tail for
      // await waitForLog({
      //   searchString: "<LOG LINE TO WAIT FOR>",
      //   containerName,
      //   timeoutSeconds: 30,
      //   tail: 1
      // });

      logger.success(`Started relayer ${name} with process ${process.pid}`);
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
