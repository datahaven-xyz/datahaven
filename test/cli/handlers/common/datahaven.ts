import { createClient, type PolkadotClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { logger } from "utils";

/**
 * Checks if the DataHaven network is ready by sending a POST request to the system_chain method.
 *
 * @param port - The port number to check.
 * @returns True if the network is ready, false otherwise.
 */
export const isNetworkReady = async (port: number): Promise<boolean> => {
  const wsUrl = `ws://127.0.0.1:${port}`;
  let client: PolkadotClient | undefined;
  try {
    // Use withPolkadotSdkCompat for consistency, though _request might not strictly need it.
    client = createClient(withPolkadotSdkCompat(getWsProvider(wsUrl)));
    const chainName = await client._request<string>("system_chain", []);
    logger.debug(`isNetworkReady PAPI check successful for port ${port}, chain: ${chainName}`);
    client.destroy();
    return !!chainName; // Ensure it's a boolean and chainName is truthy
  } catch (error) {
    logger.debug(`isNetworkReady PAPI check failed for port ${port}: ${error}`);
    if (client) {
      client.destroy();
    }
    return false;
  }
};
