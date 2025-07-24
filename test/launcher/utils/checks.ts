import { $ } from "bun";
import { logger } from "utils";

// Minimum Bun version required
const MIN_BUN_VERSION = { major: 1, minor: 1 };

/**
 * Checks if all base dependencies are installed and available.
 * These checks are needed for both CLI and test environments.
 */
export const checkBaseDependencies = async (): Promise<void> => {
  if (!(await checkKurtosisInstalled())) {
    logger.error("Kurtosis CLI is required to be installed: https://docs.kurtosis.com/install");
    throw Error("❌ Kurtosis CLI application not found.");
  }

  logger.success("Kurtosis CLI found");

  if (!(await checkBunVersion())) {
    logger.error(
      `Bun version must be ${MIN_BUN_VERSION.major}.${MIN_BUN_VERSION.minor} or higher: https://bun.sh/docs/installation#upgrading`
    );
    throw Error("❌ Bun version is too old.");
  }

  logger.success("Bun is installed and up to date");

  if (!(await checkDockerRunning())) {
    logger.error("Is Docker Running? Unable to make connection to docker daemon");
    throw Error("❌ Error connecting to Docker");
  }

  logger.success("Docker is running");

  if (!(await checkForgeInstalled())) {
    logger.error("Is foundry installed? https://book.getfoundry.sh/getting-started/installation");
    throw Error("❌ Forge binary not found in PATH");
  }

  logger.success("Forge is installed");
};

/**
 * Checks if Bun version meets minimum requirements
 */
export const checkBunVersion = async (): Promise<boolean> => {
  const bunVersion = Bun.version;
  const [major, minor] = bunVersion.split(".").map(Number);

  // Check if version meets minimum requirements
  const isVersionValid =
    major > MIN_BUN_VERSION.major ||
    (major === MIN_BUN_VERSION.major && minor >= MIN_BUN_VERSION.minor);

  if (!isVersionValid) {
    logger.debug(`Bun version: ${bunVersion} (too old)`);
    return false;
  }

  logger.debug(`Bun version: ${bunVersion}`);
  return true;
};

/**
 * Checks if Kurtosis CLI is installed
 */
export const checkKurtosisInstalled = async (): Promise<boolean> => {
  const { exitCode, stderr, stdout } = await $`kurtosis version`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.debug(`Kurtosis check failed: ${stderr.toString()}`);
    return false;
  }
  logger.debug(`Kurtosis version: ${stdout.toString().trim()}`);
  return true;
};

/**
 * Checks if Docker daemon is running
 */
export const checkDockerRunning = async (): Promise<boolean> => {
  const { exitCode, stderr } = await $`docker system info`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.debug(`Docker check failed: ${stderr.toString()}`);
    return false;
  }
  logger.debug("Docker daemon is running");
  return true;
};

/**
 * Checks if Forge (Foundry) is installed
 */
export const checkForgeInstalled = async (): Promise<boolean> => {
  const { exitCode, stderr, stdout } = await $`forge --version`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.debug(`Forge check failed: ${stderr.toString()}`);
    return false;
  }
  logger.debug(`Forge version: ${stdout.toString().trim()}`);
  return true;
};

/**
 * Checks if the Kurtosis cluster type that is configured is compatible with the expected type
 * @param kubernetes - Whether the cluster is expected to be a Kubernetes cluster
 * @returns true if the cluster type is compatible, false otherwise
 */
export const checkKurtosisCluster = async (kubernetes?: boolean): Promise<boolean> => {
  // First check if kurtosis cluster get works
  const { exitCode, stderr, stdout } = await $`kurtosis cluster get`.nothrow().quiet();

  if (exitCode !== 0) {
    logger.warn(`⚠️ Kurtosis cluster get failed: ${stderr.toString()}`);
    logger.info("ℹ️ Assuming local launch mode and continuing.");
    return true;
  }

  const currentCluster = stdout.toString().trim();
  logger.debug(`Current Kurtosis cluster: ${currentCluster}`);

  // Try to get the cluster type from config, but don't fail if config path is not reachable
  const clusterTypeResult =
    await $`CURRENT_CLUSTER=${currentCluster} && sed -n "/^  $CURRENT_CLUSTER:$/,/^  [^ ]/p" "$(kurtosis config path)" | grep "type:" | sed 's/.*type: "\(.*\)"/\1/'`
      .nothrow()
      .quiet();

  if (clusterTypeResult.exitCode !== 0) {
    logger.warn("⚠️ Failed to read Kurtosis cluster type from config");
    logger.debug(clusterTypeResult.stderr.toString());
    logger.info("ℹ️ Assuming local launch mode and continuing gracefully");
    return true; // Continue gracefully for local launch
  }

  const clusterType = clusterTypeResult.stdout.toString().trim();
  logger.debug(`Kurtosis cluster type: ${clusterType}`);

  // Validate cluster type against expected type
  if (kubernetes && clusterType !== "kubernetes") {
    logger.error(`❌ Kurtosis cluster type is "${clusterType}" but kubernetes is required`);
    return false;
  }

  if (!kubernetes && clusterType !== "docker") {
    logger.error(`❌ Kurtosis cluster type is "${clusterType}" but docker is required`);
    return false;
  }

  logger.success(`Kurtosis cluster type "${clusterType}" is compatible`);
  return true;
};
