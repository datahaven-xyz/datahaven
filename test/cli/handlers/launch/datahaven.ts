import { $ } from "bun";
import invariant from "tiny-invariant";
import {
  confirmWithTimeout,
  logger,
  printDivider,
  printHeader,
  runShellCommandWithLogger,
  waitForContainerToStart,
  waitForLog
} from "utils";
import type { LaunchOptions } from ".";
import type { LaunchedNetwork } from "./launchedNetwork";

const COMMON_LAUNCH_ARGS = [
  "--unsafe-force-node-key-generation",
  "--tmp",
  "--validator",
  "--discover-local",
  "--no-prometheus",
  "--unsafe-rpc-external",
  "--rpc-cors=all",
  "--force-authoring",
  "--no-telemetry"
];

// We need 5 since the (2/3 + 1) of 6 authority set is 5
// <repo_root>/operator/runtime/src/genesis_config_presets.rs#L94
const AUTHORITY_IDS = ["alice", "bob", "charlie", "dave", "eve"];

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

  if ((await checkDataHavenRunning()) && !options.alwaysClean) {
    logger.info("ℹ️  DataHaven network (Docker containers) is already running.");

    logger.trace("Checking if datahaven option was set via flags");
    if (options.datahaven === false) {
      logger.info("Keeping existing DataHaven containers.");

      await registerNodes(launchedNetwork);
      printDivider();
      return;
    }

    if (options.datahaven === true) {
      logger.info("Proceeding to clean and relaunch DataHaven containers...");
      await cleanDataHavenContainers();
    } else {
      const shouldRelaunch = await confirmWithTimeout(
        "Do you want to clean and relaunch the DataHaven containers?",
        true,
        10
      );

      if (!shouldRelaunch) {
        logger.info("Keeping existing DataHaven containers.");

        await registerNodes(launchedNetwork);
        printDivider();
        return;
      }
      logger.info("Proceeding to clean and relaunch DataHaven containers...");
      await cleanDataHavenContainers();
    }
  }

  if (shouldLaunchDataHaven === undefined) {
    shouldLaunchDataHaven = await confirmWithTimeout(
      "Do you want to launch the DataHaven network?",
      true,
      10
    );
  } else {
    logger.info(
      `Using flag option: ${shouldLaunchDataHaven ? "will launch" : "will not launch"} DataHaven network`
    );
  }

  if (!shouldLaunchDataHaven) {
    logger.info("Skipping DataHaven network launch. Done!");
    printDivider();
    return;
  }

  invariant(options.datahavenImageTag, "❌ Datahaven image tag not defined");

  await checkTagExists(options.datahavenImageTag);

  const logsPath = `tmp/logs/${launchedNetwork.getRunId()}/`;
  logger.debug(`Ensuring logs directory exists: ${logsPath}`);
  await $`mkdir -p ${logsPath}`.quiet();

  for (const id of AUTHORITY_IDS) {
    logger.info(`Starting ${id}...`);
    const containerName = `datahaven-${id}`;

    const command: string[] = [
      "docker",
      "run",
      "-d",
      "--platform",
      "linux/amd64",
      "--name",
      containerName,
      ...(id === "alice" ? ["-p", "9944:9944"] : []),
      options.datahavenImageTag,
      `--${id}`,
      ...COMMON_LAUNCH_ARGS
    ];

    logger.debug($`sh -c "${command.join(" ")}"`.text());

    await waitForContainerToStart(containerName);
    // TODO: Add this back once `waitForLog` cleans up its resources well
    // await waitForLog({
    //   searchString: "Running JSON-RPC server: addr=0.0.0.0:",
    //   containerName,
    //   timeoutSeconds: 30,
    //   tail: 1
    // });
  }

  for (let i = 0; i < 30; i++) {
    logger.info("Waiting for datahaven to start...");

    if (await isNetworkReady(9944)) {
      logger.success("Datahaven network started");

      await registerNodes(launchedNetwork);
      printDivider();
      return;
    }
    logger.debug("Node not ready, waiting 1 second...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Datahaven network failed to start after 30 seconds");
};

/**
 * Checks if any DataHaven containers are currently running.
 *
 * @returns True if any DataHaven containers are running, false otherwise.
 */
const checkDataHavenRunning = async (): Promise<boolean> => {
  // Check for any container whose name starts with "datahaven-"
  const PIDS = await $`docker ps -q --filter "name=^datahaven-"`.text();
  return PIDS.trim().length > 0;
};

/**
 * Stops and removes all DataHaven containers.
 */
const cleanDataHavenContainers = async (): Promise<void> => {
  logger.info("🧹 Stopping and removing existing DataHaven containers...");
  const containerIds = (await $`docker ps -a -q --filter "name=^datahaven-"`.text()).trim();
  logger.debug(`Container IDs: ${containerIds}`);
  if (containerIds.length > 0) {
    const idsArray = containerIds
      .split("\n")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    for (const id of idsArray) {
      logger.debug(`Stopping container ${id}`);
      logger.debug(await $`docker stop ${id}`.nothrow().text());
      logger.debug(await $`docker rm ${id}`.nothrow().text());
    }
  }
  logger.info("✅ Existing DataHaven containers stopped and removed.");
};

/**
 * Checks if the DataHaven network is ready by sending a POST request to the system_chain method.
 *
 * @param port - The port number to check.
 * @returns True if the network is ready, false otherwise.
 */
export const isNetworkReady = async (port: number): Promise<boolean> => {
  try {
    const response = await fetch(`http://localhost:${port}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "system_chain",
        params: []
      })
    });
    logger.debug(`isNodeReady check response: ${response.status}`);
    logger.trace(await response.json());
    return response.ok;
  } catch (error) {
    logger.debug(`isNodeReady check failed for port ${port}: ${error}`);
    return false;
  }
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
  const targetContainerName = "datahaven-alice";
  const aliceHostWsPort = 9944; // Standard host port for Alice's WS, as set during launch.

  logger.debug(`Checking Docker status for container: ${targetContainerName}`);
  // Use ^ and $ for an exact name match in the filter.
  const dockerPsOutput = await $`docker ps -q --filter "name=^${targetContainerName}$"`.text();
  const isContainerRunning = dockerPsOutput.trim().length > 0;

  if (!isContainerRunning) {
    // If the target Docker container is not running, we cannot register it.
    throw new Error(
      `❌ Docker container ${targetContainerName} is not running. Cannot register node.`
    );
  }

  // If the Docker container is running, proceed to register it in launchedNetwork.
  // We use the standard host WS port that "datahaven-alice" is expected to use.
  logger.info(
    `✅ Docker container ${targetContainerName} is running. Registering with WS port ${aliceHostWsPort}.`
  );
  launchedNetwork.addContainer(targetContainerName, { ws: aliceHostWsPort });
  logger.success(`👍 Node ${targetContainerName} successfully registered in launchedNetwork.`);
};
