import { describe, expect, it } from "bun:test";
import { getPapiSigner } from "utils";
import { BaseTestSuite } from "../framework";
import { getContractInstance } from "../utils/contracts";
import { waitForEthereumEvent } from "../utils/events";

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
    const { publicClient, dhApi } = suite.getTestConnectors();

    // get era number
    const activeEra = await dhApi.query.ExternalValidators.ActiveEra.getValue();

    console.log(activeEra);

    // need operator address to slash
    const validator = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    const sudoSlashCall = dhApi.tx.ExternalValidatorsSlashes.force_inject_slash({
      validator,
      era: activeEra?.index || 0, // Will fail if active era is 0
      percentage: 20,
      external_idx: BigInt(0)
    });
    const sudoTx = dhApi.tx.Sudo.sudo({
      call: sudoSlashCall.decodedCall
    });
    const alithSigner = getPapiSigner("ALITH");
    const result = await sudoTx.signAndSubmit(alithSigner);
    expect(result.ok).toBeTruthy();

    // Wait for Ethereum event event
    const serviceManager = await getContractInstance("ServiceManager");
    const event = await waitForEthereumEvent({
      client: publicClient,
      address: serviceManager.address,
      abi: serviceManager.abi,
      eventName: "ValidatorsSlashedTest"
    });

    console.log(event);
  }, 80000);
});
