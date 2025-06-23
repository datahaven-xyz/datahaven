import { confirmWithTimeout, logger, printDivider, printHeader } from "utils";
import { launchRelayers as launchRelayersCore } from "../../../launcher/relayers";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";
import type { LaunchOptions } from ".";

/**
 * Launches Snowbridge relayers for the DataHaven network.
 *
 * @param options - Configuration options for launching the relayers.
 * @param launchedNetwork - An instance of LaunchedNetwork to track the network's state.
 */
export const launchRelayers = async (options: LaunchOptions, launchedNetwork: LaunchedNetwork) => {
  printHeader("Starting Snowbridge Relayers");

  let shouldLaunchRelayers = options.relayer;
  if (shouldLaunchRelayers === undefined) {
    shouldLaunchRelayers = await confirmWithTimeout(
      "Do you want to launch the Snowbridge relayers?",
      true,
      10
    );
  } else {
    logger.info(
      `🏳️ Using flag option: ${shouldLaunchRelayers ? "will launch" : "will not launch"} Snowbridge relayers`
    );
  }

  if (!shouldLaunchRelayers) {
    logger.info("👍 Skipping Snowbridge relayers launch. Done!");
    printDivider();
    return;
  }

  await launchRelayersCore(
    {
      relayerImageTag: options.relayerImageTag,
      kurtosisEnclaveName: options.kurtosisEnclaveName
    },
    launchedNetwork
  );

  printDivider();
};
