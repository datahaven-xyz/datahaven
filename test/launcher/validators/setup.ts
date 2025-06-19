import fs from "node:fs";
import path from "node:path";
import invariant from "tiny-invariant";
import { logger, runShellCommandWithLogger } from "utils";
import type { ValidatorConfig } from "../types";

interface SetupValidatorsOptions {
  rpcUrl: string;
  validatorsConfig?: string;
  networkName?: string;
  deploymentPath?: string;
}

export const setupValidators = async (options: SetupValidatorsOptions): Promise<boolean> => {
  const { rpcUrl, validatorsConfig, networkName = "anvil" } = options;

  logger.info("🔧 Setting Up DataHaven Validators");

  // Validate RPC URL
  invariant(rpcUrl, "❌ RPC URL is required");

  // Load validator configuration
  const configPath =
    validatorsConfig || path.resolve(__dirname, "../../configs/validator-set.json");

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
  logger.info(`🔎 Found ${validators.length} validators to register`);

  // Iterate through all validators to register them
  for (let i = 0; i < validators.length; i++) {
    const validator = validators[i];
    logger.info(`🔧 Setting up validator ${i} (${validator.publicKey})`);

    const env = {
      ...process.env,
      NETWORK: networkName,
      OPERATOR_PRIVATE_KEY: validator.privateKey,
      OPERATOR_SOLOCHAIN_ADDRESS: validator.solochainAddress || ""
    };

    // Prepare command to register validator
    const signupCommand = `forge script script/transact/SignUpValidator.s.sol --rpc-url ${rpcUrl} --broadcast --no-rpc-rate-limit --non-interactive`;
    logger.debug(`Running command: ${signupCommand}`);

    await runShellCommandWithLogger(signupCommand, { env, cwd: "../contracts", logLevel: "debug" });

    logger.success(`Successfully registered validator ${validator.publicKey}`);
  }

  return true;
}
