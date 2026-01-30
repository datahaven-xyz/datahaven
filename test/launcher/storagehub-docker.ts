import { $ } from "bun";
import { getPublicPort, killExistingContainers, logger, waitForContainerToStart } from "utils";
import { DEFAULT_SUBSTRATE_WS_PORT } from "utils/constants";
import { waitFor } from "utils/waits";
import type { DataHavenOptions } from "./datahaven";
import { isNetworkReady } from "./datahaven";
import type { LaunchedNetwork } from "./types/launchedNetwork";

/**
 * PostgreSQL configuration for StorageHub Indexer and Fisherman
 */
const POSTGRES_CONFIG = {
  username: "indexer",
  password: "indexer",
  database: "datahaven",
  port: 5432
} as const;

/**
 * Launches a PostgreSQL database container for StorageHub Indexer and Fisherman nodes.
 *
 * This database is used by both the Indexer and Fisherman nodes to store indexed chain data
 * and fisherman-specific information.
 *
 * @param options - Configuration options for launching the network
 * @param launchedNetwork - The launched network instance to track the database
 */
export const launchStorageHubPostgres = async (
  options: DataHavenOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  logger.info("🗄️  Launching StorageHub PostgreSQL database...");

  const containerName = `storagehub-postgres-${options.networkId}`;
  const dockerNetworkName = `datahaven-${options.networkId}`;

  // Check if container already exists
  const existingContainer = await $`docker ps -a -q --filter name=^${containerName}$`
    .nothrow()
    .quiet()
    .text();

  if (existingContainer.trim()) {
    logger.info(`📦 PostgreSQL container ${containerName} already exists, removing...`);
    await $`docker rm -f ${containerName}`.nothrow().quiet();
  }

  const command: string[] = [
    "docker",
    "run",
    "-d",
    "--name",
    containerName,
    "--network",
    dockerNetworkName,
    "-e",
    `POSTGRES_USER=${POSTGRES_CONFIG.username}`,
    "-e",
    `POSTGRES_PASSWORD=${POSTGRES_CONFIG.password}`,
    "-e",
    `POSTGRES_DB=${POSTGRES_CONFIG.database}`,
    "-p",
    `${POSTGRES_CONFIG.port}`, // Expose port, Docker assigns random external port
    "postgres:16"
  ];

  logger.debug(`Executing: ${command.join(" ")}`);
  await $`sh -c "${command.join(" ")}"`.nothrow();

  await waitForContainerToStart(containerName);

  // Wait for PostgreSQL to be ready
  logger.info("⌛️ Waiting for PostgreSQL to be ready...");
  await waitFor({
    lambda: async () => {
      const result = await $`docker exec ${containerName} pg_isready -U ${POSTGRES_CONFIG.username}`
        .nothrow()
        .quiet();
      return result.exitCode === 0;
    },
    iterations: 30,
    delay: 1000,
    errorMessage: "PostgreSQL not ready"
  });

  // Register in launched network
  const publicPort = await getPublicPort(containerName, POSTGRES_CONFIG.port);
  launchedNetwork.addContainer(
    containerName,
    { postgres: publicPort },
    { postgres: POSTGRES_CONFIG.port }
  );

  logger.success(`PostgreSQL database started on port ${publicPort}`);
};

/**
 * Gets the PostgreSQL connection URL for StorageHub nodes.
 *
 * @param networkId - The network ID to construct the connection string
 * @returns PostgreSQL connection URL
 */
export const getPostgresUrl = (networkId: string): string => {
  const containerName = `storagehub-postgres-${networkId}`;
  return `postgresql://${POSTGRES_CONFIG.username}:${POSTGRES_CONFIG.password}@${containerName}:${POSTGRES_CONFIG.port}/${POSTGRES_CONFIG.database}`;
};

/**
 * Injects a BCSV ECDSA key into a StorageHub provider node's keystore.
 *
 * @param containerName - Name of the Docker container
 * @param seed - The seed phrase for key generation
 * @param derivation - Key derivation path (e.g., "//Charlie")
 */
export const injectStorageHubKey = async (
  containerName: string,
  seed: string,
  derivation: string
): Promise<void> => {
  logger.info(`🔑 Injecting key ${derivation} into ${containerName}...`);

  const suri = `${seed}${derivation}`;

  // Use Bun's $ directly with docker exec (no sh -c wrapper needed)
  // This properly handles the spaces in the seed phrase
  try {
    await $`docker exec ${containerName} datahaven-node key insert --chain dev --key-type bcsv --scheme ecdsa --suri ${suri}`.nothrow();
    logger.success(`Key ${derivation} injected successfully`);
  } catch (error) {
    logger.error(`Failed to inject key ${derivation}: ${error}`);
    throw error;
  }
};

/**
 * Gets the bootnode address from a running validator node.
 *
 * For local development with Docker, nodes on the same network can discover each other
 * via mDNS (--discover-local flag), so explicit bootnodes are optional.
 *
 * To use explicit bootnodes, we'd need to extract the peer ID from the validator node,
 * which requires querying the RPC endpoint. For simplicity in local dev, we skip this.
 *
 * @param containerName - Name of the validator container (e.g., datahaven-alice-cli-launch)
 * @returns Multiaddress string for bootnode, or empty string to skip bootnodes
 */
export const getBootnodeAddress = async (containerName: string): Promise<string> => {
  // For local Docker development, nodes discover each other via mDNS
  // No explicit bootnode needed with --discover-local flag
  logger.debug(`Skipping explicit bootnode for ${containerName} - using mDNS discovery`);
  return "";
};

/**
 * Launches a StorageHub MSP (Main Storage Provider) node.
 *
 * @param options - Configuration options for launching the network
 * @param launchedNetwork - The launched network instance to track the node
 */
export const launchMspNode = async (
  options: DataHavenOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  logger.info("🚀 Launching StorageHub MSP node...");

  const containerName = `storagehub-msp-${options.networkId}`;
  const dockerNetworkName = `datahaven-${options.networkId}`;
  const wsPort = 9945; // External port for MSP node
  const aliceContainer = `datahaven-alice-${options.networkId}`;

  // Get bootnode address (empty for local dev with mDNS discovery)
  const bootnodeAddr = await getBootnodeAddress(aliceContainer);

  const command: string[] = [
    "docker",
    "run",
    "-d",
    "--name",
    containerName,
    "--network",
    dockerNetworkName,
    "-p",
    `${wsPort}:${DEFAULT_SUBSTRATE_WS_PORT}`,
    options.datahavenImageTag,
    "--chain",
    "dev",
    "--name",
    "msp-charlie",
    "--rpc-port",
    `${DEFAULT_SUBSTRATE_WS_PORT}`,
    "--rpc-external",
    "--rpc-cors",
    "all",
    "--rpc-methods",
    "Unsafe",
    "--allow-private-ipv4",
    "--discover-local",
    "--network-backend",
    "libp2p",
    "--provider",
    "--provider-type",
    "msp",
    "--msp-charging-period",
    "100",
    "--max-storage-capacity",
    "10737418240", // 10 GiB
    "--jump-capacity",
    "1073741824" // 1 GiB
  ];

  // Only add bootnodes if we have a valid address
  if (bootnodeAddr) {
    command.push("--bootnodes", bootnodeAddr);
  }

  logger.debug(`Executing: ${command.join(" ")}`);
  await $`sh -c "${command.join(" ")}"`.nothrow();

  await waitForContainerToStart(containerName);

  // Inject key
  const seed = "bottom drive obey lake curtain smoke basket hold race lonely fit walk";
  await injectStorageHubKey(containerName, seed, "//Charlie");

  // Restart container to load key
  logger.info("🔄 Restarting MSP node to load key...");
  await $`docker restart ${containerName}`.nothrow();
  await waitForContainerToStart(containerName);

  // Wait for node to be ready
  logger.info("⌛️ Waiting for MSP node to be ready...");
  await waitFor({
    lambda: async () => {
      const ready = await isNetworkReady(wsPort, 2000);
      if (!ready) {
        logger.debug("MSP node not ready, waiting...");
      }
      return ready;
    },
    iterations: 30,
    delay: 2000,
    errorMessage: "MSP node not ready"
  });

  // Register in launched network
  launchedNetwork.addContainer(containerName, { ws: wsPort }, { ws: DEFAULT_SUBSTRATE_WS_PORT });

  logger.success(`MSP node started on port ${wsPort}`);
};

/**
 * Launches a StorageHub BSP (Backup Storage Provider) node.
 *
 * @param options - Configuration options for launching the network
 * @param launchedNetwork - The launched network instance to track the node
 */
export const launchBspNode = async (
  options: DataHavenOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  logger.info("🚀 Launching StorageHub BSP node...");

  const containerName = `storagehub-bsp-${options.networkId}`;
  const dockerNetworkName = `datahaven-${options.networkId}`;
  const wsPort = 9946; // External port for BSP node
  const aliceContainer = `datahaven-alice-${options.networkId}`;

  // Get bootnode address (empty for local dev with mDNS discovery)
  const bootnodeAddr = await getBootnodeAddress(aliceContainer);

  const command: string[] = [
    "docker",
    "run",
    "-d",
    "--name",
    containerName,
    "--network",
    dockerNetworkName,
    "-p",
    `${wsPort}:${DEFAULT_SUBSTRATE_WS_PORT}`,
    options.datahavenImageTag,
    "--chain",
    "dev",
    "--name",
    "bsp-dave",
    "--rpc-port",
    `${DEFAULT_SUBSTRATE_WS_PORT}`,
    "--rpc-external",
    "--rpc-cors",
    "all",
    "--rpc-methods",
    "Unsafe",
    "--allow-private-ipv4",
    "--discover-local",
    "--network-backend",
    "libp2p",
    "--provider",
    "--provider-type",
    "bsp",
    "--max-storage-capacity",
    "10737418240", // 10 GiB
    "--jump-capacity",
    "1073741824" // 1 GiB
  ];

  // Only add bootnodes if we have a valid address
  if (bootnodeAddr) {
    command.push("--bootnodes", bootnodeAddr);
  }

  logger.debug(`Executing: ${command.join(" ")}`);
  await $`sh -c "${command.join(" ")}"`.nothrow();

  await waitForContainerToStart(containerName);

  // Inject key (using Dave instead of Eve for BSP)
  const seed = "bottom drive obey lake curtain smoke basket hold race lonely fit walk";
  await injectStorageHubKey(containerName, seed, "//Dave");

  // Restart container to load key
  logger.info("🔄 Restarting BSP node to load key...");
  await $`docker restart ${containerName}`.nothrow();
  await waitForContainerToStart(containerName);

  // Wait for node to be ready
  logger.info("⌛️ Waiting for BSP node to be ready...");
  await waitFor({
    lambda: async () => {
      const ready = await isNetworkReady(wsPort, 2000);
      if (!ready) {
        logger.debug("BSP node not ready, waiting...");
      }
      return ready;
    },
    iterations: 30,
    delay: 2000,
    errorMessage: "BSP node not ready"
  });

  // Register in launched network
  launchedNetwork.addContainer(containerName, { ws: wsPort }, { ws: DEFAULT_SUBSTRATE_WS_PORT });

  logger.success(`BSP node started on port ${wsPort}`);
};

/**
 * Launches a StorageHub Indexer node.
 *
 * @param options - Configuration options for launching the network
 * @param launchedNetwork - The launched network instance to track the node
 */
export const launchIndexerNode = async (
  options: DataHavenOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  logger.info("🚀 Launching StorageHub Indexer node...");

  const containerName = `storagehub-indexer-${options.networkId}`;
  const dockerNetworkName = `datahaven-${options.networkId}`;
  const wsPort = 9947; // External port for Indexer node
  const aliceContainer = `datahaven-alice-${options.networkId}`;

  // Get bootnode address (empty for local dev with mDNS discovery) and PostgreSQL URL
  const bootnodeAddr = await getBootnodeAddress(aliceContainer);
  const postgresUrl = getPostgresUrl(options.networkId);

  const command: string[] = [
    "docker",
    "run",
    "-d",
    "--name",
    containerName,
    "--network",
    dockerNetworkName,
    "-p",
    `${wsPort}:${DEFAULT_SUBSTRATE_WS_PORT}`,
    options.datahavenImageTag,
    "--chain",
    "dev",
    "--name",
    "indexer",
    "--rpc-port",
    `${DEFAULT_SUBSTRATE_WS_PORT}`,
    "--rpc-external",
    "--rpc-cors",
    "all",
    "--allow-private-ipv4",
    "--discover-local",
    "--network-backend",
    "libp2p",
    "--indexer",
    "--indexer-mode",
    "full",
    "--indexer-database-url",
    postgresUrl
  ];

  // Only add bootnodes if we have a valid address
  if (bootnodeAddr) {
    command.push("--bootnodes", bootnodeAddr);
  }

  logger.debug(`Executing: ${command.join(" ")}`);
  await $`sh -c "${command.join(" ")}"`.nothrow();

  await waitForContainerToStart(containerName);

  // Wait for node to be ready
  logger.info("⌛️ Waiting for Indexer node to be ready...");
  await waitFor({
    lambda: async () => {
      const ready = await isNetworkReady(wsPort, 2000);
      if (!ready) {
        logger.debug("Indexer node not ready, waiting...");
      }
      return ready;
    },
    iterations: 60, // Indexer may take longer due to database initialization
    delay: 2000,
    errorMessage: "Indexer node not ready"
  });

  // Register in launched network
  launchedNetwork.addContainer(containerName, { ws: wsPort }, { ws: DEFAULT_SUBSTRATE_WS_PORT });

  logger.success(`Indexer node started on port ${wsPort}`);
};

/**
 * Launches a StorageHub Fisherman node.
 *
 * @param options - Configuration options for launching the network
 * @param launchedNetwork - The launched network instance to track the node
 */
export const launchFishermanNode = async (
  options: DataHavenOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  logger.info("🚀 Launching StorageHub Fisherman node...");

  const containerName = `storagehub-fisherman-${options.networkId}`;
  const dockerNetworkName = `datahaven-${options.networkId}`;
  const wsPort = 9948; // External port for Fisherman node
  const aliceContainer = `datahaven-alice-${options.networkId}`;

  // Get bootnode address (empty for local dev with mDNS discovery) and PostgreSQL URL
  const bootnodeAddr = await getBootnodeAddress(aliceContainer);
  const postgresUrl = getPostgresUrl(options.networkId);

  const command: string[] = [
    "docker",
    "run",
    "-d",
    "--name",
    containerName,
    "--network",
    dockerNetworkName,
    "-p",
    `${wsPort}:${DEFAULT_SUBSTRATE_WS_PORT}`,
    options.datahavenImageTag,
    "--chain",
    "dev",
    "--name",
    "fisherman",
    "--rpc-port",
    `${DEFAULT_SUBSTRATE_WS_PORT}`,
    "--rpc-external",
    "--rpc-cors",
    "all",
    "--allow-private-ipv4",
    "--discover-local",
    "--network-backend",
    "libp2p",
    "--fisherman",
    "--fisherman-database-url",
    postgresUrl
  ];

  // Only add bootnodes if we have a valid address
  if (bootnodeAddr) {
    command.push("--bootnodes", bootnodeAddr);
  }

  logger.debug(`Executing: ${command.join(" ")}`);
  await $`sh -c "${command.join(" ")}"`.nothrow();

  await waitForContainerToStart(containerName);

  // Wait for node to be ready
  logger.info("⌛️ Waiting for Fisherman node to be ready...");
  await waitFor({
    lambda: async () => {
      const ready = await isNetworkReady(wsPort, 2000);
      if (!ready) {
        logger.debug("Fisherman node not ready, waiting...");
      }
      return ready;
    },
    iterations: 60, // Fisherman may take longer due to database initialization
    delay: 2000,
    errorMessage: "Fisherman node not ready"
  });

  // Register in launched network
  launchedNetwork.addContainer(containerName, { ws: wsPort }, { ws: DEFAULT_SUBSTRATE_WS_PORT });

  logger.success(`Fisherman node started on port ${wsPort}`);
};

/**
 * Stops and removes all StorageHub containers.
 *
 * @param networkId - The network ID to identify containers
 */
export const cleanStorageHubContainers = async (_networkId: string): Promise<void> => {
  logger.info("🧹 Stopping and removing StorageHub containers...");

  await killExistingContainers("storagehub-");

  logger.success("StorageHub containers stopped and removed");
};
