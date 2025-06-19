import { $ } from "bun";
import {
  getPortFromKurtosis,
  type KurtosisEnclaveInfo,
  KurtosisEnclaveInfoSchema,
  logger
} from "utils";
import type { LaunchedNetwork } from "../types/launchedNetwork";

/**
 * Checks if a Kurtosis enclave with the specified name is currently running.
 *
 * @param enclaveName - The name of the Kurtosis enclave to check
 * @returns True if the enclave is running, false otherwise
 */
export async function checkKurtosisEnclaveRunning(enclaveName: string): Promise<boolean> {
  const enclaves = await getRunningKurtosisEnclaves();
  return enclaves.some((enclave) => enclave.name === enclaveName);
}

/**
 * Gets a list of currently running Kurtosis enclaves
 * @returns Promise<KurtosisEnclaveInfo[]> - Array of running enclave information
 */
export async function getRunningKurtosisEnclaves(): Promise<KurtosisEnclaveInfo[]> {
  logger.debug("🔎 Checking for running Kurtosis enclaves...");

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
        uuid,
        name,
        status,
        creationTime
      });

      if (parseResult.success) {
        enclaves.push(parseResult.data);
      } else {
        logger.warn(`Failed to parse enclave info from line: "${line}"`);
        logger.warn(`Parse errors: ${JSON.stringify(parseResult.error.errors)}`);
      }
    } else {
      logger.warn(`Line did not match expected format: "${line}"`);
    }
  }

  return enclaves;
}

/**
 * Registers Kurtosis services in the LaunchedNetwork
 * @param launchedNetwork - The launched network instance
 * @param enclaveName - The Kurtosis enclave name
 */
export async function registerKurtosisServices(
  launchedNetwork: LaunchedNetwork,
  enclaveName: string
): Promise<void> {
  logger.info("📝 Registering Kurtosis services...");

  // Get EL RPC URL
  const rethPublicPort = await getPortFromKurtosis("el-1-reth-lodestar", "rpc", enclaveName);
  if (rethPublicPort && rethPublicPort > 0) {
    const elRpcUrl = `http://127.0.0.1:${rethPublicPort}`;
    launchedNetwork.elRpcUrl = elRpcUrl;
    logger.info(`📝 Execution Layer RPC URL registered: ${elRpcUrl}`);
  }

  // Get CL endpoint
  const lodestarPublicPort = await getPortFromKurtosis("cl-1-lodestar-reth", "http", enclaveName);
  if (lodestarPublicPort && lodestarPublicPort > 0) {
    const clEndpoint = `http://127.0.0.1:${lodestarPublicPort}`;
    launchedNetwork.clEndpoint = clEndpoint;
    logger.info(`📝 Consensus Layer HTTP Endpoint registered: ${clEndpoint}`);
  }

  if (!launchedNetwork.elRpcUrl || !launchedNetwork.clEndpoint) {
    throw new Error("Failed to get Kurtosis service endpoints");
  }
}

/**
 * Cleans up a Kurtosis enclave
 * @param enclaveName - The name of the enclave to clean up
 */
export async function cleanupKurtosisEnclave(enclaveName: string): Promise<void> {
  logger.info(`🧹 Cleaning up Kurtosis enclave: ${enclaveName}...`);
  await $`kurtosis enclave rm ${enclaveName} -f`.quiet();
  logger.success(`Kurtosis enclave ${enclaveName} removed`);
}
