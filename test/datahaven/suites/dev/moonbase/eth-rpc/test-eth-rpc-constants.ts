import { describeSuite, expect, customDevRpcRequest } from "@moonwall/cli";

describeSuite({
  id: "D021201",
  title: "RPC Constants",
  foundationMethods: "dev",
  testCases: ({ it, context }) => {
    it({
      id: "T01",
      title: "should have 0 hashrate",
      test: async function () {
        expect(BigInt(await customDevRpcRequest("eth_hashrate"))).toBe(0n);
      },
    });

    it({
      id: "T02",
      title: "should have chainId 1288",
      test: async function () {
        expect(BigInt(await customDevRpcRequest("eth_chainId"))).toBe(1288n);
      },
    });

    it({
      id: "T03",
      title: "should have no account",
      test: async function () {
        expect(await customDevRpcRequest("eth_accounts")).toStrictEqual([]);
      },
    });

    it({
      id: "T04",
      title: "block author should be 0x0000000000000000000000000000000000000000",
      test: async function () {
        // This address `0x1234567890` is hardcoded into the runtime find_author
        // as we are running manual sealing consensus.
        expect(await customDevRpcRequest("eth_coinbase")).toBe(
          "0x0000000000000000000000000000000000000000"
        );
      },
    });
  },
});
