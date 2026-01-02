import { customDevRpcRequest, describeSuite, expect } from "@moonwall/cli";
import { CHAIN_ID } from "utils/constants";

describeSuite({
  id: "D021201",
  title: "RPC Constants",
  foundationMethods: "dev",
  testCases: ({ it }) => {
    const DATAHAVEN_CHAIN_ID = BigInt(CHAIN_ID);
    it({
      id: "T01",
      title: "should have 0 hashrate",
      test: async () => {
        expect(BigInt(await customDevRpcRequest("eth_hashrate"))).toBe(0n);
      }
    });

    it({
      id: "T02",
      title: `should have chainId ${CHAIN_ID}`,
      test: async () => {
        expect(BigInt(await customDevRpcRequest("eth_chainId"))).toBe(DATAHAVEN_CHAIN_ID);
      }
    });

    it({
      id: "T03",
      title: "should have no account",
      test: async () => {
        expect(await customDevRpcRequest("eth_accounts")).toStrictEqual([]);
      }
    });

    it({
      id: "T04",
      title: "block author should be 0x0000000000000000000000000000000000000000",
      test: async () => {
        // This address `0x1234567890` is hardcoded into the runtime find_author
        // as we are running manual sealing consensus.
        expect(await customDevRpcRequest("eth_coinbase")).toBe(
          "0x0000000000000000000000000000000000000000"
        );
      }
    });
  }
});
