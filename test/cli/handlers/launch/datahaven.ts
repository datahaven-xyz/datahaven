import invariant from "tiny-invariant";
import { confirmWithTimeout, logger, printDivider, printHeader } from "utils";
import {
  checkDataHavenRunning,
  cleanDataHavenContainers,
  launchLocalDataHavenSolochain,
  registerNodes
} from "../../../launcher/datahaven";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";
import { type LaunchOptions, NETWORK_ID } from ".";

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

    await registerNodes(NETWORK_ID, launchedNetwork);
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

        await registerNodes(NETWORK_ID, launchedNetwork);
        printDivider();
        return;
      }

      // Case: User wants to clean and relaunch the DataHaven containers
      await cleanDataHavenContainers(NETWORK_ID);
    }
  }

  invariant(options.datahavenImageTag, "❌ DataHaven image tag not defined");

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
  }

  await launchLocalDataHavenSolochain(
    {
      networkId: NETWORK_ID,
      datahavenImageTag: options.datahavenImageTag,
      relayerImageTag: options.relayerImageTag,
      authorityIds: CLI_AUTHORITY_IDS,
      buildDatahaven: shouldBuildDataHaven,
      datahavenBuildExtraArgs: options.datahavenBuildExtraArgs
    },
    launchedNetwork
  );

  printDivider();
};
