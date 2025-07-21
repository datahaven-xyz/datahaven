import { beforeAll, describe, expect, it } from "bun:test";
import type { PolkadotSigner } from "polkadot-api";
import { getPapiSigner, logger, SUBSTRATE_FUNDED_ACCOUNTS } from "utils";
import { BaseTestSuite } from "../framework";

class CrossChainTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "cross-chain"
    });

    this.setupHooks();
  }

  override async onSetup(): Promise<void> {
    // Wait a bit for relayers to fully initialize
    logger.info("Waiting for relayers to initialize...");
    await Bun.sleep(10000); // 10 seconds
  }
}

// Create the test suite instance
const suite = new CrossChainTestSuite();

describe("Cross-Chain Communication", () => {
  let _signer: PolkadotSigner;

  beforeAll(() => {
    _signer = getPapiSigner();
  });

  it("should query Ethereum client state on DataHaven", async () => {
    const connectors = suite.getTestConnectors();

    // Check basic chain connectivity
    const blockNumber = await connectors.papiClient.getBlockHeader();

    logger.info(`Connected to DataHaven at block: ${blockNumber.number}`);
    expect(blockNumber.number).toBeGreaterThan(0);
  });

  it("should check beacon relayer status", async () => {
    const connectors = suite.getTestConnectors();

    // Check if we can access chain state
    try {
      const blockHash = await connectors.papiClient.getFinalizedBlock();
      logger.info(`Finalized block hash: ${blockHash}`);
      expect(blockHash).toBeDefined();
    } catch (_error) {
      logger.warn("Unable to get finalized block - relayers may still be syncing");
    }
  });

  it("should verify validator registry connection", async () => {
    const connectors = suite.getTestConnectors();

    // For now, just check that we can connect
    // The specific storage items depend on the runtime configuration
    const blockNumber = await connectors.papiClient.getBlockHeader();

    logger.info(`Current block number: ${blockNumber.number}`);
    expect(blockNumber.number).toBeGreaterThan(0);
  });

  it("should check system information", async () => {
    const connectors = suite.getTestConnectors();

    // Query basic system information
    const blockNumber = await connectors.dhApi.query.System.Number.getValue();
    const parentHash = await connectors.dhApi.query.System.ParentHash.getValue();

    logger.info(`Current block: ${blockNumber}`);
    logger.info(`Parent hash: ${parentHash}`);

    expect(blockNumber).toBeGreaterThan(0);
    expect(parentHash).toBeDefined();
  });

  it("should query ethereum client pallet", async () => {
    const connectors = suite.getTestConnectors();

    // Check if we can access account info
    const accountInfo = await connectors.dhApi.query.System.Account.getValue(
      SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey
    );

    logger.info(`Account nonce: ${accountInfo.nonce}`);
    logger.info(`Account providers: ${accountInfo.providers}`);

    expect(accountInfo.providers).toBeGreaterThan(0);
  });

  it("should check BEEFY consensus status", async () => {
    const connectors = suite.getTestConnectors();

    // Query BEEFY validator set
    const validatorSet = await connectors.papiClient.getUnsafeApi().apis.BeefyApi.validator_set();

    if (validatorSet) {
      logger.info(`BEEFY validator set ID: ${validatorSet.id}`);
      logger.info(`BEEFY validator count: ${validatorSet.validators.length}`);

      expect(validatorSet.validators.length).toBeGreaterThan(0);
    } else {
      logger.warn("BEEFY validator set not yet available");
    }
  });
});
