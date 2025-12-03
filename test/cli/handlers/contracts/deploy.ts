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

  printHeader(`Deploying DataHaven Contracts to ${chain}`);

  const txExecutionOverride = options.executeOwnerTransactions ? true : undefined;

  try {
    logger.info("🚀 Starting deployment...");
    logger.info(`📡 Using chain: ${chain}`);
    if (options.rpcUrl) {
      logger.info(`📡 Using RPC URL: ${options.rpcUrl}`);
    }

    await deployContracts({
      chain: chain,
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

  printHeader(`Checking DataHaven ${chain} Configuration and Status`);

  logger.info("🔍 Showing deployment plan and status");

  // Use the status function from status.ts
  await showDeploymentPlanAndStatus(chain);
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

  printHeader(`Verifying DataHaven Contracts on ${chain} Block Explorer`);

  if (options.skipVerification) {
    logger.info("⏭️ Skipping verification as requested");
    return;
  }

  try {
    const verifyOptions = {
      ...options,
      chain: chain
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
    logger.error("❌ Chain is required. Use --chain option (hoodi, holesky, mainnet, anvil)");
    process.exit(1);
  }

  const supportedChains = ["hoodi", "holesky", "mainnet", "anvil"];
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
