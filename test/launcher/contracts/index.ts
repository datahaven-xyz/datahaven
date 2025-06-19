import { $ } from "bun";
import invariant from "tiny-invariant";
import {
  logger,
  parseDeploymentsFile,
  parseRewardsInfoFile,
  runShellCommandWithLogger
} from "utils";
import type { ParameterCollection } from "utils/parameters";
import type { ContractsDeployOptions, ContractsDeployResult } from "./types";

export const deployContracts = async (
  options: ContractsDeployOptions
): Promise<ContractsDeployResult> => {
  try {
    logger.info("🚀 Deploying smart contracts...");

    // Validate parameters
    validateDeploymentParams(options);

    // Build contracts
    logger.info("🛳️ Building contracts...");
    await buildContracts();

    // Construct and execute deployment command
    logger.info("⌛️ Deploying contracts (this might take a few minutes)...");
    const command = constructDeployCommand(options);
    await executeDeployment(command, options.parameterCollection);

    logger.success("Smart contracts deployed successfully");

    return {
      success: true,
      deployed: true
    };
  } catch (error) {
    logger.error("Failed to deploy contracts", error);
    return {
      success: false,
      error: error as Error
    };
  }
}

/**
 * Validates deployment parameters
 */
export const validateDeploymentParams = (options: ContractsDeployOptions): void => {
  const { rpcUrl, verified, blockscoutBackendUrl } = options;

  invariant(rpcUrl, "❌ RPC URL is required");
  if (verified) {
    invariant(blockscoutBackendUrl, "❌ Blockscout backend URL is required for verification");
  }
}

/**
 * Builds smart contracts using forge
 */
export const buildContracts = async (): Promise<void> => {
  const {
    exitCode: buildExitCode,
    stderr: buildStderr,
    stdout: buildStdout
  } = await $`forge build`.cwd("../contracts").nothrow().quiet();

  if (buildExitCode !== 0) {
    logger.error(buildStderr.toString());
    throw Error("❌ Contracts have failed to build properly.");
  }
  logger.debug(buildStdout.toString());
}

/**
 * Constructs the deployment command
 */
export const constructDeployCommand = (options: ContractsDeployOptions): string => {
  const { rpcUrl, verified, blockscoutBackendUrl } = options;

  let deployCommand = `forge script script/deploy/DeployLocal.s.sol --rpc-url ${rpcUrl} --color never -vv --no-rpc-rate-limit --non-interactive --broadcast`;

  if (verified && blockscoutBackendUrl) {
    // TODO: Allow for other verifiers like Etherscan.
    deployCommand += ` --verify --verifier blockscout --verifier-url ${blockscoutBackendUrl}/api/ --delay 0`;
    logger.info("🔍 Contract verification enabled");
  }

  return deployCommand;
}

/**
 * Executes contract deployment
 */
export const executeDeployment = async (
  deployCommand: string,
  parameterCollection?: ParameterCollection
): Promise<void> => {
  // Using custom shell command to improve logging with forge's stdoutput
  await runShellCommandWithLogger(deployCommand, { cwd: "../contracts" });

  // After deployment, read the deployment results and add to parameters if collection is provided
  if (parameterCollection) {
    try {
      const deployments = await parseDeploymentsFile();
      const rewardsInfo = await parseRewardsInfoFile();
      const gatewayAddress = deployments.Gateway;
      const rewardsRegistryAddress = deployments.RewardsRegistry;
      const rewardsAgentOrigin = rewardsInfo.RewardsAgentOrigin;
      const updateRewardsMerkleRootSelector = rewardsInfo.updateRewardsMerkleRootSelector;

      if (gatewayAddress) {
        logger.debug(`📝 Adding EthereumGatewayAddress parameter: ${gatewayAddress}`);

        parameterCollection.addParameter({
          name: "EthereumGatewayAddress",
          value: gatewayAddress
        });
      } else {
        logger.warn("⚠️ Gateway address not found in deployments file");
      }

      if (rewardsRegistryAddress) {
        logger.debug(`📝 Adding RewardsRegistryAddress parameter: ${rewardsRegistryAddress}`);
        parameterCollection.addParameter({
          name: "RewardsRegistryAddress",
          value: rewardsRegistryAddress
        });
      } else {
        logger.warn("⚠️ RewardsRegistry address not found in deployments file");
      }

      if (updateRewardsMerkleRootSelector) {
        logger.debug(
          `📝 Adding RewardsUpdateSelector parameter: ${updateRewardsMerkleRootSelector}`
        );
        parameterCollection.addParameter({
          name: "RewardsUpdateSelector",
          value: updateRewardsMerkleRootSelector
        });
      } else {
        logger.warn("⚠️ updateRewardsMerkleRootSelector not found in rewards info file");
      }

      if (rewardsAgentOrigin) {
        logger.debug(`📝 Adding RewardsAgentOrigin parameter: ${rewardsAgentOrigin}`);
        parameterCollection.addParameter({
          name: "RewardsAgentOrigin",
          value: rewardsAgentOrigin
        });
      } else {
        logger.warn("⚠️ RewardsAgentOrigin not found in deployments file");
      }
    } catch (error) {
      logger.error(`Failed to read parameters from deployment: ${error}`);
    }
  }
}
