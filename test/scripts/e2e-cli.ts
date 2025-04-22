import { $ } from "bun";
import chalk from "chalk";
import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import { deployContracts } from "./deploy-contracts";
import { launchKurtosis } from "./launch-kurtosis";
import sendTxn from "./send-txn";
import { setupValidators } from "./setup-validators";
import { updateValidatorSet } from "./update-validator-set";

interface ScriptOptions {
  verified: boolean;
  launchKurtosis?: boolean;
  deployContracts?: boolean;
  setupValidators?: boolean;
  updateValidatorSet?: boolean;
  blockscout?: boolean;
  help?: boolean;
}

async function main() {
  const args = process.argv.slice(2);

  // Parse command-line arguments
  const options: ScriptOptions = {
    verified: args.includes("--verified"),
    launchKurtosis: parseFlag(args, "launchKurtosis"),
    deployContracts: parseFlag(args, "deploy-contracts"),
    setupValidators: parseFlag(args, "setup-validators"),
    updateValidatorSet: parseFlag(args, "update-validator-set"),
    blockscout: parseFlag(args, "blockscout"),
    help: args.includes("--help") || args.includes("-h")
  };

  // Show help menu if requested
  if (options.help) {
    printHelp();
    return;
  }

  logger.info(`Running with options: ${getOptionsString(options)}`);

  const timeStart = performance.now();

  printHeader("Environment Checks");

  await checkDependencies();

  // Clean up and launch Kurtosis enclave
  const { services } = await launchKurtosis({
    launchKurtosis: options.launchKurtosis,
    blockscout: options.blockscout
  });

  // Send test transaction
  printHeader("Setting Up Blockchain");
  const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Anvil test acc1
  const networkRpcUrl = services.find((s) => s.service === "reth-1-rpc")?.url;
  invariant(networkRpcUrl, "❌ Network RPC URL not found");

  logger.info("💸 Sending test transaction...");
  await sendTxn(privateKey, networkRpcUrl);

  printDivider();

  // Display service information in a clean table
  printHeader("Service Endpoints");

  // Filter services to display based on blockscout option
  const servicesToDisplay = services
    .filter((s) => ["reth-1-rpc", "reth-2-rpc", "dora"].includes(s.service))
    .concat([{ service: "kurtosis-web", port: "9711", url: "http://127.0.0.1:9711" }]);

  // Conditionally add blockscout services
  if (options.blockscout !== false) {
    const blockscoutBackend = services.find((s) => s.service === "blockscout-backend");
    if (blockscoutBackend) {
      servicesToDisplay.push(blockscoutBackend);
      // Only add frontend if backend exists
      servicesToDisplay.push({ service: "blockscout", port: "3000", url: "http://127.0.0.1:3000" });
    }
  }

  console.table(servicesToDisplay);

  printDivider();

  // Show completion information
  const timeEnd = performance.now();
  const minutes = ((timeEnd - timeStart) / (1000 * 60)).toFixed(1);

  logger.success(`Kurtosis network started successfully in ${minutes} minutes`);

  printDivider();

  // Deploy contracts using the extracted function
  let blockscoutBackendUrl: string | undefined = undefined;

  if (options.blockscout !== false) {
    blockscoutBackendUrl = services.find((s) => s.service === "blockscout-backend")?.url;
  } else if (options.verified) {
    logger.warn(
      "⚠️ Contract verification (--verified) requested, but Blockscout is disabled (--no-blockscout). Verification will be skipped."
    );
  }

  const contractsDeployed = await deployContracts({
    rpcUrl: networkRpcUrl,
    verified: options.verified,
    blockscoutBackendUrl,
    deployContracts: options.deployContracts
  });

  // Set up validators using the extracted function
  if (contractsDeployed) {
    let shouldSetupValidators = options.setupValidators;
    if (shouldSetupValidators === undefined) {
      // If not specified, default to true
      shouldSetupValidators = true;
    }

    if (shouldSetupValidators) {
      await setupValidators({
        rpcUrl: networkRpcUrl
        // Default values for other options
      });

      // After setting up validators, update the validator set if requested
      let shouldUpdateValidatorSet = options.updateValidatorSet;
      if (shouldUpdateValidatorSet === undefined) {
        // If not specified, default to true
        shouldUpdateValidatorSet = true;
      }

      if (shouldUpdateValidatorSet) {
        await updateValidatorSet({
          rpcUrl: networkRpcUrl
          // Default values for other options
        });
      } else {
        logger.info("Skipping validator set update");
      }
    } else {
      logger.info("Skipping validator setup");
    }
  } else if (options.setupValidators) {
    logger.warn(
      "⚠️ Validator setup requested but contracts were not deployed. Skipping validator setup."
    );
  }
}

// Helper function to check all dependencies at once
const checkDependencies = async (): Promise<void> => {
  if (!(await checkKurtosisInstalled())) {
    logger.error("Kurtosis CLI is required to be installed: https://docs.kurtosis.com/install");
    throw Error("❌ Kurtosis CLI application not found.");
  }

  logger.success("Kurtosis CLI found");

  if (!(await checkDockerRunning())) {
    logger.error("Is Docker Running? Unable to make connection to docker daemon");
    throw Error("❌ Error connecting to Docker");
  }

  logger.success("Docker is running");

  if (!(await checkForgeInstalled())) {
    logger.error("Is foundry installed? https://book.getfoundry.sh/getting-started/installation");
    throw Error("❌ forge binary not found in PATH");
  }

  logger.success("Forge is installed");
};

const checkKurtosisInstalled = async (): Promise<boolean> => {
  const { exitCode, stderr, stdout } = await $`kurtosis version`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.error(stderr.toString());
    return false;
  }
  logger.debug(stdout.toString());
  return true;
};

const checkDockerRunning = async (): Promise<boolean> => {
  const { exitCode, stderr, stdout } = await $`docker system info`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.error(stderr.toString());
    return false;
  }
  logger.debug(stdout.toString());
  return true;
};

const checkForgeInstalled = async (): Promise<boolean> => {
  const { exitCode, stderr, stdout } = await $`forge --version`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.error(stderr.toString());
    return false;
  }
  logger.debug(stdout.toString());
  return true;
};

// Helper function to format options as a string
function getOptionsString(options: ScriptOptions): string {
  const optionStrings: string[] = [];
  if (options.verified) optionStrings.push("verified");
  if (options.launchKurtosis !== undefined)
    optionStrings.push(`launchKurtosis=${options.launchKurtosis}`);
  if (options.deployContracts !== undefined)
    optionStrings.push(`deployContracts=${options.deployContracts}`);
  if (options.setupValidators !== undefined)
    optionStrings.push(`setupValidators=${options.setupValidators}`);
  if (options.updateValidatorSet !== undefined)
    optionStrings.push(`updateValidatorSet=${options.updateValidatorSet}`);
  if (options.blockscout !== undefined) optionStrings.push(`blockscout=${options.blockscout}`);
  return optionStrings.length ? optionStrings.join(", ") : "no options";
}

// Print help menu
function printHelp(): void {
  console.log(chalk.bold.cyan("\nDatahaven Kurtosis Startup Script"));
  console.log(chalk.gray("=".repeat(40)));
  console.log(`
${chalk.yellow("Available Options:")}

${chalk.green("--verified")}                Use contract verification via Blockscout
${chalk.green("--launchKurtosis")}          Clean and launch Kurtosis enclave if already running
${chalk.green("--no-launchKurtosis")}       Keep existing Kurtosis enclave if already running
${chalk.green("--deploy-contracts")}        Deploy smart contracts after Kurtosis starts
${chalk.green("--no-deploy-contracts")}     Skip smart contract deployment
${chalk.green("--setup-validators")}        Set up validators after contracts are deployed
${chalk.green("--no-setup-validators")}     Skip validator setup
${chalk.green("--update-validator-set")}    Update validator set on substrate chain after setup
${chalk.green("--no-update-validator-set")} Skip validator set update
${chalk.green("--blockscout")}              Launch Kurtosis with Blockscout services (uses minimal-with-bs.yaml)
${chalk.green("--no-blockscout")}           Launch Kurtosis without Blockscout services (uses minimal.yaml)
${chalk.green("--help, -h")}                Show this help menu

${chalk.yellow("Examples:")}
  ${chalk.gray("# Start with interactive prompts")}
  bun run start-kurtosis

  ${chalk.gray("# Start with verification and automatic redeploy")}
  bun run start-kurtosis --verified --redeploy

  ${chalk.gray("# Start without deploying contracts")}
  bun run start-kurtosis --no-deploy-contracts

  ${chalk.gray("# Start without updating validator set")}
  bun run start-kurtosis --no-update-validator-set
`);
}

// Parse and handle boolean flags with negations
function parseFlag(args: string[], flagName: string): boolean | undefined {
  const positiveFlag = `--${flagName}`;
  const negativeFlag = `--no-${flagName}`;

  if (args.includes(positiveFlag)) return true;
  if (args.includes(negativeFlag)) return false;
  return undefined;
}

main();
