import { beforeAll, describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import { encodeDeployData } from "viem";

/*
  At rpc-level, there is no interface for retrieving emulated pending transactions - emulated
    transactions that exist in the Substrate's pending transaction pool. Instead they are added to a
    shared collection (Mutex) with get/set locking to serve requests that ask for this transactions
    information before they are included in a block.
    We want to test that:
      - We resolve multiple promises in parallel that will write in this collection on the rpc-side
      - We resolve multiple promises in parallel that will read from this collection on the rpc-side
      - We can get the final transaction data once it leaves the pending collection
  */

describeSuite({
  id: "D021103",
  title: "EthPool - Multiple pending transactions",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    let txHashes: string[];

    beforeAll(async () => {
      const { bytecode, abi } = fetchCompiledContract("MultiplyBy7");
      const callData = encodeDeployData({
        abi,
        bytecode,
        args: []
      });

      txHashes = await Promise.all(
        new Array(10).fill(0).map(async (_, i) => {
          return await context.viem().sendTransaction({ nonce: i, data: callData, gas: 200000n });
        })
      );
    });

    it({
      id: "T01",
      title: "should all be available by hash",
      test: async () => {
        const transactions = await Promise.all(
          txHashes.map((txHash) => context.viem().getTransaction({ hash: txHash as `0x${string}` }))
        );

        expect(transactions.length).toBe(10);
        expect(
          transactions.every((transaction, index) => transaction.hash === txHashes[index])
        ).toBe(true);
      }
    });

    it({
      id: "T02",
      title: "should all be marked as pending",
      test: async () => {
        const transactions = await Promise.all(
          txHashes.map((txHash) => context.viem().getTransaction({ hash: txHash as `0x${string}` }))
        );

        expect(transactions.length).toBe(10);
        expect(transactions.every((transaction) => transaction.blockNumber === null)).toBe(true);
        expect(transactions.every((transaction) => transaction.transactionIndex === null)).toBe(
          true
        );
      }
    });

    it({
      id: "T03",
      title: "should all be populated when included in a block",
      test: async () => {
        await context.createBlock();
        const transactions = await Promise.all(
          txHashes.map((txHash) => context.viem().getTransaction({ hash: txHash as `0x${string}` }))
        );

        expect(transactions.length).toBe(10);
        expect(transactions.every((transaction) => transaction.blockNumber === 1n)).toBe(true);
        expect(
          transactions.every((transaction, index) => transaction.transactionIndex === index)
        ).toBe(true);
      }
    });
  }
});
