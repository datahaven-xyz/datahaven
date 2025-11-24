import { describeSuite, expect } from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  BALTATHAR_ADDRESS,
  baltathar,
  DEFAULT_GENESIS_BALANCE
} from "@moonwall/util";

// A call from root (sudo) can make a transfer directly in pallet_evm
// A signed call cannot make a transfer directly in pallet_evm

describeSuite({
  id: "D021502",
  title: "Pallet EVM - call",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    it({
      id: "T01",
      title: "should fail without sudo",
      test: async () => {
        expect(
          await context
            .createBlock(
              context
                .polkadotJs()
                .tx.evm.call(
                  ALITH_ADDRESS,
                  BALTATHAR_ADDRESS,
                  "0x0",
                  100_000_000_000_000_000_000n,
                  12_000_000n,
                  1_000_000_000n,
                  "0",
                  null,
                  []
                )
            )
            .catch((e) => e.toString())
        ).to.equal("RpcError: 1010: Invalid Transaction: Transaction call is not expected");

        expect(await context.viem().getBalance({ address: baltathar.address })).to.equal(
          DEFAULT_GENESIS_BALANCE
        );
      }
    });

    it({
      id: "T02",
      title: "should succeed with sudo",
      test: async () => {
        const { result } = await context.createBlock(
          context
            .polkadotJs()
            .tx.sudo.sudo(
              context
                .polkadotJs()
                .tx.evm.call(
                  ALITH_ADDRESS,
                  baltathar.address,
                  "0x0",
                  100_000_000_000_000_000_000n,
                  12_000_000n,
                  100_000_000_000_000n,
                  "0",
                  null,
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
        expect(await context.viem().getBalance({ address: baltathar.address })).to.equal(
          DEFAULT_GENESIS_BALANCE + 100_000_000_000_000_000_000n
        );
      }
    });
  }
});
