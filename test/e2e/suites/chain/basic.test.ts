import { describe, expect, it } from "bun:test";
import { BaseTestSuite, SuiteType } from "../../framework";

/**
 * Chain Basic Test Suite
 *
 * This is a placeholder test suite for Chain-only E2E tests.
 * It launches 2 validator nodes (alice, bob) without Ethereum network or relayers.
 *
 * Use this suite type for tests that:
 * - Test multi-node consensus
 * - Test validator rotation
 * - Test P2P networking
 * - Test Substrate-specific functionality that requires multiple nodes
 */
class ChainBasicSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "chain-basic",
      suiteType: SuiteType.CHAIN,
      networkOptions: {
        slotTime: 1
      }
    });

    this.setupHooks();
  }
}

const suite = new ChainBasicSuite();

describe("Chain Basic", () => {
  it("should connect to Chain network", async () => {
    const connectors = suite.getChainTestConnectors();
    expect(connectors.dhRpcUrl).toBeDefined();
    expect(connectors.dhApi).toBeDefined();
  });

  it("should query chain info", async () => {
    const connectors = suite.getChainTestConnectors();
    const chainSpec = await connectors.dhApi.constants.System.Version();
    expect(chainSpec).toBeDefined();
    expect(chainSpec.spec_name).toBe("datahaven-stagenet");
  });

  it("should get current block number", async () => {
    const connectors = suite.getChainTestConnectors();
    const header = await connectors.papiClient.getBlockHeader();
    expect(header.number).toBeGreaterThanOrEqual(0);
  });
});
