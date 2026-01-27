/**
 * Balance extrinsics tests
 * Adapted from Moonbeam test suite
 */

import { TransactionTypes, beforeAll, beforeEach, describeSuite, expect } from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  BALTATHAR_ADDRESS,
  GLMR,
  createRawTransfer,
  mapExtrinsics,
} from "@moonwall/util";
import type { PrivateKeyAccount } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

describeSuite({
  id: "D030204",
  title: "Balance - Extrinsic Events",
  foundationMethods: "dev",
  testCases: ({ context, log, it }) => {
    let randomAccount: PrivateKeyAccount;

    beforeAll(async function () {
      // To create the treasury account
      await context.createBlock(createRawTransfer(context, BALTATHAR_ADDRESS, 1337));
    });

    beforeEach(async function () {
      const privateKey = generatePrivateKey();
      randomAccount = privateKeyToAccount(privateKey);
    });

    for (const txnType of TransactionTypes) {
      it({
        id: `T0${TransactionTypes.indexOf(txnType) + 1}`,
        title: `should emit events for ${txnType} ethereum/transfers`,
        test: async function () {
          await context.createBlock(
            createRawTransfer(context, randomAccount.address, 1n * GLMR, {
              type: txnType,
              gas: 500000n,
            })
          );

          const signedBlock = await context.polkadotJs().rpc.chain.getBlock();
          const allRecords = await context.polkadotJs().query.system.events();
          const txsWithEvents = mapExtrinsics(signedBlock.block.extrinsics, allRecords);

          const ethTx = txsWithEvents.find(
            ({ extrinsic: { method } }) => method.section === "ethereum"
          )!;

          // Check key events are present
          const hasNewAccount = ethTx.events.some((e) =>
            context.polkadotJs().events.system.NewAccount.is(e)
          );
          const hasEndowed = ethTx.events.some((e) =>
            context.polkadotJs().events.balances.Endowed.is(e)
          );
          const hasTransfer = ethTx.events.some((e) =>
            context.polkadotJs().events.balances.Transfer.is(e)
          );
          const hasExecuted = ethTx.events.some((e) =>
            context.polkadotJs().events.ethereum.Executed.is(e)
          );
          const hasSuccess = ethTx.events.some((e) =>
            context.polkadotJs().events.system.ExtrinsicSuccess.is(e)
          );

          expect(hasNewAccount, "NewAccount event should be present").to.be.true;
          expect(hasEndowed, "Endowed event should be present").to.be.true;
          expect(hasTransfer, "Transfer event should be present").to.be.true;
          expect(hasExecuted, "Executed event should be present").to.be.true;
          expect(hasSuccess, "ExtrinsicSuccess event should be present").to.be.true;

          // Verify transfer event data
          const transferEvent = ethTx.events.find((e) =>
            context.polkadotJs().events.balances.Transfer.is(e)
          )!;
          expect(transferEvent.data[0].toString()).to.eq(ALITH_ADDRESS);
          expect(transferEvent.data[1].toString()).to.eq(randomAccount.address);
        },
      });
    }
  },
});
