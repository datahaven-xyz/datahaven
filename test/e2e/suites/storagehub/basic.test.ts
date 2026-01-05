import { describe, expect, it } from "bun:test";
import { BaseTestSuite, SuiteType } from "../../framework";

/**
 * StorageHub Basic Test Suite
 *
 * This is a placeholder test suite for StorageHub integration E2E tests.
 * It launches 2 validator nodes (alice, bob) plus StorageHub components
 * (MSP, BSP, Indexer) without Ethereum network or relayers.
 *
 * Use this suite type for tests that:
 * - Test MSP/BSP file storage and retrieval
 * - Test StorageHub indexer functionality
 * - Test provider registration and management
 * - Test storage proofs and challenges
 */
class StorageHubBasicSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "storagehub-basic",
      suiteType: SuiteType.STORAGEHUB,
      networkOptions: {
        slotTime: 1
      }
    });

    this.setupHooks();
  }
}

const suite = new StorageHubBasicSuite();

describe("StorageHub Basic", () => {
  it("should connect to DataHaven network", async () => {
    const connectors = suite.getStorageHubTestConnectors();
    expect(connectors.dhRpcUrl).toBeDefined();
    expect(connectors.dhApi).toBeDefined();
  });

  it("should have StorageHub RPC endpoints configured", async () => {
    const connectors = suite.getStorageHubTestConnectors();
    expect(connectors.mspRpcUrl).toBeDefined();
    expect(connectors.bspRpcUrl).toBeDefined();
    expect(connectors.indexerRpcUrl).toBeDefined();
  });

  it("should query chain info", async () => {
    const connectors = suite.getStorageHubTestConnectors();
    const chainSpec = await connectors.dhApi.constants.System.Version();
    expect(chainSpec).toBeDefined();
    expect(chainSpec.spec_name).toBe("datahaven-stagenet");
  });

  it("should get current block number", async () => {
    const connectors = suite.getStorageHubTestConnectors();
    const header = await connectors.papiClient.getBlockHeader();
    expect(header.number).toBeGreaterThanOrEqual(0);
  });
});
