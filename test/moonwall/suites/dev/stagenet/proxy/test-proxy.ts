import { beforeEach, describeSuite, expect } from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  CHARLETH_ADDRESS,
  type KeyringPair,
  alith,
  generateKeyringPair,
} from "@moonwall/util";

// In these tests Alith will allow signer to perform calls on her behalf.
// Charleth is used as a target account when making transfers.

describeSuite({
  id: "D022902",
  title: "Proxy - proxy",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let signer: KeyringPair;

    beforeEach(async () => {
      signer = generateKeyringPair("ethereum");

      await context.createBlock(
        context.polkadotJs().tx.balances.transferAllowDeath(signer.address, 5n * 10n ** 18n)
      );
    });

    it({
      id: "T01",
      title: "shouldn't accept unknown proxy",
      test: async function () {
        const beforeCharlethBalance = await context
          .viem()
          .getBalance({ address: CHARLETH_ADDRESS });

        const expectEvents = [context.polkadotJs().events.system.ExtrinsicFailed];

        await context.createBlock(
          context
            .polkadotJs()
            .tx.proxy.proxy(
              ALITH_ADDRESS,
              null,
              context.polkadotJs().tx.balances.transferAllowDeath(CHARLETH_ADDRESS, 100)
            )
            .signAsync(signer),
          { expectEvents, signer: alith, allowFailures: true }
        );
        const afterCharlethBalance = await context.viem().getBalance({ address: CHARLETH_ADDRESS });
        expect(afterCharlethBalance - beforeCharlethBalance).to.be.eq(0n);
      },
    });

    it({
      id: "T02",
      title: "should accept known proxy",
      test: async () => {
        const beforeCharlethBalance = await context
          .viem()
          .getBalance({ address: CHARLETH_ADDRESS });

        const events1 = [
          context.polkadotJs().events.system.ExtrinsicSuccess,
          context.polkadotJs().events.proxy.ProxyAdded,
        ];

        const { result } = await context.createBlock(
          context.polkadotJs().tx.proxy.addProxy(signer.address, "Any", 0),
          { signer: alith, expectEvents: events1 }
        );
        const proxyAdded = result?.events.find(({ event }) =>
          context.polkadotJs().events.proxy.ProxyAdded.is(event)
        );
        expect(proxyAdded).to.not.be.undefined;
        expect(proxyAdded!.event.data[2].toString()).to.be.eq("Any"); //ProxyType

        const events2 = [
          context.polkadotJs().events.system.ExtrinsicSuccess,
          context.polkadotJs().events.proxy.ProxyExecuted,
        ];

        const { result: result2 } = await context.createBlock(
          context
            .polkadotJs()
            .tx.proxy.proxy(
              alith.address,
              null,
              context.polkadotJs().tx.balances.transferAllowDeath(CHARLETH_ADDRESS, 100)
            )
            .signAsync(signer),
          { signer: alith, expectEvents: events2 }
        );
        const proxyExecuted = result2?.events.find(({ event }) =>
          context.polkadotJs().events.proxy.ProxyExecuted.is(event)
        );
        expect(proxyExecuted).to.not.be.undefined;
        expect(proxyExecuted!.event.data[0].toString()).to.be.eq("Ok");
        const afterCharlethBalance = await context.viem().getBalance({ address: CHARLETH_ADDRESS });
        expect(afterCharlethBalance - beforeCharlethBalance).to.be.eq(100n);
      },
    });

    it({
      id: "T03",
      title: "shouldn't accept removed proxy",
      test: async () => {
        const beforeCharlethBalance = await context
          .viem()
          .getBalance({ address: CHARLETH_ADDRESS });

        await context.createBlock(
          context.polkadotJs().tx.proxy.addProxy(signer.address, "Any", 0),
          { signer: alith, allowFailures: false }
        );

        await context.createBlock(
          context.polkadotJs().tx.proxy.removeProxy(signer.address, "Any", 0),
          { signer: alith, allowFailures: false }
        );

        await context.createBlock(
          context
            .polkadotJs()
            .tx.proxy.proxy(
              alith.address,
              null,
              context.polkadotJs().tx.balances.transferAllowDeath(CHARLETH_ADDRESS, 100)
            ),
          { signer: alith, expectEvents: [context.polkadotJs().events.system.ExtrinsicFailed] }
        );
        const afterCharlethBalance = await context.viem().getBalance({ address: CHARLETH_ADDRESS });
        expect(afterCharlethBalance - beforeCharlethBalance).to.be.eq(0n);
      },
    });

    it({
      id: "T04",
      title: "shouldn't accept instant for delayed proxy",
      test: async () => {
        const beforeCharlethBalance = await context
          .viem()
          .getBalance({ address: CHARLETH_ADDRESS });

        await context.createBlock(
          context.polkadotJs().tx.proxy.addProxy(signer.address, "Any", 2),
          { signer: alith, allowFailures: false }
        );

        await context.createBlock(
          context
            .polkadotJs()
            .tx.proxy.proxy(
              alith.address,
              null,
              context.polkadotJs().tx.balances.transferAllowDeath(CHARLETH_ADDRESS, 100)
            )
            .signAsync(signer),
          { signer: alith, expectEvents: [context.polkadotJs().events.system.ExtrinsicFailed] }
        );
        const afterCharlethBalance = await context.viem().getBalance({ address: CHARLETH_ADDRESS });
        expect(afterCharlethBalance - beforeCharlethBalance).to.be.eq(0n);
      },
    });

    it({
      id: "T05",
      title: "shouldn't accept instant for delayed proxy",
      test: async () => {
        const beforeCharlethBalance = await context
          .viem()
          .getBalance({ address: CHARLETH_ADDRESS });

        await context.createBlock(
          context.polkadotJs().tx.proxy.addProxy(signer.address, "Any", 2),
          {
            signer: alith,
            allowFailures: false,
          }
        );

        await context.createBlock(
          context
            .polkadotJs()
            .tx.proxy.proxy(
              alith.address,
              null,
              context.polkadotJs().tx.balances.transferAllowDeath(CHARLETH_ADDRESS, 100)
            )
            .signAsync(signer),
          {
            signer: alith,
            expectEvents: [context.polkadotJs().events.system.ExtrinsicFailed],
          }
        );
        const afterCharlethBalance = await context.viem().getBalance({ address: CHARLETH_ADDRESS });
        expect(afterCharlethBalance - beforeCharlethBalance).to.be.eq(0n);
      },
    });

    it({
      id: "T06",
      title: "shouldn't accept early delayed proxy",
      test: async () => {
        const beforeCharlethBalance = await context
          .viem()
          .getBalance({ address: CHARLETH_ADDRESS });
        const { result } = await context.createBlock(
          context.polkadotJs().tx.proxy.addProxy(signer.address, "Any", 6),
          { signer: alith, allowFailures: false }
        );
        result?.events.forEach(({ event }) => log(`1${event.method}(${event.data})`));

        const transfer = context.polkadotJs().tx.balances.transferAllowDeath(CHARLETH_ADDRESS, 100);

        const { result: result2 } = await context.createBlock(
          context.polkadotJs().tx.proxy.announce(alith.address, transfer.hash).signAsync(signer),
          {
            signer: alith,
            expectEvents: [context.polkadotJs().events.proxy.Announced],
            allowFailures: false,
          }
        );
        result2?.events.forEach(({ event }) => log(`2${event.method}(${event.data})`));

        const { result: result3 } = await context.createBlock(
          context
            .polkadotJs()
            .tx.proxy.proxyAnnounced(signer.address, alith.address, null, transfer)
            .signAsync(signer),
          {
            signer: alith,
            expectEvents: [context.polkadotJs().events.system.ExtrinsicFailed],
          }
        );
        result3?.events.forEach(({ event }) => log(`3${event.method}(${event.data})`));
        const afterCharlethBalance = await context.viem().getBalance({ address: CHARLETH_ADDRESS });
        expect(afterCharlethBalance - beforeCharlethBalance).to.be.eq(0n);
      },
    });

    it({
      id: "T07",
      title: "should accept on-time delayed proxy ",
      test: async () => {
        const beforeCharlethBalance = await context
          .viem()
          .getBalance({ address: CHARLETH_ADDRESS });
        await context.createBlock(
          context.polkadotJs().tx.proxy.addProxy(signer.address, "Any", 2),
          { signer: alith, allowFailures: false }
        );

        const transfer = context.polkadotJs().tx.balances.transferAllowDeath(CHARLETH_ADDRESS, 100);
        const u8a = transfer.method.toU8a();
        const transfer_hash = transfer.registry.hash(u8a).toHex();

        const { result: result2 } = await context.createBlock(
          context.polkadotJs().tx.proxy.announce(alith.address, transfer_hash).signAsync(signer),
          {
            signer: alith,
            expectEvents: [context.polkadotJs().events.proxy.Announced],
            allowFailures: false,
          }
        );
        const announced = result2?.events.find(({ event }) =>
          context.polkadotJs().events.proxy.Announced.is(event)
        );
        expect(announced).to.not.be.undefined;
        expect(announced!.event.data[2].toHex()).to.eq(transfer_hash);

        await context.createBlock();
        await context.createBlock();

        // On time.
        const { result: result3 } = await context.createBlock(
          context
            .polkadotJs()
            .tx.proxy.proxyAnnounced(signer.address, alith.address, null, transfer)
            .signAsync(signer),
          {
            signer: alith,
            expectEvents: [context.polkadotJs().events.proxy.ProxyExecuted],
            allowFailures: false,
          }
        );
        const afterCharlethBalance = await context.viem().getBalance({ address: CHARLETH_ADDRESS });
        expect(afterCharlethBalance - beforeCharlethBalance).to.be.eq(100n);
      },
    });
  },
});
