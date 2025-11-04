import { describeSuite, expect, customDevRpcRequest } from "@moonwall/cli";
import {
  createRawTransfer,
  BALTATHAR_ADDRESS,
  BALTATHAR_PRIVATE_KEY,
  CHARLETH_ADDRESS,
  CHARLETH_PRIVATE_KEY,
} from "@moonwall/util";
import { parseGwei } from "viem";

describeSuite({
  id: "D021204",
  title: "Ethereum RPC - eth_pendingTransactions",
  foundationMethods: "dev",
  testCases: ({ it, context }) => {
    const TEST_ACCOUNT = "0x1111111111111111111111111111111111111111";

    // Helper function to get pending transactions
    async function getPendingTransactions() {
      return await customDevRpcRequest("eth_pendingTransactions", []);
    }

    // Helper function to identify future transactions (nonce > current account nonce)
    async function getFutureTransactions(accountAddress: `0x${string}`) {
      const currentNonce = BigInt(
        await context.viem().getTransactionCount({
          address: accountAddress,
        })
      );

      const pendingTxs = await getPendingTransactions();
      return pendingTxs.filter(
        (tx) =>
          tx.from.toLowerCase() === accountAddress.toLowerCase() && BigInt(tx.nonce) > currentNonce
      );
    }

    // Helper function to wait for a condition with retries
    async function waitForCondition(params: {
      checkFn: () => Promise<boolean>;
      maxRetries?: number;
      interval?: number;
      errorMsg: string;
    }): Promise<void> {
      const { checkFn, maxRetries = 5, interval = 1000, errorMsg } = params;
      let lastError: Error | null = null;

      for (let i = 0; i < maxRetries; i++) {
        try {
          if (await checkFn()) {
            return;
          }
        } catch (error) {
          lastError = error as Error;
        }

        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      }

      throw new Error(`${errorMsg}${lastError ? `: ${lastError.message}` : ""}`);
    }

    it({
      id: "T01",
      title: "should return empty array when no transactions are pending",
      test: async function () {
        // Create a block to clear any pending transactions
        await context.createBlock();

        // Wait for transaction pool to be empty
        await waitForCondition({
          checkFn: async () => (await getPendingTransactions()).length === 0,
          errorMsg: "Transaction pool was not empty after block creation",
        });

        const pendingTransactions = await getPendingTransactions();
        expect(pendingTransactions).toHaveLength(0);
      },
    });

    it({
      id: "T02",
      title: "should return all pending transactions",
      test: async function () {
        // Create a block to clear any pending transactions
        await context.createBlock();

        // Ensure transaction pool is empty before starting test
        await waitForCondition({
          checkFn: async () => (await getPendingTransactions()).length === 0,
          errorMsg: "Transaction pool was not empty at the start of test",
        });

        const initialNonce = BigInt(
          await context.viem().getTransactionCount({
            address: BALTATHAR_ADDRESS,
          })
        );

        const readyTransactionCount = 3;
        const futureTransactionCount = 2;

        const allTxHashes: `0x${string}`[] = [];
        const futureNonces: bigint[] = [];

        // Submit ready transactions with sequential nonces
        for (let i = 0; i < readyTransactionCount; i++) {
          const currentNonce = initialNonce + BigInt(i);
          const tx = await createRawTransfer(context, TEST_ACCOUNT, 1, {
            nonce: Number(currentNonce),
            privateKey: BALTATHAR_PRIVATE_KEY,
          });
          const hash = await context.viem().sendRawTransaction({ serializedTransaction: tx });
          allTxHashes.push(hash);
        }

        // Submit future transactions with gaps in nonces
        for (let i = 0; i < futureTransactionCount; i++) {
          const gapSize = BigInt(i * 2 + 1);
          const futureNonce = initialNonce + BigInt(readyTransactionCount) + gapSize;
          futureNonces.push(futureNonce);

          const tx = await createRawTransfer(context, TEST_ACCOUNT, 1, {
            nonce: Number(futureNonce),
            privateKey: BALTATHAR_PRIVATE_KEY,
          });
          const hash = await context.viem().sendRawTransaction({ serializedTransaction: tx });
          allTxHashes.push(hash);
        }

        const expectedPoolSize = readyTransactionCount + futureTransactionCount;

        // Verify that all transactions are in the pending pool
        await waitForCondition({
          checkFn: async () => {
            const pendingTxs = await getPendingTransactions();
            return (
              pendingTxs.length === expectedPoolSize &&
              allTxHashes.every((hash) => pendingTxs.some((tx) => tx.hash === hash))
            );
          },
          errorMsg: "Not all transactions appeared in the pending pool",
        });

        // Create a block which should process ready transactions
        await context.createBlock();

        // Verify that only future transactions remain in the pool
        await waitForCondition({
          checkFn: async () => {
            const futureTxs = await getFutureTransactions(BALTATHAR_ADDRESS);
            return futureTxs.length === futureTransactionCount;
          },
          errorMsg: "Future transactions count doesn't match expected count after block creation",
        });

        // Get future transactions after block creation
        const expectedFutureTxs = await getFutureTransactions(BALTATHAR_ADDRESS);
        expect(expectedFutureTxs.length).toBe(futureTransactionCount);

        // Submit a transaction that is now ready (with current nonce)
        const nonceAfterBlock1 = BigInt(
          await context.viem().getTransactionCount({
            address: BALTATHAR_ADDRESS,
          })
        );

        const nextReadyTx = await createRawTransfer(context, TEST_ACCOUNT, 1, {
          nonce: Number(nonceAfterBlock1),
          privateKey: BALTATHAR_PRIVATE_KEY,
        });
        const nextReadyTxHash = await context.viem().sendRawTransaction({
          serializedTransaction: nextReadyTx,
        });

        // Verify pool contains the new ready tx + previous future txs
        await waitForCondition({
          checkFn: async () => {
            const pendingTxs = await getPendingTransactions();
            const futureTxs = await getFutureTransactions(BALTATHAR_ADDRESS);

            return (
              pendingTxs.length === futureTxs.length + 1 && // +1 for the ready tx
              pendingTxs.some((tx) => tx.hash === nextReadyTxHash)
            );
          },
          errorMsg:
            "Transaction pool doesn't contain expected transactions after adding next ready transaction",
        });

        // Create another block which should process the ready transaction
        await context.createBlock();

        // Verify the ready transaction was included in the block
        const latestBlock = await context.viem().getBlock({ blockTag: "latest" });
        expect(latestBlock.transactions).toContain(nextReadyTxHash);

        // Verify only future transactions remain in the pool
        const finalFutureTxs = await getFutureTransactions(BALTATHAR_ADDRESS);

        // The current account nonce has increased, so some previously "future" transactions
        // may now be eligible for processing. We need to check the actual count.
        const currentAccountNonce = BigInt(
          await context.viem().getTransactionCount({
            address: BALTATHAR_ADDRESS,
          })
        );
        const expectedRemainingCount = futureNonces.filter(
          (nonce) => nonce > currentAccountNonce
        ).length;

        expect(finalFutureTxs).toHaveLength(expectedRemainingCount);
        expect(finalFutureTxs.some((tx) => tx.hash === nextReadyTxHash)).toBe(false);

        // Verify nonces of remaining future transactions
        finalFutureTxs.forEach((tx) => {
          const txNonce = BigInt(tx.nonce);
          expect(txNonce).toBeGreaterThan(currentAccountNonce);
          expect(futureNonces).toContain(txNonce);
        });
      },
    });

    it({
      id: "T03",
      title: "should include transaction details in pending transactions",
      test: async function () {
        const TEST_ACCOUNT_SENDER = CHARLETH_ADDRESS;
        const TEST_ACCOUNT_SENDER_KEY = CHARLETH_PRIVATE_KEY;

        // Create a block to clear any pending transactions for this account (not from other accounts)
        await context.createBlock();

        // Get current nonce for the test account
        const nonce = await context.viem().getTransactionCount({
          address: TEST_ACCOUNT_SENDER,
        });

        // Submit a transaction with specific values
        const txValue = 1n;
        const tx = await createRawTransfer(context, TEST_ACCOUNT, 1, {
          nonce: nonce,
          privateKey: TEST_ACCOUNT_SENDER_KEY,
        });
        const hash = await context.viem().sendRawTransaction({ serializedTransaction: tx });

        // Wait for the transaction to appear in the pending pool
        await waitForCondition({
          checkFn: async () => {
            const pendingTxs = await getPendingTransactions();
            return pendingTxs.some((tx) => tx.hash === hash);
          },
          errorMsg: "Transaction did not appear in the pending pool",
        });

        // Get pending transactions
        const pendingTransactions = await getPendingTransactions();

        // Find our transaction
        const pendingTx = pendingTransactions.find((tx) => tx.hash === hash);
        expect(pendingTx).toBeDefined();

        // Check transaction details
        if (pendingTx) {
          expect(pendingTx.from.toLowerCase()).toBe(TEST_ACCOUNT_SENDER.toLowerCase());
          expect(pendingTx.to.toLowerCase()).toBe(TEST_ACCOUNT.toLowerCase());
          expect(BigInt(pendingTx.value)).toBe(txValue);
          expect(Number(pendingTx.nonce)).toBe(Number(nonce));
          expect(pendingTx.hash).toBe(hash);
          expect(pendingTx.input).toBeDefined();
        }
      },
    });
  },
});
