import type { Command } from "@commander-js/extra-typings";
import { $ } from "bun";
import { logger, printHeader } from "utils";

interface LaunchOptions {
  verified?: boolean;
  launchKurtosis?: boolean;
  deployContracts?: boolean;
  fundValidators?: boolean;
  setupValidators?: boolean;
  updateValidatorSet?: boolean;
  blockscout?: boolean;
  relayer?: boolean;
}

// =====  Launch Handler Functions  =====

export const launch = async (options: LaunchOptions) => {
  logger.debug("Running with options:");
  logger.debug(options);

  const timeStart = performance.now();

  printHeader("Environment Checks");

  await checkDependencies();
};

export const launchPreActionHook = (
  thisCmd: Command<[], LaunchOptions & { [key: string]: any }>
) => {
  const { blockscout, verified } = thisCmd.opts();
  if (verified && !blockscout) {
    thisCmd.error("--verified requires --blockscout to be set");
  }
};

//  =====  Checks  =====
const checkDependencies = async (): Promise<void> => {
  if (!(await checkKurtosisInstalled())) {
    logger.error("Kurtosis CLI is required to be installed: https://docs.kurtosis.com/install");
    throw Error("❌ Kurtosis CLI application not found.");
  }

  logger.success("Kurtosis CLI found");

  if (!(await checkDockerRunning())) {
    logger.error("Is Docker Running? Unable to make connection to docker daemon");
    throw Error("❌ Error connecting to Docker");
  }

  logger.success("Docker is running");

  if (!(await checkForgeInstalled())) {
    logger.error("Is foundry installed? https://book.getfoundry.sh/getting-started/installation");
    throw Error("❌ forge binary not found in PATH");
  }

  logger.success("Forge is installed");
};

const checkKurtosisInstalled = async (): Promise<boolean> => {
  const { exitCode, stderr, stdout } = await $`kurtosis version`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.error(stderr.toString());
    return false;
  }
  logger.debug(stdout.toString());
  return true;
};

const checkDockerRunning = async (): Promise<boolean> => {
  const { exitCode, stderr, stdout } = await $`docker system info`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.error(stderr.toString());
    return false;
  }
  logger.debug(stdout.toString());
  return true;
};

const checkForgeInstalled = async (): Promise<boolean> => {
  const { exitCode, stderr, stdout } = await $`forge --version`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.error(stderr.toString());
    return false;
  }
  logger.debug(stdout.toString());
  return true;
};
