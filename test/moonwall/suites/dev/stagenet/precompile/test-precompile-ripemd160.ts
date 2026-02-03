/**
 * RIPEMD-160 precompile tests
 * Adapted from Moonbeam test suite
 */

import { describeSuite, expect } from "@moonwall/cli";
import { toHex } from "viem";
import { expectEVMResult } from "../../../../helpers";

describeSuite({
  id: "D030105",
  title: "Precompiles - ripemd160",
  foundationMethods: "dev",
  testCases: ({ context, log, it }) => {
    it({
      id: "T01",
      title: "should be valid",
      test: async function () {
        expect(
          (
            await context.viem().call({
              to: "0x0000000000000000000000000000000000000003",
              data: toHex("Hello world!"),
            })
          ).data
        ).equals("0x0000000000000000000000007f772647d88750add82d8e1a7a3e5c0902a346a3");
      },
    });

    it({
      id: "T02",
      title: "should be accessible from a smart contract",
      test: async function () {
        const { contractAddress } = await context.deployContract!("HasherChecker");

        // Execute the contract ripemd160 call
        const rawTxn = await context.writeContract!({
          contractAddress,
          contractName: "HasherChecker",
          functionName: "ripemd160Check",
          rawTxOnly: true,
        });

        const { result } = await context.createBlock(rawTxn);

        expectEVMResult(result!.events, "Succeed");
      },
    });
  },
});
