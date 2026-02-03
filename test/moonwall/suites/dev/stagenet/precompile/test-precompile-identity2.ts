/**
 * Identity precompile tests - set identity
 * Adapted from Moonbeam test suite
 */

import { beforeAll, describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import { BALTATHAR_PRIVATE_KEY, baltathar } from "@moonwall/util";
import { decodeEventLog, toHex } from "viem";
import {
  PRECOMPILE_IDENTITY_ADDRESS,
  expectEVMResult,
  expectSubstrateEvent,
} from "../../../../helpers";

describeSuite({
  id: "D030302",
  title: "Precompiles - Identity precompile - set identity",
  foundationMethods: "dev",
  testCases: ({ it, log, context }) => {
    beforeAll(async function () {
      const block = await context.createBlock(
        await context.writeContract!({
          contractName: "Identity",
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          functionName: "setIdentity",
          privateKey: BALTATHAR_PRIVATE_KEY,
          rawTxOnly: true,
          args: [
            {
              additional: [
                {
                  key: { hasData: true, value: toHex("discord") },
                  value: { hasData: true, value: toHex("my-discord") },
                },
              ],
              display: { hasData: true, value: toHex("display") },
              legal: { hasData: true, value: toHex("legal") },
              web: { hasData: true, value: toHex("web") },
              riot: { hasData: true, value: toHex("riot") },
              email: { hasData: true, value: toHex("email") },
              hasPgpFingerprint: true,
              pgpFingerprint: toHex(Uint8Array.from(new Array(20).fill(1))),
              image: { hasData: true, value: toHex("image") },
              twitter: { hasData: true, value: toHex("twitter") },
            },
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

      expect(evmLog.eventName).to.equal("IdentitySet");
      expect(evmLog.args.who).to.equal(baltathar.address);
    });

    it({
      id: "T01",
      title: "should retrieve newly set identity",
      test: async function () {
        const identity = (await context.readContract!({
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          contractName: "Identity",
          functionName: "identity",
          args: [baltathar.address],
        })) as any;

        expect(identity.isValid).to.be.true;
        expect(identity.judgements).to.be.empty;
        expect(identity.deposit).to.equal(1034200000000000000n);
        expect(identity.info.additional.length).to.equal(1);
        expect(identity.info.additional[0].key.hasData).to.be.true;
        expect(identity.info.additional[0].key.value).to.equal(toHex("discord"));
        expect(identity.info.additional[0].value.hasData).to.be.true;
        expect(identity.info.additional[0].value.value).to.equal(toHex("my-discord"));
        expect(identity.info.display.hasData).to.be.true;
        expect(identity.info.display.value).to.equal(toHex("display"));
        expect(identity.info.legal.hasData).to.be.true;
        expect(identity.info.legal.value).to.equal(toHex("legal"));
        expect(identity.info.web.hasData).to.be.true;
        expect(identity.info.web.value).to.equal(toHex("web"));
        expect(identity.info.riot.hasData).to.be.true;
        expect(identity.info.riot.value).to.equal(toHex("riot"));
        expect(identity.info.email.hasData).to.be.true;
        expect(identity.info.email.value).to.equal(toHex("email"));
        expect(identity.info.hasPgpFingerprint).to.be.true;
        expect(identity.info.pgpFingerprint).to.equal(
          toHex(Uint8Array.from(new Array(20).fill(1)))
        );
        expect(identity.info.image.hasData).to.be.true;
        expect(identity.info.image.value).to.equal(toHex("image"));
        expect(identity.info.twitter.hasData).to.be.true;
        expect(identity.info.twitter.value).to.equal(toHex("twitter"));
      },
    });
  },
});
