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
  getPortFromKurtosis,
  killExistingContainers,
  logger,
  parseDeploymentsFile,
  parseRelayConfig,
  runShellCommandWithLogger,
  SUBSTRATE_FUNDED_ACCOUNTS,
  waitForContainerToStart
} from "utils";
import type { BeaconCheckpoint, FinalityCheckpointsResponse } from "utils/types";
import { parseJsonToBeaconCheckpoint } from "utils/types";
import { waitFor } from "utils/waits";
import type { LaunchedNetwork } from "./types/launchedNetwork";
import { ZERO_HASH } from "./utils/constants";

// Type definitions
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
  ethElRpcEndpoint: string;
  ethClEndpoint: string;
  substrateWsEndpoint: string;
  gatewayAddress: string;
};

export type SolochainConfig = {
  type: "solochain";
  ethElRpcEndpoint: string;
  substrateWsEndpoint: string;
  beefyClientAddress: string;
  gatewayAddress: string;
  rewardsRegistryAddress: string;
  ethClEndpoint: string;
};

export type RelayerConfigType = BeaconConfig | BeefyConfig | ExecutionConfig | SolochainConfig;

export type RelayerSpec = {
  name: string;
  configFilePath: string;
  templateFilePath?: string;
  config: RelayerConfigType;
  pk: { ethereum?: string; substrate?: string };
};

// Constants
export const INITIAL_CHECKPOINT_DIR = "tmp/beacon-checkpoint";
export const getInitialCheckpointFile = (networkId: string) =>
  `dump-initial-checkpoint-${networkId}.json`;
export const getInitialCheckpointPath = (networkId: string) =>
  path.join(INITIAL_CHECKPOINT_DIR, getInitialCheckpointFile(networkId));

/**
 * Configuration options for launching Snowbridge relayers.
 */
export interface RelayersOptions {
  networkId: string;
  relayerImageTag: string;
  kurtosisEnclaveName: string;
}

/**
 * Configuration paths for different relayer types.
 */
export const RELAYER_CONFIG_DIR = "tmp/configs";
export const RELAYER_CONFIG_PATHS = {
  BEACON: path.join(RELAYER_CONFIG_DIR, "beacon-relay.json"),
  BEEFY: path.join(RELAYER_CONFIG_DIR, "beefy-relay.json"),
  EXECUTION: path.join(RELAYER_CONFIG_DIR, "execution-relay.json"),
  SOLOCHAIN: path.join(RELAYER_CONFIG_DIR, "solochain-relay.json")
};

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
      const cfg = parseRelayConfig(json, type);
      cfg.source.ethereum.endpoint = config.ethElRpcEndpoint;
      cfg.source.beacon.endpoint = config.ethClEndpoint;
      cfg.source.beacon.stateEndpoint = config.ethClEndpoint;
      cfg.source.beacon.datastore.location = "/data";
      cfg.sink.parachain.endpoint = config.substrateWsEndpoint;
      cfg.source.contracts.Gateway = config.gatewayAddress;

      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated execution config written to ${outputFilePath}`);
      break;
    }
    case "solochain": {
      const cfg = parseRelayConfig(json, type);
      cfg.source.ethereum.endpoint = config.ethElRpcEndpoint;
      cfg.source.solochain.endpoint = config.substrateWsEndpoint;
      cfg.source.contracts.BeefyClient = config.beefyClientAddress;
      cfg.source.contracts.Gateway = config.gatewayAddress;
      cfg.source.beacon.endpoint = config.ethClEndpoint;
      cfg.source.beacon.stateEndpoint = config.ethClEndpoint;
      cfg.source.beacon.datastore.location = "/data";
      cfg.sink.ethereum.endpoint = config.ethElRpcEndpoint;
      cfg.sink.contracts.Gateway = config.gatewayAddress;
      cfg["reward-address"] = config.rewardsRegistryAddress;

      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated solochain config written to ${outputFilePath}`);
      break;
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
 * @param datastorePath - The path to the datastore directory.
 * @param launchedNetwork - An instance of LaunchedNetwork to interact with the running network.
 * @throws If there's an error generating the beacon checkpoint or submitting it to Substrate.
 */
export const initEthClientPallet = async (
  networkId: string,
  beaconConfigHostPath: string,
  relayerImageTag: string,
  datastorePath: string,
  launchedNetwork: LaunchedNetwork
) => {
  logger.debug("Initialising eth client pallet");
  // Poll the beacon chain until it's ready every 10 seconds for 10 minutes
  await waitBeaconChainReady(launchedNetwork, 10000, 600000);

  const beaconConfigContainerPath = "/app/beacon-relay.json";
  const checkpointHostPath = path.resolve(getInitialCheckpointPath(networkId));
  const checkpointContainerPath = "/app/dump-initial-checkpoint.json"; // Hardcoded filename that generate-beacon-checkpoint expects

  logger.debug("Generating beacon checkpoint");
  // Pre-create the checkpoint file so that Docker doesn't interpret it as a directory
  await Bun.write(getInitialCheckpointPath(networkId), "");

  logger.debug(`Removing 'generate-beacon-checkpoint-${networkId}' container if it exists`);
  logger.debug(await $`docker rm -f generate-beacon-checkpoint-${networkId}`.text());

  // When running in Linux, `host.docker.internal` is not pre-defined when running in a container.
  // So we need to add the parameter `--add-host host.docker.internal:host-gateway` to the command.
  // In Mac this is not needed and could cause issues.
  const addHostParam =
    process.platform === "linux" ? "--add-host host.docker.internal:host-gateway" : "";

  // Opportunistic pull - pull the image from Docker Hub only if it's not a local image
  const isLocal = relayerImageTag.endsWith(":local");

  logger.debug("Generating beacon checkpoint");
  const datastoreHostPath = path.resolve(datastorePath);
  const command = `docker run \
      -v ${beaconConfigHostPath}:${beaconConfigContainerPath}:ro \
      -v ${checkpointHostPath}:${checkpointContainerPath} \
      -v ${datastoreHostPath}:/data \
      --name generate-beacon-checkpoint-${networkId} \
      --platform linux/amd64 \
      --workdir /app \
      ${addHostParam} \
      ${launchedNetwork.networkName ? `--network ${launchedNetwork.networkName}` : ""} \
      ${isLocal ? "" : "--pull always"} \
      ${relayerImageTag} \
      generate-beacon-checkpoint --config beacon-relay.json --export-json`;
  logger.debug(`Running command: ${command}`);
  logger.debug(await $`sh -c "${command}"`.text());

  // Load the checkpoint into a JSON object and clean it up
  const initialCheckpointFile = Bun.file(getInitialCheckpointPath(networkId));
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

/**
 * Launches Snowbridge relayers for cross-chain communication.
 *
 * This function sets up and launches all required Snowbridge relayers:
 * - BEEFY relayer: Handles BEEFY protocol messages
 * - Beacon relayer: Syncs Ethereum beacon chain state
 * - Execution relayer: Processes execution layer events
 * - Solochain relayer: Handles solochain-specific operations
 *
 * The function performs the following steps:
 * 1. Kills any existing relayer containers
 * 2. Waits for BEEFY protocol to be ready
 * 3. Retrieves contract addresses from deployments
 * 4. Creates configuration directories
 * 5. Generates relayer configurations
 * 6. Initializes the Ethereum client pallet
 * 7. Starts all relayer containers
 *
 * @param options - Configuration options for launching relayers
 * @param options.relayerImageTag - Docker image tag for the relayer containers
 * @param options.kurtosisEnclaveName - Name of the Kurtosis enclave for Ethereum services
 * @param launchedNetwork - The launched network instance containing connection details
 *
 * @throws {Error} If the relayer image tag is not provided
 * @throws {Error} If BEEFY protocol is not ready within timeout
 * @throws {Error} If required contract addresses are not found
 * @throws {Error} If Docker operations fail
 */
export const launchRelayers = async (
  options: RelayersOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  logger.info("🚀 Launching Snowbridge relayers...");

  const { relayerImageTag, kurtosisEnclaveName } = options;

  invariant(relayerImageTag, "❌ relayerImageTag is required");

  await killExistingContainers("snowbridge-");

  // Get DataHaven node port
  const dhNodes = launchedNetwork.containers.filter((container) =>
    container.name.includes("datahaven")
  );
  let substrateWsPort: number;
  let substrateWsInternalPort: number;
  let substrateNodeId: string;

  if (dhNodes.length === 0) {
    logger.warn(
      "⚠️ No DataHaven nodes found in launchedNetwork. Assuming DataHaven is running and defaulting to port 9944 for relayers."
    );
    substrateWsPort = 9944;
    substrateWsInternalPort = 9944;
    substrateNodeId = "default (assumed)";
  } else {
    const firstDhNode = dhNodes[0];
    substrateWsPort = firstDhNode.publicPorts.ws;
    substrateWsInternalPort = firstDhNode.internalPorts.ws;
    substrateNodeId = firstDhNode.name;
    logger.info(
      `🔌 Using DataHaven node ${substrateNodeId} on port ${substrateWsPort} for relayers and BEEFY check.`
    );
  }

  // Check if BEEFY is ready before proceeding
  await waitBeefyReady(launchedNetwork, 2000, 60000);

  const anvilDeployments = await parseDeploymentsFile();
  const beefyClientAddress = anvilDeployments.BeefyClient;
  const gatewayAddress = anvilDeployments.Gateway;
  const rewardsRegistryAddress = anvilDeployments.RewardsRegistry;
  invariant(beefyClientAddress, "❌ BeefyClient address not found in anvil.json");
  invariant(gatewayAddress, "❌ Gateway address not found in anvil.json");
  invariant(rewardsRegistryAddress, "❌ RewardsRegistry address not found in anvil.json");

  logger.debug(`Ensuring output directory exists: ${RELAYER_CONFIG_DIR}`);
  await $`mkdir -p ${RELAYER_CONFIG_DIR}`.quiet();

  const datastorePath = "tmp/datastore";
  logger.debug(`Ensuring datastore directory exists: ${datastorePath}`);
  await $`mkdir -p ${datastorePath}`.quiet();

  const ethWsPort = await getPortFromKurtosis("el-1-reth-lodestar", "ws", kurtosisEnclaveName);
  const ethHttpPort = await getPortFromKurtosis("cl-1-lodestar-reth", "http", kurtosisEnclaveName);

  const ethElRpcEndpoint = `ws://host.docker.internal:${ethWsPort}`;
  const ethClEndpoint = `http://host.docker.internal:${ethHttpPort}`;

  const substrateWsEndpoint = `ws://${substrateNodeId}:${substrateWsInternalPort}`;
  logger.info(`🔗 Substrate endpoint for relayers: ${substrateWsEndpoint}`);

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
        rewardsRegistryAddress,
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

  // Generate configurations for all relayers
  for (const relayerSpec of relayersToStart) {
    await generateRelayerConfig(relayerSpec, "local", RELAYER_CONFIG_DIR);
  }

  invariant(
    launchedNetwork.networkName,
    "❌ Docker network name not found in LaunchedNetwork instance"
  );

  // Initialize Ethereum client pallet
  await initEthClientPallet(
    options.networkId,
    path.resolve(RELAYER_CONFIG_PATHS.BEACON),
    relayerImageTag,
    datastorePath,
    launchedNetwork
  );

  // Launch all relayers
  await launchRelayerContainers(
    relayersToStart,
    relayerImageTag,
    launchedNetwork,
    options.networkId
  );

  logger.success("Snowbridge relayers launched successfully");
};

/**
 * Waits for the BEEFY protocol to be ready by polling its finalized head.
 *
 * @param launchedNetwork - An instance of LaunchedNetwork to get the node endpoint
 * @param pollIntervalMs - The interval in milliseconds to poll the BEEFY endpoint
 * @param timeoutMs - The total time in milliseconds to wait before timing out
 *
 * @throws {Error} If BEEFY is not ready within the timeout
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
 * Launches individual relayer containers.
 *
 * @param relayersToStart - Array of relayer specifications
 * @param relayerImageTag - Docker image tag for the relayers
 * @param launchedNetwork - The launched network instance
 * @param networkId - The network ID to suffix container names
 */
const launchRelayerContainers = async (
  relayersToStart: RelayerSpec[],
  relayerImageTag: string,
  launchedNetwork: LaunchedNetwork,
  networkId: string
): Promise<void> => {
  const isLocal = relayerImageTag.endsWith(":local");
  const networkName = launchedNetwork.networkName;
  invariant(networkName, "❌ Docker network name not found in LaunchedNetwork instance");

  for (const { configFilePath, name, config, pk } of relayersToStart) {
    try {
      const containerName = `snowbridge-${config.type}-relay-${networkId}`;
      logger.info(`🚀 Starting relayer ${containerName} ...`);

      const hostConfigFilePath = path.resolve(configFilePath);
      const containerConfigFilePath = `/${configFilePath}`;

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
        const hostDatastorePath = path.resolve("tmp/datastore");
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
        relayerImageTag,
        ...relayerCommandArgs
      ];

      logger.debug(`Running command: ${command.join(" ")}`);
      await runShellCommandWithLogger(command.join(" "), { logLevel: "debug" });

      launchedNetwork.addContainer(containerName);

      await waitForContainerToStart(containerName);

      logger.success(`Started relayer ${name} with process ${process.pid}`);
    } catch (e) {
      logger.error(`Error starting relayer ${name}`);
      logger.error(e);
    }
  }
};
