import type { Command } from "@commander-js/extra-typings";
import { $ } from "bun";
import { deployContracts } from "scripts/deploy-contracts";
import { fundValidators } from "scripts/fund-validators";
import { generateSnowbridgeConfigs } from "scripts/gen-snowbridge-cfgs";
import { launchKurtosis } from "scripts/launch-kurtosis";
import sendTxn from "scripts/send-txn";
import { setupValidators } from "scripts/setup-validators";
import { updateValidatorSet } from "scripts/update-validator-set";
import invariant from "tiny-invariant";
import { ANVIL_FUNDED_ACCOUNTS, logger, printDivider, printHeader, promptWithTimeout } from "utils";

interface LaunchOptions {
  verified?: boolean;
  launchKurtosis?: boolean;
  deployContracts?: boolean;
  fundValidators?: boolean;
  setupValidators?: boolean;
  updateValidatorSet?: boolean;
  blockscout?: boolean;
  relayer?: boolean;
  relayerBinPath?: string;
}

// =====  Launch Handler Functions  =====

export const launch = async (options: LaunchOptions) => {
  logger.debug("Running with options:");
  logger.debug(options);

  const timeStart = performance.now();

  printHeader("Environment Checks");

  await checkDependencies();

  logger.trace("Launching Kurtosis enclave");
  const { services } = await launchKurtosis({
    launchKurtosis: options.launchKurtosis,
    blockscout: options.blockscout
  });
  logger.trace("Kurtosis enclave launched");

  logger.trace("Send test transaction");
  printHeader("Setting Up Blockchain");
  logger.debug(`Using account ${ANVIL_FUNDED_ACCOUNTS[1].publicKey}`);
  const privateKey = ANVIL_FUNDED_ACCOUNTS[1].privateKey;
  const networkRpcUrl = services.find((s) => s.service === "reth-1-rpc")?.url;
  invariant(networkRpcUrl, "❌ Network RPC URL not found");

  logger.info("💸 Sending test transaction...");
  await sendTxn(privateKey, networkRpcUrl);

  printDivider();

  logger.trace("Display service information in a clean table");
  printHeader("Service Endpoints");

  logger.trace("Filter services to display based on blockscout option");
  const servicesToDisplay = services
    .filter((s) => ["reth-1-rpc", "reth-2-rpc", "dora"].includes(s.service))
    .concat([{ service: "kurtosis-web", port: "9711", url: "http://127.0.0.1:9711" }]);

  logger.trace("Conditionally add blockscout services");
  if (options.blockscout !== false) {
    const blockscoutBackend = services.find((s) => s.service === "blockscout-backend");
    if (blockscoutBackend) {
      servicesToDisplay.push(blockscoutBackend);
      logger.trace("Adding blockscout frontend");
      servicesToDisplay.push({ service: "blockscout", port: "3000", url: "http://127.0.0.1:3000" });
    }
  }

  console.table(servicesToDisplay);

  printDivider();

  logger.trace("Show completion information");
  const timeEnd = performance.now();
  const minutes = ((timeEnd - timeStart) / (1000 * 60)).toFixed(1);

  logger.success(`Kurtosis network started successfully in ${minutes} minutes`);

  printDivider();

  logger.trace("Deploy contracts using the extracted function");
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

  logger.trace("Set up validators using the extracted function");
  if (contractsDeployed) {
    let shouldFundValidators = options.fundValidators;
    let shouldSetupValidators = options.setupValidators;
    let shouldUpdateValidatorSet = options.updateValidatorSet;

    logger.trace("If not specified, prompt for funding");
    if (shouldFundValidators === undefined) {
      shouldFundValidators = await promptWithTimeout(
        "Do you want to fund validators with tokens and ETH?",
        true,
        10
      );
    } else {
      logger.info(
        `Using flag option: ${shouldFundValidators ? "will fund" : "will not fund"} validators`
      );
    }

    logger.trace("If not specified, prompt for setup");
    if (shouldSetupValidators === undefined) {
      shouldSetupValidators = await promptWithTimeout(
        "Do you want to register validators in EigenLayer?",
        true,
        10
      );
    } else {
      logger.info(
        `Using flag option: ${shouldSetupValidators ? "will register" : "will not register"} validators`
      );
    }

    logger.trace("If not specified, prompt for update");
    if (shouldUpdateValidatorSet === undefined) {
      shouldUpdateValidatorSet = await promptWithTimeout(
        "Do you want to update the validator set on the substrate chain?",
        true,
        10
      );
    } else {
      logger.info(
        `Using flag option: ${shouldUpdateValidatorSet ? "will update" : "will not update"} validator set`
      );
    }

    if (shouldFundValidators) {
      await fundValidators({
        rpcUrl: networkRpcUrl
      });
    } else {
      logger.info("Skipping validator funding");
    }

    if (shouldSetupValidators) {
      await setupValidators({
        rpcUrl: networkRpcUrl
      });

      if (shouldUpdateValidatorSet) {
        await updateValidatorSet({
          rpcUrl: networkRpcUrl
        });
      } else {
        logger.info("Skipping validator set update");
      }
    } else {
      logger.info("Skipping validator setup");
    }
  } else if (options.setupValidators || options.fundValidators) {
    logger.warn(
      "⚠️ Validator operations requested but contracts were not deployed. Skipping validator operations."
    );
  }

  if (options.relayer) {
    printHeader("Starting Snowbridge Relayers");

    logger.info(`Running snowbridge relayer from: ${options.relayerBinPath}`);

    const { stdout, stderr, exitCode } = await $`sh -c ${options.relayerBinPath} --help`
      .quiet()
      .nothrow();

    if (exitCode !== 0) {
      logger.error(`Failed to run relayer binary ${options.relayerBinPath}: ${stderr.toString()}`);
      throw Error("❌ Relayer binary failed basic help check");
    }
    logger.debug(stdout.toString());

    logger.info("Preparing to generate configs");
    await generateSnowbridgeConfigs();
    logger.success("Snowbridge configs generated");

    // TODO - Start Relayers here
    // For each relayer in array spawn in background relayer with appropriate private key, command and config param
    const relayersToStart = [
      {
        name: "relayer-🥩",
        type: "beefy",
        config: "modified-beefy-relay.json"
      },
      {
        name: "relayer-🥓",
        type: "beacon",
        config: "modified-beacon-relay.json"
      }
    ];

    // logger.trace("Starting Snowbridge relayers");
    // for (const relayer of relayersToStart) {
    //   await $`sh -c docker run --platform=linux/amd64 ${dockerImage}`.quiet().nothrow();
    // }
    // logger.success("Snowbridge relayers started");
  }

  logger.success("Launch script completed successfully");
};

export const launchPreActionHook = (
  thisCmd: Command<[], LaunchOptions & { [key: string]: any }>
) => {
  const { blockscout, verified } = thisCmd.opts();
  if (verified && !blockscout) {
    thisCmd.error("--verified requires --blockscout to be set");
  }
};

//  =====  Checks  =====
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
