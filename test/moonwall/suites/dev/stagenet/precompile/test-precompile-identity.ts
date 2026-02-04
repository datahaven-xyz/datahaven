/**
 * Identity precompile tests - retrieve registrars and identity
 * Adapted from Moonbeam test suite
 */

import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { alith, baltathar } from "@moonwall/util";
import { toHex } from "viem";
import { PRECOMPILE_IDENTITY_ADDRESS } from "../../../../helpers";

describeSuite({
  id: "D030301",
  title: "Precompiles - Identity precompile",
  foundationMethods: "dev",
  testCases: ({ it, log, context }) => {
    beforeAll(async function () {
      await context.createBlock(
        context
          .polkadotJs()
          .tx.sudo.sudo(context.polkadotJs().tx.identity.addRegistrar(alith.address))
      );

      await context.createBlock(context.polkadotJs().tx.identity.setFee(0, 100));
      await context.createBlock(
        // With 0b111 we are indicating the pallet to use "Display", "Legal" and "Web" fields.
        context
          .polkadotJs()
          .tx.identity.setFields(0, 0b111 as any)
      );

      await context.createBlock(
        context
          .polkadotJs()
          .tx.identity.setIdentity({
            additional: [[{ raw: "discord" }, { raw: "my-discord" }]],
            display: { raw: "display" },
            legal: { raw: "legal" },
            web: { raw: "web" },
            riot: { raw: "riot" },
            email: { raw: "email" },
            pgpFingerprint: new Array(20).fill(1),
            image: { raw: "image" },
            twitter: { raw: "twitter" },
          })
          .signAsync(baltathar)
      );
    });

    it({
      id: "T01",
      title: "should retrieve registrars",
      test: async function () {
        const registrars = (await context.readContract!({
          contractAddress: PRECOMPILE_IDENTITY_ADDRESS,
          contractName: "Identity",
          functionName: "registrars",
          args: [],
        })) as any;

        expect(registrars.length).to.equal(1);
        expect(registrars[0].isValid).to.be.true;
        expect(registrars[0].index).to.equal(0);
        expect(registrars[0].account).to.equal(alith.address);
        expect(registrars[0].fee).to.equal(100n);
        expect(registrars[0].fields.display).to.be.true;
        expect(registrars[0].fields.web).to.be.true;
        expect(registrars[0].fields.legal).to.be.true;
        expect(registrars[0].fields.riot).to.be.false;
        expect(registrars[0].fields.email).to.be.false;
        expect(registrars[0].fields.pgpFingerprint).to.be.false;
        expect(registrars[0].fields.image).to.be.false;
        expect(registrars[0].fields.twitter).to.be.false;
      },
    });

    it({
      id: "T02",
      title: "should retrieve identity",
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
