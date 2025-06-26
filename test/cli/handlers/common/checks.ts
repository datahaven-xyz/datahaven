import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import type { DeployOptions } from "../deploy";
import { MIN_BUN_VERSION } from "./consts";
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
    case "local":
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

const checkKurtosisInstalled = async (): Promise<boolean> => {
  const { exitCode, stderr, stdout } = await $`kurtosis version`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.error(stderr.toString());
    return false;
  }
  logger.debug(stdout.toString());
  return true;
};

export const checkKurtosisCluster = async (kubernetes?: boolean): Promise<boolean> => {
  // First check if kurtosis cluster get works
  const { exitCode, stderr, stdout } = await $`kurtosis cluster get`.nothrow().quiet();

  if (exitCode !== 0) {
    logger.error(stderr.toString());
    return false;
  }

  const currentCluster = stdout.toString().trim();
  logger.debug(`Current Kurtosis cluster: ${currentCluster}`);

  // Get the cluster type from config using sed
  const clusterTypeResult =
    await $`CURRENT_CLUSTER=${currentCluster} && sed -n "/^  $CURRENT_CLUSTER:$/,/^  [^ ]/p" "$(kurtosis config path)" | grep "type:" | sed 's/.*type: "\(.*\)"/\1/'`
      .nothrow()
      .quiet();

  if (clusterTypeResult.exitCode !== 0) {
    logger.error("❌ Failed to read Kurtosis cluster type from config");
    logger.debug(clusterTypeResult.stderr.toString());
    return false;
  }

  const clusterType = clusterTypeResult.stdout.toString().trim();
  logger.warn(`Kurtosis cluster type: ${clusterType}`);

  // Validate cluster type against expected type
  if (kubernetes && clusterType !== "kubernetes") {
    logger.error(`❌ Kurtosis cluster type is "${clusterType}" but kubernetes is required`);
    return false;
  }

  if (!kubernetes && clusterType !== "docker") {
    logger.error(`❌ Kurtosis cluster type is "${clusterType}" but docker is required`);
    return false;
  }

  logger.success(`✅ Kurtosis cluster type "${clusterType}" is compatible`);
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
