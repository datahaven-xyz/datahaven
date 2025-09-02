import { $ } from "bun";
import invariant from "tiny-invariant";
import {
  getPortFromKurtosis,
  type KurtosisEnclaveInfo,
  KurtosisEnclaveInfoSchema,
  logger,
  runShellCommandWithLogger
} from "utils";
import { parse, stringify } from "yaml";
import type { LaunchedNetwork } from "./types/launchedNetwork";

/**
 * Configuration options for Kurtosis-related operations.
 */
export interface KurtosisOptions {
  kurtosisEnclaveName: string;
  blockscout?: boolean;
  slotTime?: number;
  kurtosisNetworkArgs?: string;
}

/**
 * Result of launching a Kurtosis network.
 */
export interface KurtosisLaunchResult {
  success: boolean;
  cleanup?: () => Promise<void>;
}

/**
 * Launches a local Kurtosis Ethereum network for testing.
 *
 * This function handles the complete setup of a Kurtosis test network including:
 * - Checking and handling existing enclaves
 * - Pulling required Docker images (macOS-specific handling)
 * - Running the Kurtosis enclave with the specified configuration
 * - Registering service endpoints in the launched network
 *
 * @param options - Configuration options for launching the network
 * @param options.kurtosisEnclaveName - Name of the Kurtosis enclave to create
 * @param options.blockscout - Whether to include Blockscout block explorer
 * @param options.slotTime - Seconds per slot for the network
 * @param options.kurtosisNetworkArgs - Additional network parameters
 * @param launchedNetwork - The launched network instance to track the network's state
 * @param configFilePath - Path to the Kurtosis configuration file (default: "configs/kurtosis/minimal.yaml")
 *
 * @throws {Error} If the Kurtosis network fails to start properly
 */
export const launchKurtosisNetwork = async (
  options: KurtosisOptions,
  launchedNetwork: LaunchedNetwork,
  configFilePath = "configs/kurtosis/minimal.yaml"
): Promise<void> => {
  logger.info("🚀 Launching Kurtosis Ethereum network...");

  // Handle macOS-specific Docker image requirements
  if (process.platform === "darwin") {
    await pullMacOSImages();
  }

  await runKurtosisEnclave(options, configFilePath);
  await registerServices(launchedNetwork, options.kurtosisEnclaveName);

  logger.success("Kurtosis network launched successfully");
};

/**
 * Checks if a Kurtosis enclave with the specified name is currently running.
 *
 * @param enclaveName - The name of the Kurtosis enclave to check
 * @returns True if the enclave is running, false otherwise
 */
export const checkKurtosisEnclaveRunning = async (enclaveName: string): Promise<boolean> => {
  const enclaves = await getRunningKurtosisEnclaves();
  return enclaves.some((enclave) => enclave.name === enclaveName);
};

/**
 * Gets a list of currently running Kurtosis enclaves.
 *
 * This function executes the `kurtosis enclave ls` command and parses the output
 * to extract information about running enclaves.
 *
 * @returns Array of running enclave information including UUID, name, status, and creation time
 */
export const getRunningKurtosisEnclaves = async (): Promise<KurtosisEnclaveInfo[]> => {
  logger.debug("🔎 Checking for running Kurtosis enclaves...");

  try {
    const lines = (await Array.fromAsync($`kurtosis enclave ls`.lines())).filter(
      (line) => line.length > 0
    );
    logger.trace(lines);

    // Remove header line
    lines.shift();

    const enclaves: KurtosisEnclaveInfo[] = [];

    if (lines.length === 0) {
      logger.debug("🤷‍ No Kurtosis enclaves found running.");
      return enclaves;
    }

    logger.debug(`🔎 Found ${lines.length} Kurtosis enclave(s) running.`);
    // Updated regex to match the actual format: "uuid name status creationTime"
    const enclaveRegex = /^(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/;

    for (const line of lines) {
      const match = line.match(enclaveRegex);
      if (match) {
        const [, uuid, name, status, creationTime] = match;
        const parseResult = KurtosisEnclaveInfoSchema.safeParse({
          uuid: uuid.trim(),
          name: name.trim(),
          status: status.trim(),
          creationTime: creationTime.trim()
        });

        if (parseResult.success) {
          enclaves.push(parseResult.data);
        } else {
          logger.warn(
            `⚠️ Could not parse enclave line: "${line}". Error: ${parseResult.error.message}`
          );
        }
      } else {
        logger.warn(`⚠️ Could not parse enclave line (regex mismatch): "${line}"`);
      }
    }

    if (lines.length > 0 && enclaves.length === 0) {
      logger.warn("⚠️ Found enclave lines in output, but failed to parse any of them.");
    }

    return enclaves;
  } catch (error) {
    logger.debug("🤷‍ Kurtosis engine is not running or command failed. Returning empty array.");
    logger.trace(`Error: ${error}`);
    return [];
  }
};

/**
 * Cleans and removes a Kurtosis enclave and optionally performs system cleanup.
 *
 * This function:
 * - Stops the specified Kurtosis enclave
 * - Cleans Kurtosis artifacts
 * - Stops the Kurtosis engine
 * - Optionally prunes Docker system resources
 *
 * @param enclaveName - The name of the Kurtosis enclave to clean
 * @param pruneDocker - Whether to run docker system prune (default: true)
 */
export const cleanKurtosisEnclave = async (
  enclaveName: string,
  pruneDocker = true
): Promise<void> => {
  logger.info("🧹 Cleaning up Docker and Kurtosis environments...");

  logger.debug(await $`kurtosis enclave stop ${enclaveName}`.nothrow().text());
  logger.debug(await $`kurtosis clean`.text());
  logger.debug(await $`kurtosis engine stop`.nothrow().text());

  if (pruneDocker) {
    logger.debug(await $`docker system prune -f`.nothrow().text());
  }

  logger.success("Kurtosis enclave cleaned successfully");
};

/**
 * Modifies a Kurtosis configuration file based on deployment options.
 *
 * This function reads a YAML configuration file, applies modifications based on the provided
 * deployment options, and writes the modified configuration to a new file in the tmp/configs directory.
 *
 * @param options - Configuration options
 * @param options.blockscout - If true, adds "blockscout" to the additional_services array
 * @param options.slotTime - If provided, sets the network_params.seconds_per_slot value
 * @param options.kurtosisNetworkArgs - Space-separated key=value pairs to add to network_params
 * @param configFile - Path to the original YAML configuration file to modify
 * @returns Path to the modified configuration file in tmp/configs/
 *
 * @throws {Error} If the config file is not found
 */
export const modifyConfig = async (
  options: {
    blockscout?: boolean;
    slotTime?: number;
    kurtosisNetworkArgs?: string;
    kurtosisEnclaveName?: string;
  },
  configFile: string
): Promise<string> => {
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
  // Use a unique filename based on the enclave name to avoid conflicts in parallel execution
  const configFileName = options.kurtosisEnclaveName
    ? `modified-config-${options.kurtosisEnclaveName}.yaml`
    : "modified-config.yaml";
  const outputFile = `${outputDir}/${configFileName}`;
  logger.debug(`Modified config saving to ${outputFile}`);

  await Bun.write(outputFile, stringify(parsedConfig));
  return outputFile;
};

/**
 * Registers the Execution Layer (EL) and Consensus Layer (CL) service endpoints with the LaunchedNetwork instance.
 *
 * This function retrieves the public ports for the Ethereum network services from Kurtosis and configures
 * the LaunchedNetwork instance with the appropriate RPC URLs and endpoints for client communication.
 *
 * Services registered:
 * - Execution Layer (EL): Reth RPC endpoint via "el-1-reth-lodestar" service
 * - Consensus Layer (CL): Lodestar HTTP endpoint via "cl-1-lodestar-reth" service
 *
 * @param launchedNetwork - The LaunchedNetwork instance to populate with service endpoints
 * @param enclaveName - The name of the Kurtosis enclave containing the services
 *
 * @throws {Error} If EL RPC port cannot be found
 * @throws {Error} If CL endpoint cannot be determined
 */
export const registerServices = async (
  launchedNetwork: LaunchedNetwork,
  enclaveName: string
): Promise<void> => {
  logger.info("📝 Registering Kurtosis service endpoints...");

  // Configure EL RPC URL
  try {
    const rethPublicPort = await getPortFromKurtosis("el-1-reth-lodestar", "rpc", enclaveName);
    invariant(rethPublicPort && rethPublicPort > 0, "❌ Could not find EL RPC port");
    const elRpcUrl = `http://127.0.0.1:${rethPublicPort}`;
    launchedNetwork.elRpcUrl = elRpcUrl;
    logger.info(`📝 Execution Layer RPC URL configured: ${elRpcUrl}`);

    // Configure CL Endpoint
    const lodestarPublicPort = await getPortFromKurtosis("cl-1-lodestar-reth", "http", enclaveName);
    const clEndpoint = `http://127.0.0.1:${lodestarPublicPort}`;
    invariant(
      clEndpoint,
      "❌ CL Endpoint could not be determined from Kurtosis service cl-1-lodestar-reth"
    );
    launchedNetwork.clEndpoint = clEndpoint;
    logger.info(`📝 Consensus Layer Endpoint configured: ${clEndpoint}`);
  } catch (error) {
    logger.warn(`⚠️ Kurtosis service endpoints could not be determined: ${error}`);
    throw error;
  }
};

/**
 * Runs a Kurtosis Ethereum network enclave with the specified configuration.
 *
 * This function handles the complete process of starting a Kurtosis enclave:
 * 1. Modifies the configuration file based on the provided options
 * 2. Executes the kurtosis run command with the modified configuration
 * 3. Handles error cases and logs appropriate debug information
 *
 * @param options - Configuration options containing kurtosisEnclaveName and other settings
 * @param configFilePath - Path to the base YAML configuration file to use
 *
 * @throws {Error} If the Kurtosis network fails to start properly
 */
export const runKurtosisEnclave = async (
  options: {
    kurtosisEnclaveName: string;
    blockscout?: boolean;
    slotTime?: number;
    kurtosisNetworkArgs?: string;
  },
  configFilePath: string
): Promise<void> => {
  logger.info("🚀 Starting Kurtosis enclave...");

  const configFile = await modifyConfig(options, configFilePath);

  logger.info(`⚙️ Using Kurtosis config file: ${configFile}`);

  await runShellCommandWithLogger(
    `kurtosis run github.com/ethpandaops/ethereum-package --args-file ${configFile} --enclave ${options.kurtosisEnclaveName} --cli-log-level debug`,
    {
      logLevel: "debug"
    }
  );
};

/**
 * Pulls required Docker images for macOS with the correct platform architecture.
 *
 * This function is specifically for macOS users who need to pull linux/amd64 images
 * to ensure compatibility with Kurtosis.
 */
const pullMacOSImages = async (): Promise<void> => {
  logger.debug("Detected macOS, pulling container images with linux/amd64 platform...");
  logger.debug(
    await $`docker pull ghcr.io/blockscout/smart-contract-verifier:latest --platform linux/amd64`.text()
  );
};

/**
 * Gets the Blockscout URL for a given Kurtosis enclave.
 *
 * @param enclaveName - The name of the Kurtosis enclave
 * @returns The Blockscout backend URL
 *
 * @throws {Error} If the Blockscout service is not found in the enclave
 */
export const getBlockscoutUrl = async (enclaveName: string): Promise<string> => {
  const blockscoutPort = await getPortFromKurtosis("blockscout", "http", enclaveName);
  invariant(blockscoutPort, "❌ Could not find Blockscout service port");
  return `http://127.0.0.1:${blockscoutPort}`;
};
