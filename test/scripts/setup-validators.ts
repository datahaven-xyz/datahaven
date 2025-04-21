// Setup of validators for DataHaven
import { $ } from "bun";
import fs from "node:fs";
import path from "node:path";
import invariant from "tiny-invariant";
import { logger, printHeader, promptWithTimeout } from "../utils/index";

interface SetupValidatorsOptions {
  rpcUrl: string;
  validatorsConfig?: string; // Path to JSON config file with validator addresses
  executeSignup?: boolean;
  sendToSubstrate?: boolean;
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
  BeefyClient: string;
  AgentExecutor: string;
  Gateway: string;
  ServiceManager: string;
  VetoableSlasher: string;
  RewardsRegistry: string;
  Agent: string;
  DelegationManager: string;
  StrategyManager: string;
  AVSDirectory: string;
  EigenPodManager: string;
  EigenPodBeacon: string;
  RewardsCoordinator: string;
  AllocationManager: string;
  PermissionController: string;
  ETHPOSDeposit: string;
  BaseStrategyImplementation: string;
  DeployedStrategies: StrategyInfo[];
}

/**
 * Registers validators in EigenLayer and synchronises them with the DataHaven chain
 *
 * @param options - Configuration options for setup
 * @param options.rpcUrl - The RPC URL to connect to
 * @param options.validatorsConfig - Path to JSON config file (uses default config if not provided)
 * @param options.executeSignup - Whether to run the SignUpValidator script
 * @param options.sendToSubstrate - Whether to send validator set to substrate chain
 * @returns Promise resolving to true if validators were set up successfully, false if skipped
 */
export const setupValidators = async (options: SetupValidatorsOptions): Promise<boolean> => {
  const { rpcUrl, validatorsConfig, executeSignup, sendToSubstrate } = options;

  // Check if executeSignup option was set via flags, or prompt if not
  let shouldExecuteSignup = executeSignup;
  if (shouldExecuteSignup === undefined) {
    shouldExecuteSignup = await promptWithTimeout(
      "Do you want to register validators in EigenLayer?",
      true,
      10
    );
  } else {
    logger.info(
      `Using flag option: ${shouldExecuteSignup ? "will register" : "will not register"} validators`
    );
  }

  // Check if sendToSubstrate option was set via flags, or prompt if not
  let shouldSendToSubstrate = sendToSubstrate;
  if (shouldSendToSubstrate === undefined) {
    shouldSendToSubstrate = await promptWithTimeout(
      "Do you want to send the validator set to DataHaven substrate chain?",
      true,
      10
    );
  } else {
    logger.info(
      `Using flag option: ${shouldSendToSubstrate ? "will send" : "will not send"} validator set to substrate`
    );
  }

  if (!shouldExecuteSignup && !shouldSendToSubstrate) {
    logger.info("Skipping validator setup. Done!");
    return false;
  }

  printHeader("Setting Up DataHaven Validators");

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
  logger.info(`Loading validator configuration from ${configPath}`);
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
  logger.info(`Found ${validators.length} validators to register`);

  // Get forge path
  const { stdout: forgePath } = await $`which forge`.quiet();
  const forgeExecutable = forgePath.toString().trim();

  // Get cast path for transactions
  const { stdout: castPath } = await $`which cast`.quiet();
  const castExecutable = castPath.toString().trim();

  // 1. Register validators in EigenLayer using SignUpValidator.s.sol
  if (shouldExecuteSignup) {
    // Get the deployment information to find the strategies
    const deploymentPath = path.resolve("../contracts/deployments/anvil.json");

    if (!fs.existsSync(deploymentPath)) {
      logger.error(`Deployment file not found: ${deploymentPath}`);
      return false;
    }

    const deployments: DeploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    // Ensure there's at least one deployed strategy
    if (!deployments.DeployedStrategies || deployments.DeployedStrategies.length === 0) {
      logger.error("No strategies found in deployment file - cannot proceed");
      return false;
    }

    logger.info(`Found ${deployments.DeployedStrategies.length} strategies with token information`);

    // We need to ensure all operators to be registered have the necessary tokens
    logger.info("Preparing validators with tokens...");

    // Iterate through the strategies, using the embedded token information to fund validators
    for (const strategy of deployments.DeployedStrategies) {
      const strategyAddress = strategy.address;
      const underlyingTokenAddress = strategy.underlyingToken;
      const tokenCreator = strategy.tokenCreator;

      logger.info(
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
      logger.info(`Found token creator's private key for address ${tokenCreator}`);

      // Get the ERC20 balance of the token creator and its ETH balance as well
      const getErc20BalanceCmd = `${castExecutable} balance --erc20 ${underlyingTokenAddress} ${tokenCreator} --rpc-url ${rpcUrl}`;
      const getEthBalanceCmd = `${castExecutable} balance ${tokenCreator} --rpc-url ${rpcUrl}`;
      const { stdout: erc20BalanceOutput } = await $`sh -c ${getErc20BalanceCmd}`.quiet();
      const { stdout: ethBalanceOutput } = await $`sh -c ${getEthBalanceCmd}`.quiet();
      const creatorErc20Balance = erc20BalanceOutput.toString().trim().split(" ")[0];
      const creatorEthBalance = ethBalanceOutput.toString().trim();
      logger.info(`Token creator has ${creatorErc20Balance} tokens and ${creatorEthBalance} ETH`);
      //const getBalanceCmd = `${castExecutable} call ${underlyingTokenAddress} "balanceOf(address)(uint256)" ${tokenCreator} --rpc-url ${rpcUrl}`;
      //const { stdout: balanceOutput } = await $`sh -c ${getBalanceCmd}`.quiet();
      //const creatorBalance = balanceOutput.toString().trim().split(" ")[0];
      //logger.info(`Token creator has ${creatorBalance} tokens`);

      // Transfer 5% of the creator's tokens to each validator + 1% of the creator's ETH. ETH is transferred only if the receiving validator does not have any
      const erc20TransferAmount = BigInt(creatorErc20Balance) / BigInt(20); // 5% of the balance
      const ethTransferAmount = BigInt(creatorEthBalance) / BigInt(100); // 1% of the balance
      logger.info(`Transferring ${erc20TransferAmount} tokens to each validator`);

      for (const validator of validators) {
        if (validator.publicKey !== tokenCreator) {
          const transferCmd = `${castExecutable} send --private-key ${creatorPrivateKey} ${underlyingTokenAddress} "transfer(address,uint256)" ${validator.publicKey} ${erc20TransferAmount} --rpc-url ${rpcUrl}`;
          const { exitCode: transferExitCode, stderr: transferStderr } =
            await $`sh -c ${transferCmd}`.nothrow();
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
          logger.info(`Validator ${validator.publicKey} has ${validatorEthBalance} ETH`);

          // Transfer ETH only if the validator has no ETH
          if (BigInt(validatorEthBalance) === BigInt(0)) {
            const ethTransferCmd = `${castExecutable} send --private-key ${creatorPrivateKey} ${validator.publicKey} --value ${ethTransferAmount} --rpc-url ${rpcUrl}`;
            const { exitCode: ethTransferExitCode, stderr: ethTransferStderr } =
              await $`sh -c ${ethTransferCmd}`.nothrow();
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
    logger.info("All validators have been funded with tokens");

    // Iterate through all validators to register them
    for (let i = 0; i < validators.length; i++) {
      const validator = validators[i];
      logger.info(`Setting up validator ${i} (${validator.publicKey})`);

      // Setting up the environment variables directly
      const env = {
        ...process.env,
        NETWORK: "anvil",
        // OPERATOR_PRIVATE_KEY is what the script reads to set the operator
        OPERATOR_PRIVATE_KEY: validator.privateKey,
        // OPERATOR_SOLOCHAIN_ADDRESS is the validator's address on the substrate chain
        OPERATOR_SOLOCHAIN_ADDRESS: validator.solochainAddress || ""
      };

      // Prepare command to register validator
      const signupCommand = `${forgeExecutable} script script/transact/SignUpValidator.s.sol --rpc-url ${rpcUrl} --broadcast --no-rpc-rate-limit --non-interactive`;

      logger.info(`Running command: ${signupCommand}`);

      // Run with environment variables directly passed to the environment
      const { exitCode, stderr } = await $`sh -c ${signupCommand}`
        .cwd("../contracts")
        .env(env)
        .nothrow();

      if (exitCode !== 0) {
        logger.error(`Failed to register validator ${validator.publicKey}: ${stderr.toString()}`);
        continue;
      }

      logger.success(`Successfully registered validator ${validator.publicKey}`);
    }
  } else {
    logger.info("Skipping validator registration in EigenLayer");
  }

  // 2. Send the validator set to the DataHaven chain through Snowbridge
  if (shouldSendToSubstrate) {
    logger.info("Sending validator set to DataHaven chain via Snowbridge");

    // Get the owner's private key for transaction signing from the .env
    const ownerPrivateKey =
      process.env.AVS_OWNER_PRIVATE_KEY ||
      "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e"; // Sixth pre-funded account from Anvil

    // Get deployed contract addresses from the deployments file
    const deploymentPath = path.resolve("../contracts/deployments/anvil.json");

    if (!fs.existsSync(deploymentPath)) {
      logger.error(`Deployment file not found: ${deploymentPath}`);
      return false;
    }

    const deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    // Prepare command to send validator set
    const serviceManagerAddress = deployments.ServiceManager;
    invariant(serviceManagerAddress, "ServiceManager address not found in deployments");

    // Using cast to send the transaction
    const executionFee = "100000000000000000"; // 0.1 ETH
    const relayerFee = "200000000000000000"; // 0.2 ETH
    const value = "300000000000000000"; // 0.3 ETH (sum of fees)

    const sendCommand = `${castExecutable} send --private-key ${ownerPrivateKey} --value ${value} ${serviceManagerAddress} "sendNewValidatorSet(uint128,uint128)" ${executionFee} ${relayerFee} --rpc-url ${rpcUrl}`;

    logger.info(`Running command: ${sendCommand}`);

    const { exitCode, stderr } = await $`sh -c ${sendCommand}`.nothrow();

    if (exitCode !== 0) {
      logger.error(`Failed to send validator set: ${stderr.toString()}`);
      return false;
    }

    logger.success("Validator set sent to Snowbridge Gateway");

    // 3. Check if the validator set has been queued on the substrate side (placeholder)
    logger.info("Checking validator set on substrate chain (not implemented)");
    /*
    // PLACEHOLDER: Code to check if validator set has been queued on substrate
    // This requires a connection to the DataHaven substrate node which is not available yet
    
    // Example of what this might look like:
    const substrateApi = await ApiPromise.create({ provider: new WsProvider('ws://localhost:9944') });
    const validatorSetModule = substrateApi.query.validatorSet;
    const queuedValidators = await validatorSetModule.queuedValidators();
    
    if (queuedValidators.length === validators.length) {
      logger.success('Validator set successfully queued on substrate chain');
    } else {
      logger.warn('Validator set not properly queued on substrate chain');
    }
    */
  } else {
    logger.info("Skipping sending validator set to DataHaven chain");
  }

  return true;
};

// Allow script to be run directly with CLI arguments
if (import.meta.main) {
  const args = process.argv.slice(2);
  const options: {
    rpcUrl?: string;
    validatorsConfig?: string;
    executeSignup?: boolean;
    sendToSubstrate?: boolean;
  } = {
    executeSignup: args.includes("--no-signup") ? false : undefined,
    sendToSubstrate: args.includes("--no-substrate-send") ? false : undefined
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

  // Parse signup flag
  if (args.includes("--signup")) {
    options.executeSignup = true;
  }

  // Parse substrate-send flag
  if (args.includes("--substrate-send")) {
    options.sendToSubstrate = true;
  }

  // Check required parameters
  if (!options.rpcUrl) {
    console.error("Error: --rpc-url parameter is required");
    process.exit(1);
  }

  // Run setup
  setupValidators({
    rpcUrl: options.rpcUrl,
    validatorsConfig: options.validatorsConfig,
    executeSignup: options.executeSignup,
    sendToSubstrate: options.sendToSubstrate
  }).catch((error) => {
    console.error("Validator setup failed:", error);
    process.exit(1);
  });
}
