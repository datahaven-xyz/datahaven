import { $ } from "bun";
import { CHAIN_CONFIGS } from "configs/contracts/config";
import invariant from "tiny-invariant";
import {
  logger,
  parseDeploymentsFile,
  parseRewardsInfoFile,
  runShellCommandWithLogger
} from "utils";
import type { ParameterCollection } from "utils/parameters";

interface ContractDeploymentOptions {
  chain?: string;
  rpcUrl?: string;
  privateKey: string;
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

  if (buildExitCode !== 0) {
    logger.error(buildStderr.toString());
    throw Error("❌ Contracts have failed to build properly.");
  }
  logger.debug(buildStdout.toString());
};

/**
 * Constructs the deployment command
 */
export const constructDeployCommand = (options: ContractDeploymentOptions): string => {
  const { chain, rpcUrl, verified, blockscoutBackendUrl } = options;

  const deploymentScript =
    !chain || chain === "anvil" || chain === "local"
      ? "script/deploy/DeployLocal.s.sol"
      : "script/deploy/DeployTestnet.s.sol";

  logger.info(`🚀 Deploying contracts to ${chain} using ${deploymentScript}`);

  let deployCommand = `forge script ${deploymentScript} --rpc-url ${rpcUrl} --color never -vv --no-rpc-rate-limit --non-interactive --broadcast`;

  // Add environment variable for chain if specified
  if (chain) {
    deployCommand = `NETWORK=${chain} ${deployCommand}`;
  }

  if (verified && blockscoutBackendUrl) {
    // TODO: Allow for other verifiers like Etherscan.
    deployCommand += ` --verify --verifier blockscout --verifier-url ${blockscoutBackendUrl}/api/ --delay 0`;
    logger.info("🔍 Contract verification enabled");
  }

  return deployCommand;
};

/**
 * Executes contract deployment
 * Supports multiple calling patterns for backwards compatibility:
 */
export const executeDeployment = async (
  deployCommand: string,
  parameterCollection?: ParameterCollection,
  chain?: string
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
      const deployments = await parseDeploymentsFile(chain);
      const rewardsInfo = await parseRewardsInfoFile(chain);
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

/**
 * Main function to deploy contracts with simplified interface
 * This is the main entry point for CLI handlers
 */
export const deployContracts = async (options: {
  chain: string;
  rpcUrl?: string;
  privateKey: string;
  verified?: boolean;
  blockscoutBackendUrl?: string;
}) => {
  const chainConfig = CHAIN_CONFIGS[options.chain as keyof typeof CHAIN_CONFIGS];

  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${options.chain}`);
  }

  const finalRpcUrl = options.rpcUrl || chainConfig.RPC_URL;

  const deploymentOptions: ContractDeploymentOptions = {
    chain: options.chain,
    rpcUrl: finalRpcUrl,
    privateKey: options.privateKey,
    verified: options.verified,
    blockscoutBackendUrl: options.blockscoutBackendUrl
  };

  // Validate parameters
  validateDeploymentParams(deploymentOptions);

  // Build contracts
  await buildContracts();

  // Construct and execute deployment
  const deployCommand = constructDeployCommand(deploymentOptions);
  await executeDeployment(deployCommand);

  logger.success(`DataHaven contracts deployed successfully to ${options.chain}`);
};

// Allow script to be run directly with CLI arguments
if (import.meta.main) {
  const args = process.argv.slice(2);

  // Extract RPC URL
  const rpcUrlIndex = args.indexOf("--rpc-url");
  invariant(rpcUrlIndex !== -1, "❌ --rpc-url flag is required");
  invariant(rpcUrlIndex + 1 < args.length, "❌ --rpc-url flag requires an argument");

  // Extract private key
  const privateKeyIndex = args.indexOf("--private-key");
  invariant(privateKeyIndex !== -1, "❌ --private-key flag is required");
  invariant(privateKeyIndex + 1 < args.length, "❌ --private-key flag requires an argument");

  const options: {
    rpcUrl: string;
    privateKey: string;
    verified: boolean;
    blockscoutBackendUrl?: string;
  } = {
    rpcUrl: args[rpcUrlIndex + 1],
    privateKey: args[privateKeyIndex + 1],
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

  const deployCommand = constructDeployCommand(options);
  await executeDeployment(deployCommand);
}
