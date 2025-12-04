import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { ALITH_PRIVATE_KEY } from "@moonwall/util";
import { type Abi, createWalletClient, type Hex, http, type Log } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Contract-related helper utilities for DataHaven tests
 * Adapted from Moonbeam test helpers
 */

interface ArtifactContract {
  abi?: Abi;
  bytecode?: `0x${string}`;
  evm?: { bytecode?: { object?: string } };
}

interface CompiledContractArtifactJson {
  abi?: Abi;
  byteCode?: `0x${string}`;
  contract: ArtifactContract;
  sourceCode: string;
}

export interface CompiledContractArtifact {
  abi: Abi;
  bytecode: `0x${string}`;
  contract: ArtifactContract;
  sourceCode: string;
}

export interface DeployContractOptions {
  args?: readonly unknown[];
  gasLimit?: bigint | number;
  txnType?: "legacy" | "eip2930" | "eip1559";
  value?: bigint | number;
  privateKey?: `0x${string}`;
  poolSettleDelayMs?: number;
}

export interface DeployedContractResult extends CompiledContractArtifact {
  contractAddress: `0x${string}`;
  hash: Hex;
  logs: readonly Log[];
  status: "success" | "reverted";
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const fetchCompiledContract = (contractName: string): CompiledContractArtifact => {
  let artifactPath = path.join(__dirname, "../", "contracts", "out", `${contractName}.json`);
  if (!existsSync(artifactPath)) {
    const folder = contractName
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/_/g, "-")
      .toLowerCase()
      .replace(/-+precompile$/, "");
    const candidate = path.join(
      __dirname,
      "../../",
      "contracts",
      "out",
      "precompiles",
      folder,
      `${contractName}.json`
    );
    if (existsSync(candidate)) {
      artifactPath = candidate;
    }
  }
  if (!existsSync(artifactPath)) {
    throw new Error(`Contract artifact not found: ${contractName} (searched: ${artifactPath})`);
  }
  const artifactContent = readFileSync(artifactPath, "utf-8");
  const artifactJson = JSON.parse(artifactContent) as CompiledContractArtifactJson;

  const abi = artifactJson.abi ?? artifactJson.contract.abi;
  if (!abi) {
    throw new Error(`Missing ABI for compiled contract: ${contractName}`);
  }

  const bytecodeFromContract = artifactJson.contract.bytecode;
  const bytecodeObject = artifactJson.contract.evm?.bytecode?.object;
  const bytecode =
    bytecodeFromContract ??
    (bytecodeObject ? (`0x${bytecodeObject}` as const) : artifactJson.byteCode);
  if (!bytecode) {
    throw new Error(`Missing bytecode for compiled contract: ${contractName}`);
  }

  return {
    abi,
    bytecode,
    contract: artifactJson.contract,
    sourceCode: artifactJson.sourceCode
  } satisfies CompiledContractArtifact;
};

/**
 * Deploys a compiled contract using walletClient.deployContract and creates
 * blocks while waiting for the receipt.
 */
export const deployContract = async (
  context: {
    createBlock: (...args: any[]) => Promise<any>;
    viem: () => {
      getTransactionReceipt: (params: { hash: Hex }) => Promise<{
        contractAddress?: `0x${string}` | null;
        logs: readonly Log[];
        status: "success" | "reverted";
      }>;
      transport: { url?: string };
      chain: unknown;
    };
  },
  contractName: string,
  options?: DeployContractOptions
): Promise<DeployedContractResult> => {
  const compiled = fetchCompiledContract(contractName);
  const { abi, bytecode } = compiled;
  const transport = context.viem().transport as { url?: string };
  if (!transport?.url) {
    throw new Error("Missing viem transport url for contract deployment");
  }
  const signerKey = options?.privateKey ?? ALITH_PRIVATE_KEY;
  const walletClient = createWalletClient({
    account: privateKeyToAccount(signerKey),
    transport: http(transport.url),
    chain: context.viem().chain as any
  });

  const deployOptions: {
    abi: Abi;
    bytecode: `0x${string}`;
    args?: readonly unknown[];
    gas?: bigint;
    value?: bigint;
  } = {
    abi,
    bytecode
  };

  if (options?.args) {
    deployOptions.args = options.args;
  }
  if (options?.gasLimit !== undefined) {
    deployOptions.gas = BigInt(options.gasLimit);
  }
  if (options?.value !== undefined) {
    deployOptions.value = BigInt(options.value);
  }

  const hash = await walletClient.deployContract(deployOptions as any);
  for (let attempt = 0; attempt < 12; attempt++) {
    await context.createBlock();
    try {
      const receipt = await context.viem().getTransactionReceipt({ hash });
      if (!receipt.contractAddress) {
        throw new Error("Missing contract address in deployment receipt");
      }
      return {
        ...compiled,
        contractAddress: receipt.contractAddress,
        hash,
        logs: receipt.logs,
        status: receipt.status
      };
    } catch (error) {
      if (attempt === 11) {
        throw error;
      }
      await delay(100 * (attempt + 1));
    }
  }
  throw new Error(`Timed out deploying ${contractName}`);
};
