/**
 * BN128 addition precompile tests
 * Adapted from Moonbeam test suite
 */

import { deployCreateCompiledContract, describeSuite } from "@moonwall/cli";
import { createViemTransaction } from "@moonwall/util";
import { encodeFunctionData } from "viem";
import { expectEVMResult } from "../../../../helpers";

describeSuite({
  id: "D030102",
  title: "Precompiles - bn128add",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "should be accessible from a smart contract",
      test: async function () {
        const { abi, contractAddress } = await deployCreateCompiledContract(
          context,
          "HasherChecker"
        );

        const { result } = await context.createBlock(
          createViemTransaction(context, {
            to: contractAddress,
            data: encodeFunctionData({
              abi,
              functionName: "bn128AdditionCheck",
            }),
          })
        );

        expectEVMResult(result!.events, "Succeed");
      },
    });
  },
});
