import { describeSuite, expect, fetchCompiledContract, TransactionTypes } from "@moonwall/cli";
import { encodeDeployData } from "viem";
import { getTransactionReceiptWithRetry } from "../../../../helpers/eth-transactions";

describeSuite({
  id: "D020505",
  title: "Fibonacci",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    for (const txnType of TransactionTypes) {
      it({
        id: `T0${TransactionTypes.indexOf(txnType) + 1}`,
        title: "should be able to call fibonacci",
        test: async () => {
          //TODO: replace this with txnType deploy fn when available
          const { abi, bytecode } = fetchCompiledContract("Fibonacci");
          const data = encodeDeployData({
            abi,
            bytecode
          });

          const { result } = await context.createBlock(
            context.createTxn!({
              data,
              txnType,
              libraryType: "ethers",
              gasLimit: 260_000n
            })
          );

          const contractAddress = (
            await context.viem().getTransactionReceipt({ hash: result!.hash as `0x${string}` })
          ).contractAddress!;

          expect(
            await context.readContract!({
              contractName: "Fibonacci",
              contractAddress,
              functionName: "fib2",
              args: [0]
            })
          ).toBe(0n);
          expect(
            await context.readContract!({
              contractName: "Fibonacci",
              contractAddress,
              functionName: "fib2",
              args: [1]
            })
          ).toBe(1n);
          expect(
            await context.readContract!({
              contractName: "Fibonacci",
              contractAddress,
              functionName: "fib2",
              args: [2]
            })
          ).toBe(1n);
          expect(
            await context.readContract!({
              contractName: "Fibonacci",
              contractAddress,
              functionName: "fib2",
              args: [3]
            })
          ).toBe(2n);
          expect(
            await context.readContract!({
              contractName: "Fibonacci",
              contractAddress,
              functionName: "fib2",
              args: [4]
            })
          ).toBe(3n);
          expect(
            await context.readContract!({
              contractName: "Fibonacci",
              contractAddress,
              functionName: "fib2",
              args: [5]
            })
          ).toBe(5n);
          expect(
            await context.readContract!({
              contractName: "Fibonacci",
              contractAddress,
              functionName: "fib2",
              args: [20]
            })
          ).toBe(6765n);

          // the largest Fib number supportable by a uint256 is 370.
          // actual value:
          // 94611056096305838013295371573764256526437182762229865607320618320601813254535
          expect(
            await context.readContract!({
              contractName: "Fibonacci",
              contractAddress,
              functionName: "fib2",
              args: [370]
            })
          ).toBe(94611056096305838013295371573764256526437182762229865607320618320601813254535n);
        }
      });

      it({
        id: `T0${TransactionTypes.indexOf(txnType) + 4}`,
        title: "should be able to call fibonacci[370] in txn",
        test: async () => {
          //TODO: replace this with txnType deploy fn when available
          const { abi, bytecode } = fetchCompiledContract("Fibonacci");
          const data = encodeDeployData({
            abi,
            bytecode
          });

          const { result } = await context.createBlock(
            context.createTxn!({
              data,
              txnType,
              libraryType: "ethers"
            })
          );

          const receipt1 = await getTransactionReceiptWithRetry(
            context,
            result!.hash as `0x${string}`
          );
          const contractAddress = receipt1.contractAddress!;

          const hash = await context.writeContract!({
            contractName: "Fibonacci",
            contractAddress,
            functionName: "fib2",
            args: [370],
            value: 0n
          });

          await context.createBlock();
          const receipt2 = await getTransactionReceiptWithRetry(context, hash as `0x${string}`);
          expect(receipt2.status).toBe("success");
        }
      });
    }
  }
});
