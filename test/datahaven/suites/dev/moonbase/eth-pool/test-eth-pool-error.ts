import { afterEach, beforeAll, customDevRpcRequest, describeSuite, expect } from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  BALTATHAR_ADDRESS,
  CHARLETH_ADDRESS,
  CHARLETH_PRIVATE_KEY,
  createEthersTransaction,
  createRawTransfer,
  DOROTHY_ADDRESS,
  GLMR,
  GOLIATH_ADDRESS,
  GOLIATH_PRIVATE_KEY,
  sendRawTransaction
} from "@moonwall/util";
import { parseGwei } from "viem";
import { ALITH_GENESIS_TRANSFERABLE_BALANCE, ConstantStore } from "../../../../helpers";

describeSuite({
  id: "D021102",
  title: "Ethereum Rpc pool errors",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    beforeAll(async () => {
      await context.createBlock(await createRawTransfer(context, BALTATHAR_ADDRESS, 3n));
    });

    afterEach(async () => {
      await context.createBlock();
    });

    it({
      id: "T01",
      title: "already known #1",
      test: async () => {
        const tx = (await createRawTransfer(context, BALTATHAR_ADDRESS, 1)) as `0x${string}`;
        await sendRawTransaction(context, tx);

        await expect(async () => await sendRawTransaction(context, tx)).rejects.toThrowError(
          "already known"
        );
      }
    });

    it({
      id: "T02",
      title: "replacement transaction underpriced",
      test: async () => {
        const nonce = await context.viem().getTransactionCount({ address: ALITH_ADDRESS });

        const tx1 = await createEthersTransaction(context, {
          to: CHARLETH_ADDRESS,
          nonce,
          gasPrice: parseGwei("15"),
          value: 100,
          txnType: "legacy"
        });

        await customDevRpcRequest("eth_sendRawTransaction", [tx1]);

        const tx2 = await createEthersTransaction(context, {
          to: DOROTHY_ADDRESS,
          nonce,
          value: 200,
          gasPrice: parseGwei("10"),
          txnType: "legacy"
        });

        await expect(
          async () => await customDevRpcRequest("eth_sendRawTransaction", [tx2])
        ).rejects.toThrowError("replacement transaction underpriced");
      }
    });

    it({
      id: "T03",
      title: "nonce too low",
      test: async () => {
        const nonce = await context.viem().getTransactionCount({ address: CHARLETH_ADDRESS });
        const tx1 = await context.createTxn!({
          to: BALTATHAR_ADDRESS,
          value: 1n,
          nonce,
          privateKey: CHARLETH_PRIVATE_KEY
        });
        await context.createBlock(tx1);

        const tx2 = await context.createTxn!({
          to: DOROTHY_ADDRESS,
          value: 2n,
          nonce: Math.max(nonce - 1, 0),
          privateKey: CHARLETH_PRIVATE_KEY
        });
        await expect(
          async () => await customDevRpcRequest("eth_sendRawTransaction", [tx2]),
          "tx should be rejected for duplicate nonce"
        ).rejects.toThrowError("nonce too low");
      }
    });

    it({
      id: "T04",
      title: "already known #2",
      test: async () => {
        const { specVersion } = await context.polkadotJs().consts.system.version;
        const GENESIS_BASE_FEE = ConstantStore(context).GENESIS_BASE_FEE.get(
          specVersion.toNumber()
        );

        const nonce = await context
          .viem("public")
          .getTransactionCount({ address: GOLIATH_ADDRESS });

        const tx1 = await createRawTransfer(context, BALTATHAR_ADDRESS, 1, {
          nonce: nonce + 1,
          gasPrice: GENESIS_BASE_FEE,
          privateKey: GOLIATH_PRIVATE_KEY
        });
        await context.createBlock(tx1);

        await expect(
          async () => await customDevRpcRequest("eth_sendRawTransaction", [tx1])
        ).rejects.toThrowError("already known");
      }
    });

    it({
      id: "T05",
      title: "insufficient funds for gas * price + value",
      test: async () => {
        const ZEROED_PKEY = "0xbf2a9f29a7631116a1128e34fcf8817581fb3ec159ef2be004b459bc33f2ed2d";
        const tx = await createRawTransfer(context, BALTATHAR_ADDRESS, 1, {
          privateKey: ZEROED_PKEY
        });

        await expect(
          async () => await customDevRpcRequest("eth_sendRawTransaction", [tx])
        ).rejects.toThrowError("insufficient funds for gas * price + value");
      }
    });

    it({
      id: "T06",
      title: "exceeds block gas limit",
      test: async () => {
        const tx = await createRawTransfer(context, BALTATHAR_ADDRESS, 1, {
          gas: 1_000_000_0000n
        });

        await expect(
          async () => await customDevRpcRequest("eth_sendRawTransaction", [tx])
        ).rejects.toThrowError("exceeds block gas limit");
      }
    });

    it({
      id: "T07",
      title: "insufficient funds for gas * price + value",
      test: async () => {
        const CHARLETH_GENESIS_TRANSFERABLE_BALANCE =
          ALITH_GENESIS_TRANSFERABLE_BALANCE + 1000n * GLMR + 10n * 100_000_000_000_000n;
        const amount = CHARLETH_GENESIS_TRANSFERABLE_BALANCE - 21000n * 10_000_000_000n + 1n;
        const tx = await createRawTransfer(context, BALTATHAR_ADDRESS, amount, {
          privateKey: CHARLETH_PRIVATE_KEY
        });

        await expect(
          async () => await customDevRpcRequest("eth_sendRawTransaction", [tx])
        ).rejects.toThrowError("insufficient funds for gas * price + value");
      }
    });

    it({
      id: "T08",
      title: "max priority fee per gas higher than max fee per gast",
      modifier: "skip", // client libraries block invalid txns like this
      test: async () => {
        const tx = await createRawTransfer(context, BALTATHAR_ADDRESS, 1n, {
          maxFeePerGas: 100_000_000_000n,
          maxPriorityFeePerGas: 200_000_000_000n
        });

        await expect(
          async () => await customDevRpcRequest("eth_sendRawTransaction", [tx])
        ).rejects.toThrowError("max priority fee per gas higher than max fee per gas");
      }
    });
  }
});
