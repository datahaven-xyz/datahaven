import { describe, expect, it } from "bun:test";
import { BaseTestSuite, SuiteType } from "../../framework";

/**
 * DataHaven Basic Test Suite
 *
 * This is a placeholder test suite for DataHaven-only E2E tests.
 * It launches 2 validator nodes (alice, bob) without Ethereum network or relayers.
 *
 * Use this suite type for tests that:
 * - Test multi-node consensus
 * - Test validator rotation
 * - Test P2P networking
 * - Test Substrate-specific functionality that requires multiple nodes
 */
class DataHavenBasicSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "datahaven-basic",
      suiteType: SuiteType.DATAHAVEN,
      networkOptions: {
        slotTime: 1
      }
    });

    this.setupHooks();
  }
}

const suite = new DataHavenBasicSuite();

describe("DataHaven Basic", () => {
  it("should connect to DataHaven network", async () => {
    const connectors = suite.getDataHavenTestConnectors();
    expect(connectors.dhRpcUrl).toBeDefined();
    expect(connectors.dhApi).toBeDefined();
  });

  it("should query chain info", async () => {
    const connectors = suite.getDataHavenTestConnectors();
    const chainSpec = await connectors.dhApi.constants.System.Version();
    expect(chainSpec).toBeDefined();
    expect(chainSpec.spec_name).toBe("datahaven-stagenet-runtime");
  });

  it("should get current block number", async () => {
    const connectors = suite.getDataHavenTestConnectors();
    const header = await connectors.papiClient.getBlockHeader();
    expect(header.number).toBeGreaterThanOrEqual(0);
  });
});
