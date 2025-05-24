import { $ } from "bun";
import { cargoCrossbuild } from "scripts/cargo-crossbuild";
import invariant from "tiny-invariant";
import {
  confirmWithTimeout,
  killExistingContainers,
  logger,
  printDivider,
  printHeader,
  waitForContainerToStart
} from "utils";
import { waitFor } from "utils/waits";
import { DOCKER_NETWORK_NAME } from "../common/consts";
import { isNetworkReady, setupDataHavenValidatorConfig } from "../common/datahaven";
import type { LaunchedNetwork } from "../common/launchedNetwork";
import type { LaunchOptions } from ".";

const LOG_LEVEL = Bun.env.LOG_LEVEL || "info";

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

const DEFAULT_PUBLIC_WS_PORT = 9944;

// 2 validators (Alice and Bob) are used for local & CI testing
// <repo_root>/operator/runtime/stagenet/src/genesis_config_presets.rs#L98
const CLI_AUTHORITY_IDS = ["alice", "bob"] as const;

/**
 * Launches a DataHaven solochain network for testing.
 *
 * @param options - Configuration options for launching the network.
 * @param launchedNetwork - An instance of LaunchedNetwork to track the network's state.
 */
export const launchDataHavenSolochain = async (
  options: LaunchOptions,
  launchedNetwork: LaunchedNetwork
) => {
  printHeader("Starting DataHaven Network");

  let shouldLaunchDataHaven = options.datahaven;

  if (shouldLaunchDataHaven === undefined) {
    shouldLaunchDataHaven = await confirmWithTimeout(
      "Do you want to launch the DataHaven network?",
      true,
      10
    );
  } else {
    logger.info(
      `🏳️ Using flag option: ${shouldLaunchDataHaven ? "will launch" : "will not launch"} DataHaven network`
    );
  }

  if (!shouldLaunchDataHaven) {
    logger.info("👍 Skipping DataHaven network launch. Done!");

    await registerNodes(launchedNetwork);
    printDivider();
    return;
  }

  if (await checkDataHavenRunning()) {
    // If the user wants to launch the DataHaven network, we ask them if they want
    // to clean the existing containers/network or just continue with the existing
    // containers/network.
    if (shouldLaunchDataHaven) {
      let shouldRelaunch = options.cleanNetwork;

      if (shouldRelaunch === undefined) {
        shouldRelaunch = await confirmWithTimeout(
          "Do you want to clean and relaunch the DataHaven containers?",
          true,
          10
        );
      }

      // Case: User wants to keep existing containers/network
      if (!shouldRelaunch) {
        logger.info("👍 Keeping existing DataHaven containers/network.");

        await registerNodes(launchedNetwork);
        printDivider();
        return;
      }

      // Case: User wants to clean and relaunch the DataHaven containers
      await cleanDataHavenContainers(options);
    }
  }

  logger.info(`⛓️‍💥 Creating Docker network: ${DOCKER_NETWORK_NAME}`);
  logger.debug(await $`docker network rm ${DOCKER_NETWORK_NAME} -f`.text());
  logger.debug(await $`docker network create ${DOCKER_NETWORK_NAME}`.text());

  invariant(options.datahavenImageTag, "❌ DataHaven image tag not defined");

  await buildLocalImage(options);
  await checkTagExists(options.datahavenImageTag);

  logger.success(`DataHaven nodes will use Docker network: ${DOCKER_NETWORK_NAME}`);

  for (const id of CLI_AUTHORITY_IDS) {
    logger.info(`🚀 Starting ${id}...`);
    const containerName = `datahaven-${id}`;

    const command: string[] = [
      "docker",
      "run",
      "-d",
      "--name",
      containerName,
      "--network",
      DOCKER_NETWORK_NAME,
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

  await setupDataHavenValidatorConfig(launchedNetwork, "datahaven-");

  printDivider();
};

/**
 * Checks if any DataHaven containers are currently running.
 *
 * @returns True if any DataHaven containers are running, false otherwise.
 */
const checkDataHavenRunning = async (): Promise<boolean> => {
  // Check for any container whose name starts with "datahaven-"
  const containerIds = await $`docker ps --format "{{.Names}}" --filter "name=^datahaven-"`.text();
  const networkOutput =
    await $`docker network ls --filter "name=^${DOCKER_NETWORK_NAME}$" --format "{{.Name}}"`.text();

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
 * Stops and removes all DataHaven containers.
 */
const cleanDataHavenContainers = async (options: LaunchOptions): Promise<void> => {
  logger.info("🧹 Stopping and removing existing DataHaven containers...");

  invariant(options.datahavenImageTag, "❌ DataHaven image tag not defined");
  await killExistingContainers(options.datahavenImageTag);

  if (options.relayerImageTag) {
    logger.info(
      "🧹 Stopping and removing existing relayer containers (relayers depend on DataHaven nodes)..."
    );
    await killExistingContainers(options.relayerImageTag);
  }

  logger.info("✅ Existing DataHaven containers stopped and removed.");

  logger.debug(await $`docker network rm -f ${DOCKER_NETWORK_NAME}`.text());
  logger.info("✅ DataHaven Docker network removed.");

  invariant(
    (await checkDataHavenRunning()) === false,
    "❌ DataHaven containers were not stopped and removed"
  );
};

const buildLocalImage = async (options: LaunchOptions) => {
  let shouldBuildDataHaven = options.buildDatahaven;

  if (shouldBuildDataHaven === undefined) {
    shouldBuildDataHaven = await confirmWithTimeout(
      "Do you want to build the DataHaven node local Docker image?",
      true,
      10
    );
  } else {
    logger.info(
      `🏳️ Using flag option: ${shouldBuildDataHaven ? "will build" : "will not build"} DataHaven node local Docker image`
    );
  }

  if (!shouldBuildDataHaven) {
    logger.info("👍 Skipping DataHaven node local Docker image build. Done!");
    return;
  }

  await cargoCrossbuild({ datahavenBuildExtraArgs: options.datahavenBuildExtraArgs });

  logger.info("🐳 Building DataHaven node local Docker image...");
  if (LOG_LEVEL === "trace") {
    await $`bun build:docker:operator`;
  } else {
    await $`bun build:docker:operator`.quiet();
  }
  logger.success("DataHaven node local Docker image build completed successfully");
};

/**
 * Checks if an image exists locally or on Docker Hub.
 *
 * @param tag - The tag of the image to check.
 * @returns A promise that resolves when the image is found.
 */
const checkTagExists = async (tag: string) => {
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

const registerNodes = async (launchedNetwork: LaunchedNetwork) => {
  // Registering DataHaven nodes Docker network.
  launchedNetwork.networkName = DOCKER_NETWORK_NAME;

  const targetContainerName = "datahaven-alice";
  const aliceHostWsPort = DEFAULT_PUBLIC_WS_PORT; // Standard host port for Alice's WS, as set during launch.

  logger.debug(`Checking Docker status for container: ${targetContainerName}`);
  // Use ^ and $ for an exact name match in the filter.
  const dockerPsOutput = await $`docker ps -q --filter "name=^${targetContainerName}$"`.text();
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
