import type { LaunchOptions } from "cli/handlers";
import { confirmWithTimeout, logger, printDivider, printHeader } from "utils";
import { launchEthereum } from "../../../launcher";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";

/**
 * Launches a Kurtosis Ethereum network enclave for testing.
 *
 * @param launchedNetwork - The LaunchedNetwork instance to store network details
 * @param options - Configuration options
 */
export const launchKurtosis = async (
  options: LaunchOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  printHeader("Starting Kurtosis Ethereum Network");

  let shouldLaunchKurtosis = options.launchKurtosis;

  if (shouldLaunchKurtosis === undefined) {
    shouldLaunchKurtosis = await confirmWithTimeout(
      "Do you want to launch the Kurtosis network?",
      true,
      10
    );
  }

  if (!shouldLaunchKurtosis) {
    logger.info("👍 Skipping Kurtosis Ethereum network launch. Done!");
    printDivider();
    return;
  }

  const result = await launchEthereum(
    {
      networkId: "cli-launch",
      kurtosisEnclaveName: options.kurtosisEnclaveName,
      blockscout: options.blockscout,
      slotTime: options.slotTime,
      kurtosisNetworkArgs: options.kurtosisNetworkArgs
    },
    launchedNetwork
  );

  if (!result.success) {
    logger.error("Failed to launch Ethereum network", result.error);
    throw result.error;
  }

  logger.success("Kurtosis network operations completed successfully.");
  printDivider();
};
