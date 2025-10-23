import {
  beforeAll,
  deployCreateCompiledContract,
  describeSuite,
  expect,
  TransactionTypes
} from "@moonwall/cli";
import { ConstantStore } from "../../../../helpers";

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
          const { hash, status } = await deployCreateCompiledContract(context, "MultiplyBy7", {
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
            deployCreateCompiledContract(context, "MultiplyBy7", {
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
        const { contractAddress, abi } = await deployCreateCompiledContract(
          context,
          "BlockVariables",
          {
            gas: 500_000n
          }
        );

        if (!contractAddress) {
          throw new Error("Expected deployed contract to have an address");
        }

        const gasLimit = await context.viem().readContract({
          address: contractAddress,
          abi,
          args: [],
          functionName: "getGasLimit"
        });

        expect(gasLimit).to.equal(ConstantStore(context).GAS_LIMIT.get(specVersion));
      }
    });
  }
});
