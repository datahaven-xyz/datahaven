import { beforeAll, describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import { alith, createEthersTransaction, sendRawTransaction } from "@moonwall/util";
import { encodeDeployData, toHex } from "viem";

describeSuite({
  id: "D023802",
  title: "TxPool - Future Ethereum transaction",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let txHash: string;
    let deployData: string;

    beforeAll(async () => {
      const { abi, bytecode } = fetchCompiledContract("MultiplyBy7");
      deployData = encodeDeployData({
        abi,
        bytecode,
      });

      const rawTxn = await createEthersTransaction(context, {
        data: deployData,
        gasLimit: 1048576,
        nonce: 1, // future nonce
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
        const data = inspect.queued[alith.address.toLowerCase()][toHex(1)];
        expect(data).to.not.be.undefined;
        expect(data).to.be.equal(
          "0x0000000000000000000000000000000000000000: 0 wei + 1048576 gas x 10000000000 wei"
        );
      },
    });

    it({
      id: "T02",
      title: "should appear in the txpool content",
      test: async function () {
        const content = (await context
          .viem()
          .transport.request({ method: "txpool_content" })) as any;
        // web3 rpc returns lowercase
        const data = content.queued[alith.address.toLowerCase()][toHex(1)];
        expect(data).toMatchObject({
          blockHash: null,
          blockNumber: null,
          from: alith.address.toLowerCase(),
          gas: "0x100000",
          gasPrice: "0x2540be400",
          hash: txHash,
          input: deployData,
          nonce: toHex(1),
          to: null,
          transactionIndex: null,
          value: "0x0",
        });
      },
    });
  },
});
