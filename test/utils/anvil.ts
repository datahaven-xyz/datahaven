import { getPortFromKurtosis } from "./kurtosis";
import { logger } from "./logger";

/**
 * Gets the RPC URL for the Anvil (local Ethereum) node running in Kurtosis
 * @param enclaveName - The name of the Kurtosis enclave (default: "datahaven-ethereum")
 * @returns The HTTP RPC URL for the Ethereum node
 */
export const getAnvilRpcUrl = async (enclaveName = "datahaven-ethereum"): Promise<string> => {
  try {
    logger.debug("Getting Anvil RPC URL from Kurtosis...");

    // Get the RPC port from the EL (Execution Layer) service
    const rpcPort = await getPortFromKurtosis("el-1-reth-lodestar", "rpc", enclaveName);

    const rpcUrl = `http://127.0.0.1:${rpcPort}`;
    logger.debug(`Anvil RPC URL: ${rpcUrl}`);

    return rpcUrl;
  } catch (error) {
    logger.warn(`⚠️ Failed to get Anvil RPC URL from Kurtosis: ${error}`);
    logger.warn("   Falling back to default http://localhost:8545");
    return "http://localhost:8545";
  }
};

/**
 * Gets the WebSocket URL for the Anvil (local Ethereum) node running in Kurtosis
 * @param enclaveName - The name of the Kurtosis enclave (default: "datahaven-ethereum")
 * @returns The WebSocket URL for the Ethereum node
 */
export const getAnvilWsUrl = async (enclaveName = "datahaven-ethereum"): Promise<string> => {
  try {
    logger.debug("Getting Anvil WebSocket URL from Kurtosis...");

    // Get the WS port from the EL (Execution Layer) service
    const wsPort = await getPortFromKurtosis("el-1-reth-lodestar", "ws", enclaveName);

    const wsUrl = `ws://127.0.0.1:${wsPort}`;
    logger.debug(`Anvil WebSocket URL: ${wsUrl}`);

    return wsUrl;
  } catch (error) {
    logger.warn(`⚠️ Failed to get Anvil WebSocket URL from Kurtosis: ${error}`);
    logger.warn("   Falling back to default ws://localhost:8546");
    return "ws://localhost:8546";
  }
};
