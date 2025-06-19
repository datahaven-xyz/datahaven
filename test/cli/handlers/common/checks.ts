import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";
import {
  checkBunVersion,
  checkDockerRunning,
  checkForgeInstalled,
  checkHelmInstalled,
  checkKurtosisInstalled
} from "../../../launcher/utils";
import type { DeployOptions } from "../deploy";

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
      "Bun version is too old. Upgrade from: https://bun.sh/docs/installation#upgrading"
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
