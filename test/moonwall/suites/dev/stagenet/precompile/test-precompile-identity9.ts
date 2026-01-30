/**
 * Identity precompile tests - set fields
 * Adapted from Moonbeam test suite
 */

import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { alith } from "@moonwall/util";
import { expectEVMResult, PRECOMPILE_IDENTITY_ADDRESS } from "../../../../helpers";

describeSuite({
  id: "D030309",
  title: "Precompiles - Identity precompile - set fields",
  foundationMethods: "dev",
  testCases: ({ it, log, context }) => {
    beforeAll(async function () {
      await context.createBlock(
        context
          .polkadotJs()
          .tx.sudo.sudo(context.polkadotJs().tx.identity.addRegistrar(alith.address))
      );

      const block = await context.createBlock(
        await context.writeContract!({
          contractName: "Identity",
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          functionName: "setFields",
          rawTxOnly: true,
          args: [
            0,
            {
              display: true,
              web: true,
              legal: true,
              riot: true,
              email: true,
              pgpFingerprint: true,
              image: true,
              twitter: true,
            },
          ],
        })
      );

      expectEVMResult(block.result!.events, "Succeed");
    });

    it({
      id: "T01",
      title: "should retrieve the registrar",
      test: async function () {
        const registrars = (await context.readContract!({
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          contractName: "Identity",
          functionName: "registrars",
        })) as any;

        expect(registrars.length).to.equal(1);
        expect(registrars[0].isValid).to.be.true;
        expect(registrars[0].index).to.equal(0);
        expect(registrars[0].account).to.equal(alith.address);
        expect(registrars[0].fee).to.equal(0n);
        expect(registrars[0].fields.display).to.be.true;
        expect(registrars[0].fields.web).to.be.true;
        expect(registrars[0].fields.legal).to.be.true;
        expect(registrars[0].fields.riot).to.be.true;
        expect(registrars[0].fields.email).to.be.true;
        expect(registrars[0].fields.pgpFingerprint).to.be.true;
        expect(registrars[0].fields.image).to.be.true;
        expect(registrars[0].fields.twitter).to.be.true;
      },
    });
  },
});
