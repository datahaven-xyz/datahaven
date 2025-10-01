import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Abi } from "viem";

interface ArtifactEvmBytecode {
    object?: string;
}

interface ArtifactEvm {
    bytecode?: ArtifactEvmBytecode;
}

interface ArtifactContract {
    abi?: Abi;
    evm?: ArtifactEvm;
    bytecode?: `0x${string}`;
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

export const fetchCompiledContract = async (
    contractName: string
): Promise<CompiledContractArtifact> => {
    const artifactPath = path.join(__dirname, "../", "contracts", "out", `${contractName}.json`);
    const artifactContent = await readFile(artifactPath, "utf-8");
    const artifactJson = JSON.parse(artifactContent) as CompiledContractArtifactJson;

    const abi = artifactJson.abi ?? artifactJson.contract.abi;
    if (!abi) {
        throw new Error(`Missing ABI for compiled contract: ${contractName}`);
    }

    const bytecodeFromContract = artifactJson.contract.bytecode;
    const bytecodeObject = artifactJson.contract.evm?.bytecode?.object;
    const bytecode = bytecodeFromContract ?? (bytecodeObject ? (`0x${bytecodeObject}` as const) : artifactJson.byteCode);
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

