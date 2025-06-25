import { secp256k1 } from "@noble/curves/secp256k1";
import { $ } from "bun";
import { createClient, type PolkadotClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { cargoCrossbuild } from "scripts/cargo-crossbuild";
import invariant from "tiny-invariant";
import {
  createPapiConnectors,
  killExistingContainers,
  logger,
  waitForContainerToStart
} from "utils";
import { waitFor } from "utils/waits";
import { type Hex, keccak256, toHex } from "viem";
import { publicKeyToAddress } from "viem/accounts";
import type { LaunchedNetwork } from "./types/launchedNetwork";

/**
 * Options for DataHaven-related operations.
 */
export interface DataHavenOptions {
  networkId: string;
  datahavenImageTag: string;
  relayerImageTag: string;
  buildDatahaven: boolean;
  authorityIds: readonly string[];
  datahavenBuildExtraArgs?: string;
}

const DEFAULT_PUBLIC_WS_PORT = 9944;

/**
 * Launches a local DataHaven solochain network for testing.
 *
 * This function handles the complete setup of a local DataHaven test network including:
 * - Building the local Docker image if requested
 * - Verifying the Docker image exists
 * - Creating a Docker network for node communication
 * - Starting authority nodes based on the provided authority IDs
 * - Waiting for nodes to become ready
 * - Registering nodes in the launched network
 * - Setting up validator configuration with BEEFY authorities
 *
 * @param options - Configuration options for launching the network
 * @param options.networkId - The network ID to use for the docker network name (will be `datahaven-${networkId}`)
 * @param options.datahavenImageTag - Docker image tag for DataHaven nodes
 * @param options.relayerImageTag - Docker image tag for relayer nodes
 * @param options.buildDatahaven - Whether to build the local Docker image before launching
 * @param options.authorityIds - Array of authority IDs to launch (e.g., ["alice", "bob"])
 * @param options.datahavenBuildExtraArgs - Extra arguments for building DataHaven (e.g., "--features=fast-runtime")
 * @param launchedNetwork - The launched network instance to track the network's state
 *
 * @throws {Error} If the DataHaven image tag is not provided
 * @throws {Error} If the network fails to start within the timeout period
 * @throws {Error} If container startup fails for any node
 * @throws {Error} If the Docker image cannot be found locally or on Docker Hub
 */
export const launchLocalDataHavenSolochain = async (
  options: DataHavenOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  logger.info("🚀 Launching DataHaven network...");

  invariant(options.datahavenImageTag, "❌ DataHaven image tag not defined");

  if (options.buildDatahaven) {
    await buildLocalImage(options);
  }
  await checkTagExists(options.datahavenImageTag);

  const COMMON_LAUNCH_ARGS = [
    "--unsafe-force-node-key-generation",
    "--tmp",
    "--validator",
    "--discover-local",
    "--no-prometheus",
    "--unsafe-rpc-external",
    "--rpc-cors=all",
    "--force-authoring",
    "--no-telemetry",
    "--enable-offchain-indexing=true"
  ];

  // Create a unique Docker network name using the network ID
  const dockerNetworkName = `datahaven-${options.networkId}`;

  logger.info(`⛓️‍💥 Creating Docker network: ${dockerNetworkName}`);
  logger.debug(await $`docker network rm ${dockerNetworkName} -f`.text());
  logger.debug(await $`docker network create ${dockerNetworkName}`.text());
  launchedNetwork.networkName = dockerNetworkName;

  logger.success(`DataHaven nodes will use Docker network: ${dockerNetworkName}`);

  for (const id of options.authorityIds) {
    logger.info(`🚀 Starting ${id}...`);
    const containerName = `datahaven-${id}-${options.networkId}`;

    const command: string[] = [
      "docker",
      "run",
      "-d",
      "--name",
      containerName,
      "--network",
      dockerNetworkName,
      ...(id === "alice" ? ["-p", `${DEFAULT_PUBLIC_WS_PORT}:9944`] : []),
      options.datahavenImageTag,
      `--${id}`,
      ...COMMON_LAUNCH_ARGS
    ];

    logger.debug(await $`sh -c "${command.join(" ")}"`.text());

    await waitForContainerToStart(containerName);

    // TODO: Un-comment this when it doesn't stop process from hanging
    // This is working on SH, but not here so probably a Bun defect
    //
    // const listeningLine = await waitForLog({
    //   search: "Running JSON-RPC server: addr=0.0.0.0:",
    //   containerName,
    //   timeoutSeconds: 30
    // });
    // logger.debug(listeningLine);
  }

  logger.info("⌛️ Waiting for DataHaven to start...");
  const timeoutMs = 2000; // 2 second timeout
  await waitFor({
    lambda: async () => {
      const isReady = await isNetworkReady(DEFAULT_PUBLIC_WS_PORT, timeoutMs);
      if (!isReady) {
        logger.debug("Node not ready, waiting 1 second...");
      }
      return isReady;
    },
    iterations: 30,
    delay: timeoutMs,
    errorMessage: "DataHaven network not ready"
  });

  logger.success(
    `DataHaven network started, primary node accessible on port ${DEFAULT_PUBLIC_WS_PORT}`
  );

  await registerNodes(launchedNetwork);

  await setupDataHavenValidatorConfig(launchedNetwork, "datahaven-");
};

/**
 * Checks if the DataHaven network is ready by connecting via WebSocket and calling the system_chain RPC method.
 *
 * This function suppresses console errors during connection attempts to avoid noise in the logs.
 * It uses the Polkadot API to connect to the node and verify it's responding to RPC calls.
 *
 * @param port - The port number to check for WebSocket connectivity
 * @param timeoutMs - The timeout in milliseconds for the RPC call
 * @returns True if the network is ready and responding, false otherwise
 */
export const isNetworkReady = async (port: number, timeoutMs: number): Promise<boolean> => {
  const wsUrl = `ws://127.0.0.1:${port}`;
  let client: PolkadotClient | undefined;

  // Temporarily capture and suppress error logs during connection attempts.
  // This is to avoid the "Unable to connect to ws:" error logs from the `client._request` call.
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    // Use withPolkadotSdkCompat for consistency, though _request might not strictly need it.
    client = createClient(withPolkadotSdkCompat(getWsProvider(wsUrl)));

    // Add timeout to the RPC call to prevent hanging.
    const chainNamePromise = client._request<string>("system_chain", []);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("RPC call timeout")), timeoutMs);
    });

    const chainName = await Promise.race([chainNamePromise, timeoutPromise]);
    logger.debug(`isNetworkReady PAPI check successful for port ${port}, chain: ${chainName}`);
    client.destroy();
    return !!chainName; // Ensure it's a boolean and chainName is truthy
  } catch (error) {
    logger.debug(`isNetworkReady PAPI check failed for port ${port}: ${error}`);
    if (client) {
      client.destroy();
    }
    return false;
  } finally {
    // Restore original console methods.
    console.error = originalConsoleError;
  }
};

/**
 * Converts a compressed secp256k1 public key to an Ethereum address.
 *
 * This function takes a compressed public key (33 bytes), decompresses it to get the full
 * uncompressed public key (64 bytes of x and y coordinates), and then derives the
 * corresponding Ethereum address using the standard Ethereum address derivation algorithm.
 *
 * @param compressedPubKey - The compressed public key as a hex string (with or without "0x" prefix)
 * @returns The corresponding Ethereum address (checksummed, with "0x" prefix)
 *
 * @throws {Error} If the provided public key is invalid or cannot be decompressed
 */
export const compressedPubKeyToEthereumAddress = (compressedPubKey: string): string => {
  // Ensure the input is a hex string and remove "0x" prefix
  const compressedKeyHex = compressedPubKey.startsWith("0x")
    ? compressedPubKey.substring(2)
    : compressedPubKey;

  // Decompress the public key
  const point = secp256k1.ProjectivePoint.fromHex(compressedKeyHex);
  // toRawBytes(false) returns the uncompressed key (64 bytes, x and y coordinates)
  const uncompressedPubKeyBytes = point.toRawBytes(false);
  const uncompressedPubKeyHex = toHex(uncompressedPubKeyBytes); // Prefixes with "0x"

  // Compute the Ethereum address from the uncompressed public key
  // publicKeyToAddress expects a 0x-prefixed hex string representing the 64-byte uncompressed public key
  const address = publicKeyToAddress(uncompressedPubKeyHex);
  return address;
};

/**
 * Prepares the configuration for DataHaven authorities by fetching their BEEFY public keys,
 * converting them to Ethereum addresses, and updating the network configuration file.
 *
 * This function performs the following steps:
 * 1. Connects to the first available DataHaven node matching the container prefix
 * 2. Fetches the BEEFY NextAuthorities from the node's runtime
 * 3. Converts each compressed public key to an Ethereum address
 * 4. Computes the keccak256 hash of each address (authority hash)
 * 5. Updates the network configuration file with the authority hashes
 *
 * The configuration is saved to `../contracts/config/{NETWORK}.json` where NETWORK
 * defaults to "anvil" if not specified in environment variables.
 *
 * @param launchedNetwork - The launched network instance containing container information
 * @param containerNamePrefix - The prefix to filter DataHaven containers by (e.g., "datahaven-", "dh-validator-")
 *
 * @throws {Error} If no DataHaven nodes are found in the launched network
 * @throws {Error} If BEEFY authorities cannot be fetched from the node
 * @throws {Error} If public key conversion fails
 * @throws {Error} If the configuration file cannot be read or written
 */
export const setupDataHavenValidatorConfig = async (
  launchedNetwork: LaunchedNetwork,
  containerNamePrefix: string
): Promise<void> => {
  const networkName = process.env.NETWORK || "anvil";
  logger.info(`🔧 Preparing DataHaven authorities configuration for network: ${networkName}...`);

  let authorityPublicKeys: string[] = [];
  const dhNodes = launchedNetwork.containers.filter((x) => x.name.startsWith(containerNamePrefix));

  invariant(dhNodes.length > 0, "No DataHaven nodes found in launchedNetwork");

  const firstNode = dhNodes[0];
  const wsUrl = `ws://127.0.0.1:${firstNode.publicPorts.ws}`;
  const { client: papiClient, typedApi: dhApi } = createPapiConnectors(wsUrl);

  logger.info(
    `📡 Attempting to fetch BEEFY next authorities from node ${firstNode.name} (port ${firstNode.publicPorts.ws})...`
  );

  // Fetch NextAuthorities
  // Beefy.NextAuthorities returns a fixed-length array of bytes representing the authority public keys
  const nextAuthoritiesRaw = await dhApi.query.Beefy.NextAuthorities.getValue({
    at: "best"
  });

  invariant(nextAuthoritiesRaw && nextAuthoritiesRaw.length > 0, "No BEEFY next authorities found");

  authorityPublicKeys = nextAuthoritiesRaw.map((key) => key.asHex()); // .asHex() returns the hex string representation of the corresponding key
  logger.success(
    `Successfully fetched ${authorityPublicKeys.length} BEEFY next authorities directly.`
  );

  // Clean up PAPI client, otherwise it will hang around and prevent this process from exiting.
  papiClient.destroy();

  const authorityHashes: string[] = [];
  for (const compressedKey of authorityPublicKeys) {
    try {
      const ethAddress = compressedPubKeyToEthereumAddress(compressedKey);
      const authorityHash = keccak256(ethAddress as Hex);
      authorityHashes.push(authorityHash);
      logger.debug(
        `Processed public key ${compressedKey} -> ETH address ${ethAddress} -> Authority hash ${authorityHash}`
      );
    } catch (error) {
      logger.error(`❌ Failed to process public key ${compressedKey}: ${error}`);
      throw new Error(`Failed to process public key ${compressedKey}`);
    }
  }

  // process.cwd() is 'test/', so config is at '../contracts/config'
  const configDir = `${process.cwd()}/../contracts/config`;
  const configFilePath = `${configDir}/${networkName}.json`;

  try {
    const configFile = Bun.file(configFilePath);
    if (!(await configFile.exists())) {
      logger.warn(
        `⚠️ Configuration file ${configFilePath} not found. Skipping update of validator sets.`
      );
      // Optionally, create a default structure if it makes sense, or simply return.
      // For now, if the base network config doesn't exist, we can't update it.
      return;
    }

    const configFileContent = await configFile.text();
    const configJson = JSON.parse(configFileContent);

    if (!configJson.snowbridge) {
      logger.warn(`⚠️ "snowbridge" section not found in ${configFilePath}, creating it.`);
      configJson.snowbridge = {};
    }

    configJson.snowbridge.initialValidators = authorityHashes;
    configJson.snowbridge.nextValidators = authorityHashes;

    await Bun.write(configFilePath, JSON.stringify(configJson, null, 2));
    logger.success(`DataHaven authority hashes updated in: ${configFilePath}`);
  } catch (error) {
    logger.error(`❌ Failed to read or update ${configFilePath}: ${error}`);
    throw new Error(`Failed to update authority hashes in ${configFilePath}.`);
  }
};

/**
 * Checks if any DataHaven containers are currently running.
 *
 * @returns True if any DataHaven containers are running, false otherwise.
 */
export const checkDataHavenRunning = async (): Promise<boolean> => {
  // Check for any container whose name starts with "datahaven-"
  const containerIds = await $`docker ps --format "{{.Names}}" --filter "name=^datahaven-"`.text();
  // Check for any Docker network that starts with "datahaven-"
  const networkOutput =
    await $`docker network ls --filter "name=^datahaven-" --format "{{.Name}}"`.text();

  // Check if containerIds has any actual IDs (not just whitespace)
  const containersExist = containerIds.trim().length > 0;
  if (containersExist) {
    logger.info(`ℹ️ DataHaven containers already running: \n${containerIds}`);
  }

  // Check if networkOutput has any network names (not just whitespace or empty lines)
  const networksExist =
    networkOutput
      .trim()
      .split("\n")
      .filter((line) => line.trim().length > 0).length > 0;
  if (networksExist) {
    logger.info(`ℹ️ DataHaven network already running: ${networkOutput}`);
  }

  return containersExist || networksExist;
};

/**
 * Stops and removes all DataHaven containers and the associated Docker network.
 *
 * This function:
 * - Kills all containers using the specified DataHaven image tag
 * - Optionally kills relayer containers if a relayer image tag is provided
 * - Removes the DataHaven Docker network
 * - Verifies that all containers and networks have been successfully removed
 *
 * @param datahavenImageTag - The Docker image tag for DataHaven nodes to remove (required)
 * @param relayerImageTag - The Docker image tag for relayer nodes to remove (optional)
 *
 * @throws {Error} If the DataHaven image tag is not provided
 * @throws {Error} If containers or networks were not successfully removed
 */
export const cleanDataHavenContainers = async (
  networkId: string,
  datahavenImageTag: string,
  relayerImageTag?: string
): Promise<void> => {
  logger.info("🧹 Stopping and removing existing DataHaven containers...");

  invariant(datahavenImageTag, "❌ DataHaven image tag not defined");
  await killExistingContainers(datahavenImageTag);

  if (relayerImageTag) {
    logger.info(
      "🧹 Stopping and removing existing relayer containers (relayers depend on DataHaven nodes)..."
    );
    await killExistingContainers(relayerImageTag);
  }

  logger.info("✅ Existing DataHaven containers stopped and removed.");

  logger.debug(await $`docker network rm -f datahaven-${networkId}`.text());
  logger.info("✅ DataHaven Docker network removed.");

  invariant(
    (await checkDataHavenRunning()) === false,
    "❌ DataHaven containers were not stopped and removed"
  );
};

/**
 * Builds a local Docker image for DataHaven.
 *
 * This function:
 * - Runs cargo crossbuild with the specified build arguments
 * - Builds the Docker image using the 'bun build:docker:operator' command
 * - Logs progress at trace level for debugging
 *
 * @param options - Configuration options for building the image
 * @param options.datahavenBuildExtraArgs - Extra arguments to pass to cargo crossbuild (e.g., "--features=fast-runtime")
 */
export const buildLocalImage = async (options: DataHavenOptions) => {
  await cargoCrossbuild({
    datahavenBuildExtraArgs: options.datahavenBuildExtraArgs
  });

  logger.info("🐳 Building DataHaven node local Docker image...");
  logger.trace(await $`bun build:docker:operator`.text());
  logger.success("DataHaven node local Docker image build completed successfully");
};

/**
 * Checks if a Docker image exists locally or on Docker Hub.
 *
 * @param tag - The tag of the image to check.
 * @returns A promise that resolves when the image is found.
 * @throws {Error} If the image is not found locally or on Docker Hub.
 */
export const checkTagExists = async (tag: string) => {
  const cleaned = tag.trim();
  logger.debug(`Checking if image  ${cleaned} is available locally`);
  const { exitCode: localExists } = await $`docker image inspect ${cleaned}`.nothrow().quiet();

  if (localExists !== 0) {
    logger.debug(`Checking if image ${cleaned} is available on docker hub`);
    const result = await $`docker manifest inspect ${cleaned}`.nothrow().quiet();
    invariant(
      result.exitCode === 0,
      `❌ Image ${tag} not found.\n Does this image exist?\n Are you logged and have access to the repository?`
    );
  }

  logger.success(`Image ${tag} found locally`);
};

/**
 * Registers the primary DataHaven node (alice) in the launched network.
 *
 * This function:
 * - Sets the Docker network name in the launched network configuration
 * - Checks if the 'datahaven-alice' container is running
 * - If running, registers it with the default WebSocket port (9944)
 * - If not running, logs a warning and returns without error
 *
 * Note: Only the alice node is registered as it's the primary node exposed on the default port.
 * Other nodes can be accessed via the Docker network but aren't directly exposed.
 *
 * @param launchedNetwork - The launched network instance to register nodes in
 */
export const registerNodes = async (launchedNetwork: LaunchedNetwork) => {
  const targetContainerName = "datahaven-alice";
  const aliceHostWsPort = DEFAULT_PUBLIC_WS_PORT; // Standard host port for Alice's WS, as set during launch.

  logger.debug(`Checking Docker status for container: ${targetContainerName}`);
  // Use ^ and $ for an exact name match in the filter.
  const dockerPsOutput = await $`docker ps -q --filter "name=^${targetContainerName}"`.text();
  const isContainerRunning = dockerPsOutput.trim().length > 0;

  if (!isContainerRunning) {
    // If the target Docker container is not running, we cannot register it.
    logger.warn(`⚠️ Docker container ${targetContainerName} is not running. Cannot register node.`);
    return;
  }

  // If the Docker container is running, proceed to register it in launchedNetwork.
  // We use the standard host WS port that "datahaven-alice" is expected to use.
  logger.debug(
    `Docker container ${targetContainerName} is running. Registering with WS port ${aliceHostWsPort}.`
  );
  launchedNetwork.addContainer(targetContainerName, { ws: aliceHostWsPort });
  logger.info(`📝 Node ${targetContainerName} successfully registered in launchedNetwork.`);
};
