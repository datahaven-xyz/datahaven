import { describeSuite, expect } from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  CHARLETH_ADDRESS,
  baltathar,
} from "@moonwall/util";

describeSuite({
  id: "D010502",
  title: "Proxy: Balances",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "should accept known proxy",
      test: async () => {
        const beforeCharlieBalance = await context.viem().getBalance({ address: CHARLETH_ADDRESS });
        const { result } = await context.createBlock(
          context.polkadotJs().tx.proxy.addProxy(baltathar.address, "Balances" as any, 0)
        );
        const proxyAdded = result!.events.find(
          ({ event }) => event.method === "ProxyAdded"
        );
        expect(proxyAdded).to.not.be.undefined;
        expect(proxyAdded!.event.data[2].toString()).to.be.eq("Balances"); //ProxyType
        expect(result!.events.some(({ event }) => event.method === "ExtrinsicSuccess")).to.be.true;

        const { result: result2 } = await context.createBlock(
          context
            .polkadotJs()
            .tx.proxy.proxy(
              ALITH_ADDRESS,
              null,
              context.polkadotJs().tx.balances.transferAllowDeath(CHARLETH_ADDRESS, 100)
            )
            .signAsync(baltathar)
        );

        const proxyExecuted = result2!.events.find(
          ({ event }) => event.method === "ProxyExecuted"
        );
        expect(proxyExecuted).to.not.be.undefined;
        expect(proxyExecuted!.event.data[0].toString()).to.be.eq("Ok");
        expect(result2!.events.some(({ event }) => event.method === "ExtrinsicSuccess")).to.be
          .true;
        const afterCharlieBalance = await context.viem().getBalance({ address: CHARLETH_ADDRESS });
        expect(afterCharlieBalance - beforeCharlieBalance).to.be.eq(100n);
      },
    });

    it({
      id: "T02",
      title: "shouldn't accept other proxy types",
      test: async () => {
        await context.createBlock(
          context.polkadotJs().tx.proxy.addProxy(baltathar.address, "Balances", 0)
        );

        const { result } = await context.createBlock(
          context
            .polkadotJs()
            .tx.proxy.proxy(
              ALITH_ADDRESS,
              null,
              context.polkadotJs().tx.system.remark("0x")
            )
            .signAsync(baltathar)
        );

        const proxyExecuted = result!.events.find(
          ({ event }) => event.method === "ProxyExecuted"
        );
        expect(proxyExecuted).to.not.be.undefined;
        // Balances proxy type should not allow system.remark
        expect(proxyExecuted!.event.data[0].toString()).to.not.be.eq("Ok");
        expect(result!.events.some(({ event }) => event.method === "ExtrinsicSuccess")).to.be.true;
      },
    });
  },
});
