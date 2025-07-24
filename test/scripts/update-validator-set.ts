import fs from "node:fs";
import path from "node:path";
// Update validator set on DataHaven substrate chain
import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger } from "../utils/index";

interface UpdateValidatorSetOptions {
  rpcUrl: string;
}

/**
 * Sends the validator set to the DataHaven chain through Snowbridge
 *
 * @param options - Configuration options for update
 * @param options.rpcUrl - The RPC URL to connect to
 * @returns Promise resolving to true if validator set was sent successfully, false if skipped
 */
export const updateValidatorSet = async (options: UpdateValidatorSetOptions): Promise<boolean> => {
  const { rpcUrl } = options;

  // Validate RPC URL
  invariant(rpcUrl, "❌ RPC URL is required");

  // Get cast path for transactions
  const { stdout: castPath } = await $`which cast`.quiet();
  const castExecutable = castPath.toString().trim();

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

  logger.debug(`Running command: ${sendCommand}`);

  const { exitCode, stderr } = await $`sh -c ${sendCommand}`.nothrow().quiet();

  if (exitCode !== 0) {
    logger.error(`Failed to send validator set: ${stderr.toString()}`);
    return false;
  }

  logger.success("Validator set sent to Snowbridge Gateway");

  // Check if the validator set has been queued on the substrate side (placeholder)
  logger.debug("Checking validator set on substrate chain (not implemented)");
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

  return true;
};

// Allow script to be run directly with CLI arguments
if (import.meta.main) {
  const args = process.argv.slice(2);
  const options: {
    rpcUrl?: string;
  } = {};

  // Extract RPC URL
  const rpcUrlIndex = args.indexOf("--rpc-url");
  if (rpcUrlIndex !== -1 && rpcUrlIndex + 1 < args.length) {
    options.rpcUrl = args[rpcUrlIndex + 1];
  }

  // Check required parameters
  if (!options.rpcUrl) {
    console.error("Error: --rpc-url parameter is required");
    process.exit(1);
  }

  // Run update
  updateValidatorSet({
    rpcUrl: options.rpcUrl
  }).catch((error) => {
    console.error("Validator set update failed:", error);
    process.exit(1);
  });
}
