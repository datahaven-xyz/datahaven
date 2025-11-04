import {
  type EthTransactionType,
  TransactionTypes,
  beforeAll,
  customDevRpcRequest,
  describeSuite,
  expect,
  fetchCompiledContract,
} from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  createEthersTransaction,
  faith,
  getAllCompiledContracts,
} from "@moonwall/util";
import { randomBytes } from "ethers";
import { encodeDeployData } from "viem";
import { expectEVMResult } from "../../../../helpers";

describeSuite({
  id: "D021802",
  title: "Estimate Gas - Multiply",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    const contractNames = getAllCompiledContracts("contracts/out", true);

    beforeAll(async function () {
      // Estimation for storage need to happen in a block > than genesis.
      // Otherwise contracts that uses block number as storage will remove instead of storing
      // (as block.number === H256::default).
      await context.createBlock();
    });

    it({
      id: "T01",
      title: "should have at least 1 contract to estimate",
      test: async function () {
        expect(contractNames).length.to.be.at.least(1);
      },
    });

    const calculateTestCaseNumber = (contractName: string, txnType: EthTransactionType) =>
      contractNames.indexOf(contractName) * TransactionTypes.length +
      TransactionTypes.indexOf(txnType) +
      2;

    for (const contractName of contractNames) {
      for (const txnType of TransactionTypes) {
        it({
          id: `T${calculateTestCaseNumber(contractName, txnType).toString().padStart(2, "0")}`,
          title: `should be enough for contract ${contractName} via ${txnType}`,
          test: async function () {
            const { bytecode, abi } = fetchCompiledContract(contractName);
            const constructorAbi = abi.find(
              (call) => call.type === "constructor"
            ) as AbiConstructor;
            // ask RPC for an gas estimate of deploying this contract

            const args = constructorAbi
              ? constructorAbi.inputs.map((input: { type: string }) => {
                  if (input.type === "bool") {
                    return true;
                  }

                  if (input.type === "address") {
                    return faith.address;
                  }

                  if (input.type.startsWith("uint")) {
                    const rest = input.type.split("uint")[1];
                    if (rest === "[]") {
                      return [];
                    }
                    const length = Number(rest) || 256;
                    return `0x${Buffer.from(randomBytes(length / 8)).toString("hex")}`;
                  }

                  if (input.type.startsWith("bytes")) {
                    const rest = input.type.split("bytes")[1];
                    if (rest === "[]") {
                      return [];
                    }
                    const length = Number(rest) || 1;
                    return `0x${Buffer.from(randomBytes(length)).toString("hex")}`;
                  }
                })
              : [];

            const callData = encodeDeployData({
              abi,
              args,
              bytecode,
            });

            let estimate: bigint;
            let creationResult: "Revert" | "Succeed";
            try {
              estimate = await customDevRpcRequest("eth_estimateGas", [
                {
                  from: ALITH_ADDRESS,
                  data: callData,
                },
              ]);
              creationResult = "Succeed";
            } catch (e: any) {
              if (e.message === "VM Exception while processing transaction: revert") {
                estimate = 12_000_000n;
                creationResult = "Revert";
              } else {
                throw e;
              }
            }

            // attempt a transaction with our estimated gas
            const rawSigned = await createEthersTransaction(context, {
              data: callData,
              gasLimit: estimate,
              txnType,
            });
            const { result } = await context.createBlock(rawSigned);
            const receipt = await context
              .viem("public")
              .getTransactionReceipt({ hash: result!.hash as `0x${string}` });

            expectEVMResult(result!.events, creationResult);
            expect(receipt.status === "success").to.equal(creationResult === "Succeed");
          },
        });
      }
    }
  },
});
