import { existsSync } from "node:fs";
import path from "node:path";
import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import { DEFAULT_SUBSTRATE_WS_PORT } from "utils/constants";
import { waitFor } from "utils/waits";
import { isNetworkReady, setupDataHavenValidatorConfig } from "../../../launcher/datahaven";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";
import { forwardPort } from "../common/kubernetes";
import type { DeployOptions } from ".";

/**
 * Deploys a DataHaven solochain network in a Kubernetes namespace.
 *
 * @param options - Configuration options for launching the network.
 * @param launchedNetwork - An instance of LaunchedNetwork to track the network's state.
 * @returns A promise that resolves to a cleanup function for the validator port forwarding.
 */
export const deployDataHavenSolochain = async (
  options: DeployOptions,
  launchedNetwork: LaunchedNetwork
): Promise<() => Promise<void>> => {
  if (options.skipDatahavenSolochain) {
    logger.info("🏳️ Skipping DataHaven deployment");

    // Forward port from validator to localhost, to interact with the network.
    const { cleanup: validatorPortForwardCleanup } = await forwardPort(
      "dh-validator-0",
      DEFAULT_SUBSTRATE_WS_PORT,
      DEFAULT_SUBSTRATE_WS_PORT,
      launchedNetwork
    );

    await registerNodes(launchedNetwork);
    await setupDataHavenValidatorConfig(launchedNetwork, "dh-validator-");

    printDivider();
    return validatorPortForwardCleanup;
  }

  printHeader("Deploying DataHaven Network");

  invariant(options.datahavenImageTag, "❌ DataHaven image tag not defined");

  if (!options.dockerUsername) {
    await checkTagExists(options.datahavenImageTag);
  }

  // Validate custom chainspec file if provided
  if (options.chainspec) {
    if (!path.isAbsolute(options.chainspec)) {
      throw new Error(`❌ Chainspec path must be absolute: ${options.chainspec}`);
    }
    if (!existsSync(options.chainspec)) {
      throw new Error(`❌ Custom chainspec file not found: ${options.chainspec}`);
    }
    logger.info(`✅ Custom chainspec file found: ${options.chainspec}`);
  }

  await checkOrCreateKubernetesNamespace(launchedNetwork.kubeNamespace);

  // Create secret for Docker Hub credentials, if they were provided.
  if (options.dockerUsername && options.dockerPassword && options.dockerEmail) {
    logger.info("🔐 Creating Docker Hub secret...");
    logger.debug(
      await $`kubectl create secret docker-registry datahaven-dockerhub \
        --docker-username=${options.dockerUsername} \
        --docker-password=${options.dockerPassword} \
        --docker-email=${options.dockerEmail} \
        -n ${launchedNetwork.kubeNamespace}`.text()
    );
    logger.success("Docker Hub secret created successfully");
  }

  // Deploy DataHaven bootnode and validators with helm chart.
  logger.info("🚀 Deploying DataHaven bootnode with helm chart...");
  const bootnodeTimeout = "5m"; // 5 minutes

  // Build helm command arguments
  const bootnodeArgs = [
    "upgrade",
    "--install",
    "dh-bootnode",
    "charts/node",
    "-f",
    "charts/node/datahaven/dh-bootnode.yaml",
    "-f",
    `environments/${options.environment}/dh-bootnode.yaml`
  ];

  // Add custom chainspec configuration if provided
  if (options.chainspec) {
    logger.info(`🔗 Using custom chainspec: ${options.chainspec}`);
    bootnodeArgs.push("--set-file", `customChainspecContent=${options.chainspec}`);
  }

  bootnodeArgs.push("-n", launchedNetwork.kubeNamespace, "--wait", "--timeout", bootnodeTimeout);

  logger.debug(await $`helm ${bootnodeArgs}`.cwd(path.join(process.cwd(), "../deploy")).text());
  logger.success("DataHaven bootnode deployed successfully");

  logger.info("🚀 Deploying DataHaven validators with helm chart...");
  const validatorTimeout = "5m"; // 5 minutes

  // Build helm command arguments
  const validatorArgs = [
    "upgrade",
    "--install",
    "dh-validator",
    "charts/node",
    "-f",
    "charts/node/datahaven/dh-validator.yaml",
    "-f",
    `environments/${options.environment}/dh-validator.yaml`
  ];

  // Add custom chainspec configuration if provided
  if (options.chainspec) {
    validatorArgs.push("--set-file", `customChainspecContent=${options.chainspec}`);
  }

  validatorArgs.push("-n", launchedNetwork.kubeNamespace, "--wait", "--timeout", validatorTimeout);

  logger.debug(await $`helm ${validatorArgs}`.cwd(path.join(process.cwd(), "../deploy")).text());
  logger.success("DataHaven validators deployed successfully");

  // Forward port from validator to localhost, to interact with the network.
  const { cleanup: validatorPortForwardCleanup } = await forwardPort(
    "dh-validator-0",
    DEFAULT_SUBSTRATE_WS_PORT,
    DEFAULT_SUBSTRATE_WS_PORT,
    launchedNetwork
  );

  // Wait for the network to start.
  logger.info("⌛️ Waiting for DataHaven to start...");
  const timeoutMs = 5000; // 5 second timeout
  const delayMs = 5000; // 5 second delay between iterations
  await waitFor({
    lambda: async () => {
      logger.info(`📡 Checking if DataHaven is ready (timeout: ${timeoutMs / 1000}s)...`);
      const isReady = await isNetworkReady(DEFAULT_SUBSTRATE_WS_PORT, timeoutMs);
      if (!isReady) {
        logger.info(`⌛️ Node not ready, waiting ${delayMs / 1000}s to check again...`);
      }
      return isReady;
    },
    iterations: 12, // 12 iterations of 5 + 5 = 2 minutes
    delay: delayMs, // 5 second delay between iterations
    errorMessage: "DataHaven network not ready"
  });

  logger.success(
    `DataHaven network started, primary node accessible on port ${DEFAULT_SUBSTRATE_WS_PORT}`
  );

  await registerNodes(launchedNetwork);
  await setupDataHavenValidatorConfig(launchedNetwork, "dh-validator-");

  printDivider();
  return validatorPortForwardCleanup;
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

/**
 * Checks if a Kubernetes namespace exists and creates it if it doesn't.
 *
 * @param namespace - The name of the namespace to check or create.
 * @returns A promise that resolves when the namespace exists or has been created.
 */
const checkOrCreateKubernetesNamespace = async (namespace: string) => {
  logger.info(`🔍 Checking if Kubernetes namespace "${namespace}" exists...`);

  // Check if namespace exists
  const checkResult = await $`kubectl get namespace ${namespace}`.nothrow().quiet();

  if (checkResult.exitCode === 0) {
    logger.success(`Namespace "${namespace}" already exists`);
    return;
  }

  logger.info(`📦 Creating Kubernetes namespace "${namespace}"...`);
  const createResult = await $`kubectl create namespace ${namespace}`.nothrow();

  if (createResult.exitCode !== 0) {
    throw new Error(`Failed to create namespace "${namespace}": ${createResult.stderr}`);
  }

  logger.success(`Successfully created namespace "${namespace}"`);
};

const registerNodes = async (launchedNetwork: LaunchedNetwork) => {
  // Register the validator node, using the standard host WS port that we just forwarded.
  launchedNetwork.addContainer("dh-validator-0", {
    ws: DEFAULT_SUBSTRATE_WS_PORT
  });
  logger.info("📝 Node dh-validator-0 successfully registered in launchedNetwork.");
};
