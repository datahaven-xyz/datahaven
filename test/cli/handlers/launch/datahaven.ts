import fs from "node:fs";
import path from "node:path";
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

// TODO: This is very rough and will need something more substantial when we know what we want!
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
      `Using flag option: ${shouldLaunchDataHaven ? "will launch" : "will not launch"} DataHaven network`
    );
  }

  if (!shouldLaunchDataHaven) {
    logger.info("Skipping DataHaven network launch. Done!");
    printDivider();
    return;
  }

  // Kill any pre-existing datahaven processes if they exist
  await $`pkill datahaven`.nothrow().quiet();

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

    logger.debug(`Spawning command: ${command.join(" ")}`);
    const process = Bun.spawn(command);

    process.unref();

    launchedNetwork.addContainer(containerName, id === "alice" ? { ws: 9944 } : {});

    await waitForContainerToStart(containerName);
    await waitForLog({
      searchString: "Running JSON-RPC server: addr=0.0.0.0:",
      containerName,
      timeoutSeconds: 30,
      tail: 1
    });

    launchedNetwork.addProcess(process);
    logger.debug(`Started ${id} at ${process.pid}`);
  }

  for (let i = 0; i < 30; i++) {
    logger.info("Waiting for datahaven to start...");

    if (await isNetworkReady(9944)) {
      logger.success("Datahaven network started");
      return;
    }
    logger.debug("Node not ready, waiting 1 second...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Datahaven network failed to start after 30 seconds");
};

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
