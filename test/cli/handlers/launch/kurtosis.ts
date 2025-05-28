import { $ } from "bun";
import type { LaunchOptions } from "cli/handlers";
import invariant from "tiny-invariant";
import { confirmWithTimeout, getPortFromKurtosis, logger, printDivider, printHeader } from "utils";
import { parse, stringify } from "yaml";
import type { LaunchedNetwork } from "./launchedNetwork";

/**
 * Launches a Kurtosis Ethereum network enclave for testing.
 *
 * @param launchedNetwork - The LaunchedNetwork instance to store network details
 * @param options - Configuration options
 */
export const launchKurtosis = async (
  launchedNetwork: LaunchedNetwork,
  options: LaunchOptions
): Promise<void> => {
  printHeader("Starting Kurtosis EthereumNetwork");

  let shouldLaunchKurtosis = options.launchKurtosis;

  if (shouldLaunchKurtosis === undefined) {
    shouldLaunchKurtosis = await confirmWithTimeout(
      "Do you want to launch the Kurtosis network?",
      true,
      10
    );
  }

  if (!shouldLaunchKurtosis) {
    logger.info("👍 Skipping Kurtosis Ethereum network launch. Done!");

    if (options.kurtosisEnclaveName) {
      logger.debug(`Registering ${options.kurtosisEnclaveName}`);
      await registerServices(launchedNetwork, options.kurtosisEnclaveName);
    }
    printDivider();
    return;
  }

  if (await checkKurtosisRunning(options.kurtosisEnclaveName)) {
    logger.info("ℹ️  Kurtosis Ethereum network is already running.");

    // If the user wants to launch the Kurtosis network, we ask them if they want
    // to clean the existing enclave or just continue with the existing enclave.
    if (shouldLaunchKurtosis) {
      let shouldRelaunch = options.cleanNetwork;

      if (shouldRelaunch === undefined) {
        shouldRelaunch = await confirmWithTimeout(
          "Do you want to clean and relaunch the Kurtosis enclave?",
          true,
          10
        );
      }

      // Case: User wants to keep existing enclave
      if (!shouldRelaunch) {
        logger.info("👍 Keeping existing Kurtosis enclave.");

        await registerServices(launchedNetwork, options.kurtosisEnclaveName);
        printDivider();
        return;
      }

      // Case: User wants to clean and relaunch the enclave
      logger.info("🧹 Cleaning up Docker and Kurtosis environments...");
      logger.debug(await $`kurtosis enclave stop ${options.kurtosisEnclaveName}`.nothrow().text());
      logger.debug(await $`kurtosis clean`.text());
      logger.debug(await $`kurtosis engine stop`.nothrow().text());
      logger.debug(await $`docker system prune -f`.nothrow().text());
    }
  }

  if (process.platform === "darwin") {
    logger.debug("Detected macOS, pulling container images with linux/amd64 platform...");
    logger.debug(
      await $`docker pull ghcr.io/blockscout/smart-contract-verifier:latest --platform linux/amd64`.text()
    );
  }

  logger.info("🚀 Starting Kurtosis enclave...");

  const configFile = await modifyConfig(options, "configs/kurtosis/minimal.yaml");

  logger.info(`⚙️ Using Kurtosis config file: ${configFile}`);

  const { stderr, stdout, exitCode } =
    await $`kurtosis run github.com/ethpandaops/ethereum-package --args-file ${configFile} --enclave ${options.kurtosisEnclaveName}`
      .nothrow()
      .quiet();

  if (exitCode !== 0) {
    logger.error(stderr.toString());
    throw Error("❌ Kurtosis network has failed to start properly.");
  }
  logger.debug(stdout.toString());

  await registerServices(launchedNetwork, options.kurtosisEnclaveName);
  logger.success("Kurtosis network operations completed successfully.");
  printDivider();
};

/**
 * Checks if a Kurtosis enclave with the specified name is currently running.
 *
 * @param enclaveName - The name of the Kurtosis enclave to check
 * @returns True if the enclave is running, false otherwise
 */
const checkKurtosisRunning = async (enclaveName: string): Promise<boolean> => {
  const text = await $`kurtosis enclave ls | grep "${enclaveName}" | grep RUNNING`.text();
  return text.length > 0;
};

const modifyConfig = async (options: LaunchOptions, configFile: string) => {
  const outputDir = "tmp/configs";
  logger.debug(`Ensuring output directory exists: ${outputDir}`);
  await $`mkdir -p ${outputDir}`.quiet();

  const file = Bun.file(configFile);
  invariant(file, `❌ Config file ${configFile} not found`);

  const config = await file.text();
  logger.debug(`Parsing config at ${configFile}`);
  logger.trace(config);

  const parsedConfig = parse(config);

  if (options.blockscout) {
    parsedConfig.additional_services.push("blockscout");
  }

  if (options.slotTime) {
    parsedConfig.network_params.seconds_per_slot = options.slotTime;
  }

  if (options.kurtosisNetworkArgs) {
    logger.debug(`Using custom Kurtosis network args: ${options.kurtosisNetworkArgs}`);
    const args = options.kurtosisNetworkArgs.split(" ");
    for (const arg of args) {
      const [key, value] = arg.split("=");
      parsedConfig.network_params[key] = value;
    }
  }

  logger.trace(parsedConfig);
  const outputFile = `${outputDir}/modified-config.yaml`;
  logger.debug(`Modified config saving to ${outputFile}`);

  await Bun.write(outputFile, stringify(parsedConfig));
  return outputFile;
};

/**
 * Registers the EL and CL service endpoints with the LaunchedNetwork instance.
 *
 * @param launchedNetwork - The LaunchedNetwork instance to store network details.
 */
const registerServices = async (launchedNetwork: LaunchedNetwork, enclaveName: string) => {
  logger.info("📝 Registering Kurtosis service endpoints...");

  // Configure EL RPC URL
  try {
    const rethPublicPort = await getPortFromKurtosis("el-1-reth-lighthouse", "rpc", enclaveName);
    invariant(rethPublicPort && rethPublicPort > 0, "❌ Could not find EL RPC port");
    const elRpcUrl = `http://127.0.0.1:${rethPublicPort}`;
    launchedNetwork.elRpcUrl = elRpcUrl;
    logger.info(`📝 Execution Layer RPC URL configured: ${elRpcUrl}`);

    // Configure CL Endpoint
    const lighthousePublicPort = await getPortFromKurtosis(
      "cl-1-lighthouse-reth",
      "http",
      enclaveName
    );
    const clEndpoint = `http://127.0.0.1:${lighthousePublicPort}`;
    invariant(
      clEndpoint,
      "❌ CL Endpoint could not be determined from Kurtosis service cl-1-lighthouse-reth"
    );
    launchedNetwork.clEndpoint = clEndpoint;
    logger.info(`📝 Consensus Layer Endpoint configured: ${clEndpoint}`);
  } catch (error) {
    logger.warn(`⚠️ Kurtosis service endpoints could not be determined: ${error}`);
  }
};
