import fs from "node:fs";
import path from "node:path";
// Script to fund validators with tokens and ETH for local testing
import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger } from "../utils/index";

interface FundValidatorsOptions {
  rpcUrl: string;
  validatorsConfig?: string; // Path to JSON config file with validator addresses
  networkName?: string; // Network name for default deployment path
  deploymentPath?: string; // Optional custom deployment path
}

/**
 * JSON structure for validator configuration
 */
interface ValidatorConfig {
  validators: {
    publicKey: string;
    privateKey: string;
    solochainAddress?: string; // Optional substrate address
  }[];
  notes?: string;
}

/**
 * Structure for strategy information in the deployment file
 */
interface StrategyInfo {
  address: string;
  underlyingToken: string;
  tokenCreator: string;
}

/**
 * Deployment file structure with enhanced strategy information
 */
interface DeploymentInfo {
  network: string;
  DeployedStrategies: StrategyInfo[];
}

/**
 * Funds validators with tokens and ETH for local testing
 *
 * @param options - Configuration options for funding
 * @param options.rpcUrl - The RPC URL to connect to
 * @param options.validatorsConfig - Path to JSON config file (uses default config if not provided)
 * @returns Promise resolving to true if validators were funded successfully
 */
export const fundValidators = async (options: FundValidatorsOptions): Promise<boolean> => {
  const { rpcUrl, validatorsConfig, networkName = "anvil", deploymentPath } = options;

  // Validate RPC URL
  invariant(rpcUrl, "❌ RPC URL is required");

  // Load validator configuration - use default path if not specified
  const configPath = validatorsConfig || path.resolve(__dirname, "../configs/validator-set.json");

  // Ensure the configuration file exists
  if (!fs.existsSync(configPath)) {
    logger.error(`Validator configuration file not found: ${configPath}`);
    throw new Error("Validator configuration file is required");
  }

  // Load and validate the validator configuration
  logger.debug(`Loading validator configuration from ${configPath}`);
  let config: ValidatorConfig;

  try {
    const fileContent = fs.readFileSync(configPath, "utf8");
    config = JSON.parse(fileContent);
  } catch (error) {
    logger.error(`Failed to parse validator config file: ${error}`);
    throw new Error("Invalid JSON format in validator configuration file");
  }

  // Validate the validators array
  if (!config.validators || !Array.isArray(config.validators) || config.validators.length === 0) {
    logger.error("Invalid validator configuration: 'validators' array is missing or empty");
    throw new Error("Validator configuration must contain a non-empty 'validators' array");
  }

  // Validate each validator entry
  for (const [index, validator] of config.validators.entries()) {
    if (!validator.publicKey) {
      throw new Error(`Validator at index ${index} is missing 'publicKey'`);
    }
    if (!validator.privateKey) {
      throw new Error(`Validator at index ${index} is missing 'privateKey'`);
    }
    if (!validator.publicKey.startsWith("0x")) {
      throw new Error(`Validator publicKey at index ${index} must start with '0x'`);
    }
    if (!validator.privateKey.startsWith("0x")) {
      throw new Error(`Validator privateKey at index ${index} must start with '0x'`);
    }
  }

  const validators = config.validators;
  logger.info(`🔎 Found ${validators.length} validators to fund`);

  // Get cast path for transactions
  const { stdout: castPath } = await $`which cast`.quiet();
  const castExecutable = castPath.toString().trim();

  // Get the deployment information to find the strategies
  const defaultDeploymentPath = path.resolve(`../contracts/deployments/${networkName}.json`);
  const finalDeploymentPath = deploymentPath || defaultDeploymentPath;

  if (!fs.existsSync(finalDeploymentPath)) {
    logger.error(`Deployment file not found: ${finalDeploymentPath}`);
    return false;
  }

  const deployments: DeploymentInfo = JSON.parse(fs.readFileSync(finalDeploymentPath, "utf8"));

  // Ensure there's at least one deployed strategy
  if (!deployments.DeployedStrategies || deployments.DeployedStrategies.length === 0) {
    logger.error("No strategies found in deployment file - cannot proceed");
    return false;
  }

  logger.debug(`Found ${deployments.DeployedStrategies.length} strategies with token information`);

  // We need to ensure all operators to be registered have the necessary tokens
  // Iterate through the strategies, using the embedded token information to fund validators
  for (const strategy of deployments.DeployedStrategies) {
    const strategyAddress = strategy.address;
    const underlyingTokenAddress = strategy.underlyingToken;
    const tokenCreator = strategy.tokenCreator;

    logger.debug(
      `Processing strategy ${strategyAddress} with token ${underlyingTokenAddress} created by ${tokenCreator}`
    );

    // Find the token creator in our validator list
    const creatorValidator = validators.find((validator) => validator.publicKey === tokenCreator);
    if (!creatorValidator) {
      logger.error(`Token creator ${tokenCreator} not found in validators list`);
      logger.warn("Will try to continue with other strategies...");
      continue;
    }

    const creatorPrivateKey = creatorValidator.privateKey;
    logger.debug(`Found token creator's private key for address ${tokenCreator}`);

    // Get the ERC20 balance of the token creator and its ETH balance as well
    const getErc20BalanceCmd = `${castExecutable} call ${underlyingTokenAddress} "balanceOf(address)(uint256)" ${tokenCreator} --rpc-url ${rpcUrl}`;
    const getEthBalanceCmd = `${castExecutable} balance ${tokenCreator} --rpc-url ${rpcUrl}`;
    const { stdout: erc20BalanceOutput } = await $`sh -c ${getErc20BalanceCmd}`.quiet();
    const { stdout: ethBalanceOutput } = await $`sh -c ${getEthBalanceCmd}`.quiet();
    const creatorErc20Balance = erc20BalanceOutput.toString().trim().split(" ")[0];
    const creatorEthBalance = ethBalanceOutput.toString().trim();
    logger.debug(`Token creator has ${creatorErc20Balance} tokens and ${creatorEthBalance} ETH`);

    // Transfer 5% of the creator's tokens to each validator + 1% of the creator's ETH. ETH is transferred only if the receiving validator does not have any
    const erc20TransferAmount = BigInt(creatorErc20Balance) / BigInt(20); // 5% of the balance
    const ethTransferAmount = BigInt(creatorEthBalance) / BigInt(100); // 1% of the balance
    logger.debug(`Transferring ${erc20TransferAmount} tokens to each validator`);

    for (const validator of validators) {
      if (validator.publicKey !== tokenCreator) {
        const transferCmd = `${castExecutable} send --private-key ${creatorPrivateKey} ${underlyingTokenAddress} "transfer(address,uint256)" ${validator.publicKey} ${erc20TransferAmount} --rpc-url ${rpcUrl}`;
        const { exitCode: transferExitCode, stderr: transferStderr } = await $`sh -c ${transferCmd}`
          .nothrow()
          .quiet();
        if (transferExitCode !== 0) {
          logger.error(
            `Failed to transfer tokens to validator ${validator.publicKey}: ${transferStderr.toString()}`
          );
          continue;
        }

        // Verify the transfer was successful
        const validatorBalanceCmd = `${castExecutable} call ${underlyingTokenAddress} "balanceOf(address)(uint256)" ${validator.publicKey} --rpc-url ${rpcUrl}`;
        const { stdout: validatorBalanceOutput } = await $`sh -c ${validatorBalanceCmd}`.quiet();
        const validatorBalance = validatorBalanceOutput.toString().trim().split(" ")[0];

        // Note: We shouldn't use strict equality here as other transactions might affect balances
        if (BigInt(validatorBalance) < erc20TransferAmount) {
          logger.warn(
            `Validator ${validator.publicKey} has less than expected balance (${validatorBalance} < ${erc20TransferAmount})`
          );
        } else {
          logger.success(`Successfully transferred tokens to validator ${validator.publicKey}`);
        }

        // Check this validator's ETH balance
        const validatorEthBalanceCmd = `${castExecutable} balance ${validator.publicKey} --rpc-url ${rpcUrl}`;
        const { stdout: validatorEthBalanceOutput } =
          await $`sh -c ${validatorEthBalanceCmd}`.quiet();
        const validatorEthBalance = validatorEthBalanceOutput.toString().trim();
        logger.debug(`Validator ${validator.publicKey} has ${validatorEthBalance} ETH`);

        // Transfer ETH only if the validator has no ETH
        if (BigInt(validatorEthBalance) === BigInt(0)) {
          const ethTransferCmd = `${castExecutable} send --private-key ${creatorPrivateKey} ${validator.publicKey} --value ${ethTransferAmount} --rpc-url ${rpcUrl}`;
          const { exitCode: ethTransferExitCode, stderr: ethTransferStderr } =
            await $`sh -c ${ethTransferCmd}`.nothrow().quiet();
          if (ethTransferExitCode !== 0) {
            logger.error(
              `Failed to transfer ETH to validator ${validator.publicKey}: ${ethTransferStderr.toString()}`
            );
            continue;
          }

          // Verify the ETH transfer was successful
          const validatorEthBalanceAfterCmd = `${castExecutable} balance ${validator.publicKey} --rpc-url ${rpcUrl}`;
          const { stdout: validatorEthBalanceAfterOutput } =
            await $`sh -c ${validatorEthBalanceAfterCmd}`.quiet();
          const validatorEthBalanceAfter = validatorEthBalanceAfterOutput.toString().trim();
          if (BigInt(validatorEthBalanceAfter) < ethTransferAmount) {
            logger.warn(
              `Validator ${validator.publicKey} has less than expected ETH balance (${validatorEthBalanceAfter} < ${ethTransferAmount})`
            );
          } else {
            logger.success(`Successfully transferred ETH to validator ${validator.publicKey}`);
          }
        }
      }
    }
  }

  logger.success("All validators have been funded with tokens");

  return true;
};

// Allow script to be run directly with CLI arguments
if (import.meta.main) {
  const args = process.argv.slice(2);
  const options: {
    rpcUrl?: string;
    validatorsConfig?: string;
    networkName?: string;
    deploymentPath?: string;
  } = {
    networkName: "anvil" // Default network name
  };

  // Extract RPC URL
  const rpcUrlIndex = args.indexOf("--rpc-url");
  if (rpcUrlIndex !== -1 && rpcUrlIndex + 1 < args.length) {
    options.rpcUrl = args[rpcUrlIndex + 1];
  }

  // Extract validators config path
  const configIndex = args.indexOf("--config");
  if (configIndex !== -1 && configIndex + 1 < args.length) {
    options.validatorsConfig = args[configIndex + 1];
  }

  // Extract network name
  const networkIndex = args.indexOf("--network");
  if (networkIndex !== -1 && networkIndex + 1 < args.length) {
    options.networkName = args[networkIndex + 1];
  }

  // Extract custom deployment path
  const deploymentPathIndex = args.indexOf("--deployment-path");
  if (deploymentPathIndex !== -1 && deploymentPathIndex + 1 < args.length) {
    options.deploymentPath = args[deploymentPathIndex + 1];
  }

  // Check required parameters
  if (!options.rpcUrl) {
    console.error("Error: --rpc-url parameter is required");
    process.exit(1);
  }

  // Run funding
  fundValidators({
    rpcUrl: options.rpcUrl,
    validatorsConfig: options.validatorsConfig,
    networkName: options.networkName,
    deploymentPath: options.deploymentPath
  }).catch((error) => {
    console.error("Validator funding failed:", error);
    process.exit(1);
  });
}
