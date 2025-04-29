import { $ } from "bun";
import {
  type KurtosisService,
  confirmWithTimeout,
  getServicesFromKurtosis,
  logger,
  printDivider,
  printHeader
} from "utils";

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
 * @param options.blockscout - Whether to add Blockscout service (true/undefined) or not (false)
 * @param options.skipCleaning - Whether to skip cleaning Kurtosis (true) or not (false)
 * @returns Object containing success status and Docker services information
 */
export const launchKurtosis = async (
  options: { launchKurtosis?: boolean; blockscout?: boolean; skipCleaning?: boolean } = {}
): Promise<Record<string, KurtosisService>> => {
  if (await checkKurtosisRunning()) {
    logger.info("ℹ️  Kurtosis network is already running.");

    logger.trace("Checking if launchKurtosis option was set via flags");
    if (options.launchKurtosis === false) {
      logger.info("Keeping existing Kurtosis enclave. Exiting...");
      return getServicesFromKurtosis();
    }

    if (options.launchKurtosis === true) {
      logger.info("Proceeding to clean and relaunch the Kurtosis enclave...");
    } else {
      // Use confirmWithTimeout if launchKurtosis is undefined
      const shouldRelaunch = await confirmWithTimeout(
        "Do you want to clean and relaunch the Kurtosis enclave?",
        true,
        10
      );

      if (!shouldRelaunch) {
        logger.info("Keeping existing Kurtosis enclave. Exiting...");
        return getServicesFromKurtosis();
      }

      logger.info("Proceeding to clean and relaunch the Kurtosis enclave...");
    }
  }

  printHeader("Starting Kurtosis Network");

  if (!options.skipCleaning) {
    logger.info("🧹 Cleaning up Docker and Kurtosis environments...");
    logger.debug(await $`kurtosis enclave stop datahaven-ethereum`.nothrow().text());
    logger.debug(await $`kurtosis clean`.text());
    logger.debug(await $`kurtosis engine stop`.text());
    logger.debug(await $`docker system prune -f`.nothrow().text());
  }

  if (process.platform === "darwin") {
    logger.debug("Detected macOS, pulling container images with linux/amd64 platform...");
    logger.debug(
      await $`docker pull ghcr.io/blockscout/smart-contract-verifier:latest --platform linux/amd64`.text()
    );
  }

  logger.info("🚀 Starting Kurtosis enclave...");
  const configFile =
    options.blockscout === true
      ? "configs/kurtosis/minimal-with-bs.yaml"
      : "configs/kurtosis/minimal.yaml";
  logger.info(`Using Kurtosis config file: ${configFile}`);

  const { stderr, stdout, exitCode } =
    await $`kurtosis run github.com/ethpandaops/ethereum-package --args-file ${configFile} --enclave datahaven-ethereum`
      .nothrow()
      .quiet();

  if (exitCode !== 0) {
    logger.error(stderr.toString());
    throw Error("❌ Kurtosis network has failed to start properly.");
  }
  logger.debug(stdout.toString());

  logger.info("🔍 Gathering Kurtosis public ports...");
  const services = await getServicesFromKurtosis();

  printDivider();

  return services;
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
