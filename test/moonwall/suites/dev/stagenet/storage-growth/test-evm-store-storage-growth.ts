// TODO: Constants (storage growth ratios, limits) may need adjustment for DataHaven's runtime configuration
import {
  TransactionTypes,
  beforeAll,
  deployCreateCompiledContract,
  describeSuite,
} from "@moonwall/cli";
import { createEthersTransaction } from "@moonwall/util";
import { expectEVMResult, expectOk } from "../../../../helpers";
import { type Abi, encodeFunctionData } from "viem";

describeSuite({
  id: "D023403",
  title: "Storage growth limit - New Entries",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let storageLoopAddress: `0x${string}`;
    let storageLoopAbi: Abi;
    // Number of bytes added to storage for a new entry.
    const ACCOUNT_STORAGE_SIZE = 116;
    // Ratio of gas to storage growth. (BlockGasLimit (15_000_000) / BlockStorageLimit (40kb))
    const GAS_LIMIT_STORAGE_GROWTH_RATIO = 366;
    beforeAll(async () => {
      const { contractAddress, abi } = await deployCreateCompiledContract(context, "StorageLoop");
      storageLoopAddress = contractAddress;
      storageLoopAbi = abi;

      await context.createBlock();
    });

    for (const txnType of TransactionTypes) {
      it({
        id: `T0${TransactionTypes.indexOf(txnType) + 1}`,
        title: "should out of gas when gas provided is not enough to cover storage growth",
        test: async function () {
          // Tx is creating 5 new storage entries. So, required gas is:
          // (5 * ACCOUNT_STORAGE_SIZE) * GAS_LIMIT_STORAGE_GROWTH_RATIO = 212_280
          // Execute tx with insufficient gas limit
          const rawSigned = await createEthersTransaction(context, {
            to: storageLoopAddress,
            data: encodeFunctionData({
              abi: storageLoopAbi,
              functionName: "store",
              // for each transaction type, we add 5 new storage entries
              args: [5 + 5 * TransactionTypes.indexOf(txnType)],
            }),
            gasLimit: 212_270,
          });

          const { result } = await context.createBlock(rawSigned);
          // Check that the transaction failed with an out of gas error
          expectEVMResult(result!.events, "Error", "OutOfGas");
        },
      });

      it({
        id: `T0${TransactionTypes.indexOf(txnType) + 4}`,
        title: "should successfully execute when updating existing storage entries (no growth)",
        test: async function () {
          // Update 5 existing storage entries. So, required gas should be less than 212_280
          const rawSigned = await createEthersTransaction(context, {
            to: storageLoopAddress,
            data: encodeFunctionData({
              abi: storageLoopAbi,
              functionName: "store",
              args: [5],
            }),
            gasLimit: 50_000,
          });

          await expectOk(context.createBlock(rawSigned));
        },
      });
    }
  },
});
