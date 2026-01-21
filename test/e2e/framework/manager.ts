import { logger } from "utils";

export interface TestSuiteRegistry {
  suiteId: string;
  networkId: string;
  startTime: number;
  status: "running" | "completed" | "failed";
}

/**
 * Manager for tracking running test suites and ensuring cleanup
 */
export class TestSuiteManager {
  private static instance: TestSuiteManager;
  private suites: Map<string, TestSuiteRegistry> = new Map();

  private constructor() {
    // Set up process exit handlers to ensure cleanup
    process.on("exit", () => this.cleanupAll());
    process.on("SIGINT", () => this.cleanupAll());
    process.on("SIGTERM", () => this.cleanupAll());
  }

  static getInstance(): TestSuiteManager {
    if (!TestSuiteManager.instance) {
      TestSuiteManager.instance = new TestSuiteManager();
    }
    return TestSuiteManager.instance;
  }

  registerSuite(suiteId: string, networkId: string): void {
    if (this.suites.has(suiteId)) {
      throw new Error(`Test suite ${suiteId} is already registered`);
    }

    this.suites.set(suiteId, {
      suiteId,
      networkId,
      startTime: Date.now(),
      status: "running"
    });

    logger.debug(`Registered test suite: ${suiteId} with network: ${networkId}`);
  }

  completeSuite(suiteId: string): void {
    const suite = this.suites.get(suiteId);
    if (suite) {
      suite.status = "completed";
      const duration = ((Date.now() - suite.startTime) / 1000).toFixed(1);
      logger.debug(`Test suite ${suiteId} completed in ${duration}s`);
    }
  }

  failSuite(suiteId: string): void {
    const suite = this.suites.get(suiteId);
    if (suite) {
      suite.status = "failed";
      logger.debug(`Test suite ${suiteId} failed`);
    }
  }

  getRunningCount(): number {
    return Array.from(this.suites.values()).filter((s) => s.status === "running").length;
  }

  getRunningNetworkIds(): string[] {
    return Array.from(this.suites.values())
      .filter((s) => s.status === "running")
      .map((s) => s.networkId);
  }

  private cleanupAll(): void {
    const runningSuites = Array.from(this.suites.values()).filter((s) => s.status === "running");

    if (runningSuites.length > 0) {
      logger.warn(`⚠️ Process exiting with ${runningSuites.length} test suite(s) still running`);
      runningSuites.forEach((suite) => {
        logger.warn(`  - ${suite.suiteId} (network: ${suite.networkId})`);
      });
    }
  }
}
