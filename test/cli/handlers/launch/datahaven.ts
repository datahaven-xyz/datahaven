import { $ } from "bun";
import { confirmWithTimeout, logger, printDivider, printHeader } from "utils";
import { launchDataHaven } from "../../../launcher";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";
import type { LaunchOptions } from ".";

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
    printDivider();
    return;
  }

  // Check for clean network option
  let shouldCleanNetwork = options.cleanNetwork;
  if (shouldCleanNetwork === undefined && (await checkDataHavenRunning())) {
    shouldCleanNetwork = await confirmWithTimeout(
      "Do you want to clean and relaunch the DataHaven containers?",
      true,
      10
    );

    if (!shouldCleanNetwork) {
      logger.info("👍 Keeping existing DataHaven containers/network.");
      printDivider();
      return;
    }
  }

  // Determine if we should build DataHaven
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

  const result = await launchDataHaven(
    {
      networkId: "cli-launch",
      datahavenImageTag: options.datahavenImageTag || "moonsonglabs/datahaven:local",
      buildDatahaven: shouldBuildDataHaven,
      datahavenBuildExtraArgs: options.datahavenBuildExtraArgs,
      slotTime: options.slotTime
    },
    launchedNetwork
  );

  if (!result.success) {
    logger.error("Failed to launch DataHaven network", result.error);
    throw result.error;
  }

  printDivider();
};

/**
 * Checks if any DataHaven containers are currently running.
 *
 * @returns True if any DataHaven containers are running, false otherwise.
 */
const checkDataHavenRunning = async (): Promise<boolean> => {
  // Check for any container whose name starts with "datahaven-cli-launch"
  const containerIds =
    await $`docker ps --format "{{.Names}}" --filter "name=^datahaven-cli-launch"`.text();

  // Check if containerIds has any actual IDs (not just whitespace)
  const containersExist = containerIds.trim().length > 0;
  if (containersExist) {
    logger.info(`ℹ️ DataHaven containers already running: \n${containerIds}`);
  }

  return containersExist;
};
