import fs from "node:fs";
import path from "node:path";
import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger } from "utils";

interface UpdateValidatorSetOptions {
  rpcUrl: string;
}

export const updateValidatorSet = async (options: UpdateValidatorSetOptions): Promise<boolean> => {
  const { rpcUrl } = options;

  logger.info("🔄 Updating DataHaven Validator Set");

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

  return true;
}
