import { describeSuite, expect, beforeEach } from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  BALTATHAR_ADDRESS,
  GLMR,
  createViemTransaction,
  checkBalance,
} from "@moonwall/util";

describeSuite({
  id: "D021302",
  title: "Native Token Transfer Test",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    let initialAlithBalance: bigint;
    let initialBaltatharBalance: bigint;

    beforeEach(async function () {
      initialAlithBalance = await checkBalance(context, ALITH_ADDRESS);
      initialBaltatharBalance = await checkBalance(context, BALTATHAR_ADDRESS);
    });

    it({
      id: "T01",
      title: "Native transfer with fixed gas limit (21000) should succeed",
      test: async function () {
        const amountToTransfer = 1n * GLMR;
        const gasLimit = 21000n;

        // Create and send the transaction with fixed gas limit
        const { result } = await context.createBlock(
          createViemTransaction(context, {
            from: ALITH_ADDRESS,
            to: BALTATHAR_ADDRESS,
            value: amountToTransfer,
            gas: gasLimit,
          })
        );

        expect(result?.successful).to.be.true;

        // Check balances after transfer
        const alithBalanceAfter = await checkBalance(context, ALITH_ADDRESS);
        const baltatharBalanceAfter = await checkBalance(context, BALTATHAR_ADDRESS);

        // Calculate gas cost
        const receipt = await context
          .viem()
          .getTransactionReceipt({ hash: result!.hash as `0x${string}` });
        const gasCost = gasLimit * receipt.effectiveGasPrice;

        // Verify balances
        expect(alithBalanceAfter).to.equal(initialAlithBalance - amountToTransfer - gasCost);
        expect(baltatharBalanceAfter).to.equal(initialBaltatharBalance + amountToTransfer);

        // Verify gas used matches our fixed gas limit
        expect(receipt.gasUsed).to.equal(gasLimit);
      },
    });

    it({
      id: "T02",
      title: "should estimate 21000 gas for native transfer",
      test: async function () {
        const estimatedGas = await context.viem().estimateGas({
          account: ALITH_ADDRESS,
          to: BALTATHAR_ADDRESS,
          value: 1n * GLMR,
        });

        expect(estimatedGas).to.equal(21000n);
      },
    });
  },
});
