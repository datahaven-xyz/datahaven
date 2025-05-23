import type { DeployOptions } from "cli/handlers";
import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import { registerServices, runKurtosisEnclave } from "../common/kurtosis";
import type { LaunchedNetwork } from "../common/launchedNetwork";

/**
 * Launches a Kurtosis Ethereum network enclave for staging environment.
 *
 * @param launchedNetwork - The LaunchedNetwork instance to store network details
 * @param options - Configuration options
 */
export const launchKurtosis = async (
  options: DeployOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  printHeader("Starting Kurtosis EthereumNetwork");

  invariant(
    options.environment === "staging",
    "❌ Kurtosis should only be used in staging environment"
  );

  await runKurtosisEnclave(options, "configs/kurtosis/minimal.yaml");

  await registerServices(launchedNetwork, options.kurtosisEnclaveName);
  logger.success("Kurtosis network operations completed successfully.");
  printDivider();
};
