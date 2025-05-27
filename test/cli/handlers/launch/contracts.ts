import {
  buildContracts,
  constructDeployCommand,
  executeDeployment,
  validateDeploymentParams
} from "scripts/deploy-contracts";
import { confirmWithTimeout, logger, printDivider, printHeader } from "utils";
import type { ParameterCollection } from "utils/parameters";

interface DeployContractsOptions {
  rpcUrl: string;
  verified?: boolean;
  blockscoutBackendUrl?: string;
  deployContracts?: boolean;
  parameterCollection?: ParameterCollection;
}

/**
 * Deploys smart contracts to the specified RPC URL
 *
 * @param options - Configuration options for deployment
 * @param options.rpcUrl - The RPC URL to deploy to
 * @param options.verified - Whether to verify contracts (requires blockscoutBackendUrl)
 * @param options.blockscoutBackendUrl - URL for the Blockscout API (required if verified is true)
 * @param options.deployContracts - Flag to control deployment (if undefined, will prompt)
 * @param options.parameterCollection - Collection of parameters to update in the DataHaven runtime
 * @returns Promise resolving to true if contracts were deployed successfully, false if skipped
 */
export const deployContracts = async (options: DeployContractsOptions): Promise<boolean> => {
  printHeader("Deploying Smart Contracts");
  const { deployContracts } = options;

  // Check if deployContracts option was set via flags, or prompt if not
  let shouldDeployContracts = deployContracts;
  if (shouldDeployContracts === undefined) {
    shouldDeployContracts = await confirmWithTimeout(
      "Do you want to deploy the smart contracts?",
      true,
      10
    );
  } else {
    logger.info(
      `🏳️ Using flag option: ${shouldDeployContracts ? "will deploy" : "will not deploy"} smart contracts`
    );
  }

  if (!shouldDeployContracts) {
    logger.info("👍 Skipping contract deployment. Done!");
    printDivider();

    return false;
  }

  // Check if required parameters are provided
  validateDeploymentParams(options);

  // Build contracts
  await buildContracts();

  // Construct and execute deployment
  const deployCommand = constructDeployCommand(options);
  await executeDeployment(deployCommand, options.parameterCollection);
  printDivider();

  return true;
};
