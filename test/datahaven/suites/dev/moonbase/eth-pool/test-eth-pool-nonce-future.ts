import { TransactionTypes, describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  BALTATHAR_ADDRESS,
  createEthersTransaction,
  createRawTransfer,
  sendRawTransaction,
} from "@moonwall/util";

import { encodeDeployData } from "viem";

describeSuite({
  id: "D021104",
  title: "EthPool - Future Ethereum transaction",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    for (const txnType of TransactionTypes) {
      it({
        id: `T0${TransactionTypes.indexOf(txnType) + 1}`,
        title: "should not be executed until condition is met",
        test: async function () {
          const { bytecode, abi } = fetchCompiledContract("MultiplyBy7");
          const callData = encodeDeployData({
            abi,
            bytecode,
            args: [],
          });
          const rawSigned = await createEthersTransaction(context, {
            data: callData,
            txnType,
          });
          const txHash = await sendRawTransaction(context, rawSigned);
          const transaction = await context.viem().getTransaction({ hash: txHash });
          expect(transaction.blockNumber).to.be.null;
          await context.createBlock();
        },
      });

      // TODO: Add txpool_content once implemented
      it({
        id: `T0${TransactionTypes.indexOf(txnType) + 4}`,
        title: "should be executed after condition is met",
        test: async function () {
          const { bytecode, abi } = fetchCompiledContract("MultiplyBy7");
          const callData = encodeDeployData({
            abi,
            bytecode,
            args: [],
          });
          const nonce = await context
            .viem("public")
            .getTransactionCount({ address: ALITH_ADDRESS });
          const rawSigned = await createEthersTransaction(context, {
            data: callData,
            txnType,
            nonce: nonce + 1,
          });
          const txHash = await sendRawTransaction(context, rawSigned);
          await context.createBlock(
            await createRawTransfer(context, BALTATHAR_ADDRESS, 512, { nonce })
          );
          const transaction = await context.viem().getTransaction({ hash: txHash });
          expect(transaction.blockNumber! > 0n).toBe(true);
        },
      });
    }
  },
});
