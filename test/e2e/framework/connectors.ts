import { datahaven } from "@polkadot-api/descriptors";
import { createClient as createPapiClient, type PolkadotClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/node";
import { ANVIL_FUNDED_ACCOUNTS, type DataHavenApi, logger } from "utils";
import {
  type Account,
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  type PublicClient,
  type WalletClient,
  webSocket
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil } from "viem/chains";
import { socketClientCache } from "viem/utils";
import type {
  DataHavenLaunchResult,
  LaunchNetworkResult,
  StorageHubLaunchResult
} from "../../launcher/types";
import { SuiteType } from "../../launcher/types";

// DataHaven-only connectors (base for all suites)
export interface DataHavenTestConnectors {
  papiClient: PolkadotClient;
  dhApi: DataHavenApi;
  dhRpcUrl: string;
}

// StorageHub connectors (extends DataHaven)
export interface StorageHubTestConnectors extends DataHavenTestConnectors {
  mspRpcUrl: string;
  bspRpcUrl: string;
  indexerRpcUrl: string;
}

// Full Ethereum connectors (for cross-chain testing)
export interface TestConnectors extends DataHavenTestConnectors {
  // Ethereum connectors
  publicClient: PublicClient;
  walletClient: WalletClient<any, any, Account>;
  elRpcUrl: string;
}

// Union type for all connector types
type AnyLaunchResult = LaunchNetworkResult | StorageHubLaunchResult | DataHavenLaunchResult;
type AnyTestConnectors = TestConnectors | StorageHubTestConnectors | DataHavenTestConnectors;

export class ConnectorFactory {
  private connectors: AnyLaunchResult;
  private suiteType: SuiteType;

  constructor(connectors: AnyLaunchResult, suiteType: SuiteType = SuiteType.ETHEREUM) {
    this.connectors = connectors;
    this.suiteType = suiteType;
  }

  /**
   * Create test connectors for interacting with the launched networks.
   * Returns the appropriate connector type based on suite type.
   */
  async createTestConnectors(): Promise<AnyTestConnectors> {
    switch (this.suiteType) {
      case SuiteType.DATAHAVEN:
        return this.createDataHavenTestConnectors();
      case SuiteType.STORAGEHUB:
        return this.createStorageHubTestConnectors();
      case SuiteType.ETHEREUM:
      default:
        return this.createEthereumTestConnectors();
    }
  }

  /**
   * Create DataHaven-only test connectors
   */
  private async createDataHavenTestConnectors(): Promise<DataHavenTestConnectors> {
    logger.debug("Creating DataHaven test connectors...");

    // Create DataHaven/Substrate clients
    const wsProvider = getWsProvider(this.connectors.dataHavenRpcUrl);
    const papiClient = createPapiClient(withPolkadotSdkCompat(wsProvider));
    const dhApi = papiClient.getTypedApi(datahaven);

    logger.debug("DataHaven test connectors created successfully");

    return {
      papiClient,
      dhApi,
      dhRpcUrl: this.connectors.dataHavenRpcUrl
    };
  }

  /**
   * Create StorageHub test connectors
   */
  private async createStorageHubTestConnectors(): Promise<StorageHubTestConnectors> {
    logger.debug("Creating StorageHub test connectors...");

    const shConnectors = this.connectors as StorageHubLaunchResult;

    // Create DataHaven/Substrate clients
    const wsProvider = getWsProvider(this.connectors.dataHavenRpcUrl);
    const papiClient = createPapiClient(withPolkadotSdkCompat(wsProvider));
    const dhApi = papiClient.getTypedApi(datahaven);

    logger.debug("StorageHub test connectors created successfully");

    return {
      papiClient,
      dhApi,
      dhRpcUrl: this.connectors.dataHavenRpcUrl,
      mspRpcUrl: shConnectors.mspRpcUrl,
      bspRpcUrl: shConnectors.bspRpcUrl,
      indexerRpcUrl: shConnectors.indexerRpcUrl
    };
  }

  /**
   * Create Ethereum test connectors (full cross-chain setup)
   */
  private async createEthereumTestConnectors(): Promise<TestConnectors> {
    logger.debug("Creating Ethereum test connectors...");

    const ethConnectors = this.connectors as LaunchNetworkResult;

    // Prefer WebSocket for event-heavy public client; fall back to HTTP when WS is unavailable.
    const wsUrl = ethConnectors.ethereumWsUrl;

    const publicTransport = wsUrl?.startsWith("ws")
      ? fallback([webSocket(wsUrl), http(ethConnectors.ethereumRpcUrl)])
      : http(ethConnectors.ethereumRpcUrl);

    // Create Ethereum clients
    const publicClient = createPublicClient({
      chain: anvil,
      transport: publicTransport
    });

    const account = privateKeyToAccount(ANVIL_FUNDED_ACCOUNTS[0].privateKey);
    const walletClient = createWalletClient({
      account,
      chain: anvil,
      transport: http(ethConnectors.ethereumRpcUrl)
    });

    // Create DataHaven/Substrate clients
    const wsProvider = getWsProvider(this.connectors.dataHavenRpcUrl);
    const papiClient = createPapiClient(withPolkadotSdkCompat(wsProvider));
    const dhApi = papiClient.getTypedApi(datahaven);

    logger.debug("Ethereum test connectors created successfully");

    return {
      publicClient,
      walletClient,
      papiClient,
      dhApi,
      elRpcUrl: ethConnectors.ethereumRpcUrl,
      dhRpcUrl: this.connectors.dataHavenRpcUrl
    };
  }

  /**
   * Create a wallet client with a specific account (Ethereum suite only)
   */
  createWalletClient(privateKey: `0x${string}`): WalletClient<any, any, Account> {
    if (this.suiteType !== SuiteType.ETHEREUM) {
      throw new Error(`Cannot create wallet client for suite type: ${this.suiteType}`);
    }
    const ethConnectors = this.connectors as LaunchNetworkResult;
    const account = privateKeyToAccount(privateKey);
    return createWalletClient({
      account,
      chain: anvil,
      transport: http(ethConnectors.ethereumRpcUrl)
    });
  }

  /**
   * Clean up connections
   */
  async cleanup(connectors: AnyTestConnectors): Promise<void> {
    logger.debug("Cleaning up test connectors...");

    // Close any cached WebSocket clients used by viem to prevent reconnect noise after teardown.
    if (this.suiteType === SuiteType.ETHEREUM) {
      try {
        for (const client of socketClientCache.values()) {
          try {
            client.close();
          } catch {
            // Ignore individual socket close errors
          }
        }
        socketClientCache.clear();
      } catch {
        // Ignore cache errors during cleanup
      }
    }

    // Destroy PAPI client
    if (connectors.papiClient) {
      try {
        connectors.papiClient.destroy();
      } catch (error) {
        // Ignore DisjointError - it occurs when ChainHead subscriptions are already disjointed
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
          throw error;
        }
      }
    }

    logger.debug("Test connectors cleaned up");
  }
}
