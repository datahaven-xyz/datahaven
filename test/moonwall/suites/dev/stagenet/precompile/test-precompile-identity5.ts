/**
 * Identity precompile tests - cancel requested judgement
 * Adapted from Moonbeam test suite
 */

import { beforeAll, describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import { BALTATHAR_PRIVATE_KEY, alith, baltathar } from "@moonwall/util";
import { decodeEventLog, toHex } from "viem";
import {
  PRECOMPILE_IDENTITY_ADDRESS,
  expectEVMResult,
  expectSubstrateEvent,
} from "../../../../helpers";

describeSuite({
  id: "D030305",
  title: "Precompiles - Identity precompile - cancel requested judgement",
  foundationMethods: "dev",
  testCases: ({ it, log, context }) => {
    beforeAll(async function () {
      await context.createBlock(
        context
          .polkadotJs()
          .tx.sudo.sudo(context.polkadotJs().tx.identity.addRegistrar(alith.address))
      );
      await context.createBlock([
        context.polkadotJs().tx.identity.setFee(0, 100n),
        context
          .polkadotJs()
          .tx.identity.setIdentity({
            display: { raw: "display" },
          })
          .signAsync(baltathar),
      ]);
      await context.createBlock(
        context.polkadotJs().tx.identity.requestJudgement(0, 1000n).signAsync(baltathar)
      );

      const block = await context.createBlock(
        await context.writeContract!({
          contractName: "Identity",
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          functionName: "cancelRequest",
          privateKey: BALTATHAR_PRIVATE_KEY,
          rawTxOnly: true,
          args: [0],
        })
      );

      expectEVMResult(block.result!.events, "Succeed");
      const { data } = expectSubstrateEvent(block, "evm", "Log");
      const evmLog = decodeEventLog({
        abi: fetchCompiledContract("Identity").abi,
        topics: data[0].topics.map((t) => t.toHex()) as any,
        data: data[0].data.toHex(),
      }) as any;

      expect(evmLog.eventName).to.equal("JudgementUnrequested");
      expect(evmLog.args.who).to.equal(baltathar.address);
      expect(evmLog.args.registrarIndex).to.equal(0);
    });

    it({
      id: "T01",
      title: "should have no requested judgement as part of identity",
      test: async function () {
        const identity = (await context.readContract!({
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          contractName: "Identity",
          functionName: "identity",
          args: [baltathar.address],
        })) as any;

        expect(identity.isValid).to.be.true;
        expect(identity.judgements).to.be.empty;
        expect(identity.deposit).to.equal(1027400000000000000n);
        expect(identity.info.display.hasData).to.be.true;
        expect(identity.info.display.value).to.equal(toHex("display"));
      },
    });
  },
});
