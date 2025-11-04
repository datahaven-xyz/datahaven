import { describeSuite, beforeAll, expect } from "@moonwall/cli";
import { BALTATHAR_ADDRESS, createRawTransfer } from "@moonwall/util";

describeSuite({
  id: "D021206",
  title: "Transaction Index",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    beforeAll(async () => {
      await context.createBlock(createRawTransfer(context, BALTATHAR_ADDRESS, 0));
    });

    it({
      id: "T01",
      title: "should get transaction by index",
      test: async function () {
        const block = 1n;
        const index = 0;
        const result = await context.viem().getTransaction({ blockNumber: block, index });

        expect(result.transactionIndex).to.equal(index);
      },
    });
    it({
      id: "T02",
      title: "should return out of bounds message",
      test: async function () {
        const block = 0n;
        const index = 0;

        await expect(
          async () => await context.viem().getTransaction({ blockNumber: block, index })
        ).rejects.toThrowError(`${index} is out of bounds`);
      },
    });
  },
});
