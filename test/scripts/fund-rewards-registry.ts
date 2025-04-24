import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger, printHeader, promptWithTimeout } from "../utils/index";

interface FundRewardsRegistryOptions {
  rpcUrl: string;
  operatorSetId?: number;
  amount?: string;
  senderPrivateKey?: string;
  networkName?: string;
}

/**
 * Funds the RewardsRegistry contract with ETH
 *
 * @param options Configuration options
 * @returns True if funding was successful
 */
export async function fundRewardsRegistry(options: FundRewardsRegistryOptions): Promise<boolean> {
  const {
    rpcUrl,
    operatorSetId = 0, // Default to validators set
    amount = "500ether", // Default amount to fund
    senderPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Anvil test account 1
    networkName = "anvil"
  } = options;

  printHeader("Funding Rewards Registry");

  // Get forge path
  const { stdout: forgePath } = await $`which forge`.quiet();
  const forgeExecutable = forgePath.toString().trim();

  // Build the command to fund the rewards registry
  const fundCommand = `${forgeExecutable} script script/utils/FundRewardsRegistry.s.sol --rpc-url ${rpcUrl} --broadcast -vvv --private-key ${senderPrivateKey}`;

  logger.info(`Funding rewards registry for operator set ID: ${operatorSetId} with ${amount}`);

  // Set up the environment variables
  const env = {
    ...process.env,
    NETWORK: networkName,
    OPERATOR_SET_ID: operatorSetId.toString(),
    FUND_AMOUNT: amount
  };

  // Run the command to fund the rewards registry
  const { exitCode, stderr, stdout } = await $`sh -c ${fundCommand}`
    .cwd("../contracts")
    .env(env)
    .nothrow();

  if (exitCode !== 0) {
    logger.error(`Failed to fund rewards registry: ${stderr.toString()}`);
    return false;
  }

  logger.info(stdout.toString());
  logger.success(`Successfully funded rewards registry for operator set ID: ${operatorSetId}`);
  return true;
}

// Allow script to be run directly with CLI arguments
if (import.meta.main) {
  const args = process.argv.slice(2);
  const options: FundRewardsRegistryOptions = {
    rpcUrl: ""
  };

  // Extract RPC URL
  const rpcUrlIndex = args.indexOf("--rpc-url");
  if (rpcUrlIndex !== -1 && rpcUrlIndex + 1 < args.length) {
    options.rpcUrl = args[rpcUrlIndex + 1];
  }

  // Extract amount
  const amountIndex = args.indexOf("--amount");
  if (amountIndex !== -1 && amountIndex + 1 < args.length) {
    options.amount = args[amountIndex + 1];
  }

  // Extract operator set ID
  const operatorSetIdIndex = args.indexOf("--operator-set-id");
  if (operatorSetIdIndex !== -1 && operatorSetIdIndex + 1 < args.length) {
    options.operatorSetId = parseInt(args[operatorSetIdIndex + 1]);
  }

  // Extract private key
  const privateKeyIndex = args.indexOf("--private-key");
  if (privateKeyIndex !== -1 && privateKeyIndex + 1 < args.length) {
    options.senderPrivateKey = args[privateKeyIndex + 1];
  }

  // Extract network name
  const networkIndex = args.indexOf("--network");
  if (networkIndex !== -1 && networkIndex + 1 < args.length) {
    options.networkName = args[networkIndex + 1];
  }

  // Check required parameters
  if (!options.rpcUrl) {
    console.error("Error: --rpc-url parameter is required");
    process.exit(1);
  }

  // Run funding script
  fundRewardsRegistry(options).catch((error) => {
    console.error("Funding rewards registry failed:", error);
    process.exit(1);
  });
}
