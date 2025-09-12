import path from "node:path";
import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import { DEFAULT_SUBSTRATE_WS_PORT } from "utils/constants";
import { waitFor } from "utils/waits";
import { isNetworkReady } from "../../../launcher/datahaven";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";
import { forwardPort } from "../common/kubernetes";
import type { DeployOptions } from ".";

/**
 * Deploys StorageHub components (MSP, BSP, Indexer, Fisherman nodes and databases) in a Kubernetes namespace.
 *
 * @param options - Configuration options for launching the network.
 * @param launchedNetwork - An instance of LaunchedNetwork to track the network's state.
 * @returns A promise that resolves when all StorageHub components are deployed.
 */
export const deployStorageHubComponents = async (
  options: DeployOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  if (options.skipStorageHub) {
    logger.info("🏳️ Skipping StorageHub components deployment");
    printDivider();
    return;
  }

  printHeader("Deploying StorageHub Components");

  invariant(options.datahavenImageTag, "❌ DataHaven image tag not defined");

  if (!options.dockerUsername) {
    await checkTagExists(options.datahavenImageTag);
  }

  // Deploy StorageHub databases first (Indexer and Fisherman PostgreSQL databases)
  await deployStorageHubDatabases(options, launchedNetwork);

  // Deploy StorageHub nodes (MSP, BSP, Indexer, Fisherman)
  await deployStorageHubNodes(options, launchedNetwork);

  // Deploy StorageHub MSP Backend API
  await deployStorageHubBackend(options, launchedNetwork);

  await registerStorageHubNodes(launchedNetwork);

  printDivider();
};

/**
 * Deploys StorageHub PostgreSQL databases for Indexer and Fisherman nodes.
 */
const deployStorageHubDatabases = async (
  options: DeployOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  logger.info("🗄️ Deploying StorageHub PostgreSQL databases...");

  const deployDatabase = async (name: string, component: string) => {
    const timeout = "3m";
    const args = [
      "upgrade",
      "--install",
      name,
      "oci://registry-1.docker.io/bitnamicharts/postgresql",
      "-f",
      `environments/${options.environment}/${component}-db.yaml`,
      "-n",
      launchedNetwork.kubeNamespace,
      "--wait",
      "--timeout",
      timeout
    ];

    logger.info(`📦 Deploying ${name} database...`);
    logger.debug(await $`helm ${args}`.cwd(path.join(process.cwd(), "../deploy")).text());
    logger.success(`${name} database deployed successfully`);
  };

  // Deploy Indexer database
  await deployDatabase("sh-indexer-db", "sh-idxnode");

  // Deploy Fisherman database
  await deployDatabase("sh-fisherman-db", "sh-fisherman");
};

/**
 * Deploys StorageHub nodes (MSP, BSP, Indexer, Fisherman).
 */
const deployStorageHubNodes = async (
  options: DeployOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  logger.info("🚀 Deploying StorageHub nodes...");

  const deployNode = async (name: string, component: string) => {
    const timeout = "5m";
    const args = [
      "upgrade",
      "--install",
      name,
      "charts/node",
      "-f",
      `charts/node/storagehub/${component}.yaml`,
      "-f",
      `environments/${options.environment}/${component}.yaml`,
      "-n",
      launchedNetwork.kubeNamespace,
      "--wait",
      "--timeout",
      timeout
    ];

    logger.info(`🏗️ Deploying ${name}...`);
    logger.debug(await $`helm ${args}`.cwd(path.join(process.cwd(), "../deploy")).text());
    logger.success(`${name} deployed successfully`);
  };

  // Deploy StorageHub nodes in dependency order
  await deployNode("sh-mspnode", "sh-mspnode");
  await deployNode("sh-bspnode", "sh-bspnode");
  await deployNode("sh-idxnode", "sh-idxnode");
  await deployNode("sh-fisherman", "sh-fisherman");
};

/**
 * Deploys StorageHub MSP Backend API.
 */
const deployStorageHubBackend = async (
  options: DeployOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  logger.info("🚀 Deploying StorageHub MSP Backend API...");

  const timeout = "3m";
  const args = [
    "upgrade",
    "--install",
    "sh-mspbackend",
    "charts/backend",
    "-f",
    "charts/backend/storagehub/sh-mspbackend.yaml",
    "-f",
    `environments/${options.environment}/sh-mspbackend.yaml`,
    "-n",
    launchedNetwork.kubeNamespace,
    "--wait",
    "--timeout",
    timeout
  ];

  logger.debug(await $`helm ${args}`.cwd(path.join(process.cwd(), "../deploy")).text());
  logger.success("StorageHub MSP Backend API deployed successfully");
};

/**
 * Waits for StorageHub Indexer node to be ready and registers nodes in LaunchedNetwork.
 */
const registerStorageHubNodes = async (launchedNetwork: LaunchedNetwork): Promise<void> => {
  // Forward port from indexer node to localhost for health checks
  const indexerPort = 9944;
  const { cleanup: indexerPortForwardCleanup } = await forwardPort(
    "sh-idxnode-0",
    indexerPort,
    indexerPort + 100, // Use different local port to avoid conflicts
    launchedNetwork
  );

  // Wait for the StorageHub Indexer to start
  logger.info("⌛️ Waiting for StorageHub Indexer to start...");
  const timeoutMs = 5000; // 5 second timeout
  const delayMs = 5000; // 5 second delay between iterations
  await waitFor({
    lambda: async () => {
      logger.info(`📡 Checking if StorageHub Indexer is ready (timeout: ${timeoutMs / 1000}s)...`);
      const isReady = await isNetworkReady(indexerPort + 100, timeoutMs);
      if (!isReady) {
        logger.info(
          `⌛️ StorageHub Indexer not ready, waiting ${delayMs / 1000}s to check again...`
        );
      }
      return isReady;
    },
    iterations: 12, // 12 iterations of 5 + 5 = 2 minutes
    delay: delayMs,
    errorMessage: "StorageHub Indexer not ready"
  });

  logger.success("StorageHub Indexer is ready");

  // Clean up the port forwarding
  await indexerPortForwardCleanup();

  // Register StorageHub nodes in LaunchedNetwork
  launchedNetwork.addContainer("sh-mspnode-0", { ws: 9944 });
  launchedNetwork.addContainer("sh-bspnode-0", { ws: 9944 });
  launchedNetwork.addContainer("sh-idxnode-0", { ws: 9944 });
  launchedNetwork.addContainer("sh-fisherman-0", { ws: 9944 });

  logger.info("📝 StorageHub nodes successfully registered in launchedNetwork.");
};

/**
 * Checks if an image exists in Docker Hub.
 *
 * @param tag - The tag of the image to check.
 * @returns A promise that resolves when the image is found.
 */
const checkTagExists = async (tag: string) => {
  const cleanTag = tag.trim();
  logger.debug(`Checking if image ${cleanTag} is available on Docker Hub`);
  const result = await $`docker manifest inspect ${cleanTag}`.nothrow().quiet();
  invariant(
    result.exitCode === 0,
    `❌ Image ${tag} not found.\n Does this image exist?\n Are you logged and have access to the repository?`
  );

  logger.success(`Image ${cleanTag} found on Docker Hub`);
};
