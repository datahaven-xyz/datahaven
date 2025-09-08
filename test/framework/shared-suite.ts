import { afterAll, beforeAll } from "bun:test";
import { logger } from "utils";
import type { LaunchNetworkResult } from "../launcher/types";
import { ConnectorFactory, type TestConnectors } from "./connectors";
import { SharedNetworkManager } from "./shared-network";

export interface SharedTestSuiteOptions {
  suiteName: string;
}

/**
 * Base test suite that uses a shared network instance across all test suites.
 * This prevents Kurtosis from being restarted for each test suite.
 */
export abstract class SharedTestSuite {
  protected connectors?: LaunchNetworkResult;
  protected testConnectors?: TestConnectors;
  private connectorFactory?: ConnectorFactory;
  private options: SharedTestSuiteOptions;
  private sharedNetworkManager: SharedNetworkManager;

  constructor(options: SharedTestSuiteOptions) {
    this.options = options;
    this.sharedNetworkManager = SharedNetworkManager.getInstance();
  }

  protected setupHooks(): void {
    beforeAll(async () => {
      logger.info(`🧪 Setting up test suite (shared network): ${this.options.suiteName}`);

      try {
        // Get or launch the shared network
        this.connectors = await this.sharedNetworkManager.getNetwork();
        logger.info(`📝 Using shared network for suite: ${this.options.suiteName}`);

        // Create test connectors
        this.connectorFactory = new ConnectorFactory(this.connectors);
        this.testConnectors = await this.connectorFactory.createTestConnectors();

        // Allow derived classes to perform additional setup
        await this.onSetup();

        logger.success(`Test suite setup complete: ${this.options.suiteName}`);
      } catch (error) {
        logger.error(`Failed to setup test suite: ${this.options.suiteName}`, error);
        throw error;
      }
    });

    afterAll(async () => {
      logger.info(`🧹 Tearing down test suite (shared network): ${this.options.suiteName}`);

      try {
        // Allow derived classes to perform cleanup
        await this.onTeardown();

        // Cleanup test connectors (but not the network)
        if (this.testConnectors && this.connectorFactory) {
          await this.connectorFactory.cleanup(this.testConnectors);
        }

        // Release our reference to the shared network
        await this.sharedNetworkManager.release();

        logger.success(`Test suite teardown complete: ${this.options.suiteName}`);
      } catch (error) {
        logger.error(`Error during test suite teardown: ${this.options.suiteName}`, error);
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
