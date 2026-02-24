import { describeSuite, expect } from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  DEFAULT_GENESIS_BALANCE,
  baltathar,
  generateKeyringPair,
} from "@moonwall/util";
import { ALITH_GENESIS_TRANSFERABLE_BALANCE, verifyLatestBlockFees } from "../../../../helpers";
import { CHARLETH_ADDRESS, ETHAN_ADDRESS } from "@moonwall/util";

describeSuite({
  id: "D023601",
  title: "Sudo - successful forceSetBalance",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    it({
      id: "T01",
      title: "should be able to call sudo with the right account",
      test: async function () {
        const { result } = await context.createBlock(
          context
            .polkadotJs()
            .tx.sudo.sudo(context.polkadotJs().tx.balances.forceSetBalance(ETHAN_ADDRESS, 0))
        );

        const account = await context.polkadotJs().query.system.account(ETHAN_ADDRESS);
        expect(account.data.free.toBigInt()).toBe(0n);

        // DataHaven has 1 more event (NewChallengeSeed) than Moonbeam,
        // coming from the StorageHub ProofsDealer pallet.
        expect(result!.events.length).to.eq(8);
        console.log(result!.events.map((e) => e.event.toHuman()));
        expect(context.polkadotJs().events.balances.BalanceSet.is(result!.events[3].event)).to.be
          .true;
        expect(context.polkadotJs().events.sudo.Sudid.is(result!.events[4].event)).to.be.true;
        expect(context.polkadotJs().events.balances.Deposit.is(result!.events[5].event)).to.be.true;
        expect(context.polkadotJs().events.system.ExtrinsicSuccess.is(result!.events[7].event)).to
          .be.true;

        expect(
          await context.viem().getBalance({ address: ALITH_ADDRESS }),
          "diff should be null for sudo - funds are sent back"
        ).to.equal(ALITH_GENESIS_TRANSFERABLE_BALANCE);
      },
    });

    it({
      id: "T02",
      title: "should charge the correct amount of gas when calling sudo",
      test: async function () {
        await context.createBlock(
          context
            .polkadotJs()
            .tx.sudo.sudo(
              context
                .polkadotJs()
                .tx.balances.forceSetBalance(CHARLETH_ADDRESS, DEFAULT_GENESIS_BALANCE)
            )
        );

        await verifyLatestBlockFees(context);
      },
    });

    it({
      id: "T03",
      title: "should NOT be able to call sudo with another account than sudo account",
      test: async function () {
        const baltathar_before = await context.polkadotJs().query.system.account(CHARLETH_ADDRESS);
        const { result } = await context.createBlock(
          context
            .polkadotJs()
            .tx.sudo.sudo(context.polkadotJs().tx.balances.forceSetBalance(CHARLETH_ADDRESS, 0))
            .signAsync(baltathar),
          { allowFailures: true }
        );

        // Check that balance didn't change
        const account = await context.polkadotJs().query.system.account(CHARLETH_ADDRESS);
        expect(account.data.free.toBigInt()).toBe(DEFAULT_GENESIS_BALANCE);

        expect(result!.events.length === 8).to.be.true;
        expect(context.polkadotJs().events.system.NewAccount.is(result!.events[3].event)).to.be
          .true;
        expect(context.polkadotJs().events.balances.Endowed.is(result!.events[4].event)).to.be.true;
        expect(context.polkadotJs().events.system.ExtrinsicFailed.is(result!.events[7].event)).to.be
          .true;
      },
    });

    it({
      id: "T04",
      title: "should not be able to call sudo with no funds",
      test: async function () {
        const newSigner = generateKeyringPair();

        await context.createBlock(context.polkadotJs().tx.sudo.setKey(newSigner.address), {
          allowFailures: false,
        });

        expect((await context.polkadotJs().query.sudo.key()).unwrap().toString()).toBe(
          newSigner.address
        );

        await expect(
          async () =>
            await context.createBlock(
              context
                .polkadotJs()
                .tx.sudo.sudo(context.polkadotJs().tx.balances.forceSetBalance(CHARLETH_ADDRESS, 0))
                .signAsync(newSigner)
            )
        ).rejects.toThrowError(
          "1010: Invalid Transaction: Inability to pay some fees , e.g. account balance too low"
        );

        expect(await context.viem().getBalance({ address: CHARLETH_ADDRESS })).to.equal(
          DEFAULT_GENESIS_BALANCE
        );
      },
    });
  },
});
