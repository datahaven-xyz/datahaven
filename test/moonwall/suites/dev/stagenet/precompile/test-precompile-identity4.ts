/**
 * Identity precompile tests - request judgement
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
  id: "D030304",
  title: "Precompiles - Identity precompile - request judgement",
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

      const block = await context.createBlock(
        await context.writeContract!({
          contractName: "Identity",
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          functionName: "requestJudgement",
          privateKey: BALTATHAR_PRIVATE_KEY,
          rawTxOnly: true,
          args: [0, 100],
        })
      );

      expectEVMResult(block.result!.events, "Succeed");
      const { data } = expectSubstrateEvent(block, "evm", "Log");
      const evmLog = decodeEventLog({
        abi: fetchCompiledContract("Identity").abi,
        topics: data[0].topics.map((t) => t.toHex()) as any,
        data: data[0].data.toHex(),
      }) as any;

      expect(evmLog.eventName).to.equal("JudgementRequested");
      expect(evmLog.args.who).to.equal(baltathar.address);
      expect(evmLog.args.registrarIndex).to.equal(0);
    });

    it({
      id: "T01",
      title: "should retrieve requested judgement as part of identity",
      test: async function () {
        const identity = (await context.readContract!({
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          contractName: "Identity",
          functionName: "identity",
          args: [baltathar.address],
        })) as any;

        expect(identity.isValid).to.be.true;
        expect(identity.judgements).to.have.length(1);
        expect(identity.judgements[0].registrarIndex).to.equal(0);
        expect(identity.judgements[0].judgement.isFeePaid).to.be.true;
        expect(identity.judgements[0].judgement.feePaidDeposit).to.equal(100n);
        expect(identity.deposit).to.equal(1027400000000000000n);
        expect(identity.info.display.hasData).to.be.true;
        expect(identity.info.display.value).to.equal(toHex("display"));
      },
    });
  },
});
