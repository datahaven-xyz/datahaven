import { logger, printDivider, printHeader } from "utils";
import { deployContracts } from "../../../scripts/deploy-contracts";
import { showDeploymentPlanAndStatus } from "./status";
import { verifyContracts } from "./verify";

export const contractsDeploy = async (options: any, command: any) => {
  // Try to get chain from options or command
  let chain = options.chain;
  if (!chain && command.parent) {
    chain = command.parent.getOptionValue("chain");
  }
  if (!chain) {
    chain = command.getOptionValue("chain");
  }

  // Get environment option
  let environment = options.environment;
  if (!environment && command.parent) {
    environment = command.parent.getOptionValue("environment");
  }

  // Build display name for logging
  const displayName = environment ? `${environment}-${chain}` : chain;

  printHeader(`Deploying DataHaven Contracts to ${displayName}`);

  const txExecutionOverride = options.executeOwnerTransactions ? true : undefined;

  try {
    logger.info("🚀 Starting deployment...");
    logger.info(`📡 Using chain: ${chain}`);
    if (environment) {
      logger.info(`📡 Using environment: ${environment}`);
    }
    if (options.rpcUrl) {
      logger.info(`📡 Using RPC URL: ${options.rpcUrl}`);
    }

    await deployContracts({
      chain: chain,
      environment: environment,
      rpcUrl: options.rpcUrl,
      privateKey: options.privateKey,
      avsOwnerKey: options.avsOwnerKey,
      avsOwnerAddress: options.avsOwnerAddress,
      txExecution: txExecutionOverride
    });

    printDivider();
  } catch (error) {
    logger.error(`❌ Deployment failed: ${error}`);
  }
};

export const contractsCheck = async (options: any, command: any) => {
  // Try to get chain from options or command
  let chain = options.chain;
  if (!chain && command.parent) {
    chain = command.parent.getOptionValue("chain");
  }
  if (!chain) {
    chain = command.getOptionValue("chain");
  }

  // Get environment option
  let environment = options.environment;
  if (!environment && command.parent) {
    environment = command.parent.getOptionValue("environment");
  }

  // Build network identifier with environment prefix if specified
  const networkId = environment ? `${environment}-${chain}` : chain;

  printHeader(`Checking DataHaven ${networkId} Configuration and Status`);

  logger.info("🔍 Showing deployment plan and status");

  // Use the status function from status.ts
  await showDeploymentPlanAndStatus(chain, environment);
};

export const contractsVerify = async (options: any, command: any) => {
  // Try to get chain from options or command
  let chain = options.chain;
  if (!chain && command.parent) {
    chain = command.parent.getOptionValue("chain");
  }
  if (!chain) {
    chain = command.getOptionValue("chain");
  }

  // Get environment option
  let environment = options.environment;
  if (!environment && command.parent) {
    environment = command.parent.getOptionValue("environment");
  }

  // Build display name for logging
  const displayName = environment ? `${environment}-${chain}` : chain;

  printHeader(`Verifying DataHaven Contracts on ${displayName} Block Explorer`);

  if (options.skipVerification) {
    logger.info("⏭️ Skipping verification as requested");
    return;
  }

  try {
    const verifyOptions = {
      ...options,
      chain: chain,
      environment: environment
    };
    await verifyContracts(verifyOptions);
    printDivider();
  } catch (error) {
    logger.error(`❌ Verification failed: ${error}`);
  }
};

export const contractsPreActionHook = async (thisCommand: any) => {
  let chain = thisCommand.getOptionValue("chain");

  if (!chain && thisCommand.parent) {
    chain = thisCommand.parent.getOptionValue("chain");
  }

  const privateKey = thisCommand.getOptionValue("privateKey");

  if (!chain) {
    logger.error("❌ Chain is required. Use --chain option (hoodi, ethereum, anvil)");
    process.exit(1);
  }

  const supportedChains = ["hoodi", "ethereum", "anvil"];
  if (!supportedChains.includes(chain)) {
    logger.error(`❌ Unsupported chain: ${chain}. Supported chains: ${supportedChains.join(", ")}`);
    process.exit(1);
  }

  if (!privateKey && !process.env.DEPLOYER_PRIVATE_KEY) {
    logger.warn(
      "⚠️ Private key not provided. Will use DEPLOYER_PRIVATE_KEY environment variable if set, or default Anvil key."
    );
  }
};
