import {
  customDevRpcRequest,
  deployCreateCompiledContract,
  describeSuite,
  expect
} from "@moonwall/cli";

describeSuite({
  id: "D021703",
  title: "Filter Block API",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    it({
      id: "T01",
      title: "should return block information",
      test: async () => {
        const createFilter = await customDevRpcRequest("eth_newBlockFilter", []);
        const block = await context.viem().getBlock();
        const poll = await customDevRpcRequest("eth_getFilterChanges", [createFilter]);

        expect(poll.length).to.be.eq(1);
        expect(poll[0]).to.be.eq(block.hash);
      }
    });

    it({
      id: "T02",
      title: "should not retrieve previously polled",
      test: async () => {
        const filterId = await customDevRpcRequest("eth_newBlockFilter", []);

        await context.createBlock();
        await customDevRpcRequest("eth_getFilterChanges", [filterId]);

        await context.createBlock();
        await context.createBlock();

        const poll = await customDevRpcRequest("eth_getFilterChanges", [filterId]);

        const block2 = await context.viem().getBlock({ blockNumber: 2n });
        const block3 = await context.viem().getBlock({ blockNumber: 3n });
        expect(poll.length).to.be.eq(2);
        expect(poll[0]).to.be.eq(block2.hash);
        expect(poll[1]).to.be.eq(block3.hash);
      }
    });

    it({
      id: "T03",
      title: "should be empty after already polling",
      test: async () => {
        const filterId = await customDevRpcRequest("eth_newBlockFilter", []);

        await context.createBlock();
        await customDevRpcRequest("eth_getFilterChanges", [filterId]);
        const poll = await customDevRpcRequest("eth_getFilterChanges", [filterId]);

        expect(poll.length).to.be.eq(0);
      }
    });

    it({
      id: "T04",
      title: "should support filtering created contract",
      test: async () => {
        const { contractAddress, hash } = await deployCreateCompiledContract(
          context,
          "EventEmitter"
        );
        const receipt = await context.viem().getTransactionReceipt({ hash });

        const filterId = await customDevRpcRequest("eth_newFilter", [
          {
            fromBlock: "0x0",
            toBlock: "latest",
            address: contractAddress,
            topics: receipt.logs[0].topics
          }
        ]);
        const poll = await customDevRpcRequest("eth_getFilterChanges", [filterId]);

        expect(poll.length).to.be.eq(1);
        expect(poll[0].address).to.be.eq(contractAddress);
        expect(poll[0].topics).to.be.deep.eq(receipt.logs[0].topics);
      }
    });
  }
});
