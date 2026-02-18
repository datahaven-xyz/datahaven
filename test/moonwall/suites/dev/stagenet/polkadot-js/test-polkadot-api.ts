import { describeSuite, expect } from "@moonwall/cli";
import { ALITH_ADDRESS, GLMR, generateKeyringPair } from "@moonwall/util";

describeSuite({
  id: "D022501",
  title: "Polkadot API",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "should return genesis block",
      test: async function () {
        const lastHeader = await context.polkadotJs().rpc.chain.getHeader();
        expect(Number(lastHeader.number) >= 0).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "should return latest header number",
      test: async function () {
        await context.createBlock();
        const lastHeader = await context.polkadotJs().rpc.chain.getHeader();
        expect(lastHeader.number.toNumber()).to.be.at.least(1);
      },
    });

    it({
      id: "T03",
      title: "transfers should be stored on chain",
      test: async function () {
        const randomAddress = generateKeyringPair().address as `0x${string}`;
        await context.createBlock(
          context.polkadotJs().tx.balances.transferAllowDeath(randomAddress, 2n * GLMR)
        );

        expect(BigInt(await context.viem().getBalance({ address: randomAddress }))).to.equal(
          2n * GLMR
        );
      },
    });

    it({
      id: "T04",
      title: "should appear in extrinsics",
      test: async function () {
        const randomAddress = generateKeyringPair().address as `0x${string}`;
        await context.createBlock(
          context.polkadotJs().tx.balances.transferAllowDeath(randomAddress, 2n * GLMR)
        );
        const signedBlock = await context.polkadotJs().rpc.chain.getBlock();

        // Expecting 3 extrinsics so far:
        // timestamp, author, the parachain validation data, randomness, and the balances transfer.
        expect(signedBlock.block.extrinsics).to.be.of.length(3);

        signedBlock.block.extrinsics.forEach((ex, index) => {
          const {
            method: { args, method, section },
          } = ex;
          const message = `${section}.${method}(${args.map((a) => a.toString()).join(", ")})`;

          switch (index) {
            case 0:
              expect(message.substring(0, 13)).to.eq(`timestamp.set`);
              break;
            case 1:
              expect(message.toLocaleLowerCase()).to.match(/^randomness\.setbaberandomness/);
              break;
            case 2:
              expect(message).to.eq(
                `balances.transferAllowDeath(${randomAddress}, 2000000000000000000)`
              );
              expect(ex.signer.toString()).to.eq(ALITH_ADDRESS);
              break;
            default:
              throw new Error(`Unexpected extrinsic: ${message}`);
          }
        });
      },
    });

    it({
      id: "T05",
      title: "should appear in events",
      test: async function () {
        // Generating two transfers to ensure treasury account exists
        const randomAddress = generateKeyringPair().address as `0x${string}`;
        await context.createBlock(
          context.polkadotJs().tx.balances.transferAllowDeath(randomAddress, 2n * GLMR)
        );

        const randomAddress2 = generateKeyringPair().address as `0x${string}`;
        await context.createBlock(
          context.polkadotJs().tx.balances.transferAllowDeath(randomAddress2, 2n * GLMR)
        );
        const signedBlock = await context.polkadotJs().rpc.chain.getBlock();
        const apiAt = await context.polkadotJs().at(signedBlock.block.header.hash);
        const allRecords = await apiAt.query.system.events();

        // map between the extrinsics and events
        signedBlock.block.extrinsics.forEach((_, index) => {
          // filter the specific events based on the phase and then the
          // index of our extrinsic in the block
          const events = allRecords
            .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index))
            .map(({ event }) => event);

          switch (index) {
            // First 2 events:
            // timestamp.set:: system.ExtrinsicSuccess
            // randomness.setBabeRandomness:: system.ExtrinsicSuccess
            case 0:
            case 1:
              expect(events).to.be.of.length(1);
              expect(context.polkadotJs().events.system.ExtrinsicSuccess.is(events[0])).to.be.true;
              break;
            // balances.transferAllowDeath emits: system.NewAccount, balances.Endowed,
            // balances.Transfer, (other events), system.ExtrinsicSuccess
            case 2:
              log(events.map((e) => `${e.section}.${e.method}`).join(" - "));
              expect(events.length).to.be.at.least(7);
              expect(events.some((e) => context.polkadotJs().events.system.NewAccount.is(e))).to.be
                .true;
              expect(events.some((e) => context.polkadotJs().events.balances.Endowed.is(e))).to.be
                .true;
              expect(events.some((e) => context.polkadotJs().events.balances.Transfer.is(e))).to.be
                .true;
              // ExtrinsicSuccess should be the last event
              expect(
                context.polkadotJs().events.system.ExtrinsicSuccess.is(events[events.length - 1])
              ).to.be.true;
              break;
            default:
              throw new Error(`Unexpected extrinsic`);
          }
        });
      },
    });
  },
});
