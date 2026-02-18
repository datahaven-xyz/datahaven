import { beforeAll, describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import { ALITH_ADDRESS, createEthersTransaction, sendRawTransaction } from "@moonwall/util";
import { encodeDeployData, toHex } from "viem";

describeSuite({
  id: "D023807",
  title: "TxPool - Pending Ethereum transaction",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let txHash: string;

    beforeAll(async () => {
      const { abi, bytecode } = fetchCompiledContract("MultiplyBy7");
      const deployData = encodeDeployData({
        abi,
        bytecode,
      });

      const rawTxn = await createEthersTransaction(context, {
        data: deployData,
        gasLimit: 1048576,
        nonce: 0,
      });
      txHash = await sendRawTransaction(context, rawTxn);
    });

    it({
      id: "T01",
      title: "should appear in the txpool inspection",
      test: async function () {
        const inspect = (await context
          .viem()
          .transport.request({ method: "txpool_inspect" })) as any;

        // web3 rpc returns lowercase
        const data = inspect.pending[ALITH_ADDRESS.toLowerCase()][toHex(0)];
        expect(data).to.not.be.undefined;
        expect(data).to.be.equal(
          "0x0000000000000000000000000000000000000000: 0 wei + 1048576 gas x 10000000000 wei"
        );
      },
    });

    it({
      id: "T02",
      title: "should be marked as pending",
      test: async function () {
        const pendingTransaction = await context
          .viem()
          .getTransaction({ hash: txHash as `0x${string}` });

        // pending transactions do not know yet to which block they belong to
        expect(pendingTransaction).to.include({
          blockNumber: null,
          hash: txHash,
        });
      },
    });

    it({
      id: "T03",
      title: "should appear in the txpool content",
      test: async function () {
        const content = (await context
          .viem()
          .transport.request({ method: "txpool_content" })) as any;

        // web3 rpc returns lowercase
        const data = content.pending[ALITH_ADDRESS.toLowerCase()][toHex(0)];
        expect(data).to.include({
          blockHash: null,
          blockNumber: null,
          from: ALITH_ADDRESS.toLowerCase(),
          gas: "0x100000",
          gasPrice: "0x2540be400",
          hash: txHash,
          nonce: toHex(0),
          to: null,
          value: "0x0",
        });
      },
    });
  },
});
