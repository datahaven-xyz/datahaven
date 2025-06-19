import type { DeployOptions } from "cli/handlers";
import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";
import { registerServices, runKurtosisEnclave } from "../common/kurtosis";

/**
 * Deploys a Kurtosis Ethereum network enclave for stagenet environment.
 *
 * @param options - Configuration options
 * @param launchedNetwork - The LaunchedNetwork instance to store network details
 */
export const deployKurtosis = async (
  options: DeployOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  if (options.skipKurtosis) {
    logger.info("🏳️ Skipping Kurtosis deployment");

    await registerServices(launchedNetwork, options.kurtosisEnclaveName);
    printDivider();
    return;
  }

  printHeader("Deploying Kurtosis Ethereum Network");

  invariant(
    options.environment === "stagenet",
    "❌ Kurtosis should only be used in stagenet environment"
  );

  await runKurtosisEnclave(options, "configs/kurtosis/minimal.yaml");

  await registerServices(launchedNetwork, options.kurtosisEnclaveName);
  logger.success("Kurtosis network operations completed successfully.");
  printDivider();
};
