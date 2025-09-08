import { beforeAll, describe, expect, it } from "bun:test";
import type { PolkadotSigner } from "polkadot-api";
import { getPapiSigner, logger, SUBSTRATE_FUNDED_ACCOUNTS } from "utils";
import { isAddress } from "viem";
import { SharedTestSuite } from "../framework";

class DataHavenSubstrateTestSuite extends SharedTestSuite {
  constructor() {
    super({
      suiteName: "datahaven-substrate"
    });

    this.setupHooks();
  }
}

// Create the test suite instance
const suite = new DataHavenSubstrateTestSuite();

describe("DataHaven Substrate Operations", () => {
  let _signer: PolkadotSigner;

  beforeAll(() => {
    _signer = getPapiSigner();
  });

  it("should query runtime API", async () => {
    const connectors = suite.getTestConnectors();
    const address = await connectors.dhApi.apis.EthereumRuntimeRPCApi.author();

    logger.info(`Author address: ${address.asHex()}`);
    expect(isAddress(address.asHex())).toBeTrue();
  });

  it("should lookup account balance", async () => {
    const connectors = suite.getTestConnectors();
    const {
      data: { free: freeBalance }
    } = await connectors.dhApi.query.System.Account.getValue(
      SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey
    );

    logger.info(`Balance of ALITH: ${freeBalance}`);
    expect(freeBalance).toBeGreaterThan(0n);
  });

  it("should listen to events", async () => {
    const connectors = suite.getTestConnectors();

    // Pull next ExtrinsicSuccess event
    const event = await connectors.dhApi.event.System.ExtrinsicSuccess.pull();

    expect(event).not.toBeEmpty();
    expect(event[0].payload.dispatch_info.weight.ref_time).toBeGreaterThan(0n);

    logger.info(
      `Caught ExtrinsicSuccess event with weight: ${event[0].payload.dispatch_info.weight.ref_time}`
    );
  });

  it("should query block information", async () => {
    const connectors = suite.getTestConnectors();

    // Get current block
    const blockHeader = await connectors.papiClient.getBlockHeader();

    expect(blockHeader.number).toBeGreaterThan(0);

    logger.info(`Current block #${blockHeader.number}`);
  });
});
