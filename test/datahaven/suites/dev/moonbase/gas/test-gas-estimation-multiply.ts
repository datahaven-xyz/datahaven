import { beforeAll, deployCreateCompiledContract, describeSuite, expect } from "@moonwall/cli";
import { ALITH_ADDRESS } from "@moonwall/util";
import type { Abi } from "viem";

describeSuite({
  id: "D021804",
  title: "Estimate Gas - Multiply",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let multiAbi: Abi;
    let multiAddress: `0x${string}`;

    beforeAll(async function () {
      const { abi, contractAddress } = await deployCreateCompiledContract(context, "MultiplyBy7");

      multiAbi = abi;
      multiAddress = contractAddress;
    });

    it({
      id: "T01",
      title: "should return correct gas estimation",
      test: async function () {
        const estimatedGas = await context.viem().estimateContractGas({
          account: ALITH_ADDRESS,
          abi: multiAbi,
          address: multiAddress,
          functionName: "multiply",
          maxPriorityFeePerGas: 0n,
          args: [3],
          value: 0n,
        });

        // Snapshot estimated gas
        expect(estimatedGas).toMatchInlineSnapshot(`22363n`);
      },
    });

    it({
      id: "T02",
      title: "should work without gas limit",
      test: async function () {
        const estimatedGas = await context.viem().estimateContractGas({
          account: ALITH_ADDRESS,
          abi: multiAbi,
          address: multiAddress,
          functionName: "multiply",
          maxPriorityFeePerGas: 0n,
          args: [3],
          //@ts-expect-error expected
          gasLimit: undefined,
          value: 0n,
        });

        // Snapshot estimated gas
        expect(estimatedGas).toMatchInlineSnapshot(`22363n`);
      },
    });

    it({
      id: "T03",
      title: "should work with gas limit",
      test: async function () {
        const estimatedGas = await context.viem().estimateContractGas({
          account: ALITH_ADDRESS,
          abi: multiAbi,
          address: multiAddress,
          functionName: "multiply",
          args: [3],
          // @ts-expect-error expected
          gasLimit: 22363n,
          value: 0n,
        });

        expect(estimatedGas).toMatchInlineSnapshot(`22363n`);
      },
    });

    it({
      id: "T04",
      title: "should ignore from balance (?)",
      test: async function () {
        const estimatedGas = await context.viem().estimateContractGas({
          account: "0x0000000000000000000000000000000000000000",
          abi: multiAbi,
          address: multiAddress,
          functionName: "multiply",
          maxPriorityFeePerGas: 0n,
          args: [3],
          // @ts-expect-error expected
          gasLimit: 22363n,
          value: 0n,
        });

        // Snapshot estimated gas
        expect(estimatedGas).toMatchInlineSnapshot(`22363n`);
      },
    });

    it({
      id: "T05",
      title: "should not work with a lower gas limit",
      test: async function () {
        await expect(
          async () =>
            await context.viem().estimateContractGas({
              account: "0x0000000000000000000000000000000000000000",
              abi: multiAbi,
              address: multiAddress,
              functionName: "multiply",
              maxPriorityFeePerGas: 0n,
              args: [3],
              gas: 21000n,
              value: 0n,
            })
        ).rejects.toThrowError("gas required exceeds allowance 21000");
      },
    });
  },
});
