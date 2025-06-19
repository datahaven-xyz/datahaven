import { $ } from "bun";
import { logger } from "utils";

// Minimum Bun version required
const MIN_BUN_VERSION = { major: 1, minor: 1 };

/**
 * Checks if all base dependencies are installed and available.
 * These checks are needed for both CLI and test environments.
 */
export const checkBaseDependencies = async (options?: {
  skipDocker?: boolean;
  skipKurtosis?: boolean;
  skipForge?: boolean;
}): Promise<void> => {
  if (!options?.skipKurtosis && !(await checkKurtosisInstalled())) {
    throw new Error(
      "❌ Kurtosis CLI application not found. Install from: https://docs.kurtosis.com/install"
    );
  }

  if (!(await checkBunVersion())) {
    throw new Error(
      `❌ Bun version must be ${MIN_BUN_VERSION.major}.${MIN_BUN_VERSION.minor} or higher. Upgrade from: https://bun.sh/docs/installation#upgrading`
    );
  }

  if (!options?.skipDocker && !(await checkDockerRunning())) {
    throw new Error("❌ Docker is not running. Please start Docker daemon.");
  }

  if (!options?.skipForge && !(await checkForgeInstalled())) {
    throw new Error(
      "❌ Forge binary not found. Install from: https://book.getfoundry.sh/getting-started/installation"
    );
  }
}

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
}

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
}

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
}

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
}

/**
 * Checks if Helm is installed (only needed for deployment)
 */
export const checkHelmInstalled = async (): Promise<boolean> => {
  const { exitCode, stderr, stdout } = await $`helm version`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.debug(`Helm check failed: ${stderr.toString()}`);
    return false;
  }
  logger.debug(`Helm version: ${stdout.toString().trim()}`);
  return true;
}
