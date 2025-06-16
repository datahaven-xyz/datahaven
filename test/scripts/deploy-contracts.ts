import { $ } from "bun";
import invariant from "tiny-invariant";
import {
  logger,
  parseDeploymentsFile,
  parseRewardsInfoFile,
  runShellCommandWithLogger,
  waitForNodeToSync
} from "utils";
import type { ParameterCollection } from "utils/parameters";

interface ContractDeploymentOptions {
  rpcUrl: string;
  verified?: boolean;
  blockscoutBackendUrl?: string;
}

/**
 * Validates deployment parameters
 */
export const validateDeploymentParams = (options: ContractDeploymentOptions) => {
  const { rpcUrl, verified, blockscoutBackendUrl } = options;

  invariant(rpcUrl, "❌ RPC URL is required");
  if (verified) {
    invariant(blockscoutBackendUrl, "❌ Blockscout backend URL is required for verification");
  }
};

/**
 * Builds smart contracts using forge
 */
export const buildContracts = async () => {
  logger.info("🛳️ Building contracts...");
  const {
    exitCode: buildExitCode,
    stderr: buildStderr,
    stdout: buildStdout
  } = await $`forge build`.cwd("../contracts").nothrow().quiet();

  await $`bun run biome format --write ../contracts/deployments/state-diff.json`;

  if (buildExitCode !== 0) {
    logger.error(buildStderr.toString());
    throw Error("❌ Contracts have failed to build properly.");
  }
  logger.debug(buildStdout.toString());
};

/**
 * Constructs the deployment command
 */
export const constructDeployCommand = async (
  options: ContractDeploymentOptions
): Promise<string> => {
  const { rpcUrl, verified, blockscoutBackendUrl } = options;

  // Check if the node is syncing before deploying
  logger.info("🔄 Checking if node is syncing...");
  await waitForNodeToSync(rpcUrl);

  let deployCommand = `forge script script/deploy/DeployLocal.s.sol --rpc-url ${rpcUrl} --color never -vv --no-rpc-rate-limit --non-interactive --broadcast`;

  if (verified && blockscoutBackendUrl) {
    deployCommand += ` --verify --verifier blockscout --verifier-url ${blockscoutBackendUrl}/api/ --delay 0`;
    logger.info("🔍 Contract verification enabled");
  }

  return deployCommand;
};

/**
 * Executes contract deployment
 */
export const executeDeployment = async (
  deployCommand: string,
  parameterCollection?: ParameterCollection
) => {
  logger.info("⌛️ Deploying contracts (this might take a few minutes)...");

  // Using custom shell command to improve logging with forge's stdoutput
  await runShellCommandWithLogger(deployCommand, { cwd: "../contracts" });

  // After deployment, read the:
  // - Gateway address
  // - RewardsRegistry address
  // - RewardsAgent address
  // - RewardsAgentOrigin (bytes32)
  // and add it to parameters if collection is provided
  if (parameterCollection) {
    try {
      const deployments = await parseDeploymentsFile();
      logger.debug("📂 Reading deployments file for Gateway address");
      logger.debug(`📂 Deployments file content: ${JSON.stringify(deployments, null, 2)}`);
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

  logger.success("Contracts deployed successfully");
};

// Allow script to be run directly with CLI arguments
if (import.meta.main) {
  const args = process.argv.slice(2);

  // Extract RPC URL
  const rpcUrlIndex = args.indexOf("--rpc-url");
  invariant(rpcUrlIndex !== -1, "❌ --rpc-url flag is required");
  invariant(rpcUrlIndex + 1 < args.length, "❌ --rpc-url flag requires an argument");

  const options: {
    rpcUrl: string;
    verified: boolean;
    blockscoutBackendUrl?: string;
  } = {
    rpcUrl: args[rpcUrlIndex + 1],
    verified: args.includes("--verified")
  };

  // Extract Blockscout URL if verification is enabled
  if (options.verified) {
    const blockscoutUrlIndex = args.indexOf("--blockscout-url");
    if (blockscoutUrlIndex !== -1 && blockscoutUrlIndex + 1 < args.length) {
      options.blockscoutBackendUrl = args[blockscoutUrlIndex + 1];
    }
  }

  if (!options.rpcUrl) {
    console.error("Error: --rpc-url parameter is required");
    process.exit(1);
  }

  if (options.verified && !options.blockscoutBackendUrl) {
    console.error("Error: --blockscout-url parameter is required when using --verified");
    process.exit(1);
  }

  validateDeploymentParams(options);

  await buildContracts();

  const deployCommand = await constructDeployCommand(options);
  await executeDeployment(deployCommand);
}
