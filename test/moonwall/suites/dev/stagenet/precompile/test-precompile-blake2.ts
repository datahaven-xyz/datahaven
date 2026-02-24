/**
 * Blake2 precompile tests
 * Adapted from Moonbeam test suite
 */

import { deployCreateCompiledContract, describeSuite } from "@moonwall/cli";
import { expectEVMResult } from "../../../../helpers";

import { createViemTransaction } from "@moonwall/util";
import { encodeFunctionData } from "viem";

describeSuite({
  id: "D030101",
  title: "Precompiles - blake2",
  foundationMethods: "dev",
  testCases: ({ context, log, it }) => {
    it({
      id: "T01",
      title: "should be accessible from a smart contract",
      test: async function () {
        const { abi } = await deployCreateCompiledContract(context, "HasherChecker");

        // Execute the contract blake2 call
        const { result } = await context.createBlock(
          createViemTransaction(context, {
            data: encodeFunctionData({
              abi,
              functionName: "blake2Check",
            }),
          })
        );

        expectEVMResult(result!.events, "Succeed");
      },
    });
  },
});
