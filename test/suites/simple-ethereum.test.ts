import { describe, expect, it } from "bun:test";
import { ANVIL_FUNDED_ACCOUNTS, logger } from "utils";
import { BaseTestSuite } from "../framework";

class SimpleEthereumTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "simple-ethereum"
    });

    // Set up hooks in constructor
    this.setupHooks();
  }
}

// Create the test suite instance
const suite = new SimpleEthereumTestSuite();

describe("Simple Ethereum Test", () => {
  it("should connect and query block number", async () => {
    const connectors = suite.getTestConnectors();
    const blockNumber = await connectors.publicClient.getBlockNumber();

    expect(blockNumber).toBeGreaterThan(0n);
    logger.info(`Current block number: ${blockNumber}`);
  });

  it("should check account balance", async () => {
    const connectors = suite.getTestConnectors();
    const balance = await connectors.publicClient.getBalance({
      address: ANVIL_FUNDED_ACCOUNTS[0].publicKey
    });

    expect(balance).toBeGreaterThan(0n);
    logger.info(`Account balance: ${balance} wei`);
  });
});
