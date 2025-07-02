import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";
import { checkBaseDependencies as checkBaseDependenciesFunc } from "../../../launcher/utils";
import type { DeployOptions } from "../deploy";

//  =====  Checks  =====
export const checkBaseDependencies = async (): Promise<void> => {
  printHeader("Base Dependencies Checks");

  await checkBaseDependenciesFunc();

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
};
