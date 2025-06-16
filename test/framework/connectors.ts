import { createClient as createViemClient, http, type PublicClient, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil } from "viem/chains";
import { createClient as createPapiClient, type PolkadotClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { logger, ANVIL_FUNDED_ACCOUNTS, type DataHavenApi, getDescriptor } from "utils";
import type { NetworkConnectors } from "../launcher";

export interface TestConnectors {
  // Ethereum connectors
  publicClient: PublicClient;
  walletClient: WalletClient;
  
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
    const publicClient = createViemClient({
      chain: anvil,
      transport: http(this.connectors.elRpcUrl)
    }) as PublicClient;

    const account = privateKeyToAccount(ANVIL_FUNDED_ACCOUNTS[0].privateKey);
    const walletClient = createViemClient({
      account,
      chain: anvil,
      transport: http(this.connectors.elRpcUrl)
    }) as WalletClient;

    // Create DataHaven/Substrate clients
    const wsProvider = getWsProvider(this.connectors.dhWsUrl);
    const papiClient = createPapiClient(withPolkadotSdkCompat(wsProvider));
    
    // Get typed API
    const descriptor = await getDescriptor();
    const dhApi = papiClient.getTypedApi(descriptor);

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
  createWalletClient(privateKey: `0x${string}`): WalletClient {
    const account = privateKeyToAccount(privateKey);
    return createViemClient({
      account,
      chain: anvil,
      transport: http(this.connectors.elRpcUrl)
    }) as WalletClient;
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