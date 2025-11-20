import {
  beforeAll,
  customDevRpcRequest,
  deployCreateCompiledContract,
  describeSuite,
  expect
} from "@moonwall/cli";
import type { TransactionReceipt } from "viem";

describeSuite({
  id: "D021203",
  title: "Ethereum RPC - Filtering non-matching logs",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    let nonMatchingCases: ReturnType<typeof getNonMatchingCases>;

    const getNonMatchingCases = (receipt: TransactionReceipt) => {
      return [
        // Non-existant address.
        {
          fromBlock: "0x0",
          toBlock: "latest",
          address: "0x0000000000000000000000000000000000000000"
        },
        // Non-existant topic.
        {
          fromBlock: "0x0",
          toBlock: "latest",
          topics: ["0x0000000000000000000000000000000000000000000000000000000000000000"]
        },
        // Existant address + non-existant topic.
        {
          fromBlock: "0x0",
          toBlock: "latest",
          address: receipt.contractAddress,
          topics: ["0x0000000000000000000000000000000000000000000000000000000000000000"]
        },
        // Non-existant address + existant topic.
        {
          fromBlock: "0x0",
          toBlock: "latest",
          address: "0x0000000000000000000000000000000000000000",
          topics: receipt.logs[0].topics
        }
      ];
    };

    beforeAll(async () => {
      const { hash } = await deployCreateCompiledContract(context, "EventEmitter");
      const receipt = await context.viem().getTransactionReceipt({ hash });
      nonMatchingCases = getNonMatchingCases(receipt);
    });

    it({
      id: "T01",
      title: "EthFilterApi::getFilterLogs - should filter out non-matching cases.",
      test: async () => {
        const filterLogs = await Promise.all(
          nonMatchingCases.map(async (item) => {
            const filter = await customDevRpcRequest("eth_newFilter", [item]);
            return await customDevRpcRequest("eth_getFilterLogs", [filter]);
          })
        );

        expect(filterLogs.flat(1).length).toBe(0);
      }
    });
    it({
      id: "T02",
      title: "EthApi::getLogs - should filter out non-matching cases.",
      test: async () => {
        const logs = await Promise.all(
          nonMatchingCases.map(async (item) => await customDevRpcRequest("eth_getLogs", [item]))
        );
        expect(logs.flat(1).length).toBe(0);
      }
    });
  }
});
