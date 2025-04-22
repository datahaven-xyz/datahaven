import fs from "node:fs";
import path from "node:path";
// Setup of validators for DataHaven
import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger, printHeader, promptWithTimeout } from "../utils/index";

interface SetupValidatorsOptions {
  rpcUrl: string;
  validatorsConfig?: string; // Path to JSON config file with validator addresses
  executeSignup?: boolean;
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
 * Registers validators in EigenLayer
 *
 * @param options - Configuration options for setup
 * @param options.rpcUrl - The RPC URL to connect to
 * @param options.validatorsConfig - Path to JSON config file (uses default config if not provided)
 * @param options.executeSignup - Whether to run the SignUpValidator script
 * @returns Promise resolving to true if validators were set up successfully, false if skipped
 */
export const setupValidators = async (options: SetupValidatorsOptions): Promise<boolean> => {
  const {
    rpcUrl,
    validatorsConfig,
    executeSignup,
    networkName = "anvil",
    deploymentPath
  } = options;

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

  if (!shouldExecuteSignup) {
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
  logger.info(`Found ${validators.length} validators to register`);

  // Get forge path
  const { stdout: forgePath } = await $`which forge`.quiet();
  const forgeExecutable = forgePath.toString().trim();

  // Iterate through all validators to register them
  for (let i = 0; i < validators.length; i++) {
    const validator = validators[i];
    logger.info(`Setting up validator ${i} (${validator.publicKey})`);

    // Setting up the environment variables directly
    const env = {
      ...process.env,
      NETWORK: networkName,
      // OPERATOR_PRIVATE_KEY is what the script reads to set the operator
      OPERATOR_PRIVATE_KEY: validator.privateKey,
      // OPERATOR_SOLOCHAIN_ADDRESS is the validator's address on the substrate chain
      OPERATOR_SOLOCHAIN_ADDRESS: validator.solochainAddress || ""
    };

    // Prepare command to register validator
    const signupCommand = `${forgeExecutable} script script/transact/SignUpValidator.s.sol --rpc-url ${rpcUrl} --broadcast --no-rpc-rate-limit --non-interactive`;

    logger.debug(`Running command: ${signupCommand}`);

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

  return true;
};

// Allow script to be run directly with CLI arguments
if (import.meta.main) {
  const args = process.argv.slice(2);
  const options: {
    rpcUrl?: string;
    validatorsConfig?: string;
    executeSignup?: boolean;
    networkName?: string;
    deploymentPath?: string;
  } = {
    executeSignup: args.includes("--no-signup") ? false : undefined,
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

  // Parse signup flag
  if (args.includes("--signup")) {
    options.executeSignup = true;
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
    networkName: options.networkName,
    deploymentPath: options.deploymentPath
  }).catch((error) => {
    console.error("Validator setup failed:", error);
    process.exit(1);
  });
}
