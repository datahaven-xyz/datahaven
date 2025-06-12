import { $ } from "bun";
import type { LaunchOptions } from "cli/handlers";
import invariant from "tiny-invariant";
import {
  confirmWithTimeout,
  logger,
  parseDeploymentsFile,
  printDivider,
  printHeader,
  runShellCommandWithLogger,
  waitForNodeToSync
} from "utils";
import type { ParameterCollection } from "utils/parameters";

interface DeployContractsOptions {
  rpcUrl: string;
  blockscoutBackendUrl?: string;
  parameterCollection?: ParameterCollection;
  options: LaunchOptions;
}

/**
 * Deploys smart contracts to the specified RPC URL
 *
 * @param options - Configuration options for deployment
 * @param options.rpcUrl - The RPC URL to deploy to
 * @param options.blockscoutBackendUrl - URL for the Blockscout API (required if verified is true)
 * @param options.parameterCollection - Collection of parameters to update in the DataHaven runtime
 * @returns Promise resolving to true if contracts were deployed successfully, false if skipped
 */
export const deployContracts = async (opt: DeployContractsOptions): Promise<boolean> => {
  const { rpcUrl, blockscoutBackendUrl, parameterCollection, options } = opt;

  // Check if deployContracts option was set via flags, or prompt if not
  let shouldDeployContracts = options.deployContracts
    ? options.deployContracts && options.injectContracts !== true
    : options.deployContracts;
  if (shouldDeployContracts === undefined) {
    shouldDeployContracts = await confirmWithTimeout(
      "Do you want to deploy the smart contracts?",
      true,
      10
    );
  } else {
    logger.info(
      `🏳️ Using flag option: ${shouldDeployContracts ? "will deploy" : "will not deploy"} smart contracts`
    );
  }

  if (!shouldDeployContracts) {
    logger.info("👍 Skipping contract deployment. Done!");
    printDivider();

    return false;
  }

  // Check if required parameters are provided
  invariant(rpcUrl, "❌ RPC URL is required");
  if (options.verified) {
    invariant(blockscoutBackendUrl, "❌ Blockscout backend URL is required for verification");
  }

  printHeader("Deploying Smart Contracts");

  // Build contracts
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

  // Check if the node is syncing before deploying
  logger.info("🔄 Checking if node is syncing...");
  await waitForNodeToSync(rpcUrl);

  let deployCommand = `forge script script/deploy/DeployLocal.s.sol --rpc-url ${rpcUrl} --color never -vv --no-rpc-rate-limit --non-interactive --broadcast`;

  if (options.verified && blockscoutBackendUrl) {
    deployCommand += ` --verify --verifier blockscout --verifier-url ${blockscoutBackendUrl}/api/ --delay 0`;
    logger.info("🔍 Contract verification enabled");
  }

  logger.info("⌛️ Deploying contracts (this might take a few minutes)...");

  // Using custom shell command to improve logging with forge's stdoutput
  await runShellCommandWithLogger(deployCommand, { cwd: "../contracts" });

  // After deployment, read the Gateway address and add it to parameters if collection is provided
  if (parameterCollection) {
    try {
      const deployments = await parseDeploymentsFile();
      logger.debug("📂 Reading deployments file for Gateway address");
      logger.debug(`📂 Deployments file content: ${JSON.stringify(deployments, null, 2)}`);
      const gatewayAddress = deployments.Gateway;

      if (gatewayAddress) {
        logger.debug(`📝 Adding EthereumGatewayAddress parameter: ${gatewayAddress}`);

        parameterCollection.addParameter({
          name: "EthereumGatewayAddress",
          value: gatewayAddress
        });
      } else {
        logger.warn("⚠️ Gateway address not found in deployments file");
      }
    } catch (error) {
      logger.error(`Failed to read Gateway address from deployments: ${error}`);
    }
  }

  logger.success("Contracts deployed successfully");
  printDivider();

  return true;
};

// Allow script to be run directly with CLI arguments
if (import.meta.main) {
  const args = process.argv.slice(2);
  const options: {
    rpcUrl?: string;
    verified: boolean;
    blockscoutBackendUrl?: string;
    deployContracts?: boolean;
  } = {
    verified: args.includes("--verified"),
    deployContracts: args.includes("--deploy-contracts")
      ? true
      : args.includes("--no-deploy-contracts")
        ? false
        : undefined
  };

  // Extract RPC URL
  const rpcUrlIndex = args.indexOf("--rpc-url");
  if (rpcUrlIndex !== -1 && rpcUrlIndex + 1 < args.length) {
    options.rpcUrl = args[rpcUrlIndex + 1];
  }

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

  deployContracts({
    rpcUrl: options.rpcUrl,
    blockscoutBackendUrl: options.blockscoutBackendUrl,
    options: {
      kurtosisEnclaveName: "",
      relayerImageTag: "",
      datahavenImageTag: "",
      datahavenBuildExtraArgs: ""
    }
  }).catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
}
