import { logger, printDivider, printHeader } from "utils";
import { deployContracts } from "../../../scripts/deploy-contracts";
import { versioningPostChecks, versioningPreChecks } from "./checks";
import { showDeploymentPlanAndStatus } from "./status";
import { verifyContracts } from "./verify";

/**
 * Extracts chain and environment options from command options and parent command.
 * This handles the case where options may be specified at either the subcommand
 * or parent command level.
 */
const getChainAndEnvironment = (
  options: any,
  command: any
): { chain: string | undefined; environment: string | undefined } => {
  let chain = options.chain;
  if (!chain && command.parent) {
    chain = command.parent.getOptionValue("chain");
  }
  if (!chain) {
    chain = command.getOptionValue("chain");
  }

  let environment = options.environment;
  if (!environment && command.parent) {
    environment = command.parent.getOptionValue("environment");
  }

  return { chain, environment };
};

export const contractsDeploy = async (options: any, command: any) => {
  const { chain, environment } = getChainAndEnvironment(options, command);

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

    // For anvil, auto-detect RPC URL from Kurtosis if not provided
    let rpcUrl = options.rpcUrl;
    if (chain === "anvil" && !rpcUrl) {
      const { getAnvilRpcUrl } = await import("../../../utils/anvil");
      rpcUrl = await getAnvilRpcUrl();
      logger.info(`📡 Auto-detected Anvil RPC URL: ${rpcUrl}`);
    } else if (rpcUrl) {
      logger.info(`📡 Using RPC URL: ${rpcUrl}`);
    }

    // Override options with detected RPC URL
    const deployOptions = { ...options, rpcUrl };

    // Chain is guaranteed to be defined by preAction hook validation
    await versioningPreChecks({ chain: chain!, rpcUrl: deployOptions.rpcUrl });

    // Chain is guaranteed to be defined by preAction hook validation
    await deployContracts({
      chain: chain!,
      environment: environment,
      rpcUrl: deployOptions.rpcUrl,
      privateKey: deployOptions.privateKey,
      avsOwnerKey: deployOptions.avsOwnerKey,
      avsOwnerAddress: deployOptions.avsOwnerAddress,
      txExecution: txExecutionOverride
    });

    await versioningPostChecks({ chain: chain!, rpcUrl: deployOptions.rpcUrl });

    printDivider();
  } catch (error) {
    logger.error(`❌ Deployment failed: ${error}`);
  }
};

export const contractsCheck = async (options: any, command: any) => {
  const { chain, environment } = getChainAndEnvironment(options, command);

  // Build network identifier with environment prefix if specified
  const networkId = environment ? `${environment}-${chain}` : chain;

  printHeader(`Checking DataHaven ${networkId} Configuration and Status`);

  logger.info("🔍 Showing deployment plan and status");

  // Use the status function from status.ts
  // Chain is guaranteed to be defined by preAction hook validation
  await showDeploymentPlanAndStatus(chain!, environment);
};

export const contractsVerify = async (options: any, command: any) => {
  const { chain, environment } = getChainAndEnvironment(options, command);

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

/**
 * Supported networks for contract deployment.
 * These must correspond to config files in contracts/config/{network}.json
 */
export const SUPPORTED_NETWORKS = [
  "anvil",
  "hoodi",
  "stagenet-hoodi",
  "testnet-hoodi",
  "ethereum",
  "mainnet-ethereum"
] as const;

export const contractsPreActionHook = async (thisCommand: any) => {
  // Skip validation for commands that don't need chain
  // Check if the command is one of the versioning commands by looking at args
  const args = thisCommand.args || [];
  const subcommand = args[0];

  const skipChainValidation = ["bump", "apply-changesets", "validate-changesets"].includes(
    subcommand
  );

  if (skipChainValidation) {
    return; // Skip all validation for these commands
  }

  let chain = thisCommand.getOptionValue("chain");
  let environment = thisCommand.getOptionValue("environment");

  if (!chain && thisCommand.parent) {
    chain = thisCommand.parent.getOptionValue("chain");
  }
  if (!environment && thisCommand.parent) {
    environment = thisCommand.parent.getOptionValue("environment");
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

  // Validate environment if provided
  if (environment) {
    const supportedEnvironments = ["stagenet", "testnet", "mainnet"];
    if (!supportedEnvironments.includes(environment)) {
      logger.error(
        `❌ Unsupported environment: ${environment}. Supported environments: ${supportedEnvironments.join(", ")}`
      );
      process.exit(1);
    }

    // Validate the full network identifier exists
    const networkId = `${environment}-${chain}`;
    if (!SUPPORTED_NETWORKS.includes(networkId as (typeof SUPPORTED_NETWORKS)[number])) {
      logger.error(
        `❌ Unsupported network combination: ${networkId}. Supported networks: ${SUPPORTED_NETWORKS.join(", ")}`
      );
      process.exit(1);
    }
  }

  // Context-aware private key warnings
  if (!privateKey) {
    if (subcommand === "upgrade") {
      // Upgrades require DEPLOYER_PRIVATE_KEY (ProxyAdmin owner + versionUpdater)
      if (!process.env.DEPLOYER_PRIVATE_KEY) {
        logger.warn(
          "⚠️ DEPLOYER_PRIVATE_KEY not set. Upgrades require the deployer's private key (ProxyAdmin owner)."
        );
      }
    } else if (subcommand === "deploy") {
      // Deployments use DEPLOYER_PRIVATE_KEY for deployment, AVS_OWNER_PRIVATE_KEY for AVS ownership
      if (!process.env.DEPLOYER_PRIVATE_KEY) {
        logger.warn("⚠️ DEPLOYER_PRIVATE_KEY not set. Will use default Anvil key for deployment.");
      }
      if (!process.env.AVS_OWNER_PRIVATE_KEY) {
        logger.warn(
          "⚠️ AVS_OWNER_PRIVATE_KEY not set. ServiceManager will be owned by deployer account."
        );
      }
    }
  }
};
