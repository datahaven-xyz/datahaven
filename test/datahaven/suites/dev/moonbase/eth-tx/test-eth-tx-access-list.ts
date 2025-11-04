import { beforeAll, deployCreateCompiledContract, describeSuite, expect } from "@moonwall/cli";
import { createViemTransaction } from "@moonwall/util";
import { error } from "node:console";

describeSuite({
  id: "D021301",
  title: "Ethereum Transaction - Access List",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    let data;
    let helper;
    let helperProxy;

    beforeAll(async () => {
      helper = await deployCreateCompiledContract(context, "AccessListHelper");
      helperProxy = await deployCreateCompiledContract(context, "AccessListHelperProxy", {
        args: [helper.contractAddress],
      });
    });

    it({
      id: "T01",
      title: "after the 4th one, additional storage keys should cost 1900 gas",
      test: async function () {
        const keys = generateSequentialStorageKeys(100);

        interface Results {
          keys: number;
          size: number;
          gasWithAL: bigint;
        }

        const cases = Array.from({ length: 100 }, (_, i) => i + 1);

        const results: Results[] = [];

        for (const n of cases) {
          const txWithAL = await createViemTransaction(context, {
            to: helperProxy.contractAddress,
            data: data,
            gas: 1000000n,
            accessList: [
              {
                address: helper.contractAddress,
                storageKeys: keys.slice(0, n),
              },
            ],
          });

          await context.createBlock(txWithAL);
          const block = await context.viem().getBlock();
          const receipt = await context
            .viem()
            .getTransactionReceipt({ hash: block.transactions[0] as `0x${string}` });
          const gasCostWithAL = receipt.gasUsed;
          const txSize = txWithAL.length;

          results.push({
            keys: n,
            size: txSize,
            gasWithAL: gasCostWithAL,
          });
        }

        results.forEach((result, index) => {
          const diff = index === 0 ? "" : result.gasWithAL - results[index - 1].gasWithAL;
          if (result.keys > 4) {
            expect(
              diff,
              `Expected gas did not match when including ${result.keys} storage keys`
            ).toBe(1900n);
          }
        });
      },
    });

    it({
      id: "T02",
      title: "after the 4th one, additional addresses should cost 2400 gas",
      test: async function () {
        const addresses = randomAddresses(100);

        interface Results {
          addresses: number;
          size: number;
          gasWithAL: bigint;
        }

        interface Address {
          address: `0x${string}`;
          storageKeys: `0x${string}`[];
        }

        const cases = Array.from({ length: 100 }, (_, i) => i + 1);

        const results: Results[] = [];

        for (const n of cases) {
          const accessList: Address[] = [];
          for (let i = 0; i < n; i++) {
            accessList.push({
              address: addresses[i],
              storageKeys: [],
            });
          }

          const txWithAL = await createViemTransaction(context, {
            to: helperProxy.contractAddress,
            data: data,
            gas: 1000000n,
            accessList,
          });

          await context.createBlock(txWithAL);
          const block = await context.viem().getBlock();
          const receipt = await context
            .viem()
            .getTransactionReceipt({ hash: block.transactions[0] as `0x${string}` });
          const gasCostWithAL = receipt.gasUsed;
          const txSize = txWithAL.length;

          results.push({
            addresses: n,
            size: txSize,
            gasWithAL: gasCostWithAL,
          });
        }

        results.forEach((result, index) => {
          const diff = index === 0 ? 0n : result.gasWithAL - results[index - 1].gasWithAL;
          if (result.addresses > 4) {
            expect(
              diff,
              `Expected gas did not match when including ${result.addresses} addresses`
            ).toBe(2400n);
          }
        });
      },
    });

    it({
      id: "T03",
      title: "transaction should not be gossiped if it exceeds the gas limit",
      test: async function () {
        const keys = generateSequentialStorageKeys(100);

        const bigTxWithAL = await createViemTransaction(context, {
          to: helperProxy.contractAddress,
          data: data,
          gas: 100000000n,
          accessList: [
            {
              address: helper.contractAddress,
              storageKeys: keys,
            },
          ],
        });

        try {
          await context.viem().sendRawTransaction({ serializedTransaction: bigTxWithAL });
          error("Transaction should not have been gossiped");
        } catch (e) {
          expect(e.message).toContain("exceeds block gas limit");
        }
      },
    });
  },
});

function generateSequentialStorageKeys(n: number): `0x${string}`[] {
  const keys: `0x${string}`[] = [];
  for (let i = 0; i < n; i++) {
    keys.push(`0x${i.toString().padStart(64, "0")}`);
  }
  return keys;
}

function randomAddresses(n: number): `0x${string}`[] {
  const addresses: `0x${string}`[] = [];
  for (let i = 0; i < n; i++) {
    let current = "0x";
    for (let j = 0; j < 40; j++) {
      current += Math.floor(Math.random() * 16).toString(16);
    }
    addresses.push(current as `0x${string}`);
  }
  return addresses;
}
