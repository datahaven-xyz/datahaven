import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { ALITH_ADDRESS } from "@moonwall/util";
import { type Abi, encodeFunctionData } from "viem";

describeSuite({
  id: "D020508",
  title: "Contract creation",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    let multiplyAddress: `0x${string}`;
    let multiplyAbi: Abi;
    let deployHash: `0x${string}`;

    beforeAll(async () => {
      const { contractAddress, abi, hash } = await context.deployContract!("MultiplyBy7");

      multiplyAddress = contractAddress;
      multiplyAbi = abi;
      deployHash = hash;
    });

    // TODO: Re-enable when viem add txntype support for call method
    // for (const txnType of TransactionTypes) {

    it({
      id: "T01",
      title: "should appear in the block transaction list",
      test: async () => {
        const block = await context.viem().getBlock();
        const txHash = block.transactions[0];
        expect(txHash).toBe(deployHash);
      }
    });

    it({
      id: "T02",
      title: "should be in the transaction list",
      test: async () => {
        const tx = await context.viem().getTransaction({ hash: deployHash });
        expect(tx.hash).to.equal(deployHash);
      }
    });

    it({
      id: "T03",
      title: "should provide callable methods",
      test: async () => {
        expect(
          await context.readContract!({
            contractName: "MultiplyBy7",
            contractAddress: multiplyAddress,
            functionName: "multiply",
            args: [3]
          })
          // multiplyContract.read.multiply([3])
        ).toBe(21n);
      }
    });

    it({
      id: "T04",
      title: "should fail for call method with missing parameters",
      test: async () => {
        await expect(
          async () =>
            await context.viem().call({
              account: ALITH_ADDRESS as `0x${string}`,
              to: multiplyAddress,
              data: encodeFunctionData({
                abi: [{ ...multiplyAbi[0], inputs: [] }],
                functionName: "multiply",
                args: []
              })
            }),
          "Execution succeeded but should have failed"
        ).rejects.toThrowError("VM Exception while processing transaction: revert");
      }
    });

    it({
      id: "T05",
      title: "should fail for too many parameters",
      test: async () => {
        await expect(
          async () =>
            await context.viem().call({
              account: ALITH_ADDRESS as `0x${string}`,
              to: multiplyAddress,
              data: encodeFunctionData({
                abi: [
                  {
                    ...multiplyAbi[0],
                    inputs: [
                      { internalType: "uint256", name: "a", type: "uint256" },
                      { internalType: "uint256", name: "b", type: "uint256" }
                    ]
                  }
                ],
                functionName: "multiply",
                args: [3, 4]
              })
            }),
          "Execution succeeded but should have failed"
        ).rejects.toThrowError("VM Exception while processing transaction: revert");
      }
    });

    it({
      id: "T06",
      title: "should fail for invalid parameters",
      test: async () => {
        await expect(
          async () =>
            await context.viem().call({
              account: ALITH_ADDRESS as `0x${string}`,
              to: multiplyAddress,
              data: encodeFunctionData({
                abi: [
                  {
                    ...multiplyAbi[0],
                    inputs: [
                      {
                        internalType: "address",
                        name: "a",
                        type: "address"
                      }
                    ]
                  }
                ],
                functionName: "multiply",
                args: ["0x0123456789012345678901234567890123456789"]
              })
            }),
          "Execution succeeded but should have failed"
        ).rejects.toThrowError("VM Exception while processing transaction: revert");
      }
    });
  }
});
