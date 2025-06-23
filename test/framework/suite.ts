import { afterAll, beforeAll } from "bun:test";
import { logger } from "utils";
import { launchNetwork } from "../launcher";
import type { LaunchNetworkResult } from "../launcher/types";
import { ConnectorFactory, type TestConnectors } from "./connectors";
import { TestSuiteManager } from "./manager";

export interface TestSuiteOptions {
  suiteName: string;
  networkOptions?: {
    slotTime?: number;
    blockscout?: boolean;
    buildDatahaven?: boolean;
    datahavenImageTag?: string;
    relayerImageTag?: string;
  };
}

export abstract class BaseTestSuite {
  protected networkId: string;
  protected connectors?: LaunchNetworkResult;
  protected testConnectors?: TestConnectors;
  private networkCleanup?: () => Promise<void>;
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
      logger.info(`🧪 Setting up test suite: ${this.options.suiteName}`);
      logger.info(`📝 Network ID: ${this.networkId}`);

      try {
        // Register suite with manager
        this.manager.registerSuite(this.options.suiteName, this.networkId);

        // Launch the network
        this.connectors = await launchNetwork({
          networkId: this.networkId,
          datahavenImageTag: "moonsonglabs/datahaven:local",
          relayerImageTag: "moonsonglabs/snowbridge-relay:latest",
          ...this.options.networkOptions
        });

        // Store cleanup function if available
        if (this.connectors.cleanup) {
          this.networkCleanup = this.connectors.cleanup;
        }

        // Create test connectors
        this.connectorFactory = new ConnectorFactory(this.connectors);
        this.testConnectors = await this.connectorFactory.createTestConnectors();

        // Allow derived classes to perform additional setup
        await this.onSetup();

        logger.success(`✅ Test suite setup complete: ${this.options.suiteName}`);
      } catch (error) {
        logger.error(`Failed to setup test suite: ${this.options.suiteName}`, error);
        this.manager.failSuite(this.options.suiteName);
        throw error;
      }
    });

    afterAll(async () => {
      logger.info(`🧹 Tearing down test suite: ${this.options.suiteName}`);

      try {
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
  protected getConnectors(): LaunchNetworkResult {
    if (!this.connectors) {
      throw new Error("Network connectors not initialized. Did you call setupHooks()?");
    }
    return this.connectors;
  }

  /**
   * Get test connectors - throws if not initialized
   */
  public getTestConnectors(): TestConnectors {
    if (!this.testConnectors) {
      throw new Error("Test connectors not initialized. Did you call setupHooks()?");
    }
    return this.testConnectors;
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
}
