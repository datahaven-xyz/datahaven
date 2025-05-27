import { sleep } from "bun";
import { describe, it, beforeAll } from "bun:test";
import { TestHarness } from "utils";
// Test to that covers the snowbridge relay reading the beefy pallet and performing expected outputs

describe("Beefy Relay Integration Tests", () => {
  beforeAll(async () => {
    await new TestHarness({datahaven: true}).launchFullStack();
  });

  it("should read the beefy pallet and output expected results", async () => {
    // const result = await relay.readBeefyPallet();
    // expect(result).toEqual(expectedOutput);
await sleep(400_000)
    console.log("Test not implemented yet");
  });
});
