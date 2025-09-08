import { logger } from "utils";
import { launchNetwork } from "../launcher";
import type { LaunchNetworkResult } from "../launcher/types";

export interface SharedNetworkOptions {
  networkId?: string;
  slotTime?: number;
  blockscout?: boolean;
  buildDatahaven?: boolean;
  datahavenImageTag?: string;
  relayerImageTag?: string;
}

/**
 * Manager for a shared network instance across all test suites.
 * This ensures Kurtosis and other network components are launched only once.
 */
export class SharedNetworkManager {
  private static instance: SharedNetworkManager;
  private network?: LaunchNetworkResult;
  private isLaunching = false;
  private launchPromise?: Promise<LaunchNetworkResult>;
  private referenceCount = 0;
  private options: SharedNetworkOptions;

  private constructor() {
    // Default options
    this.options = {
      networkId: `shared-test-${Date.now()}`,
      datahavenImageTag: "datahavenxyz/datahaven:local",
      relayerImageTag: "datahavenxyz/snowbridge-relay:latest",
      buildDatahaven: false,
      slotTime: 2
    };

    // Set up process exit handlers
    process.on("exit", () => this.cleanup());
    process.on("SIGINT", () => {
      this.cleanup();
      process.exit(1);
    });
    process.on("SIGTERM", () => {
      this.cleanup();
      process.exit(1);
    });
  }

  static getInstance(): SharedNetworkManager {
    if (!SharedNetworkManager.instance) {
      SharedNetworkManager.instance = new SharedNetworkManager();
    }
    return SharedNetworkManager.instance;
  }

  /**
   * Configure the shared network options. Must be called before getNetwork().
   */
  configure(options: SharedNetworkOptions): void {
    if (this.network || this.isLaunching) {
      throw new Error("Cannot configure shared network after it has been launched");
    }
    this.options = { ...this.options, ...options };
    logger.info("Configured shared network with options:", this.options);
  }

  /**
   * Get or launch the shared network instance.
   * If the network is already running, returns the existing instance.
   * If multiple calls happen concurrently, they all wait for the same launch.
   */
  async getNetwork(): Promise<LaunchNetworkResult> {
    // If network is already running, return it
    if (this.network) {
      this.referenceCount++;
      logger.info(`Reusing shared network (reference count: ${this.referenceCount})`);
      return this.network;
    }

    // If network is currently launching, wait for it
    if (this.isLaunching && this.launchPromise) {
      logger.info("Network is already launching, waiting for completion...");
      const network = await this.launchPromise;
      this.referenceCount++;
      return network;
    }

    // Launch the network
    this.isLaunching = true;
    logger.info(`🚀 Launching shared network with ID: ${this.options.networkId}`);

    this.launchPromise = launchNetwork({
      networkId: this.options.networkId!,
      datahavenImageTag: this.options.datahavenImageTag,
      relayerImageTag: this.options.relayerImageTag,
      buildDatahaven: this.options.buildDatahaven,
      slotTime: this.options.slotTime,
      blockscout: this.options.blockscout
    });

    try {
      this.network = await this.launchPromise;
      this.referenceCount = 1;
      logger.success(`Shared network launched successfully (ID: ${this.options.networkId})`);
      return this.network;
    } catch (error) {
      logger.error("Failed to launch shared network:", error);
      throw error;
    } finally {
      this.isLaunching = false;
      this.launchPromise = undefined;
    }
  }

  /**
   * Release a reference to the shared network.
   * When the reference count reaches zero, the network can be cleaned up.
   */
  async release(): Promise<void> {
    if (this.referenceCount > 0) {
      this.referenceCount--;
      logger.info(`Released shared network reference (remaining: ${this.referenceCount})`);
    }

    // Don't automatically cleanup when ref count reaches 0
    // Let the process exit handler or explicit cleanup() call handle it
  }

  /**
   * Force cleanup of the shared network.
   * Should only be called when all tests are complete.
   */
  async cleanup(): Promise<void> {
    if (!this.network) {
      return;
    }

    logger.info(`🧹 Cleaning up shared network (ID: ${this.options.networkId})`);

    try {
      if (this.network.cleanup) {
        await this.network.cleanup();
      }
      logger.success("Shared network cleaned up successfully");
    } catch (error) {
      logger.error("Error during shared network cleanup:", error);
    } finally {
      this.network = undefined;
      this.referenceCount = 0;
    }
  }

  /**
   * Check if the network is currently running
   */
  isRunning(): boolean {
    return this.network !== undefined;
  }

  /**
   * Get the current reference count
   */
  getReferenceCount(): number {
    return this.referenceCount;
  }
}
