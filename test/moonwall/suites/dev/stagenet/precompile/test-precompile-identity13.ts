/**
 * Identity precompile tests - remove sub
 * Adapted from Moonbeam test suite
 */

import { beforeAll, describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import { BALTATHAR_PRIVATE_KEY, baltathar, charleth } from "@moonwall/util";
import { decodeEventLog } from "viem";
import {
  PRECOMPILE_IDENTITY_ADDRESS,
  expectEVMResult,
  expectSubstrateEvent,
} from "../../../../helpers";

describeSuite({
  id: "D030313",
  title: "Precompiles - Identity precompile - remove sub",
  foundationMethods: "dev",
  testCases: ({ it, log, context }) => {
    beforeAll(async function () {
      await context.createBlock(
        context
          .polkadotJs()
          .tx.identity.setIdentity({
            display: { raw: "display" },
          })
          .signAsync(baltathar)
      );
      await context.createBlock(
        context
          .polkadotJs()
          .tx.identity.addSub(charleth.address, { Raw: "test" })
          .signAsync(baltathar)
      );

      const block = await context.createBlock(
        await context.writeContract!({
          contractName: "Identity",
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          functionName: "removeSub",
          privateKey: BALTATHAR_PRIVATE_KEY,
          rawTxOnly: true,
          args: [charleth.address],
        })
      );

      expectEVMResult(block.result!.events, "Succeed");
      const { data } = expectSubstrateEvent(block, "evm", "Log");
      const evmLog = decodeEventLog({
        abi: fetchCompiledContract("Identity").abi,
        topics: data[0].topics.map((t) => t.toHex()) as any,
        data: data[0].data.toHex(),
      }) as any;

      expect(evmLog.eventName).to.equal("SubIdentityRemoved");
      expect(evmLog.args.sub).to.equal(charleth.address);
      expect(evmLog.args.main).to.equal(baltathar.address);
    });

    it({
      id: "T01",
      title: "should have no subs",
      test: async function () {
        const subs = (await context.readContract!({
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          contractName: "Identity",
          functionName: "subsOf",
          args: [baltathar.address],
        })) as any;

        expect(subs.deposit).to.be.equal(0n);
        expect(subs.accounts).to.be.empty;
      },
    });
  },
});
