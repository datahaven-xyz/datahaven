import { beforeAll, describe, expect, it } from "bun:test";
import type { PolkadotSigner } from "polkadot-api";
import { parseEther } from "viem";
import { isAddress } from "viem";
import { generateRandomAccount, getPapiSigner, logger, SUBSTRATE_FUNDED_ACCOUNTS } from "utils";
import { BaseTestSuite } from "../framework";

class DataHavenSubstrateTestSuite extends BaseTestSuite {
  constructor() {
    super({
      suiteName: "datahaven-substrate",
      networkOptions: {
        slotTime: 6 // Faster blocks for testing
      }
    });
    
    this.setupHooks();
  }
}

// Create the test suite instance
const suite = new DataHavenSubstrateTestSuite();

describe("DataHaven Substrate Operations", () => {
  let signer: PolkadotSigner;

  beforeAll(() => {
    signer = getPapiSigner();
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

  it("should submit extrinsic to finalized block", async () => {
    const connectors = suite.getTestConnectors();
    const value = parseEther("1");
    const { address: dest } = generateRandomAccount();
    
    const ext = connectors.dhApi.tx.Balances.transfer_allow_death({
      dest,
      value
    });

    // Submit and wait for finalization
    const resp = await ext.signAndSubmit(signer, {});
    logger.info(`Transaction finalized: ${resp.txHash}`);
    
    // Verify balance
    const {
      data: { free: destBalance }
    } = await connectors.dhApi.query.System.Account.getValue(dest);
    
    expect(destBalance).toBeGreaterThan(0n);
  });

  it("should submit extrinsic to best block (faster)", async () => {
    const connectors = suite.getTestConnectors();
    const value = parseEther("0.5");
    const { address: dest } = generateRandomAccount();
    
    const ext = connectors.dhApi.tx.Balances.transfer_allow_death({
      dest,
      value
    });

    // Submit to best block (faster than finalized)
    const resp = await ext.signAndSubmit(signer, { at: "best" });
    logger.info(`Transaction in best block: ${resp.txHash}`);
    
    // Check balance at best block
    const {
      data: { free: destBalance }
    } = await connectors.dhApi.query.System.Account.getValue(dest, { at: "best" });
    
    expect(destBalance).toBe(value);
  });

  it("should listen to events", async () => {
    const connectors = suite.getTestConnectors();
    
    // Pull next ExtrinsicSuccess event
    const event = await connectors.dhApi.event.System.ExtrinsicSuccess.pull();
    
    expect(event).not.toBeEmpty();
    expect(event[0].payload.dispatch_info.weight.ref_time).toBeGreaterThan(0n);
    
    logger.info(`Caught ExtrinsicSuccess event with weight: ${event[0].payload.dispatch_info.weight.ref_time}`);
  });

  it("should query block information", async () => {
    const connectors = suite.getTestConnectors();
    
    // Get current block
    const blockHeader = await connectors.papiClient.getBlockHeader();
    
    expect(blockHeader.number).toBeGreaterThan(0);
    
    logger.info(`Current block #${blockHeader.number}`);
  });

  it("should batch multiple transfers", async () => {
    const connectors = suite.getTestConnectors();
    const recipients = Array.from({ length: 3 }, () => generateRandomAccount());
    const amount = parseEther("0.1");
    
    // Create batch call
    const calls = recipients.map(recipient => 
      connectors.dhApi.tx.Balances.transfer_allow_death({
        dest: recipient.address,
        value: amount
      }).decodedCall
    );
    
    const batchExt = connectors.dhApi.tx.Utility.batch({ calls });
    
    // Submit batch
    const resp = await batchExt.signAndSubmit(signer, { at: "best" });
    logger.info(`Batch transaction submitted: ${resp.txHash}`);
    
    // Verify all recipients received funds
    for (const recipient of recipients) {
      const {
        data: { free: balance }
      } = await connectors.dhApi.query.System.Account.getValue(
        recipient.address,
        { at: "best" }
      );
      
      expect(balance).toBe(amount);
    }
    
    logger.info(`Successfully sent ${amount} wei to ${recipients.length} recipients in batch`);
  });
});