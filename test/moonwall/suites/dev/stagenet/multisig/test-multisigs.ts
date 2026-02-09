import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { blake2AsHex, createKeyMulti } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";
import {
  ALITH_ADDRESS,
  BALTATHAR_ADDRESS,
  CHARLETH_ADDRESS,
  DOROTHY_ADDRESS,
  alith,
  baltathar,
} from "@moonwall/util";

// This test cases in this suite are dependent on each other, and must be run in order.
// TODO: Make the test cases atomic

describeSuite({
  id: "D022101",
  title: "Multisigs - perform multisigs operations",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    let threshold: number;
    let call: any;
    let encodedCall: string;
    let encodedCallHash: string;

    // multisig accountId
    let encodedMultisigId: Uint8Array;
    let multisigId: string;

    beforeAll(async function () {
      // set threshold and create multisig accountId
      threshold = 2;
      encodedMultisigId = createKeyMulti([ALITH_ADDRESS, BALTATHAR_ADDRESS, CHARLETH_ADDRESS], 2);
      multisigId = u8aToHex(encodedMultisigId.slice(0, 20));

      // encode and hash the call we want to dispatch as a multisig operation
      call = context.polkadotJs().tx.balances.transferKeepAlive(DOROTHY_ADDRESS, 20);
      encodedCall = call.method.toHex();
      encodedCallHash = blake2AsHex(encodedCall);
    });

    it({
      id: "T01",
      title: "Should create a multisig operation with asMulti",
      test: async () => {
        // set signatories
        const otherSignatories = [BALTATHAR_ADDRESS, CHARLETH_ADDRESS];
        const block = await context.createBlock(
          context
            .polkadotJs()
            .tx.multisig.asMulti(threshold, otherSignatories, null, encodedCall, {})
            .signAsync(alith)
        );

        // check the event 'NewMultisig' was emitted
        const records = await context.polkadotJs().query.system.events();
        const events = records.filter(
          ({ event }) => event.section === "multisig" && event.method === "NewMultisig"
        );
        expect(events).to.have.lengthOf(1);
        expect(block.result!.successful).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "Should be able to approve a multisig operation with approveAsMulti",
      test: async function () {
        // signatories (sorted)
        const otherSignatories = [CHARLETH_ADDRESS, ALITH_ADDRESS];
        // create a new multisig operation
        await context.createBlock(
          context
            .polkadotJs()
            .tx.multisig.asMulti(threshold, otherSignatories, null, encodedCall, {})
            .signAsync(alith),
          { allowFailures: true }
        );

        // take the info of the new multisig operation saved in storage
        const multisigInfo = await context
          .polkadotJs()
          .query.multisig.multisigs(multisigId, encodedCallHash);
        const block = await context.createBlock(
          context
            .polkadotJs()
            .tx.multisig.approveAsMulti(
              threshold,
              otherSignatories,
              multisigInfo.unwrap().when,
              encodedCallHash,
              {}
            )
            .signAsync(baltathar),
          { allowFailures: true }
        );

        // check the event 'MultisigApproval' was emitted
        const records = await context.polkadotJs().query.system.events();
        const events = records.filter(
          ({ event }) => event.section === "multisig" && event.method === "MultisigApproval"
        );
        expect(events).to.have.lengthOf(1);
        expect(block.result!.successful).to.be.true;
      },
    });

    it({
      id: "T03",
      title: "Should be able to cancel a multisig operation",
      test: async () => {
        const otherSignatories = [BALTATHAR_ADDRESS, CHARLETH_ADDRESS];
        // create a new multisig operation
        await context.createBlock(
          context
            .polkadotJs()
            .tx.multisig.asMulti(threshold, otherSignatories, null, encodedCall, {})
            .signAsync(alith),
          { allowFailures: true }
        );

        // take the info of the new multisig operation saved in storage
        const multisigInfo = await context
          .polkadotJs()
          .query.multisig.multisigs(multisigId, encodedCallHash);
        const block = await context.createBlock(
          context
            .polkadotJs()
            .tx.multisig.cancelAsMulti(
              threshold,
              otherSignatories,
              multisigInfo.unwrap().when,
              encodedCallHash
            )
            .signAsync(alith)
        );

        const records = await context.polkadotJs().query.system.events();
        const events = records.filter(
          ({ event }) => event.section === "multisig" && event.method === "MultisigCancelled"
        );
        expect(events, "event 'MultisigCancelled' was not emitted").to.have.lengthOf(1);
        expect(block.result!.successful).to.be.true;
      },
    });

    it({
      id: "T04",
      title: "Should fail if signatories are out of order",
      test: async () => {
        const otherSignatories = [CHARLETH_ADDRESS, BALTATHAR_ADDRESS];
        const block = await context.createBlock(
          context
            .polkadotJs()
            .tx.multisig.asMulti(threshold, otherSignatories, null, encodedCall, {})
            .signAsync(alith),
          { allowFailures: true }
        );
        expect(block.result!.error!.name, "signatories (they are not sorted)").to.equal(
          "SignatoriesOutOfOrder"
        );
        expect(block.result!.successful).to.be.false;
      },
    });

    it({
      id: "T05",
      title: "Should fail if sender is present in signatories",
      test: async () => {
        // signatories (with sender in signatories)
        const otherSignatories = [ALITH_ADDRESS, BALTATHAR_ADDRESS];
        const block = await context.createBlock(
          context
            .polkadotJs()
            .tx.multisig.asMulti(threshold, otherSignatories, null, encodedCall, {})
            .signAsync(alith),
          { allowFailures: true }
        );
        expect(block.result!.error!.name).to.equal("SenderInSignatories");
        expect(block.result!.successful).to.be.false;
      },
    });
  },
});
