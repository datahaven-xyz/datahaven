import fs from "node:fs";
import path from "node:path";
import invariant from "tiny-invariant";
import { logger, runShellCommandWithLogger } from "../utils/index";

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
    solochainAddress?: string;
    solochainPrivateKey?: string;
    solochainAuthorityName: string;
  }[];
  notes?: string;
}

/**
 * Registers validators in EigenLayer based on a configuration file.
 * This function reads validator details (public/private keys, optional solochain addresses)
 * from a JSON file. If `executeSignup` is true (or confirmed by user prompt),
 * it iterates through the configured validators and runs the
 * `script/transact/SignUpValidator.s.sol` forge script for each to register them.
 * Environment variables `OPERATOR_PRIVATE_KEY`, `OPERATOR_SOLOCHAIN_ADDRESS`, and `NETWORK`
 * are set for the forge script execution.
 *
 * @param options - Configuration options for the validator setup process.
 * @param options.rpcUrl - The RPC URL for the Ethereum network to interact with.
 * @param options.validatorsConfig - Optional path to the JSON file containing validator configurations.
 *                                   Defaults to `../configs/validator-set.json` relative to this script.
 * @param options.executeSignup - Optional. If true, proceeds with registration. If false, skips.
 *                                If undefined, the user is prompted to confirm registration.
 * @param options.networkName - Optional network name used when executing underlying scripts (e.g., for setting the `NETWORK` environment variable).
 *                              Defaults to "anvil".
 * @returns A Promise resolving to `true` if the validator registration process was executed
 *          (for all configured validators), or `false` if the registration was skipped
 *          (either due to the `executeSignup` option or user declining the prompt).
 */
export const setupValidators = async (options: SetupValidatorsOptions): Promise<boolean> => {
  const { rpcUrl, validatorsConfig, networkName = "anvil" } = options;

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

  logger.info(`🔎 Registering ${config.validators.length} validators`);

  // Iterate through validators to register them
  for (const [i, validator] of config.validators.entries()) {
    logger.info(`🔧 Setting up validator ${i} (${validator.publicKey})`);

    const env = {
      ...process.env,
      NETWORK: networkName,
      // OPERATOR_PRIVATE_KEY is what the script reads to set the operator
      OPERATOR_PRIVATE_KEY: validator.privateKey,
      // OPERATOR_SOLOCHAIN_ADDRESS is the validator's address on the substrate chain
      OPERATOR_SOLOCHAIN_ADDRESS: validator.solochainAddress || ""
    };

    // Prepare command to register validator
    const signupCommand = `forge script script/transact/SignUpValidator.s.sol --rpc-url ${rpcUrl} --broadcast --no-rpc-rate-limit --non-interactive`;
    logger.debug(`Running command: ${signupCommand}`);

    await runShellCommandWithLogger(signupCommand, { env, cwd: "../contracts", logLevel: "debug" });

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
