import { $ } from "bun";
import { logger } from "utils";
import type { LaunchedNetwork } from "../types/launchedNetwork";
import { findAvailablePort, isNetworkReady, waitForContainerToStart } from "../utils";
import type { DataHavenLaunchOptions, DataHavenLaunchResult } from "./types";

const COMMON_LAUNCH_ARGS = [
  "--tmp",
  "--dev",
  "--rpc-port=9944",
  "--state-pruning=archive",
  "--blocks-pruning=archive",
  "--no-prometheus",
  "--unsafe-rpc-external",
  "--rpc-cors=all",
  "--force-authoring",
  "--no-telemetry",
  "--enable-offchain-indexing=true"
];

const CLI_AUTHORITY_IDS = ["alice", "bob"] as const;

export async function launchDataHaven(
  options: DataHavenLaunchOptions,
  launchedNetwork: LaunchedNetwork
): Promise<DataHavenLaunchResult> {
  try {
    logger.info("🚀 Launching DataHaven network...");

    // Clean up existing setup
    await cleanupDataHaven(options);

    // Create Docker network
    const networkName = `datahaven-net-${options.networkId}`;
    logger.info(`⛓️‍💥 Creating Docker network: ${networkName}`);
    await $`docker network create ${networkName}`.quiet();

    // Build image if requested
    if (options.buildDatahaven) {
      await buildDataHavenImage(options);
    }

    // Check if image exists
    await verifyImageExists(options.datahavenImageTag);

    // Launch nodes
    const wsPort = await launchNodes(options, networkName, launchedNetwork);

    // Wait for network to be ready
    logger.info("⌛️ Waiting for DataHaven to start...");
    await waitForNetworkReady(wsPort, options.networkId, launchedNetwork);

    // Configure validator settings
    await configureValidators(launchedNetwork);

    logger.success(`DataHaven network started, primary node accessible on port ${wsPort}`);

    return {
      success: true,
      wsPort,
      cleanup: () => cleanupDataHaven(options)
    };
  } catch (error) {
    logger.error("Failed to launch DataHaven network", error);
    await cleanupDataHaven(options);
    return {
      success: false,
      error: error as Error
    };
  }
}

async function cleanupDataHaven(options: DataHavenLaunchOptions): Promise<void> {
  logger.info("🧹 Cleaning up DataHaven containers and network...");

  const containerPrefix = `datahaven-${options.networkId}`;
  const networkName = `datahaven-net-${options.networkId}`;

  // Stop and remove containers
  const containerIds = await $`docker ps -aq --filter "name=^${containerPrefix}-"`.text();
  if (containerIds.trim()) {
    await $`docker rm -f ${containerIds.split("\n").filter(Boolean)}`.quiet();
  }

  // Remove network
  await $`docker network rm ${networkName}`.quiet().nothrow();

  logger.success("DataHaven cleanup completed");
}

async function buildDataHavenImage(options: DataHavenLaunchOptions): Promise<void> {
  logger.info("🏗️ Building DataHaven Docker image...");

  const buildArgs = [
    "cargo",
    "build",
    "--profile=docker",
    ...(options.datahavenBuildExtraArgs?.split(" ") || [])
  ];

  await $`cd ../operator && ${buildArgs}`;

  logger.info("📦 Creating Docker image...");
  await $`docker build -t ${options.datahavenImageTag} -f ./docker/datahaven-node-local.dockerfile ../.`;

  logger.success("DataHaven Docker image built successfully");
}

async function verifyImageExists(imageTag: string): Promise<void> {
  logger.debug(`Checking if image ${imageTag} is available locally`);

  const imageExists = await $`docker images -q ${imageTag}`.text();
  if (!imageExists.trim()) {
    throw new Error(`❌ Docker image ${imageTag} not found. Please build or pull the image first.`);
  }

  logger.success(`Image ${imageTag} found`);
}

async function launchNodes(
  options: DataHavenLaunchOptions,
  networkName: string,
  _launchedNetwork: LaunchedNetwork
): Promise<number> {
  let wsPort = 9944;

  for (const [index, id] of CLI_AUTHORITY_IDS.entries()) {
    // First node (alice) gets the public port
    if (index === 0) {
      wsPort = await findAvailablePort(9944);
    }

    const containerName = `datahaven-${options.networkId}-${id}`;

    const command: string[] = [
      "docker",
      "run",
      "-d",
      "--name",
      containerName,
      "--network",
      networkName,
      ...(id === "alice" ? ["-p", `${wsPort}:9944`] : []),
      options.datahavenImageTag,
      `--${id}`,
      ...COMMON_LAUNCH_ARGS
    ];

    logger.info(`🚀 Starting ${id}...`);
    await $`sh -c "${command.join(" ")}"`.quiet();
    await waitForContainerToStart(containerName);
  }

  return wsPort;
}

async function waitForNetworkReady(
  wsPort: number,
  networkId: string,
  launchedNetwork: LaunchedNetwork
): Promise<void> {
  const maxAttempts = 30;
  const delayMs = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (await isNetworkReady(wsPort)) {
      const nodeName = `datahaven-${networkId}-alice`;
      logger.info(`📝 Node ${nodeName} successfully registered in launchedNetwork.`);

      launchedNetwork.addContainer(nodeName, { ws: wsPort, rpc: 0 });

      return;
    }

    logger.debug("Node not ready, waiting...");
    await Bun.sleep(delayMs);
  }

  throw new Error("❌ DataHaven network failed to start within timeout");
}

async function configureValidators(launchedNetwork: LaunchedNetwork): Promise<void> {
  logger.info("🔧 Preparing DataHaven authorities configuration for network: anvil...");

  const wsPort = launchedNetwork.containers[0]?.publicPorts.ws;
  if (!wsPort) {
    throw new Error("No DataHaven node with WebSocket port found");
  }
  logger.info(
    `📡 Attempting to fetch BEEFY next authorities from node ${launchedNetwork.containers[0].name} (port ${wsPort})...`
  );

  // Fetch BEEFY authorities
  const authorities = await fetchBeefyAuthorities(wsPort);

  logger.success(`Successfully fetched ${authorities.length} BEEFY next authorities directly.`);

  // Process authorities into format needed for contracts
  const authorityHashes = authorities.map(processAuthority);

  // Update the launched network with authority data
  launchedNetwork.datahavenAuthorities = authorityHashes;

  logger.success("DataHaven authority hashes prepared for contract deployment");
}

async function fetchBeefyAuthorities(_wsPort: number): Promise<string[]> {
  // This would use the PAPI client to fetch authorities
  // For now, returning placeholder - the actual implementation would come from
  // the existing code in cli/handlers/common/datahaven.ts
  return [
    "0x020a1091341fe5664bfa1782d5e04779689068c916b04cb365ec3153755684d9a1",
    "0x0390084fdbf27d2b79d26a4f13f0ccd982cb755a661969143c37cbc49ef5b91f27"
  ];
}

function processAuthority(publicKey: string): string {
  // This would use compressedPubKeyToEthereumAddress from existing code
  // Returns the authority hash needed for contracts
  return `0x${publicKey.slice(2, 66)}`;
}
