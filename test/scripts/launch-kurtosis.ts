import { $ } from "bun";
import { getServicesFromDocker, logger, printDivider, printHeader, promptWithTimeout } from "utils";

/**
 * Launches a Kurtosis Ethereum network enclave for testing.
 *
 * This function checks if a Kurtosis network is already running. If it is:
 * - With `launchKurtosis: false` - keeps the existing enclave
 * - With `launchKurtosis: true` - cleans and relaunches the enclave
 * - With `launchKurtosis: undefined` - prompts the user to decide whether to relaunch
 *
 * If no network is running, it launches a new one.
 *
 * @param options - Configuration options
 * @param options.launchKurtosis - Whether to forcibly launch Kurtosis (true), keep existing (false), or prompt user (undefined)
 * @returns Object containing success status and Docker services information
 */
export const launchKurtosis = async (options: { launchKurtosis?: boolean } = {}) => {
  if (await checkKurtosisRunning()) {
    logger.info("ℹ️  Kurtosis network is already running.");

    // Check if launchKurtosis option was set via flags
    if (options.launchKurtosis === false) {
      logger.info("Keeping existing Kurtosis enclave. Exiting...");
      return { success: true, services: await getServicesFromDocker() };
    }

    if (options.launchKurtosis === true) {
      logger.info("Proceeding to clean and relaunch the Kurtosis enclave...");
    } else {
      // Use promptWithTimeout if launchKurtosis is undefined
      const shouldRelaunch = await promptWithTimeout(
        "Do you want to clean and relaunch the Kurtosis enclave?",
        true,
        10
      );

      if (!shouldRelaunch) {
        logger.info("Keeping existing Kurtosis enclave. Exiting...");
        return { success: true, services: await getServicesFromDocker() };
      }

      logger.info("Proceeding to clean and relaunch the Kurtosis enclave...");
    }
  }

  // Start Kurtosis network
  printHeader("Starting Kurtosis Network");

  // Clean up Docker and Kurtosis
  logger.info("🧹 Cleaning up Docker and Kurtosis environments...");
  logger.debug(await $`kurtosis enclave stop datahaven-ethereum`.nothrow().text());
  logger.debug(await $`kurtosis clean`.text());
  logger.debug(await $`kurtosis engine stop`.text());
  logger.debug(await $`docker system prune -f`.nothrow().text());

  // Pull necessary Docker images
  if (process.platform === "darwin") {
    logger.debug("Detected macOS, pulling container images with linux/amd64 platform...");
    logger.debug(
      await $`docker pull ghcr.io/blockscout/smart-contract-verifier:latest --platform linux/amd64`.text()
    );
  }

  // Run Kurtosis
  logger.info("🚀 Starting Kurtosis enclave...");
  const { stderr, stdout, exitCode } =
    await $`kurtosis run github.com/ethpandaops/ethereum-package --args-file configs/minimal.yaml --enclave datahaven-ethereum`
      .nothrow()
      .quiet();

  if (exitCode !== 0) {
    logger.error(stderr.toString());
    throw Error("❌ Kurtosis network has failed to start properly.");
  }
  logger.debug(stdout.toString());

  // Get service information from Docker
  logger.info("🔍 Detecting Docker container ports...");
  const services = await getServicesFromDocker();

  printDivider();

  return { success: true, services };
};

/**
 * Checks if a Kurtosis enclave named "datahaven-ethereum" is currently running.
 *
 * @returns True if the enclave is running, false otherwise
 */
const checkKurtosisRunning = async (): Promise<boolean> => {
  const text = await $`kurtosis enclave ls | grep "datahaven-ethereum" | grep RUNNING`.text();
  return text.length > 0;
};
