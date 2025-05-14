import { beforeAll, describe, expect, it } from "bun:test";
import type { PolkadotSigner } from "polkadot-api";
import {
  type DatahavenApi,
  SUBSTRATE_FUNDED_ACCOUNTS,
  createPapiConnectors,
  generateRandomAccount,
  getPapiSigner,
  logger,
  sendTxn
} from "utils";
import { isAddress, parseEther } from "viem";

describe("Datahaven solochain", () => {
  let api: DatahavenApi;
  let signer: PolkadotSigner;

  beforeAll(() => {
    const { typedApi } = createPapiConnectors();
    api = typedApi;
    signer = getPapiSigner();
  });

  it("Can query runtime API", async () => {
    const address = await api.apis.EthereumRuntimeRPCApi.author();
    logger.debug(`Author Address is: ${address.asHex()}`);
    expect(isAddress(address.asHex())).toBeTrue();
  });

  it("Can lookup storages ", async () => {
    const {
      data: { free: freeBalance }
    } = await api.query.System.Account.getValue(SUBSTRATE_FUNDED_ACCOUNTS.ALITH.publicKey);
    logger.debug(`Balance of ALITH on DH is ${freeBalance}`);
    expect(freeBalance).toBeGreaterThan(0n);
  });

  it("Can submit extrinsics into finalized block", async () => {
    const value = parseEther("1");
    const { address: dest } = generateRandomAccount();
    const ext = api.tx.Balances.transfer_allow_death({
      dest,
      value
    });

    // This will wait until finalized block
    const resp = await ext.signAndSubmit(signer, {});
    logger.debug(`Transaction in finalized block: ${resp.txHash}`);
  });

  // This is way faster and should be how we submit build tests
  it("Can submit extrinsics into best block", async () => {
    const value = parseEther("1");
    const { address: dest } = generateRandomAccount();
    const ext = api.tx.Balances.transfer_allow_death({
      dest,
      value
    });

    const resp = await sendTxn(ext);
    logger.debug(`Transaction submitted: ${resp.txHash}`);
  });

  it("Can listen to events", async () => {
    const event = await api.event.System.ExtrinsicSuccess.pull();
    logger.debug(event[0]);
    expect(event).not.toBeEmpty();
    expect(event[0].payload.dispatch_info.weight.ref_time).toBeGreaterThan(0n);
  });
});
