import { afterAll, beforeAll } from "bun:test";
import readline from "node:readline";
import { logger } from "utils";
import { isCI, launchNetwork } from "../../launcher/network";
import type {
  ChainLaunchResult,
  CrossChainLaunchResult,
  StorageLaunchResult
} from "../../launcher/types";
import { SuiteType } from "../../launcher/types";
import {
  type ChainTestConnectors,
  ConnectorFactory,
  type CrossChainTestConnectors,
  type StorageTestConnectors
} from "./connectors";
import { TestSuiteManager } from "./manager";

// Re-export SuiteType for convenience
export { SuiteType } from "../../launcher/types";

// Union type for all launch results
type AnyLaunchResult = CrossChainLaunchResult | StorageLaunchResult | ChainLaunchResult;

// Union type for all connector types
type AnyTestConnectors = CrossChainTestConnectors | StorageTestConnectors | ChainTestConnectors;

export interface TestSuiteOptions {
  /** Unique name for the test suite */
  suiteName: string;
  /** Type of suite (determines which network components to launch) */
  suiteType?: SuiteType;
  /** Network configuration options */
  networkOptions?: {
    /** Slot time in milliseconds for the network */
    slotTime?: number;
    /** Enable Blockscout explorer for the network */
    blockscout?: boolean;
    /** Build DataHaven runtime from source, needed to reflect local changes */
    buildDatahaven?: boolean;
    /** Docker image tag for DataHaven node */
    datahavenImageTag?: string;
    /** Docker image tag for Snowbridge relayer */
    relayerImageTag?: string;
  };
  /** Keep network running after tests complete for debugging */
  keepAlive?: boolean;
}

export abstract class BaseTestSuite {
  protected networkId: string;
  protected connectors?: AnyLaunchResult;
  protected testConnectors?: AnyTestConnectors;
  private connectorFactory?: ConnectorFactory;
  private options: TestSuiteOptions;
  private manager: TestSuiteManager;

  constructor(options: TestSuiteOptions) {
    this.options = options;
    // Generate unique network ID using suite name and timestamp
    this.networkId = `${options.suiteName}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    this.manager = TestSuiteManager.getInstance();
  }

  protected setupHooks(): void {
    beforeAll(async () => {
      const suiteType = this.options.suiteType ?? SuiteType.CROSSCHAIN;
      logger.info(`🧪 Setting up test suite: ${this.options.suiteName} (${suiteType})`);
      logger.info(`📝 Network ID: ${this.networkId}`);

      try {
        // Register suite with manager
        this.manager.registerSuite(this.options.suiteName, this.networkId);

        // Launch the network based on suite type
        this.connectors = await launchNetwork({
          networkId: this.networkId,
          suiteType,
          datahavenImageTag:
            this.options.networkOptions?.datahavenImageTag || "datahavenxyz/datahaven:local",
          relayerImageTag:
            this.options.networkOptions?.relayerImageTag || "datahavenxyz/snowbridge-relay:latest",
          buildDatahaven: false, // default to false in the test suite so we can speed up the CI
          ...this.options.networkOptions
        });

        // Create test connectors based on suite type
        this.connectorFactory = new ConnectorFactory(this.connectors, suiteType);
        this.testConnectors = await this.connectorFactory.createTestConnectors();

        // Allow derived classes to perform additional setup
        await this.onSetup();

        logger.success(`Test suite setup complete: ${this.options.suiteName}`);
      } catch (error) {
        logger.error(`Failed to setup test suite: ${this.options.suiteName}`, error);
        this.manager.failSuite(this.options.suiteName);
        throw error;
      }
    });

    afterAll(async () => {
      logger.info(`🧹 Tearing down test suite: ${this.options.suiteName}`);

      try {
        if (this.options.keepAlive && !isCI) {
          this.printNetworkInfo();
          await this.waitForEnter();
        }

        // Allow derived classes to perform cleanup
        await this.onTeardown();

        // Cleanup test connectors
        if (this.testConnectors && this.connectorFactory) {
          await this.connectorFactory.cleanup(this.testConnectors);
        }

        // Cleanup the network
        if (this.connectors?.cleanup) {
          await this.connectors.cleanup();
        }

        // Mark suite as completed
        this.manager.completeSuite(this.options.suiteName);

        logger.success(`Test suite teardown complete: ${this.options.suiteName}`);
      } catch (error) {
        logger.error(`Error during test suite teardown: ${this.options.suiteName}`, error);
        this.manager.failSuite(this.options.suiteName);
      }
    });
  }

  /**
   * Override this method to perform additional setup after network launch
   */
  protected async onSetup(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Override this method to perform cleanup before network teardown
   */
  protected async onTeardown(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Get network connectors - throws if not initialized
   */
  protected getConnectors(): AnyLaunchResult {
    if (!this.connectors) {
      throw new Error("Network connectors not initialized. Did you call setupHooks()?");
    }
    return this.connectors;
  }

  /**
   * Get test connectors - throws if not initialized
   * Returns the appropriate connector type based on suite type
   */
  public getTestConnectors(): AnyTestConnectors {
    if (!this.testConnectors) {
      throw new Error("Test connectors not initialized. Did you call setupHooks()?");
    }
    return this.testConnectors;
  }

  /**
   * Get CrossChain test connectors - throws if suite type is not CROSSCHAIN
   */
  public getCrossChainTestConnectors(): CrossChainTestConnectors {
    if (!this.testConnectors) {
      throw new Error("Test connectors not initialized. Did you call setupHooks()?");
    }
    if (this.options.suiteType && this.options.suiteType !== SuiteType.CROSSCHAIN) {
      throw new Error(`Cannot get CrossChain connectors for suite type: ${this.options.suiteType}`);
    }
    return this.testConnectors as CrossChainTestConnectors;
  }

  /**
   * Get Chain test connectors - available for all suite types (base connectors)
   */
  public getChainTestConnectors(): ChainTestConnectors {
    if (!this.testConnectors) {
      throw new Error("Test connectors not initialized. Did you call setupHooks()?");
    }
    return this.testConnectors as ChainTestConnectors;
  }

  /**
   * Get Storage test connectors - throws if suite type is not STORAGE
   */
  public getStorageTestConnectors(): StorageTestConnectors {
    if (!this.testConnectors) {
      throw new Error("Test connectors not initialized. Did you call setupHooks()?");
    }
    if (this.options.suiteType !== SuiteType.STORAGE) {
      throw new Error(`Cannot get Storage connectors for suite type: ${this.options.suiteType}`);
    }
    return this.testConnectors as StorageTestConnectors;
  }

  /**
   * Get connector factory - throws if not initialized
   */
  public getConnectorFactory(): ConnectorFactory {
    if (!this.connectorFactory) {
      throw new Error("Connector factory not initialized. Did you call setupHooks()?");
    }
    return this.connectorFactory;
  }

  private printNetworkInfo(): void {
    try {
      const connectors = this.getConnectors();
      const ln = connectors.launchedNetwork;
      const suiteType = this.options.suiteType ?? SuiteType.CROSSCHAIN;

      logger.info("🛠 Keep-alive mode enabled. Network will remain running until you press Enter.");
      logger.info(`📡 Network info (${suiteType}):`);
      logger.info(`  • Network ID: ${ln.networkId}`);
      logger.info(`  • Network Name: ${ln.networkName}`);
      logger.info(`  • DataHaven RPC: ${connectors.dataHavenRpcUrl}`);

      // Show Ethereum info only for CROSSCHAIN suite
      if (suiteType === SuiteType.CROSSCHAIN) {
        const crossChainConnectors = connectors as CrossChainLaunchResult;
        logger.info(`  • Ethereum RPC: ${crossChainConnectors.ethereumRpcUrl}`);
        logger.info(`  • Ethereum CL:  ${crossChainConnectors.ethereumClEndpoint}`);
      }

      // Show Storage info for STORAGE suite
      if (suiteType === SuiteType.STORAGE) {
        const storageConnectors = connectors as StorageLaunchResult;
        logger.info(`  • MSP RPC: ${storageConnectors.mspRpcUrl}`);
        logger.info(`  • BSP RPC: ${storageConnectors.bspRpcUrl}`);
        logger.info(`  • Indexer RPC: ${storageConnectors.indexerRpcUrl}`);
      }

      const containers = ln.containers || [];
      if (containers.length > 0) {
        logger.info("  • Containers:");
        for (const c of containers) {
          const pubPorts = Object.entries(c.publicPorts || {})
            .map(([k, v]) => `${k}:${v}`)
            .join(", ");
          logger.info(`     - ${c.name} [${pubPorts}]`);
        }
      }
    } catch (e) {
      logger.warn("Could not print network info", e as Error);
    }
  }

  private async waitForEnter(): Promise<void> {
    return await new Promise<void>((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question("\nPress Enter to teardown and cleanup... ", () => {
        rl.close();
        resolve();
      });
    });
  }
}
