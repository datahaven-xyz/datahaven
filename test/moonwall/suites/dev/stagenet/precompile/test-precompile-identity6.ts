/**
 * Identity precompile tests - provide judgement
 * Adapted from Moonbeam test suite
 */

import { beforeAll, describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import { alith, baltathar } from "@moonwall/util";
import { decodeEventLog, toHex } from "viem";
import {
  PRECOMPILE_IDENTITY_ADDRESS,
  expectEVMResult,
  expectSubstrateEvent,
} from "../../../../helpers";

describeSuite({
  id: "D030306",
  title: "Precompiles - Identity precompile - provide judgement",
  foundationMethods: "dev",
  testCases: ({ it, log, context }) => {
    beforeAll(async function () {
      await context.createBlock(
        context
          .polkadotJs()
          .tx.sudo.sudo(context.polkadotJs().tx.identity.addRegistrar(alith.address))
      );
      const identityData = {
        display: { raw: "display" },
      };
      await context.createBlock([
        context.polkadotJs().tx.identity.setFee(0, 100n),
        context.polkadotJs().tx.identity.setIdentity(identityData).signAsync(baltathar),
      ]);
      await context.createBlock(
        context.polkadotJs().tx.identity.requestJudgement(0, 1000n).signAsync(baltathar)
      );

      const identityHash = context
        .polkadotJs()
        .registry.createType("PalletIdentityLegacyIdentityInfo", identityData)
        .hash.toHex();
      const block = await context.createBlock(
        await context.writeContract!({
          contractName: "Identity",
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          functionName: "provideJudgement",
          rawTxOnly: true,
          args: [
            0,
            baltathar.address,
            {
              isUnknown: false,
              isFeePaid: false,
              feePaidDeposit: 0,
              isReasonable: false,
              isKnownGood: true,
              isOutOfDate: false,
              isLowQuality: false,
              isErroneous: false,
            },
            identityHash,
          ],
        })
      );

      expectEVMResult(block.result!.events, "Succeed");
      const { data } = expectSubstrateEvent(block, "evm", "Log");
      const evmLog = decodeEventLog({
        abi: fetchCompiledContract("Identity").abi,
        topics: data[0].topics.map((t) => t.toHex()) as any,
        data: data[0].data.toHex(),
      }) as any;

      expect(evmLog.eventName).to.equal("JudgementGiven");
      expect(evmLog.args.target).to.equal(baltathar.address);
      expect(evmLog.args.registrarIndex).to.equal(0);
    });

    it({
      id: "T01",
      title: "should have provided judgement as part of identity",
      test: async function () {
        const identity = (await context.readContract!({
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          contractName: "Identity",
          functionName: "identity",
          args: [baltathar.address],
        })) as any;

        expect(identity.isValid).to.be.true;
        expect(identity.judgements).to.have.length(1);
        expect(identity.judgements[0].judgement.isKnownGood).to.be.true;
        expect(identity.deposit).to.equal(1027400000000000000n);
        expect(identity.info.display.hasData).to.be.true;
        expect(identity.info.display.value).to.equal(toHex("display"));
      },
    });
  },
});
