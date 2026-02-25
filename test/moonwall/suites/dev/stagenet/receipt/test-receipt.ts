import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { BALTATHAR_ADDRESS, alith } from "@moonwall/util";

describeSuite({
  id: "D023103",
  title: "Receipt - Contract",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let txHash: string;
    let eventContract: `0x${string}`;

    beforeAll(async () => {
      const { contractAddress, hash } = await context.deployContract!("EventEmitter");
      eventContract = contractAddress;
      txHash = hash;
    });

    it({
      id: "T01",
      title: "Should generate receipt",
      test: async function () {
        const block = await context.viem().getBlock({ blockNumber: 1n });
        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: txHash as `0x${string}` });

        expect(receipt.blockHash).toBe(block.hash);
        expect(receipt.blockNumber).toBe(block.number);
        expect(receipt.from).toBe(alith.address.toLowerCase());
        expect(receipt.logs.length).toBe(1);
        expect(receipt.logs[0].address).toBe(eventContract);
        expect(receipt.logs[0].blockHash).toBe(block.hash);
      },
    });

    it({
      id: "T02",
      title: "should calculate effective gas price",
      test: async function () {
        const maxFeePerGas = 10_000_000_000n * 2n;

        const rawTxn = await context.createTxn!({
          gas: 21000n,
          libraryType: "viem",
          maxFeePerGas: maxFeePerGas,
          maxPriorityFeePerGas: maxFeePerGas,
          to: BALTATHAR_ADDRESS,
          data: "0x",
          txnType: "eip1559",
        });
        await context.createBlock(rawTxn);

        const block = await context.viem().getBlock();
        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: block.transactions[0] as `0x${string}` });
        expect(receipt.effectiveGasPrice).to.be.eq(maxFeePerGas);
      },
    });
  },
});
