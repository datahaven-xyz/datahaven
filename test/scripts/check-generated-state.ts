import { readFileSync } from "node:fs";
import { generateContractsChecksum } from "./contracts-checksum.ts";

// Read the previously stored checksum
const originalHash = readFileSync("../contracts/deployments/state-diff.checksum", "utf-8").trim();

// Directory containing the Solidity contracts
const contractsPath = "../contracts/src";

// Recompute checksum over all contract files (including nested directories)
const currentHash = generateContractsChecksum(contractsPath);

if (currentHash !== originalHash) {
  throw new Error(
    "State generated file is outdated. Please regenerate it with `bun -e \"import {generateContracts} from './scripts/generate-contracts.ts'; await generateContracts()\"`",
  );
}