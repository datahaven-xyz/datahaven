import { datahaven } from "@polkadot-api/descriptors";
import { createClient as createPapiClient, type PolkadotClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { ANVIL_FUNDED_ACCOUNTS, type DataHavenApi, logger } from "utils";
import {
  type Account,
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil } from "viem/chains";
import type { NetworkConnectors } from "../launcher";

export interface TestConnectors {
  // Ethereum connectors
  publicClient: PublicClient;
  walletClient: WalletClient<any, any, Account>;

  // DataHaven connectors
  papiClient: PolkadotClient;
  dhApi: DataHavenApi;

  // Raw URLs
  elRpcUrl: string;
  dhWsUrl: string;
}

export class ConnectorFactory {
  private connectors: NetworkConnectors;

  constructor(connectors: NetworkConnectors) {
    this.connectors = connectors;
  }

  /**
   * Create test connectors for interacting with the launched networks
   */
  async createTestConnectors(): Promise<TestConnectors> {
    logger.debug("Creating test connectors...");

    // Create Ethereum clients
    const publicClient = createPublicClient({
      chain: anvil,
      transport: http(this.connectors.elRpcUrl)
    });

    const account = privateKeyToAccount(ANVIL_FUNDED_ACCOUNTS[0].privateKey);
    const walletClient = createWalletClient({
      account,
      chain: anvil,
      transport: http(this.connectors.elRpcUrl)
    });

    // Create DataHaven/Substrate clients
    const wsProvider = getWsProvider(this.connectors.dhWsUrl);
    const papiClient = createPapiClient(withPolkadotSdkCompat(wsProvider));

    // Get typed API
    const dhApi = papiClient.getTypedApi(datahaven);

    logger.debug("Test connectors created successfully");

    return {
      publicClient,
      walletClient,
      papiClient,
      dhApi,
      elRpcUrl: this.connectors.elRpcUrl,
      dhWsUrl: this.connectors.dhWsUrl
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
      transport: http(this.connectors.elRpcUrl)
    });
  }

  /**
   * Clean up connections
   */
  async cleanup(connectors: TestConnectors): Promise<void> {
    logger.debug("Cleaning up test connectors...");

    // Destroy PAPI client
    if (connectors.papiClient) {
      connectors.papiClient.destroy();
    }

    logger.debug("Test connectors cleaned up");
  }
}
