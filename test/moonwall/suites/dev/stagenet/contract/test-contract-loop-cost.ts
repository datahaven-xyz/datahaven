import { describeSuite, expect, TransactionTypes } from "@moonwall/cli";
import { createEthersTransaction } from "@moonwall/util";
import { encodeFunctionData } from "viem";
import { deployContract } from "../../../../helpers/contracts";

describeSuite({
  id: "D020507",
  title: "Contract loop",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    let testNumber = 0;

    const TestParameters = [
      {
        loop: 1n,
        gas: 43_774n
      },
      {
        loop: 500n,
        gas: 241_390n
      },
      {
        loop: 600n,
        gas: 280_990n
      }
    ];

    TestParameters.forEach(({ loop, gas }) => {
      for (const txnType of TransactionTypes) {
        testNumber++;
        it({
          id: `T${testNumber > 9 ? testNumber : `0${testNumber}`}`,
          title: `should consume ${gas} for ${loop} loop for ${txnType}`,
          test: async () => {
            const { abi, contractAddress } = await deployContract(context as any, "Looper");

            const rawSigned = await createEthersTransaction(context, {
              to: contractAddress,
              data: encodeFunctionData({ abi, functionName: "incrementalLoop", args: [loop] }),
              gasLimit: 10_000_000,
              txnType
            });

            await context.createBlock(rawSigned);

            expect(
              await context.readContract!({
                contractName: "Looper",
                contractAddress,
                functionName: "count"
              })
            ).toBe(loop);
            const block = await context.viem().getBlock();
            expect(block.gasUsed).toBe(gas);
          }
        });
      }
    });
  }
});
