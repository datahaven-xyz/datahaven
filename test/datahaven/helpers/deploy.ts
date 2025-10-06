import type { Abi } from "viem";
import { fetchCompiledContract } from "./contracts";

export const TransactionTypes = ["legacy", "eip1559", "eip2930"] as const;

export interface DeployCompiledContractOptions {
  type?: (typeof TransactionTypes)[number];
  gas?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  value?: bigint;
}

export interface DeployCompiledContractResult {
  hash: `0x${string}`;
  contractAddress: `0x${string}` | null;
  status: "success" | "reverted";
  abi: Abi;
}

export const deployCompiledContract = async (
  context: any,
  contractName: string,
  options: DeployCompiledContractOptions = {}
): Promise<DeployCompiledContractResult> => {
  const artifact = await fetchCompiledContract(contractName);

  const tx: any = {
    data: artifact.bytecode,
    gas: options.gas,
    value: options.value ?? 0n
  };

  switch (options.type) {
    case "legacy":
      tx.type = "legacy";
      if (options.gasPrice !== undefined) tx.gasPrice = options.gasPrice;
      break;
    case "eip2930":
      tx.type = "eip2930";
      if (options.gasPrice !== undefined) tx.gasPrice = options.gasPrice;
      tx.accessList = [];
      break;
    case "eip1559":
    default:
      tx.type = "eip1559";
      if (options.maxFeePerGas !== undefined) tx.maxFeePerGas = options.maxFeePerGas;
      if (options.maxPriorityFeePerGas !== undefined)
        tx.maxPriorityFeePerGas = options.maxPriorityFeePerGas;
      break;
  }

  const hash: `0x${string}` = await context.viem().sendTransaction(tx);
  if (typeof context.createBlock === "function") {
    await context.createBlock();
  }
  const receipt = await context.viem().waitForTransactionReceipt({ hash });

  return {
    hash,
    contractAddress: receipt.contractAddress,
    status: receipt.status,
    abi: artifact.abi
  };
};
