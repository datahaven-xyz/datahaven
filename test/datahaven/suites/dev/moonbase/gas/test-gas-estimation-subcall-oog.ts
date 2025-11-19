import {
  beforeAll,
  deployCreateCompiledContract,
  describeSuite,
  expect,
} from "@moonwall/cli";
import { ALITH_ADDRESS } from "@moonwall/util";
import { type Abi, decodeEventLog, encodeFunctionData } from "viem";
import { deployContract } from "../../../../helpers/contracts";

describeSuite({
  id: "D021805",
  title: "Estimate Gas - subCall",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    let looperAddress: `0x${string}`;
    let subCallOogAbi: Abi;
    let subCallOogAddress: `0x${string}`;

    const bloatedContracts: string[] = [];
    const MAX_BLOATED_CONTRACTS = 15;

    beforeAll(async () => {
      const { contractAddress: contractAddress2 } = await deployCreateCompiledContract(
        context,
        "Looper"
      );
      looperAddress = contractAddress2;

      const { abi, contractAddress: contractAddress3 } = await deployCreateCompiledContract(
        context,
        "SubCallOOG"
      );
      subCallOogAbi = abi;
      subCallOogAddress = contractAddress3;

      // Deploy bloated contracts (test won't use more than what is needed for reaching max pov)
      for (let i = 0; i <= MAX_BLOATED_CONTRACTS; i++) {
        const { contractAddress } = await deployContract(context as any, "BloatedContract");
        bloatedContracts.push(contractAddress);
        await context.createBlock();
      }
    });

    it({
      id: "T01",
      title: "gas estimation should make subcall OOG",
      test: async () => {
        const estimatedGas = await context.viem().estimateContractGas({
          account: ALITH_ADDRESS,
          abi: subCallOogAbi,
          address: subCallOogAddress,
          functionName: "subCallLooper",
          maxPriorityFeePerGas: 0n,
          args: [looperAddress, 999],
          value: 0n
        });

        const txHash = await context.viem().sendTransaction({
          to: subCallOogAddress,
          data: encodeFunctionData({
            abi: subCallOogAbi,
            functionName: "subCallLooper",
            args: [looperAddress, 999]
          }),
          txnType: "eip1559",
          gasLimit: estimatedGas
        });

        await context.createBlock();

        const receipt = await context.viem().getTransactionReceipt({ hash: txHash });

        const decoded = decodeEventLog({
          abi: subCallOogAbi,
          data: receipt.logs[0].data,
          topics: receipt.logs[0].topics
        }) as any;

        expect(decoded.eventName).to.equal("SubCallFail");
      }
    });

    it({
      id: "T02",
      title: "gas estimation should make pov-consuming subcall succeed",
      test: async () => {
        const estimatedGas = await context.viem().estimateContractGas({
          account: ALITH_ADDRESS,
          abi: subCallOogAbi,
          address: subCallOogAddress,
          functionName: "subCallPov",
          maxPriorityFeePerGas: 0n,
          args: [bloatedContracts],
          value: 0n
        });

        log(`Estimated gas: ${estimatedGas}`);

        const txHash = await context.viem().sendTransaction({
          to: subCallOogAddress,
          data: encodeFunctionData({
            abi: subCallOogAbi,
            functionName: "subCallPov",
            args: [bloatedContracts]
          }),
          txnType: "eip1559",
          gasLimit: estimatedGas
        });

        await context.createBlock();

        const receipt = await context.viem().getTransactionReceipt({ hash: txHash });
        const decoded = decodeEventLog({
          abi: subCallOogAbi,
          data: receipt.logs[bloatedContracts.length - 1].data,
          topics: receipt.logs[bloatedContracts.length - 1].topics
        }) as any;
        expect(decoded.eventName).to.equal("SubCallSucceed");
      }
    });
  }
});
