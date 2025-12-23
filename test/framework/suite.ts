import { afterAll, beforeAll } from "bun:test";
import { closeSync, existsSync, mkdirSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import readline from "node:readline";
import { isCI } from "launcher/network";
import { logger } from "utils";
import { attachNetwork, launchNetwork } from "../launcher";
import type { LaunchNetworkResult, NetworkLaunchOptions } from "../launcher/types";
import { ConnectorFactory, type TestConnectors } from "./connectors";
import { TestSuiteManager } from "./manager";

const REUSE_INFRA_ENV = "E2E_REUSE_INFRA";
const REUSE_NETWORK_ID_ENV = "E2E_NETWORK_ID";
const DEFAULT_REUSE_NETWORK_ID = "e2e-test";
const REUSE_LOCK_PATH = join(process.cwd(), "tmp", "e2e-reuse.lock");
const REUSE_WAIT_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const REUSE_POLL_MS = 2000;

const isReuseInfraEnabled = (): boolean => {
  const value = process.env[REUSE_INFRA_ENV];
  return value === "true" || value === "1";
};

const sanitizeNetworkId = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9-]/g, "-");

const getReuseNetworkId = (): string =>
  sanitizeNetworkId(process.env[REUSE_NETWORK_ID_ENV] || DEFAULT_REUSE_NETWORK_ID);

const ensureTmpDir = (): void => {
  const dir = join(process.cwd(), "tmp");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
};

const tryAcquireReuseLock = (): number | null => {
  ensureTmpDir();
  try {
    const fd = openSync(REUSE_LOCK_PATH, "wx");
    writeFileSync(fd, `${process.pid}`);
    return fd;
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException)?.code;
    if (errorCode === "EEXIST") {
      return null;
    }
    throw error;
  }
};

const releaseReuseLock = (fd: number): void => {
  try {
    closeSync(fd);
  } finally {
    try {
      unlinkSync(REUSE_LOCK_PATH);
    } catch {
      // Ignore cleanup errors
    }
  }
};

const waitForReusableNetwork = async (networkId: string): Promise<LaunchNetworkResult> => {
  const start = Date.now();
  let lastError: unknown;

  while (Date.now() - start < REUSE_WAIT_TIMEOUT_MS) {
    try {
      return await attachNetwork({ networkId });
    } catch (error) {
      lastError = error;
    }
    await Bun.sleep(REUSE_POLL_MS);
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Timed out waiting for shared E2E network '${networkId}' to become ready. ` +
      `Last error: ${detail}. ` +
      `If no other process is launching the network, remove ${REUSE_LOCK_PATH} and retry.`
  );
};

const getOrCreateReusableNetwork = async (
  launchOptions: NetworkLaunchOptions
): Promise<LaunchNetworkResult> => {
  const lockFd = tryAcquireReuseLock();
  if (lockFd === null) {
    logger.info("⏳ Waiting for shared E2E network to be ready...");
    return await waitForReusableNetwork(launchOptions.networkId);
  }

  try {
    try {
      return await attachNetwork({ networkId: launchOptions.networkId });
    } catch {
      logger.info("📦 No existing E2E network found; launching shared infrastructure...");
      return await launchNetwork(launchOptions);
    }
  } finally {
    releaseReuseLock(lockFd);
  }
};

export interface TestSuiteOptions {
  /** Unique name for the test suite */
  suiteName: string;
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
  protected connectors?: LaunchNetworkResult;
  protected testConnectors?: TestConnectors;
  private connectorFactory?: ConnectorFactory;
  private options: TestSuiteOptions;
  private manager: TestSuiteManager;
  private reuseInfra: boolean;

  constructor(options: TestSuiteOptions) {
    this.options = options;
    this.reuseInfra = isReuseInfraEnabled();
    // Generate unique network ID using suite name and timestamp unless reusing shared infra
    const rawNetworkId = this.reuseInfra
      ? getReuseNetworkId()
      : `${options.suiteName}-${Date.now()}`;
    this.networkId = sanitizeNetworkId(rawNetworkId);
    this.manager = TestSuiteManager.getInstance();
  }

  protected setupHooks(): void {
    beforeAll(async () => {
      logger.info(`🧪 Setting up test suite: ${this.options.suiteName}`);
      logger.info(`📝 Network ID: ${this.networkId}`);
      if (this.reuseInfra) {
        logger.info(`♻️ Reusing shared E2E infrastructure (network ID: ${this.networkId})`);
      }

      try {
        // Register suite with manager
        this.manager.registerSuite(this.options.suiteName, this.networkId);

        const launchOptions: NetworkLaunchOptions = {
          networkId: this.networkId,
          datahavenImageTag:
            this.options.networkOptions?.datahavenImageTag || "datahavenxyz/datahaven:local",
          relayerImageTag:
            this.options.networkOptions?.relayerImageTag || "datahavenxyz/snowbridge-relay:latest",
          buildDatahaven: false, // default to false in the test suite so we can speed up the CI
          ...this.options.networkOptions
        };

        // Launch or attach to the network
        this.connectors = this.reuseInfra
          ? await getOrCreateReusableNetwork(launchOptions)
          : await launchNetwork(launchOptions);

        // Create test connectors
        this.connectorFactory = new ConnectorFactory(this.connectors);
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

        // Cleanup the network (skip when reusing shared infra)
        if (!this.reuseInfra && this.connectors?.cleanup) {
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

  private printNetworkInfo(): void {
    try {
      const connectors = this.getConnectors();
      const ln = connectors.launchedNetwork;
      logger.info("🛠 Keep-alive mode enabled. Network will remain running until you press Enter.");
      logger.info("📡 Network info:");
      logger.info(`  • Network ID: ${ln.networkId}`);
      logger.info(`  • Network Name: ${ln.networkName}`);
      logger.info(`  • DataHaven RPC: ${connectors.dataHavenRpcUrl}`);
      logger.info(`  • Ethereum RPC: ${connectors.ethereumRpcUrl}`);
      logger.info(`  • Ethereum CL:  ${connectors.ethereumClEndpoint}`);
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
