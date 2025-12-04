import { datahaven } from "@polkadot-api/descriptors";
import { createClient as createPapiClient, type PolkadotClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { ANVIL_FUNDED_ACCOUNTS, type DataHavenApi, logger } from "utils";
import {
  type Account,
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  webSocket,
  type PublicClient,
  type WalletClient
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil } from "viem/chains";
import type { LaunchNetworkResult } from "../launcher";

export interface TestConnectors {
  // Ethereum connectors
  publicClient: PublicClient;
  walletClient: WalletClient<any, any, Account>;

  // DataHaven connectors
  papiClient: PolkadotClient;
  dhApi: DataHavenApi;

  // Raw URLs
  elRpcUrl: string;
  dhRpcUrl: string;
}

export class ConnectorFactory {
  private connectors: LaunchNetworkResult;

  constructor(connectors: LaunchNetworkResult) {
    this.connectors = connectors;
  }

  /**
   * Create test connectors for interacting with the launched networks
   */
  async createTestConnectors(): Promise<TestConnectors> {
    logger.debug("Creating test connectors...");

    // Prefer WebSocket for event-heavy public client; fall back to HTTP when WS is unavailable.
    const wsUrl = this.connectors.ethereumWsUrl;

    const publicTransport =
      wsUrl && wsUrl.startsWith("ws")
        ? fallback([webSocket(wsUrl), http(this.connectors.ethereumRpcUrl)])
        : http(this.connectors.ethereumRpcUrl);

    // Create Ethereum clients
    const publicClient = createPublicClient({
      chain: anvil,
      transport: publicTransport
    });

    const account = privateKeyToAccount(ANVIL_FUNDED_ACCOUNTS[0].privateKey);
    const walletClient = createWalletClient({
      account,
      chain: anvil,
      transport: http(this.connectors.ethereumRpcUrl)
    });

    // Create DataHaven/Substrate clients
    // Note: polkadot-api can handle HTTP RPC URLs even when passed to getWsProvider
    const wsProvider = getWsProvider(this.connectors.dataHavenRpcUrl);
    const papiClient = createPapiClient(withPolkadotSdkCompat(wsProvider));

    // Get typed API
    const dhApi = papiClient.getTypedApi(datahaven);

    logger.debug("Test connectors created successfully");

    return {
      publicClient,
      walletClient,
      papiClient,
      dhApi,
      elRpcUrl: this.connectors.ethereumRpcUrl,
      dhRpcUrl: this.connectors.dataHavenRpcUrl
    };
  }

  /**
   * Create a wallet client with a specific account
   */
  createWalletClient(privateKey: `0x${string}`): WalletClient<any, any, Account> {
    const account = privateKeyToAccount(privateKey);
    return createWalletClient({
      account,
      chain: anvil,
      transport: http(this.connectors.ethereumRpcUrl)
    });
  }

  /**
   * Clean up connections
   */
  async cleanup(connectors: TestConnectors): Promise<void> {
    logger.debug("Cleaning up test connectors...");

    // Destroy PAPI client
    if (connectors.papiClient) {
      try {
        connectors.papiClient.destroy();
      } catch (error) {
        // Ignore DisjointError - it occurs when ChainHead subscriptions are already disjointed
        // This is harmless and expected during cleanup
        const errorName = error instanceof Error ? error.name : String(error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (
          errorName === "DisjointError" ||
          errorName.includes("disjoint") ||
          errorMessage.includes("disjoint") ||
          errorMessage.includes("ChainHead disjointed")
        ) {
          // Ignore - this is expected and harmless
        } else {
          // Re-throw unexpected errors
          throw error;
        }
      }
    }

    logger.debug("Test connectors cleaned up");
  }
}
