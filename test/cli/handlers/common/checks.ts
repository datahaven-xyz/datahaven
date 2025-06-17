import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import type { DeployOptions } from "../deploy";
import type { LaunchedNetwork } from "./launchedNetwork";

//  =====  Checks  =====
export const checkBaseDependencies = async (): Promise<void> => {
  printHeader("Base Dependencies Checks");

  if (!(await checkKurtosisInstalled())) {
    logger.error("Kurtosis CLI is required to be installed: https://docs.kurtosis.com/install");
    throw Error("❌ Kurtosis CLI application not found.");
  }

  logger.success("Kurtosis CLI found");

  if (!(await checkBunVersion())) {
    logger.error("Bun version must be 1.2 or higher. Run `bun upgrade` to upgrade.");
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

  printDivider();
};

export const deploymentChecks = async (
  options: DeployOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  printHeader("Deploy Dependencies Checks");

  if (!(await checkHelmInstalled())) {
    logger.error("Is Helm installed? https://helm.sh/docs/intro/install/");
    throw Error("❌ Helm binary not found in PATH");
  }

  logger.success("Helm is installed");

  switch (options.environment) {
    case "stagenet":
      launchedNetwork.kubeNamespace = `kt-${options.kurtosisEnclaveName}`;
      break;
    case "testnet":
    case "mainnet":
      launchedNetwork.kubeNamespace = options.kubeNamespace ?? `datahaven-${options.environment}`;

      invariant(
        options.elRpcUrl !== undefined,
        "❌ --el-rpc-url is required in testnet environment"
      );
      invariant(
        options.clEndpoint !== undefined,
        "❌ --cl-endpoint is required in testnet environment"
      );
      launchedNetwork.elRpcUrl = options.elRpcUrl;
      launchedNetwork.clEndpoint = options.clEndpoint;

      break;
  }

  logger.info(`ℹ️ Deploying to Kubernetes namespace: ${launchedNetwork.kubeNamespace}`);

  printDivider();
};

const checkBunVersion = async (): Promise<boolean> => {
  const bunVersion = Bun.version;
  const [major, minor] = bunVersion.split(".").map(Number);

  // Check if version meets minimum requirements (1.2+)
  const isVersionValid = major > 1 || (major === 1 && minor >= 2);

  if (!isVersionValid) {
    logger.debug(`Bun version: ${bunVersion} (too old)`);
    return false;
  }

  logger.debug(`Bun version: ${bunVersion}`);
  return true;
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

const checkHelmInstalled = async (): Promise<boolean> => {
  const { exitCode, stderr, stdout } = await $`helm version`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.error(stderr.toString());
    return false;
  }
  logger.debug(stdout.toString());
  return true;
};
