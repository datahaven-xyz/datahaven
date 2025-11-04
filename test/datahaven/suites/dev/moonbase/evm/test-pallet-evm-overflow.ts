import { describeSuite, expect } from "@moonwall/cli";
import { ALITH_ADDRESS, GLMR, generateKeyringPair } from "@moonwall/util";

// A call from root (sudo) can make a transfer directly in pallet_evm
// A signed call cannot make a transfer directly in pallet_evm

describeSuite({
  id: "D021501",
  title: "Pallet EVM - Transfering",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    const randomAddress = generateKeyringPair().address as string;
    it({
      id: "T01",
      title: "should not overflow",
      test: async function () {
        const { result } = await context.createBlock(
          context
            .polkadotJs()
            .tx.sudo.sudo(
              context
                .polkadotJs()
                .tx.evm.call(
                  ALITH_ADDRESS,
                  randomAddress,
                  "0x0",
                  `0x${(5n * GLMR + 2n ** 128n).toString(16)}`,
                  "0x5209",
                  1_000_000_000n,
                  "0",
                  null,
                  [],
                  []
                )
            )
        );

        expect(
          result?.events.find(
            ({ event: { section, method } }) =>
              section === "system" && method === "ExtrinsicSuccess"
          )
        ).to.exist;

        const account = await context.polkadotJs().query.system.account(randomAddress);
        expect(account.data.free.toBigInt()).to.equal(0n);
        expect(account.data.reserved.toBigInt()).to.equal(0n);
      },
    });
  },
});
