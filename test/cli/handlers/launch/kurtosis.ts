import { $ } from "bun";
import type { LaunchOptions } from "cli/handlers";
import { confirmWithTimeout, logger, printDivider, printHeader } from "utils";
import {
  checkKurtosisEnclaveRunning,
  registerServices,
  runKurtosisEnclave
} from "../common/kurtosis";
import type { LaunchedNetwork } from "../common/launchedNetwork";

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
  printHeader("Starting Kurtosis EthereumNetwork");

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

    await registerServices(launchedNetwork, options.kurtosisEnclaveName);
    printDivider();
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
      logger.info("🧹 Cleaning up Docker and Kurtosis environments...");
      logger.debug(await $`kurtosis enclave stop ${options.kurtosisEnclaveName}`.nothrow().text());
      logger.debug(await $`kurtosis clean`.text());
      logger.debug(await $`kurtosis engine stop`.nothrow().text());
      logger.debug(await $`docker system prune -f`.nothrow().text());
    }
  }

  if (process.platform === "darwin") {
    logger.debug("Detected macOS, pulling container images with linux/amd64 platform...");
    logger.debug(
      await $`docker pull ghcr.io/blockscout/smart-contract-verifier:latest --platform linux/amd64`.text()
    );
  }

  await runKurtosisEnclave(options, "configs/kurtosis/minimal.yaml");

  await registerServices(launchedNetwork, options.kurtosisEnclaveName);
  logger.success("Kurtosis network operations completed successfully.");
  printDivider();
};
