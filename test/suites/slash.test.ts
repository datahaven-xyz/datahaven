import { describe, expect, it } from "bun:test";
import { parseEther } from "viem";
import { BaseTestSuite } from "../framework";
import { getContractInstance } from "../utils/contracts";
import { getEvmEcdsaSigner, SUBSTRATE_FUNDED_ACCOUNTS } from "utils";

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
   const { publicClient, dhApi } = suite.getTestConnectors();

    // Parallelize contract fetching and rewards info parsing
    const serviceManager = await getContractInstance("ServiceManager");
  });
  it("use sudo to slash operator", async () => {
    const { publicClient, dhApi } = suite.getTestConnectors();

    // get era number
    const activeEra = await dhApi.query.ExternalValidators.ActiveEra.getValue();

    console.log(activeEra);

    // need operator address to slash
    const validator = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    dhApi.tx.ExternalValidatorsSlashes.set_slashing_mode({
      mode: "LogOnly",
    });

    const slashCall = dhApi.tx.ExternalValidatorsSlashes.force_inject_slash({
      validator,
      era: activeEra?.index || 0,
      percentage: 75,
      external_idx: BigInt(1),
    });
    const signer = getEvmEcdsaSigner(SUBSTRATE_FUNDED_ACCOUNTS.ALITH.privateKey);
    let result = await slashCall.signAndSubmit(signer);

    expect(result.ok).toBeTruthy();

  });

});
