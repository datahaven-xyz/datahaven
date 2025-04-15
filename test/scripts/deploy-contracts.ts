import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger, printHeader, promptWithTimeout } from "utils";

interface DeployContractsOptions {
  rpcUrl: string;
  verified?: boolean;
  blockscoutBackendUrl?: string;
  deployContracts?: boolean;
}

/**
 * Deploys smart contracts to the specified RPC URL
 *
 * @param options - Configuration options for deployment
 * @param options.rpcUrl - The RPC URL to deploy to
 * @param options.verified - Whether to verify contracts (requires blockscoutBackendUrl)
 * @param options.blockscoutBackendUrl - URL for the Blockscout API (required if verified is true)
 * @param options.deployContracts - Flag to control deployment (if undefined, will prompt)
 * @returns Promise resolving to true if contracts were deployed successfully, false if skipped
 */
export const deployContracts = async (options: DeployContractsOptions): Promise<boolean> => {
  const { rpcUrl, verified = false, blockscoutBackendUrl, deployContracts } = options;

  // Check if deployContracts option was set via flags, or prompt if not
  let shouldDeployContracts = deployContracts;
  if (shouldDeployContracts === undefined) {
    shouldDeployContracts = await promptWithTimeout(
      "Do you want to deploy the smart contracts?",
      true,
      10
    );
  } else {
    logger.info(
      `Using flag option: ${shouldDeployContracts ? "will deploy" : "will not deploy"} smart contracts`
    );
  }

  if (!shouldDeployContracts) {
    logger.info("Skipping contract deployment. Done!");
    return false;
  }

  // Check if required parameters are provided
  invariant(rpcUrl, "❌ RPC URL is required");
  if (verified) {
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

  // Get forge path
  const { stdout: forgePath } = await $`which forge`.quiet();
  const forgeExecutable = forgePath.toString().trim();

  // Prepare deployment command
  let deployCommand = `${forgeExecutable} script script/deploy/DeployLocal.s.sol --rpc-url ${rpcUrl} --color never -vv --no-rpc-rate-limit --non-interactive --broadcast`;

  if (verified && blockscoutBackendUrl) {
    deployCommand += ` --verify --verifier blockscout --verifier-url ${blockscoutBackendUrl}/api/ --delay 0`;
    logger.info("🔍 Contract verification enabled");
  }

  logger.info("⏳ Deploying contracts (this might take a few minutes)...");

  const { exitCode: deployExitCode, stderr: deployStderr } = await $`sh -c ${deployCommand}`
    .cwd("../contracts")
    .nothrow();

  if (deployExitCode !== 0) {
    logger.error(deployStderr.toString());
    throw Error("❌ Contracts have failed to deploy properly.");
  }

  logger.success("Contracts deployed successfully");
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

  // Check required parameters
  if (!options.rpcUrl) {
    console.error("Error: --rpc-url parameter is required");
    process.exit(1);
  }

  if (options.verified && !options.blockscoutBackendUrl) {
    console.error("Error: --blockscout-url parameter is required when using --verified");
    process.exit(1);
  }

  // Run deployment
  deployContracts({
    rpcUrl: options.rpcUrl,
    verified: options.verified,
    blockscoutBackendUrl: options.blockscoutBackendUrl,
    deployContracts: options.deployContracts
  }).catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
}
