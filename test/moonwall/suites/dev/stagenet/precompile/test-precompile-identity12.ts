/**
 * Identity precompile tests - rename sub
 * Adapted from Moonbeam test suite
 */

import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { BALTATHAR_PRIVATE_KEY, baltathar, charleth } from "@moonwall/util";
import { toHex } from "viem";
import { PRECOMPILE_IDENTITY_ADDRESS, expectEVMResult } from "../../../../helpers";

describeSuite({
  id: "D030312",
  title: "Precompiles - Identity precompile - rename sub",
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
          functionName: "renameSub",
          privateKey: BALTATHAR_PRIVATE_KEY,
          rawTxOnly: true,
          args: [
            charleth.address,
            {
              hasData: true,
              value: toHex("foobar"),
            },
          ],
        })
      );

      expectEVMResult(block.result!.events, "Succeed");
    });

    it({
      id: "T01",
      title: "should retrieve subs",
      test: async function () {
        const subs = (await context.readContract!({
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          contractName: "Identity",
          functionName: "subsOf",
          args: [baltathar.address],
        })) as any;

        expect(subs.deposit).to.equal(1005300000000000000n);
        expect(subs.accounts).to.have.length(1);
        expect(subs.accounts[0]).to.be.equal(charleth.address);
      },
    });

    it({
      id: "T02",
      title: "should retrieve super",
      test: async function () {
        const superOf = (await context.readContract!({
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          contractName: "Identity",
          functionName: "superOf",
          args: [charleth.address],
        })) as any;

        expect(superOf.isValid).to.be.true;
        expect(superOf.account).to.be.equal(baltathar.address);
        expect(superOf.data.hasData).to.be.true;
        expect(superOf.data.value).to.be.equal(toHex("foobar"));
      },
    });
  },
});
