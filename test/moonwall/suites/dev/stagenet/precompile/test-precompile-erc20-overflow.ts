import "@moonbeam-network/api-augment";
import { describeSuite, expect } from "@moonwall/cli";
import { generateKeyringPair } from "@moonwall/util";

describeSuite({
  id: "D030402",
  title: "Precompile ERC20 - Transfering through precompile",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    const randomAccount = generateKeyringPair();
    it({
      id: "T01",
      title: "should not allow overflowing the value",
      test: async function () {
        await expect(
          async () =>
            await context.writePrecompile!({
              precompileName: "Batch",
              functionName: "batchAll",
              args: [
                [randomAccount.address],
                [`${(2n ** 128n + 5_000_000_000_000_000_000n).toString()}`],
                [],
                [],
              ],
            })
        ).rejects.toThrowError("evm error: OutOfFund");
      },
    });
  },
});
