import "@moonbeam-network/api-augment";
import { beforeEach, describeSuite, expect } from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  CHARLETH_ADDRESS,
  BALTATHAR_ADDRESS,
  BALTATHAR_PRIVATE_KEY,
  CHARLETH_PRIVATE_KEY,
  GERALD_PRIVATE_KEY,
  GLMR,
  checkBalance,
  createViemTransaction,
  createRawTransfer,
  generateKeyringPair,
  sendRawTransaction,
} from "@moonwall/util";
import {
  ALITH_GENESIS_TRANSFERABLE_BALANCE,
  ConstantStore,
  verifyLatestBlockFees,
} from "../../../../helpers";

import { parseGwei } from "viem";

describeSuite({
  id: "D030202",
  title: "Balance Transfers",
  foundationMethods: "dev",
  testCases: ({ context, log, it }) => {
    let randomAddress: `0x${string}`;
    let GENESIS_BASE_FEE;

    beforeEach(async function () {
      const randomAccount = generateKeyringPair();
      randomAddress = randomAccount.address as `0x${string}`;
      const { specVersion } = await context.polkadotJs().consts.system.version;
      GENESIS_BASE_FEE = ConstantStore(context).GENESIS_BASE_FEE.get(specVersion.toNumber());
    });

    it({
      id: "T01",
      title: "should cost 21000 gas for a transfer",
      test: async function () {
        const estimatedGas = await context.viem().estimateGas({
          account: ALITH_ADDRESS,
          value: 0n * GLMR,
          to: randomAddress,
        });
        expect(estimatedGas, "Estimated bal transfer incorrect").toBe(21000n);

        await context.createBlock(createRawTransfer(context, randomAddress, 0n));
        expect(await context.viem().getBalance({ address: ALITH_ADDRESS })).toBe(
          ALITH_GENESIS_TRANSFERABLE_BALANCE - 21000n * GENESIS_BASE_FEE
        );
      },
    });

    it({
      id: "T02",
      title: "unsent txns should be in pending",
      test: async function () {
        await context.createBlock();
        const rawTx = (await createRawTransfer(context, randomAddress, 512n, {
          privateKey: CHARLETH_PRIVATE_KEY,
          gasPrice: GENESIS_BASE_FEE,
          gas: 21000n,
          txnType: "legacy",
        })) as `0x${string}`;
        await sendRawTransaction(context, rawTx);

        expect(
          await context.viem().getBalance({ address: randomAddress, blockTag: "pending" })
        ).toBe(512n);
      },
    });

    it({
      id: "T03",
      title: "should decrease from account",
      test: async function () {
        const balanceBefore = await context.viem().getBalance({ address: CHARLETH_ADDRESS });
        const fees = 21000n * GENESIS_BASE_FEE;
        await context.createBlock(
          await createRawTransfer(context, randomAddress, 512n, {
            gas: 21000n,
            gasPrice: GENESIS_BASE_FEE,
            txnType: "legacy",
            privateKey: CHARLETH_PRIVATE_KEY,
          })
        );
        const balanceAfter = await context.viem().getBalance({ address: CHARLETH_ADDRESS });
        expect(balanceBefore - balanceAfter - fees).toBe(512n);
      },
    });

    it({
      id: "T04",
      title: "should increase to account",
      test: async function () {
        const balanceBefore = await checkBalance(context, randomAddress);

        await context.createBlock(
          await createRawTransfer(context, randomAddress, 512n, {
            gas: 21000n,
            gasPrice: GENESIS_BASE_FEE,
            type: "legacy",
          })
        );
        const balanceAfter = await checkBalance(context, randomAddress);
        expect(balanceBefore).toBe(0n);
        expect(balanceAfter).toBe(512n);
      },
    });

    it({
      id: "T05",
      title: "should reflect balance identically on polkadot/web3",
      test: async function () {
        await context.createBlock(
          await createRawTransfer(context, randomAddress, 512n, {
            gas: 21000n,
            gasPrice: GENESIS_BASE_FEE,
            type: "legacy",
          })
        );

        const blockNumber = (
          await context.polkadotJs().rpc.chain.getBlock()
        ).block.header.number.toBigInt();

        const block1Hash = await context.polkadotJs().rpc.chain.getBlockHash(blockNumber);
        const balance = await (await context.polkadotJs().at(block1Hash)).query.system.account(
          ALITH_ADDRESS
        );

        expect(await context.viem().getBalance({ blockNumber, address: ALITH_ADDRESS })).to.equal(
          balance.data.free.toBigInt() +
            balance.data.reserved.toBigInt() -
            balance.data.frozen.toBigInt()
        );
      },
    });

    it({
      id: "T06",
      title: "should check latest block fees",
      test: async function () {
        await context.createBlock(
          await createRawTransfer(context, randomAddress, 512n, {
            gas: 21000n,
            gasPrice: GENESIS_BASE_FEE,
            type: "legacy",
          })
        );

        await verifyLatestBlockFees(context, BigInt(512));
      },
    });

    it({
      id: "T07",
      title: "multiple transfer should be successful",
      test: async function () {
        const { result } = await context.createBlock([
          await createRawTransfer(context, randomAddress, 10n * GLMR, {
            privateKey: GERALD_PRIVATE_KEY,
            nonce: 0,
          }),
          await createRawTransfer(context, randomAddress, 10n * GLMR, {
            privateKey: GERALD_PRIVATE_KEY,
            nonce: 1,
          }),
          await createRawTransfer(context, randomAddress, 10n * GLMR, {
            privateKey: GERALD_PRIVATE_KEY,
            nonce: 2,
          }),
          await createRawTransfer(context, randomAddress, 10n * GLMR, {
            privateKey: GERALD_PRIVATE_KEY,
            nonce: 3,
          }),
          await createRawTransfer(context, randomAddress, 10n * GLMR, {
            privateKey: GERALD_PRIVATE_KEY,
            nonce: 4,
          }),
        ]);

        expect((result as any).filter((r: any) => r.successful)).to.be.length(5);
      },
    });

    it({
      id: "T08",
      title: "should handle max_fee_per_gas",
      test: async function () {
        const balanceBefore = await checkBalance(context, CHARLETH_ADDRESS);
        await context.createBlock(
          await createRawTransfer(context, randomAddress, 1n * GLMR, {
            gas: 21000n,
            maxFeePerGas: GENESIS_BASE_FEE,
            maxPriorityFeePerGas: parseGwei("0.2"),
            gasPrice: GENESIS_BASE_FEE,
            type: "eip1559",
            privateKey: CHARLETH_PRIVATE_KEY,
          })
        );
        const balanceAfter = await checkBalance(context, CHARLETH_ADDRESS);
        const fee = 21000n * GENESIS_BASE_FEE;

        expect(balanceAfter + fee + 1n * GLMR).toBe(balanceBefore);
      },
    });

    it({
      id: "T09",
      title: "should use partial max_priority_fee_per_gas",
      test: async function () {
        // With this configuration only half of the priority fee will be used,
        // as the max_fee_per_gas is 2GWEI and the base fee is 1GWEI.
        const accountData = (await context.polkadotJs().query.system.account(BALTATHAR_ADDRESS))
          .data;
        const freeBal = accountData.free.toBigInt() - accountData.reserved.toBigInt();
        const maxFeePerGas = 10_000_000_000n * 2n;
        await context.createBlock(
          await createViemTransaction(context, {
            privateKey: BALTATHAR_PRIVATE_KEY,
            gas: 21000n,
            to: randomAddress,
            data: "0x",
            maxFeePerGas,
            maxPriorityFeePerGas: maxFeePerGas,
            type: "eip1559",
          })
        );
        const balanceAfter = await checkBalance(context, BALTATHAR_ADDRESS);
        const fee = 21_000n * maxFeePerGas;
        expect(freeBal - balanceAfter - fee).toBe(0n);
      },
    });
  },
});
