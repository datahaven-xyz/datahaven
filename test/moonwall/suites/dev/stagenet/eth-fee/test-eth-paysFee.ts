import { describeSuite, expect, extractInfo, TransactionTypes } from "@moonwall/cli";
import { BALTATHAR_ADDRESS, createRawTransfer, GLMR } from "@moonwall/util";

// We use ethers library in this test as apparently web3js's types are not fully EIP-1559
// compliant yet.
describeSuite({
  id: "D021002",
  title: "Ethereum - PaysFee",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    for (const txnType of TransactionTypes) {
      it({
        id: `T0${TransactionTypes.indexOf(txnType) + 1}`,
        title: `should be false for successful ethereum ${txnType} transactions`,
        test: async () => {
          const { result } = await context.createBlock(
            await createRawTransfer(context, BALTATHAR_ADDRESS, GLMR, { type: txnType })
          );
          const info = extractInfo(result?.events)!;
          expect(info).to.not.be.empty;
          expect(info.paysFee.isYes, "Transaction should be marked as paysFees === no").to.be.false;
        }
      });
    }
  }
});
