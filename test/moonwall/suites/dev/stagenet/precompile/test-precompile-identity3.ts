/**
 * Identity precompile tests - clear identity
 * Adapted from Moonbeam test suite
 */

import { beforeAll, describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import { BALTATHAR_PRIVATE_KEY, baltathar } from "@moonwall/util";
import { decodeEventLog } from "viem";
import {
  PRECOMPILE_IDENTITY_ADDRESS,
  expectEVMResult,
  expectSubstrateEvent,
} from "../../../../helpers";

describeSuite({
  id: "D030303",
  title: "Precompiles - Identity precompile - clear identity",
  foundationMethods: "dev",
  testCases: ({ it, log, context }) => {
    beforeAll(async function () {
      await context.createBlock([
        context
          .polkadotJs()
          .tx.identity.setIdentity({
            display: { raw: "display" },
          })
          .signAsync(baltathar),
      ]);

      const block = await context.createBlock(
        await context.writeContract!({
          contractName: "Identity",
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          functionName: "clearIdentity",
          privateKey: BALTATHAR_PRIVATE_KEY,
          rawTxOnly: true,
        })
      );

      expectEVMResult(block.result!.events, "Succeed");
      const { data } = expectSubstrateEvent(block, "evm", "Log");
      const evmLog = decodeEventLog({
        abi: fetchCompiledContract("Identity").abi,
        topics: data[0].topics.map((t) => t.toHex()) as any,
        data: data[0].data.toHex(),
      }) as any;

      expect(evmLog.eventName).to.equal("IdentityCleared");
      expect(evmLog.args.who).to.equal(baltathar.address);
    });

    it({
      id: "T01",
      title: "should have no identity",
      test: async function () {
        const identity = (await context.readContract!({
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          contractName: "Identity",
          functionName: "identity",
          args: [baltathar.address],
        })) as any;

        expect(identity.isValid).to.be.false;
      },
    });
  },
});
