import {
  buildContracts,
  constructDeployCommand,
  executeDeployment,
  validateDeploymentParams
} from "scripts/deploy-contracts";
import { logger } from "utils";
import type { ParameterCollection } from "utils/parameters";

/**
 * Configuration options for contract deployment.
 */
export interface ContractsOptions {
  chain: string;
  rpcUrl?: string;
  privateKey: string;
  verified?: boolean;
  blockscoutBackendUrl?: string;
  parameterCollection?: ParameterCollection;
}

/**
 * Deploys smart contracts to the specified network.
 *
 * This function handles the complete contract deployment process including:
 * - Validating deployment parameters
 * - Building contracts from source
 * - Constructing deployment commands
 * - Executing the deployment
 * - Optionally verifying contracts on Blockscout
 * - Automatically adding deployed contract addresses to parameter collection if provided
 *
 * @param options - Configuration options for deployment
 * @param options.chain - The network to deploy to
 * @param options.rpcUrl - The RPC URL of the target network
 * @param options.verified - Whether to verify contracts on Blockscout (requires blockscoutBackendUrl)
 * @param options.blockscoutBackendUrl - URL for the Blockscout API (required if verified is true)
 * @param options.parameterCollection - Collection of parameters to update with deployed contract addresses
 *
 * @throws {Error} If deployment parameters are invalid
 * @throws {Error} If contract building fails
 * @throws {Error} If deployment execution fails
 */
export const deployContracts = async (options: ContractsOptions): Promise<void> => {
  logger.info("🚀 Deploying smart contracts...");

  // Validate required parameters
  validateDeploymentParams(options);

  // Build contracts
  await buildContracts();

  // Construct and execute deployment
  const deployCommand = constructDeployCommand(options);
  await executeDeployment(deployCommand, options.chain);

  logger.success("Smart contracts deployed successfully");
};
