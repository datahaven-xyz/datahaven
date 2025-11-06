import {
  customDevRpcRequest,
  deployCreateCompiledContract,
  describeSuite,
  expect,
  fetchCompiledContract,
} from "@moonwall/cli";
import { ALITH_ADDRESS, PRECOMPILE_BATCH_ADDRESS } from "@moonwall/util";
import { encodeFunctionData } from "viem";

describeSuite({
  id: "D021803",
  title: "Estimate Gas - Contract estimation",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    it({
      id: `T01`,
      title: `evm should return invalid opcode`,
      test: async function () {
        await expect(
          async () =>
            await customDevRpcRequest("eth_estimateGas", [
              {
                from: ALITH_ADDRESS,
                data: "0xe4",
              },
            ]),
        ).rejects.toThrowError("evm error: InvalidCode(Opcode(228))");
      },
    });

    it({
      id: "T02",
      title: "eth_estimateGas 0x0 gasPrice is equivalent to not setting one",
      test: async function () {
        const { bytecode } = fetchCompiledContract("Incrementor");

        const result = await context.viem().estimateGas({
          account: ALITH_ADDRESS,
          data: bytecode,
          gasPrice: 0n,
        });
        expect(result).to.equal(234240n);

        const result2 = await context.viem().estimateGas({
          account: ALITH_ADDRESS,
          data: bytecode,
        });
        expect(result2).to.equal(234240n);
      },
    });

    it({
      id: "T03",
      title: "all batch functions should estimate the same cost",
      test: async function () {
        const { contractAddress: proxyAddress, abi: proxyAbi } =
          await deployCreateCompiledContract(context, "CallForwarder");
        const { contractAddress: multiAddress, abi: multiAbi } =
          await deployCreateCompiledContract(context, "MultiplyBy7");
        const batchAbi = fetchCompiledContract("Batch").abi;

        const callParameters = [
          [proxyAddress, proxyAddress],
          [],
          [
            encodeFunctionData({
              abi: proxyAbi,
              functionName: "call",
              args: [
                multiAddress,
                encodeFunctionData({
                  abi: multiAbi,
                  functionName: "multiply",
                  args: [42],
                }),
              ],
            }),
            encodeFunctionData({
              abi: proxyAbi,
              functionName: "delegateCall",
              args: [
                multiAddress,
                encodeFunctionData({
                  abi: multiAbi,
                  functionName: "multiply",
                  args: [42],
                }),
              ],
            }),
          ],
          [],
        ];

        const batchSomeGas = await context.viem().estimateGas({
          account: ALITH_ADDRESS,
          to: PRECOMPILE_BATCH_ADDRESS,
          data: encodeFunctionData({
            abi: batchAbi,
            functionName: "batchSome",
            args: callParameters,
          }),
        });

        const batchSomeUntilFailureGas = await context.viem().estimateGas({
          account: ALITH_ADDRESS,
          to: PRECOMPILE_BATCH_ADDRESS,
          data: encodeFunctionData({
            abi: batchAbi,
            functionName: "batchSomeUntilFailure",
            args: callParameters,
          }),
        });

        const batchAllGas = await context.viem().estimateGas({
          account: ALITH_ADDRESS,
          to: PRECOMPILE_BATCH_ADDRESS,
          data: encodeFunctionData({
            abi: batchAbi,
            functionName: "batchAll",
            args: callParameters,
          }),
        });

        expect(batchSomeGas).to.be.eq(batchAllGas);
        expect(batchSomeUntilFailureGas).to.be.eq(batchAllGas);
      },
    });

    it({
      id: "T04",
      title: "Non-transactional calls allowed from e.g. precompile address",
      test: async function () {
        const { bytecode } = fetchCompiledContract("MultiplyBy7");
        expect(
          await context.viem().estimateGas({
            account: PRECOMPILE_BATCH_ADDRESS,
            data: bytecode,
          }),
        ).toBe(210450n);
      },
    });

    it({
      id: "T05",
      title: "Should be able to estimate gas of infinite loop call",
      timeout: 60000,
      test: async function () {
        const { contractAddress, abi } = await deployCreateCompiledContract(
          context,
          "Looper",
        );

        await expect(
          async () =>
            await customDevRpcRequest("eth_estimateGas", [
              {
                from: ALITH_ADDRESS,
                to: contractAddress,
                data: encodeFunctionData({
                  abi: abi,
                  functionName: "infinite",
                  args: [],
                }),
              },
            ]),
        ).rejects.toThrowError("gas required exceeds allowance 6000000");
      },
    });
  },
});
