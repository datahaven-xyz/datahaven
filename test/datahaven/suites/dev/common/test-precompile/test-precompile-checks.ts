import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { encodeFunctionData } from "viem";
import { deployedContractsInLatestBlock, expectEVMResult } from "../../../../helpers";

describeSuite({
  id: "D010313",
  title: "Precompiles - Validate PrecompileChecks",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    let multiplyBy7Contract: any;

    beforeAll(async () => {
      // Test setup
      multiplyBy7Contract = await context.deployContract!("MultiplyBy7");

      expect(await deployedContractsInLatestBlock(context)).toContain(
        multiplyBy7Contract.contractAddress
      );
    });

    it({
      id: "T01",
      title: `Validate "CallableByContract" by calling precompile from smart-contract constructor`,
      test: async function () {
        await context.deployContract!("CallBatchPrecompileFromConstructor", {
          gas: 5_000_000n,
          rawTxOnly: true,
          args: [
            multiplyBy7Contract.contractAddress,
            [
              encodeFunctionData({
                abi: multiplyBy7Contract.abi,
                functionName: "multiply",
                args: [5],
              }),
            ],
          ],
        });

        const ethEvent = (await context.polkadotJs().query.system.events()).find(({ event }) =>
          context.polkadotJs().events.ethereum.Executed.is(event)
        );
        expect((ethEvent!.toHuman() as any).event["data"]["exitReason"]["Revert"]).toBe(
          "Reverted"
        );
      },
    });

    it({
      id: "T02",
      title: `Validate "CallableByContract" by calling precompile from smart-contract constructor originated by a subcall`,
      test: async function () {
        const contract = await context.deployContract!(
          "CallBatchPrecompileFromConstructorInSubCall",
          {
            gas: 5_000_000n,
            rawTxOnly: true,
          }
        );
        expect(await deployedContractsInLatestBlock(context)).toContain(contract.contractAddress);

        await expect(
          async () =>
            await context.writeContract!({
              contractName: "CallBatchPrecompileFromConstructorInSubCall",
              contractAddress: contract.contractAddress,
              functionName: "simple",
              args: [
                multiplyBy7Contract.contractAddress,
                [
                  encodeFunctionData({
                    abi: multiplyBy7Contract.abi,
                    functionName: "multiply",
                    args: [5],
                  }),
                ],
              ],
            })
        ).rejects.toThrow("Function not callable by smart contracts");
      },
    });
  },
});

