import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { BALTATHAR_ADDRESS, createViemTransaction, extractFee } from "@moonwall/util";
import type { ApiPromise } from "@polkadot/api";

describeSuite({
  id: "D021205",
  title: "Ethereum RPC - eth_getTransactionReceipt",
  foundationMethods: "dev",
  testCases: ({ it, context, log }) => {
    let polkadotJs: ApiPromise;

    beforeAll(() => {
      polkadotJs = context.polkadotJs();
    });

    it({
      id: "T01",
      title:
        "should have correct effectiveGasPrice when fee multiplier changes in consecutive blocks",
      test: async () => {
        const prevBlockNextFeeMultiplier = (
          await polkadotJs.query.transactionPayment.nextFeeMultiplier()
        ).toBigInt();

        const { result } = await context.createBlock(
          await createViemTransaction(context, {
            gas: 21_000n,
            maxFeePerGas: 1_000_000_000_000_000n,
            maxPriorityFeePerGas: 1n,
            type: "eip1559",
            to: BALTATHAR_ADDRESS
          })
        );
        const txHash = result?.hash;
        const txFee = extractFee(result?.events)!.amount.toBigInt();

        const txReceipt = await context.viem().getTransactionReceipt({ hash: txHash });
        const txReceiptFee = txReceipt.effectiveGasPrice * txReceipt.gasUsed;

        const txBlockNextFeeMultiplier = (
          await polkadotJs.query.transactionPayment.nextFeeMultiplier()
        ).toBigInt();

        // NOTE: fee multiplier needs to be different to ensure the test does not
        // yield a false positive. If some conditions make these values equal, some
        // extra transactions need to be added to the second block to make the
        // values differ.
        expect(prevBlockNextFeeMultiplier).not.toEqual(txBlockNextFeeMultiplier);

        expect(txReceiptFee).toEqual(txFee);
      }
    });
  }
});
