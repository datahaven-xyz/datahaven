import path from "node:path";
import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import { waitFor } from "utils/waits";
import { isNetworkReady, setupDataHavenValidatorConfig } from "../common/datahaven";
import { forwardPort } from "../common/kubernetes";
import type { LaunchedNetwork } from "../common/launchedNetwork";
import type { DeployOptions } from ".";

// This should be 9955, the default WS port in Substrate, not 9944, the default RPC port.
const DEFAULT_PUBLIC_WS_PORT = 9955;

/**
 * Deploys a DataHaven solochain network in a Kubernetes namespace.
 *
 * @param options - Configuration options for launching the network.
 * @param launchedNetwork - An instance of LaunchedNetwork to track the network's state.
 */
export const deployDataHavenSolochain = async (
  options: DeployOptions,
  launchedNetwork: LaunchedNetwork
) => {
  printHeader("Deploying DataHaven Network");

  invariant(options.datahavenImageTag, "❌ DataHaven image tag not defined");

  await checkTagExists(options.datahavenImageTag);

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
  logger.debug(
    await $`helm upgrade --install dh-bootnode . -f ./datahaven/dh-bootnode.yaml -n ${launchedNetwork.kubeNamespace}`
      .cwd(path.join(process.cwd(), "../deployment/charts/node"))
      .text()
  );
  logger.success("DataHaven bootnode deployed successfully");

  logger.info("🚀 Deploying DataHaven validators with helm chart...");
  logger.debug(
    await $`helm upgrade --install dh-validator . -f ./datahaven/dh-validator.yaml -n ${launchedNetwork.kubeNamespace}`
      .cwd(path.join(process.cwd(), "../deployment/charts/node"))
      .text()
  );
  logger.success("DataHaven validators deployed successfully");

  // Forward port from validator to localhost, to interact with the network.
  const { cleanup: validatorPortForwardCleanup } = await forwardPort(
    "dh-validator-0",
    DEFAULT_PUBLIC_WS_PORT,
    DEFAULT_PUBLIC_WS_PORT,
    launchedNetwork
  );

  // Wait for the network to start.
  logger.info("⌛️ Waiting for DataHaven to start...");
  await waitFor({
    lambda: async () => {
      const isReady = await isNetworkReady(DEFAULT_PUBLIC_WS_PORT);
      if (!isReady) {
        logger.debug("Node not ready, waiting 1 second...");
      }
      return isReady;
    },
    iterations: 30,
    delay: 1000,
    errorMessage: "DataHaven network not ready"
  });

  logger.success(
    `DataHaven network started, primary node accessible on port ${DEFAULT_PUBLIC_WS_PORT}`
  );

  await registerNodes(launchedNetwork);

  await setupDataHavenValidatorConfig(launchedNetwork, "dh-validator-");

  await validatorPortForwardCleanup();

  printDivider();
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
    ws: DEFAULT_PUBLIC_WS_PORT
  });
  logger.info("📝 Node dh-validator-0 successfully registered in launchedNetwork.");
};
