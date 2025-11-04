import { describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import { ALITH_ADDRESS } from "@moonwall/util";

describeSuite({
  id: "D021801",
  title: "Estimate Gas - Contract creation",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "should return contract creation gas cost",
      test: async function () {
        const { bytecode } = fetchCompiledContract("MultiplyBy7");
        expect(
          await context.viem().estimateGas({
            account: ALITH_ADDRESS,
            data: bytecode,
          })
        ).to.equal(210541n);
      },
    });
  },
});
