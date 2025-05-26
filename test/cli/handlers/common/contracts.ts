import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger, runShellCommandWithLogger } from "utils";

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
  const { rpcUrl, verified, blockscoutBackendUrl } = options;

  let deployCommand = `forge script script/deploy/DeployLocal.s.sol --rpc-url ${rpcUrl} --color never -vv --no-rpc-rate-limit --non-interactive --broadcast`;

  if (verified && blockscoutBackendUrl) {
    // TODO: Allow for other verifiers like Etherscan.
    deployCommand += ` --verify --verifier blockscout --verifier-url ${blockscoutBackendUrl}/api/ --delay 0`;
    logger.info("🔍 Contract verification enabled");
  }

  return deployCommand;
};

/**
 * Executes contract deployment
 */
export const executeDeployment = async (deployCommand: string) => {
  logger.info("⌛️ Deploying contracts (this might take a few minutes)...");

  // Using custom shell command to improve logging with forge's stdoutput
  await runShellCommandWithLogger(deployCommand, { cwd: "../contracts" });

  logger.success("Contracts deployed successfully");
};
