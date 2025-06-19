import { $ } from "bun";
import { logger } from "utils";
import { parse, stringify } from "yaml";
import type { LaunchedNetwork } from "../types/launchedNetwork";
import { cleanupKurtosisEnclave, registerKurtosisServices } from "../utils";
import type { EthereumLaunchOptions, EthereumLaunchResult } from "./types";

export const launchEthereum = async (
  options: EthereumLaunchOptions,
  launchedNetwork: LaunchedNetwork
): Promise<EthereumLaunchResult> => {
  try {
    logger.info("🚀 Launching Ethereum network via Kurtosis...");

    // Clean up existing enclaves
    await cleanupKurtosis();

    // Pull required images for macOS
    if (process.platform === "darwin") {
      await pullKurtosisImages();
    }

    // Start Kurtosis enclave
    const enclaveName = options.kurtosisEnclaveName || `eth-${options.networkId}`;
    await runKurtosisEnclave(options, enclaveName);

    // Register service endpoints
    await registerKurtosisServices(launchedNetwork, enclaveName);

    logger.success("Ethereum network operations completed successfully.");

    return {
      success: true,
      elRpcUrl: launchedNetwork.elRpcUrl,
      clEndpoint: launchedNetwork.clEndpoint,
      cleanup: () => cleanupKurtosisEnclave(enclaveName)
    };
  } catch (error) {
    logger.error("Failed to launch Ethereum network", error);
    return {
      success: false,
      error: error as Error
    };
  }
}

const cleanupKurtosis = async (): Promise<void> => {
  logger.info("🧹 Cleaning up Ethereum/Kurtosis environment...");

  // Get list of running enclaves
  const enclaves = await getRunningKurtosisEnclaves();

  if (enclaves.length > 0) {
    logger.debug(`🧹 Found ${enclaves.length} Kurtosis enclave(s) to clean.`);
    await $`kurtosis clean -a`.quiet();
  }

  logger.success("Ethereum/Kurtosis cleanup completed");
}

const getRunningKurtosisEnclaves = async (): Promise<Array<{ name: string }>> => {
  logger.debug("🔎 Checking for running Kurtosis enclaves...");

  const lines = (await Array.fromAsync($`kurtosis enclave ls`.lines())).filter(
    (line) => line.length > 0
  );

  // Remove header line
  lines.shift();

  if (lines.length === 0) {
    logger.debug("🤷‍ No Kurtosis enclaves found running.");
    return [];
  }

  // Parse enclave names
  const enclaves = lines
    .map((line) => {
      const match = line.match(/^(\S+)\s+(\S+)/);
      return match ? { name: match[2] } : null;
    })
    .filter(Boolean) as Array<{ name: string }>;

  return enclaves;
}

const pullKurtosisImages = async (): Promise<void> => {
  logger.debug("Detected macOS, pulling container images with linux/amd64 platform...");

  const images = [
    "ethpandaops/ethereum-genesis-generator:3.2.1",
    "ethpandaops/reth:main",
    "sigp/lighthouse:v5.3.0-exp-2",
    "ethpandaops/tx-fuzz:master"
  ];

  for (const image of images) {
    await $`docker pull --platform linux/amd64 ${image}`.quiet();
  }
}

const runKurtosisEnclave = async (
  options: EthereumLaunchOptions,
  enclaveName: string
): Promise<void> => {
  logger.info("🚀 Starting Kurtosis enclave...");

  // Modify config file
  const configFile = await modifyKurtosisConfig(options);
  logger.info(`⚙️ Using Kurtosis config file: ${configFile}`);

  // Run Kurtosis
  const { stderr, stdout, exitCode } =
    await $`kurtosis run github.com/ethpandaops/ethereum-package --args-file ${configFile} --enclave ${enclaveName}`
      .nothrow()
      .quiet();

  if (exitCode !== 0) {
    logger.error(stderr.toString());
    throw new Error("❌ Kurtosis network has failed to start properly.");
  }

  logger.debug(stdout.toString());
}

const modifyKurtosisConfig = async (options: EthereumLaunchOptions): Promise<string> => {
  const outputDir = "tmp/configs";
  await $`mkdir -p ${outputDir}`.quiet();

  const configFile = "configs/kurtosis/minimal.yaml";
  const file = Bun.file(configFile);

  if (!file) {
    throw new Error(`❌ Config file ${configFile} not found`);
  }

  const config = await file.text();
  const parsedConfig = parse(config);

  // Apply modifications
  if (options.blockscout) {
    parsedConfig.additional_services.push("blockscout");
  }

  if (options.slotTime) {
    parsedConfig.network_params.seconds_per_slot = options.slotTime;
  }

  if (options.kurtosisNetworkArgs) {
    const args = options.kurtosisNetworkArgs.split(" ");
    for (const arg of args) {
      const [key, value] = arg.split("=");
      parsedConfig.network_params[key] = value;
    }
  }

  // Write modified config
  const outputFile = `${outputDir}/modified-config.yaml`;
  await Bun.write(outputFile, stringify(parsedConfig));

  return outputFile;
}
