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
import {
  ANVIL_FUNDED_ACCOUNTS,
  type BeaconRelayConfig,
  type BeefyRelayConfig,
  type RelayerType,
  getPortFromKurtosis,
  getServiceFromKurtosis,
  isBeaconConfig,
  logger,
  parseRelayConfig,
  printDivider,
  printHeader,
  promptWithTimeout
} from "utils";

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
  skipCleaning?: boolean;
}

const BASE_SERVICES = [
  "cl-1-lighthouse-reth",
  "cl-1-lighthouse-reth",
  "el-1-reth-lighthouse",
  "el-2-reth-lighthouse",
  "dora"
];

// =====  Launch Handler Functions  =====

export const launch = async (options: LaunchOptions) => {
  logger.debug("Running with options:");
  logger.debug(options);

  const timeStart = performance.now();

  printHeader("Environment Checks");

  await checkDependencies();

  logger.trace("Launching Kurtosis enclave");
  await launchKurtosis({
    launchKurtosis: options.launchKurtosis,
    blockscout: options.blockscout,
    skipCleaning: options.skipCleaning
  });
  logger.trace("Kurtosis enclave launched");

  logger.trace("Send test transaction");
  printHeader("Setting Up Blockchain");
  logger.debug(`Using account ${ANVIL_FUNDED_ACCOUNTS[1].publicKey}`);
  const privateKey = ANVIL_FUNDED_ACCOUNTS[1].privateKey;
  const rethPublicPort = await getPortFromKurtosis("el-1-reth-lighthouse", "rpc");
  const networkRpcUrl = `http://127.0.0.1:${rethPublicPort}`;
  invariant(networkRpcUrl, "❌ Network RPC URL not found");

  logger.info("💸 Sending test transaction...");
  await sendTxn(privateKey, networkRpcUrl);

  printDivider();

  logger.trace("Show completion information");
  const timeEnd = performance.now();
  const minutes = ((timeEnd - timeStart) / (1000 * 60)).toFixed(1);

  logger.success(`Kurtosis network started successfully in ${minutes} minutes`);

  printDivider();

  logger.trace("Deploy contracts using the extracted function");
  let blockscoutBackendUrl: string | undefined = undefined;

  if (options.blockscout === true) {
    const blockscoutPublicPort = await getPortFromKurtosis("blockscout", "http");
    blockscoutBackendUrl = `http://127.0.0.1:${blockscoutPublicPort}`;
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

    logger.info("Preparing to generate configs");
    const anvilDeploymentsPath = "../contracts/deployments/anvil.json";
    const anvilDeploymentsFile = Bun.file(anvilDeploymentsPath);
    if (!(await anvilDeploymentsFile.exists())) {
      logger.error(`File ${anvilDeploymentsPath} does not exist`);
      throw new Error("Error reading anvil deployments file");
    }
    const anvilDeployments = await anvilDeploymentsFile.json();
    const beefyClientAddress = anvilDeployments.BeefyClient;
    const gatewayAddress = anvilDeployments.Gateway;
    invariant(beefyClientAddress, "❌ BeefyClient address not found in anvil.json");
    invariant(gatewayAddress, "❌ Gateway address not found in anvil.json");

    const outputDir = "tmp/configs";
    logger.debug(`Ensuring output directory exists: ${outputDir}`);
    await $`mkdir -p ${outputDir}`.quiet();

    const relayersToStart: { name: string; type: RelayerType; config: string }[] = [
      {
        name: "relayer-🥩",
        type: "beefy",
        config: "beefy-relay.json"
      },
      {
        name: "relayer-🥓",
        type: "beacon",
        config: "beacon-relay.json"
      }
    ];

    for (const { config: configFileName, type, name } of relayersToStart) {
      logger.debug(`Creating config for ${name}`);
      const templateFilePath = `configs/snowbridge/${configFileName}`;
      const outputFilePath = `tmp/configs/${configFileName}`;
      logger.debug(`Reading config file ${templateFilePath}`);
      const file = Bun.file(templateFilePath);

      if (!(await file.exists())) {
        logger.error(`File ${templateFilePath} does not exist`);
        throw new Error("Error reading snowbridge config file");
      }
      const json = await file.json();

      const ethWsPort = await getPortFromKurtosis("el-1-reth-lighthouse", "ws");
      const ethHttpPort = await getPortFromKurtosis("cl-1-lighthouse-reth", "http");
      const substrateWsPort = 9944;
      logger.debug(
        `Fetched ports: ETH WS=${ethWsPort}, ETH HTTP=${ethHttpPort}, Substrate WS=${substrateWsPort} (hardcoded)`
      );

      if (type === "beacon") {
        const cfg = parseRelayConfig(json, type);
        cfg.source.beacon.endpoint = `http://127.0.0.1:${ethHttpPort}`;
        cfg.source.beacon.stateEndpoint = `http://127.0.0.1:${ethHttpPort}`;

        // TODO: add datastore temp location
        cfg.sink.parachain.endpoint = `ws://127.0.0.1:${substrateWsPort}`;
        await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
        logger.success(`Updated beacon config written to ${outputFilePath}`);
      } else {
        const cfg = parseRelayConfig(json, type);
        cfg.source.polkadot.endpoint = `ws://127.0.0.1:${substrateWsPort}`;
        cfg.sink.ethereum.endpoint = `ws://127.0.0.1:${ethWsPort}`;
        cfg.sink.contracts.BeefyClient = beefyClientAddress;
        cfg.sink.contracts.Gateway = gatewayAddress;
        await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
        logger.success(`Updated beefy config written to ${outputFilePath}`);
      }

      // TODO: Start the relayer process here using the outputFilePath
      // Example (needs refinement for background execution, logging, etc.):
      // const relayerCmd = `${options.relayerBinPath} --config ${outputFilePath}`;
      // logger.info(`Starting relayer ${name} with command: ${relayerCmd}`);
      // Bun.spawn([options.relayerBinPath, "--config", outputFilePath], {
      //   stdout: "inherit",
      //   stderr: "inherit",
      //   // Consider running detached or managing the process lifecycle
      // });

      // logger.info(`Running snowbridge relayer from: ${options.relayerBinPath}`);

      // const { stdout, stderr, exitCode } = await $`sh -c ${options.relayerBinPath} --help`
      //   .quiet()
      //   .nothrow();

      // if (exitCode !== 0) {
      //   logger.error(`Failed to run relayer binary ${options.relayerBinPath}: ${stderr.toString()}`);
      //   throw Error("❌ Relayer binary failed basic help check");
      // }
      // logger.debug(stdout.toString());
    }

    // logger.trace("Starting Snowbridge relayers");
    // for (const relayer of relayersToStart) {
    //   await $`sh -c docker run --platform=linux/amd64 ${dockerImage}`.quiet().nothrow();
    // }
    // logger.success("Snowbridge relayers started");
  }

  printDivider();

  logger.trace("Display service information in a clean table");
  printHeader("Service Endpoints");

  logger.trace("Filter services to display based on blockscout option");
  const servicesToDisplay = BASE_SERVICES;

  if (options.blockscout === true) {
    servicesToDisplay.push(...["blockscout", "blockscout-frontend"]);
  }

  const displayData: { service: string; ports: Record<string, number>; url: string }[] = [];
  for (const service of servicesToDisplay) {
    logger.debug(`Checking service: ${service}`);

    const serviceInfo = await getServiceFromKurtosis(service);
    logger.debug("Service info", serviceInfo);
    switch (true) {
      case service.startsWith("cl-"): {
        const httpPort = serviceInfo.public_ports.http.number;
        displayData.push({
          service,
          ports: { http: httpPort },
          url: `http://127.0.0.1:${httpPort}`
        });
        break;
      }

      case service.startsWith("el-"): {
        const rpcPort = serviceInfo.public_ports.rpc.number;
        const wsPort = serviceInfo.public_ports.ws.number;
        displayData.push({
          service,
          ports: { rpc: rpcPort, ws: wsPort },
          url: `http://127.0.0.1:${rpcPort}`
        });
        break;
      }

      case service.startsWith("dora"): {
        const httpPort = serviceInfo.public_ports.http.number;
        displayData.push({
          service,
          ports: { http: httpPort },
          url: `http://127.0.0.1:${httpPort}`
        });
        break;
      }

      case service === "blockscout": {
        const httpPort = serviceInfo.public_ports.http.number;
        displayData.push({
          service,
          ports: { http: httpPort },
          url: `http://127.0.0.1:${httpPort}`
        });
        break;
      }

      case service === "blockscout-frontend": {
        const httpPort = serviceInfo.public_ports.http.number;
        displayData.push({
          service,
          ports: { http: httpPort },
          url: `http://127.0.0.1:${httpPort}`
        });
        break;
      }

      default: {
        logger.error(`Unknown service: ${service}`);
      }
    }
  }

  console.table(displayData);
  printDivider();
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
