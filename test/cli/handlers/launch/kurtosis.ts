import type { LaunchOptions } from "cli/handlers";
import {
  checkKurtosisEnclaveRunning,
  cleanKurtosisEnclave,
  launchKurtosisNetwork,
  registerServices
} from "launcher/kurtosis";
import type { LaunchedNetwork } from "launcher/types/launchedNetwork";
import { checkKurtosisCluster } from "launcher/utils/checks";
import { confirmWithTimeout, logger, printDivider, printHeader } from "utils";

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

    if (options.kurtosisEnclaveName) {
      logger.debug(`Registering ${options.kurtosisEnclaveName}`);
      await registerServices(launchedNetwork, options.kurtosisEnclaveName);
    }
    printDivider();
    return;
  }

  if (!(await checkKurtosisCluster())) {
    logger.error(
      "❌ Kurtosis cluster is not configured for local launch, run `kurtosis cluster get`"
    );
    return;
  }

  if (await checkKurtosisEnclaveRunning(options.kurtosisEnclaveName)) {
    logger.info("ℹ️  Kurtosis Ethereum network is already running.");

    // If the user wants to launch the Kurtosis network, we ask them if they want
    // to clean the existing enclave or just continue with the existing enclave.
    if (shouldLaunchKurtosis) {
      let shouldRelaunch = options.cleanNetwork;

      if (shouldRelaunch === undefined) {
        shouldRelaunch = await confirmWithTimeout(
          "Do you want to clean and relaunch the Kurtosis enclave?",
          true,
          10
        );
      }

      // Case: User wants to keep existing enclave
      if (!shouldRelaunch) {
        logger.info("👍 Keeping existing Kurtosis enclave.");

        await registerServices(launchedNetwork, options.kurtosisEnclaveName);
        printDivider();
        return;
      }

      // Case: User wants to clean and relaunch the enclave
      await cleanKurtosisEnclave(options.kurtosisEnclaveName);
    }
  }

  await launchKurtosisNetwork(
    {
      kurtosisEnclaveName: options.kurtosisEnclaveName,
      blockscout: options.blockscout,
      slotTime: options.slotTime,
      kurtosisNetworkArgs: options.kurtosisNetworkArgs
    },
    launchedNetwork
  );
  printDivider();
};
