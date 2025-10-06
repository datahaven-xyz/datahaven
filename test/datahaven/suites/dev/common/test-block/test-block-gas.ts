import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import { ConstantStore, deployCompiledContract, TransactionTypes } from "../../../../helpers";

describeSuite({
  id: "D010103",
  title: "Block gas limits",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    let specVersion: number;

    beforeAll(async () => {
      specVersion = (await context.polkadotJs().runtimeVersion.specVersion).toNumber();
    });

    for (const txnType of TransactionTypes) {
      it({
        id: `T0${TransactionTypes.indexOf(txnType) + 1}`,
        title: `${txnType} should be allowed to the max block gas`,
        test: async () => {
          const { hash, status } = await deployCompiledContract(context, "MultiplyBy7", {
            type: txnType,
            gas: ConstantStore(context).EXTRINSIC_GAS_LIMIT.get(specVersion)
          });
          expect(status).toBe("success");
          const receipt = await context.viem().getTransactionReceipt({ hash });
          expect(receipt.blockHash).toBeTruthy();
        }
      });

      it({
        id: `T0${TransactionTypes.indexOf(txnType) * 2 + 1}`,
        title: `${txnType} should fail setting it over the max block gas`,
        test: async () => {
          await expect(async () =>
            deployCompiledContract(context, "MultiplyBy7", {
              type: txnType,
              gas: ConstantStore(context).EXTRINSIC_GAS_LIMIT.get(specVersion) + 1n
            })
          ).rejects.toThrowError();
        }
      });
    }

    it({
      id: "T07",
      title: "should be accessible within a contract",
      test: async () => {
        const { contractAddress, abi } = await deployCompiledContract(context, "BlockVariables", {
          gas: 500_000n
        });

        const gasLimit = await context.viem().readContract({
          address: contractAddress!,
          abi,
          args: [],
          functionName: "getGasLimit"
        });

        expect(gasLimit).to.equal(ConstantStore(context).GAS_LIMIT.get(specVersion));
      }
    });
  }
});
