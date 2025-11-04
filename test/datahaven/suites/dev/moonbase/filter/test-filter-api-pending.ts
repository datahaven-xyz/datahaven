import { customDevRpcRequest, describeSuite, expect } from "@moonwall/cli";
import { fromHex } from "viem";

describeSuite({
  id: "D021702",
  title: "Filter Pending Transaction API",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "should not be supported",
      // Looks like this is now supported 🎉
      test: async function () {
        const resp = await customDevRpcRequest("eth_newPendingTransactionFilter", []);
        expect(fromHex(resp, "bigint")).toBeGreaterThanOrEqual(0n);
      },
    });
  },
});
