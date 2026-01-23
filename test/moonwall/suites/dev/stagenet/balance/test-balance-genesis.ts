import "@moonbeam-network/api-augment";
import { expect, describeSuite } from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  ALITH_GENESIS_FREE_BALANCE,
  ALITH_GENESIS_RESERVE_BALANCE,
} from "@moonwall/util";
import { ALITH_GENESIS_TRANSFERABLE_BALANCE } from "../../../../helpers";

describeSuite({
  id: "D030201",
  title: "Balance genesis",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    it({
      id: "T01",
      title: "should be accessible through web3",
      test: async function () {
        expect(await context.viem().getBalance({ address: ALITH_ADDRESS })).toBe(
          ALITH_GENESIS_TRANSFERABLE_BALANCE
        );
      },
    });

    it({
      id: "T02",
      title: "should be accessible through polkadotJs",
      test: async function () {
        const genesisHash = await context.polkadotJs().rpc.chain.getBlockHash(0);
        const account = await (await context.polkadotJs().at(genesisHash)).query.system.account(
          ALITH_ADDRESS
        );
        expect(account.data.free.toBigInt()).toBe(ALITH_GENESIS_FREE_BALANCE);
        expect(account.data.reserved.toBigInt()).toBe(ALITH_GENESIS_RESERVE_BALANCE);
      },
    });
  },
});
