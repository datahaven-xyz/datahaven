import { afterAll, beforeAll, describe, it } from "bun:test";
import { sleep } from "bun";
import { mockEthServer } from "mock/eth";
import { logger, TestHarness } from "utils";
import { createPublicClient, http } from "viem";

// Test to that covers the snowbridge relay reading the beefy pallet and performing expected outputs

describe("Beefy Relay Integration Tests", () => {
  let mockEth: Bun.Server;

  beforeAll(async () => {
    mockEth = mockEthServer;
    await new TestHarness({ datahaven: true, relayers: false }).launchFullStack();
  });

  afterAll(async () => {
    await mockEth.stop();
  });

  it("should read the beefy pallet and output expected results", async () => {
    const client = createPublicClient({
      transport: http("http://127.0.0.1:8545")
    });

    const blockNum = await client.getBlockNumber();
    logger.info(`Block number is ${blockNum}`);
    // const result = await relay.readBeefyPallet();
    // expect(result).toEqual(expectedOutput);
    await sleep(50_000);
    console.log("Test not implemented yet");
  });
});
