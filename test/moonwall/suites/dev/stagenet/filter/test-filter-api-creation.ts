import {
  customDevRpcRequest,
  deployCreateCompiledContract,
  describeSuite,
  expect
} from "@moonwall/cli";
import { fromHex, toHex } from "viem";

describeSuite({
  id: "D021701",
  title: "Filter API",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    it({
      id: "T01",
      title: "should be able to create a Log filter",
      test: async () => {
        const { contractAddress } = await deployCreateCompiledContract(context, "EventEmitter");
        const createFilter = await customDevRpcRequest("eth_newFilter", [
          {
            fromBlock: "0x0",
            toBlock: "latest",
            address: [contractAddress, "0x970951a12F975E6762482ACA81E57D5A2A4e73F4"],
            topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]
          }
        ]);
        expect(createFilter).toBe(toHex(1));
      }
    });

    it({
      id: "T02",
      title: "should increment filter id",
      test: async () => {
        const createFilter = await customDevRpcRequest("eth_newFilter", [
          {
            fromBlock: "0x1",
            toBlock: "0x2",
            address: "0xc01Ee7f10EA4aF4673cFff62710E1D7792aBa8f3",
            topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]
          }
        ]);

        const createFilter2 = await customDevRpcRequest("eth_newFilter", [
          {
            fromBlock: "0x1",
            toBlock: "0x2",
            address: "0xc01Ee7f10EA4aF4673cFff62710E1D7792aBa8f3",
            topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]
          }
        ]);
        expect(fromHex(createFilter2, "bigint")).toBeGreaterThan(fromHex(createFilter, "bigint"));
        expect(fromHex(createFilter2, "bigint") - fromHex(createFilter, "bigint")).toBe(1n);
      }
    });

    it({
      id: "T03",
      title: "should be able to create a Block Log filter",
      test: async () => {
        const createFilter = await customDevRpcRequest("eth_newBlockFilter", []);
        expect(createFilter).toBeTruthy();
      }
    });
  }
});
