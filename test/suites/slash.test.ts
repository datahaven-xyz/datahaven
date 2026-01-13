import { describe, expect, it } from "bun:test";
import { CROSS_CHAIN_TIMEOUTS, getPapiSigner } from "utils";
import { BaseTestSuite } from "../framework";
import { getContractInstance } from "../utils/contracts";
import { waitForDataHavenEvent } from "../utils/events";

class SlashTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "slash"
    });

    // Set up hooks in constructor
    this.setupHooks();
  }
}

// Create the test suite instance
const suite = new SlashTestSuite();

describe("Should slash an operator", () => {
  it("initialize", async () => {
    const _serviceManager = await getContractInstance("ServiceManager");
  });
  it("Activate slashing", async () => {
    const { dhApi } = suite.getTestConnectors();

    const mode = await dhApi.query.ExternalValidatorsSlashes.SlashingMode.getValue();
    expect(mode.type).toBe("LogOnly");
    mode.type = "Enabled";

    const sudoSlashCall = dhApi.tx.ExternalValidatorsSlashes.set_slashing_mode({
      mode
    });
    const sudoTx = dhApi.tx.Sudo.sudo({
      call: sudoSlashCall.decodedCall
    });
    const alithSigner = getPapiSigner("ALITH");
    const result = await sudoTx.signAndSubmit(alithSigner);
    expect(result.ok).toBeTruthy();

    const mode2 = await dhApi.query.ExternalValidatorsSlashes.SlashingMode.getValue();
    expect(mode2.type).toBe("Enabled");
  }, 40000);

  it("use sudo to slash operator", async () => {
    const { dhApi } = suite.getTestConnectors();

    // get era number
    const activeEra = await dhApi.query.ExternalValidators.ActiveEra.getValue();

    if (activeEra === undefined) {
      throw new Error("couldn't get current era");
    }

    // need operator address to slash
    const validator = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    const sudoSlashCall = dhApi.tx.ExternalValidatorsSlashes.force_inject_slash({
      validator,
      era: activeEra?.index + 1 || 0, // Will fail if active era is 0
      percentage: 20
    });
    const sudoTx = dhApi.tx.Sudo.sudo({
      call: sudoSlashCall.decodedCall
    });
    const alithSigner = getPapiSigner("ALITH");
    const resultSubmitTx = await sudoTx.signAndSubmit(alithSigner);
    expect(resultSubmitTx.ok).toBeTruthy();

    console.log("Transaction submitted !");

    // look for event inject event
    const resultEventSlashInjected =
      await dhApi.event.ExternalValidatorsSlashes.SlashInjected.pull();
    console.log(resultEventSlashInjected);
    if (resultEventSlashInjected.length === 0) {
      throw new Error("SlashInjected event not found");
    }
    console.log("Slash injected");

    const resultEventSlashesMessageSent = await waitForDataHavenEvent<{ message_id: any }>({
      api: dhApi,
      pallet: "ExternalValidatorsSlashes",
      event: "SlashesMessageSent",
      timeout: CROSS_CHAIN_TIMEOUTS.DH_TO_ETH_MS
    });
    if (!resultEventSlashesMessageSent) {
      throw new Error("SlashesMessageSent event not found");
    }
    console.log("Slashes message sent");
  }, 560000);
});
