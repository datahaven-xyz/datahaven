import { customDevRpcRequest, describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "D022201",
  title: "Node - RPC",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    it({
      id: "T01",
      title: "should report peer count in hex",
      test: async function () {
        // this tests that the "net_peerCount" response comes back in hex and not decimal.
        // related: frontier commits 677548c and 78fb3bc
        const result = await customDevRpcRequest("net_peerCount", []);

        expect(result).to.be.equal("0x0");
        expect(typeof result).to.be.equal("string");
      },
    });
  },
});
