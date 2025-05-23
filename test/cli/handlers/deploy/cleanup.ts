import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import { waitFor } from "utils/waits";
import { checkKurtosisEnclaveRunning } from "../common/kurtosis";
import type { LaunchedNetwork } from "../common/launchedNetwork";
import type { DeployOptions } from ".";

export const cleanup = async (
  options: DeployOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  printHeader("Cleaning up");

  if (options.environment === "staging") {
    await checkAndCleanKurtosisDeployment(options);
  }

  await checkAndCleanHelmReleases(launchedNetwork);

  printDivider();
};

/**
 * Checks for existing Kurtosis deployment and removes the specified enclave if found.
 *
 * This function performs a cleanup operation before deployment by:
 * 1. Verifying that the Kurtosis gateway process is running (required for Kubernetes integration)
 * 2. Listing all running Kurtosis enclaves
 * 3. Checking if the specified enclave exists
 * 4. Removing the enclave if found to ensure a clean deployment environment
 *
 * The function ensures that any existing Kurtosis enclave with the same name is properly
 * cleaned up before starting a new deployment, preventing conflicts and stale resources.
 *
 * @param options - Deployment configuration options
 * @param options.kurtosisEnclaveName - The name of the Kurtosis enclave to check for and remove.
 *                                     Must be defined in the options object.
 *
 * @returns Promise<void> - Resolves when all cleanup operations are complete
 *
 * @throws {Error} Throws if:
 *   - The Kurtosis gateway process is not running (required for Kubernetes integration)
 *   - Kurtosis commands fail (e.g., Kurtosis not installed, insufficient permissions)
 *   - Network connectivity issues prevent Kurtosis API access
 */
const checkAndCleanKurtosisDeployment = async (options: DeployOptions): Promise<void> => {
  logger.info("☸️ Checking for existing Kurtosis deployment in Kubernetes...");

  // Check if the Kurtosis gateway process is running.
  const { exitCode, stdout } = await $`pgrep -f "kurtosis gateway"`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.error(
      "❌ `kurtosis gateway` process not found running. This is required for Kurtosis to work with Kubernetes."
    );
    throw new Error("Kurtosis gateway process not found running.");
  }
  logger.debug(`Kurtosis gateway process found running: ${stdout}`);

  // Check if Kurtosis enclave is running.
  if (await checkKurtosisEnclaveRunning(options.kurtosisEnclaveName)) {
    logger.info(`🔎 Found Kurtosis enclave ${options.kurtosisEnclaveName} running.`);
  } else {
    logger.info(`🤷‍ No Kurtosis enclave ${options.kurtosisEnclaveName} found running.`);
    return;
  }

  logger.info("🪓 Removing Kurtosis enclave...");
  logger.debug(await $`kurtosis enclave rm ${options.kurtosisEnclaveName} -f`.text());

  // Wait for the underlying Kubernetes namespace to be fully deleted
  const kubernetesNamespace = `kt-${options.kurtosisEnclaveName}`;
  await waitForNamespaceDeletion(kubernetesNamespace);

  logger.success(`Kurtosis enclave ${options.kurtosisEnclaveName} removed successfully.`);
};

/**
 * Checks for existing DataHaven Helm releases in the specified Kubernetes namespace and removes them.
 *
 * This function performs a cleanup operation before deployment by:
 * 1. Listing all Helm releases in the target namespace
 * 2. Identifying any existing DataHaven releases
 * 3. Uninstalling each release individually
 * 4. Logging the progress and results of each operation
 *
 * The function ensures a clean deployment environment by removing any conflicting
 * or stale Helm releases that might interfere with the new deployment.
 *
 * @param options - Deployment configuration options
 * @param options.kubeNamespace - The Kubernetes namespace to check for Helm releases.
 *                                Must be defined or the function will throw an error.
 *
 * @returns Promise<void> - Resolves when all cleanup operations are complete
 *
 * @throws {Error} Throws if:
 *   - The kubeNamespace is not defined in options
 *   - Helm commands fail (e.g., Helm not installed, insufficient permissions)
 *   - Network connectivity issues prevent Kubernetes API access
 */
const checkAndCleanHelmReleases = async (launchedNetwork: LaunchedNetwork): Promise<void> => {
  logger.info("☸️ Checking for existing DataHaven Helm releases in Kubernetes...");

  invariant(launchedNetwork.kubeNamespace, "❌ Kubernetes namespace not defined");

  try {
    const releaseListOutput = await $`helm list -q -n ${launchedNetwork.kubeNamespace}`.text();
    const releases = releaseListOutput
      .trim()
      .split("\n")
      .filter((r) => r.length > 0);

    if (releases.length > 0) {
      logger.info(
        `🔎 Found existing DataHaven Helm releases: ${releases.join(", ")}. Uninstalling...`
      );
      for (const release of releases) {
        logger.info(`Uninstalling Helm release: ${release} in namespace datahaven...`);
        await $`helm uninstall ${release} -n ${launchedNetwork.kubeNamespace}`.text();
        logger.success(`Helm release ${release} uninstalled successfully.`);
      }
    } else {
      logger.info("👍 No existing DataHaven Helm releases found in namespace datahaven.");
    }
  } catch (error) {
    logger.error(
      `❌ Failed to check or clean Kubernetes Helm releases: ${error}. This may be expected if Helm is not installed or not configured. Proceeding...`
    );

    throw error;
  }
};

/**
 * Waits for a Kubernetes namespace to be fully deleted.
 * This is necessary because namespace deletion in Kubernetes is asynchronous
 * and Kurtosis may fail to create a new enclave if the namespace is still being deleted.
 *
 * @param namespaceName - The name of the Kubernetes namespace to wait for deletion
 * @returns Promise<void> - Resolves when the namespace is fully deleted or doesn't exist
 */
const waitForNamespaceDeletion = async (namespaceName: string): Promise<void> => {
  logger.info(`⌛️ Waiting for Kubernetes namespace ${namespaceName} to be fully deleted...`);

  await waitFor({
    lambda: async () => {
      try {
        const { exitCode } = await $`kubectl get namespace ${namespaceName}`.nothrow().quiet();
        // If kubectl get namespace returns non-zero exit code, the namespace doesn't exist
        return exitCode !== 0;
      } catch (error) {
        // If kubectl command fails, assume namespace is deleted or kubectl is not available
        logger.debug(`kubectl command failed: ${error}. Assuming namespace is deleted.`);
        return true;
      }
    },
    iterations: 30, // Wait up to 5 minutes (30 * 10 seconds)
    delay: 10000 // 10 seconds between checks
  });

  logger.success(`Kubernetes namespace ${namespaceName} fully deleted.`);
};
