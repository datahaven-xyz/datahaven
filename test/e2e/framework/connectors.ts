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
  ChainLaunchResult,
  CrossChainLaunchResult,
  StorageLaunchResult
} from "../../launcher/types";
import { SuiteType } from "../../launcher/types";

// Chain-only connectors (base for all suites)
export interface ChainTestConnectors {
  papiClient: PolkadotClient;
  dhApi: DataHavenApi;
  dhRpcUrl: string;
}

// Storage connectors (extends Chain with StorageHub providers)
export interface StorageTestConnectors extends ChainTestConnectors {
  mspRpcUrl: string;
  bspRpcUrl: string;
  indexerRpcUrl: string;
}

// CrossChain connectors (extends Chain with Ethereum bridge)
export interface CrossChainTestConnectors extends ChainTestConnectors {
  publicClient: PublicClient;
  walletClient: WalletClient<any, any, Account>;
  elRpcUrl: string;
}

// Union type for all connector types
type AnyLaunchResult = CrossChainLaunchResult | StorageLaunchResult | ChainLaunchResult;
type AnyTestConnectors = CrossChainTestConnectors | StorageTestConnectors | ChainTestConnectors;

export class ConnectorFactory {
  private connectors: AnyLaunchResult;
  private suiteType: SuiteType;

  constructor(connectors: AnyLaunchResult, suiteType: SuiteType = SuiteType.CROSSCHAIN) {
    this.connectors = connectors;
    this.suiteType = suiteType;
  }

  /**
   * Create test connectors for interacting with the launched networks.
   * Returns the appropriate connector type based on suite type.
   */
  async createTestConnectors(): Promise<AnyTestConnectors> {
    switch (this.suiteType) {
      case SuiteType.CHAIN:
        return this.createChainTestConnectors();
      case SuiteType.STORAGE:
        return this.createStorageTestConnectors();
      case SuiteType.CROSSCHAIN:
      default:
        return this.createCrossChainTestConnectors();
    }
  }

  /**
   * Create Chain-only test connectors
   */
  private async createChainTestConnectors(): Promise<ChainTestConnectors> {
    logger.debug("Creating Chain test connectors...");

    // Create DataHaven/Substrate clients
    const wsProvider = getWsProvider(this.connectors.dataHavenRpcUrl);
    const papiClient = createPapiClient(withPolkadotSdkCompat(wsProvider));
    const dhApi = papiClient.getTypedApi(datahaven);

    logger.debug("Chain test connectors created successfully");

    return {
      papiClient,
      dhApi,
      dhRpcUrl: this.connectors.dataHavenRpcUrl
    };
  }

  /**
   * Create Storage test connectors (Chain + StorageHub providers)
   */
  private async createStorageTestConnectors(): Promise<StorageTestConnectors> {
    logger.debug("Creating Storage test connectors...");

    const storageConnectors = this.connectors as StorageLaunchResult;

    // Create DataHaven/Substrate clients
    const wsProvider = getWsProvider(this.connectors.dataHavenRpcUrl);
    const papiClient = createPapiClient(withPolkadotSdkCompat(wsProvider));
    const dhApi = papiClient.getTypedApi(datahaven);

    logger.debug("Storage test connectors created successfully");

    return {
      papiClient,
      dhApi,
      dhRpcUrl: this.connectors.dataHavenRpcUrl,
      mspRpcUrl: storageConnectors.mspRpcUrl,
      bspRpcUrl: storageConnectors.bspRpcUrl,
      indexerRpcUrl: storageConnectors.indexerRpcUrl
    };
  }

  /**
   * Create CrossChain test connectors (Chain + Ethereum bridge)
   */
  private async createCrossChainTestConnectors(): Promise<CrossChainTestConnectors> {
    logger.debug("Creating CrossChain test connectors...");

    const crossChainConnectors = this.connectors as CrossChainLaunchResult;

    // Prefer WebSocket for event-heavy public client; fall back to HTTP when WS is unavailable.
    const wsUrl = crossChainConnectors.ethereumWsUrl;

    const publicTransport = wsUrl?.startsWith("ws")
      ? fallback([webSocket(wsUrl), http(crossChainConnectors.ethereumRpcUrl)])
      : http(crossChainConnectors.ethereumRpcUrl);

    // Create Ethereum clients
    const publicClient = createPublicClient({
      chain: anvil,
      transport: publicTransport
    });

    const account = privateKeyToAccount(ANVIL_FUNDED_ACCOUNTS[0].privateKey);
    const walletClient = createWalletClient({
      account,
      chain: anvil,
      transport: http(crossChainConnectors.ethereumRpcUrl)
    });

    // Create DataHaven/Substrate clients
    const wsProvider = getWsProvider(this.connectors.dataHavenRpcUrl);
    const papiClient = createPapiClient(withPolkadotSdkCompat(wsProvider));
    const dhApi = papiClient.getTypedApi(datahaven);

    logger.debug("CrossChain test connectors created successfully");

    return {
      publicClient,
      walletClient,
      papiClient,
      dhApi,
      elRpcUrl: crossChainConnectors.ethereumRpcUrl,
      dhRpcUrl: this.connectors.dataHavenRpcUrl
    };
  }

  /**
   * Create a wallet client with a specific account (CrossChain suite only)
   */
  createWalletClient(privateKey: `0x${string}`): WalletClient<any, any, Account> {
    if (this.suiteType !== SuiteType.CROSSCHAIN) {
      throw new Error(`Cannot create wallet client for suite type: ${this.suiteType}`);
    }
    const crossChainConnectors = this.connectors as CrossChainLaunchResult;
    const account = privateKeyToAccount(privateKey);
    return createWalletClient({
      account,
      chain: anvil,
      transport: http(crossChainConnectors.ethereumRpcUrl)
    });
  }

  /**
   * Clean up connections
   */
  async cleanup(connectors: AnyTestConnectors): Promise<void> {
    logger.debug("Cleaning up test connectors...");

    // Close any cached WebSocket clients used by viem to prevent reconnect noise after teardown.
    if (this.suiteType === SuiteType.CROSSCHAIN) {
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
