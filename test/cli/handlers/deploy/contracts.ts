import {
  buildContracts,
  constructDeployCommand,
  executeDeployment,
  validateDeploymentParams
} from "scripts/deploy-contracts";
import { logger, printDivider, printHeader } from "utils";
import type { ParameterCollection } from "utils/parameters";

interface DeployContractsOptions {
  chain: string;
  rpcUrl: string;
  privateKey: string;
  verified?: boolean;
  blockscoutBackendUrl?: string;
  parameterCollection?: ParameterCollection;
  skipContracts: boolean;
}

/**
 * Deploys smart contracts to the specified RPC URL
 *
 * @param options - Configuration options for deployment
 * @param options.rpcUrl - The RPC URL to deploy to
 * @param options.verified - Whether to verify contracts (requires blockscoutBackendUrl)
 * @param options.blockscoutBackendUrl - URL for the Blockscout API (required if verified is true)
 * @param options.parameterCollection - Collection of parameters to update in the DataHaven runtime
 * @returns Promise resolving to true if contracts were deployed successfully, false if skipped
 */
export const deployContracts = async (options: DeployContractsOptions) => {
  printHeader("Deploying Smart Contracts");

  if (options.skipContracts) {
    logger.info("🏳️ Skipping contract deployment");
    printDivider();
    return;
  }

  // Check if required parameters are provided
  validateDeploymentParams(options);

  // Build contracts
  await buildContracts();

  // Construct and execute deployment
  const deployCommand = constructDeployCommand(options);
  await executeDeployment(deployCommand, options.parameterCollection, options.chain);

  printDivider();
};
