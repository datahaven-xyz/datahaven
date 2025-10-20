import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Abi } from "viem";
/**
 * Contract-related helper utilities for DataHaven tests
 * Adapted from Moonbeam test helpers
 */

import type { DevModeContext } from "@moonwall/cli";

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
      "../",
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
