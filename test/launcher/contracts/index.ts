import {
  buildContracts,
  constructDeployCommand,
  executeDeployment,
  validateDeploymentParams
} from "scripts/deploy-contracts";
import { logger } from "utils";
import type { ParameterCollection } from "utils/parameters";
import type { ContractsDeployResult, NetworkLaunchOptions } from "../types";

export class ContractsLauncher {
  private options: NetworkLaunchOptions;

  constructor(options: NetworkLaunchOptions) {
    this.options = options;
  }

  async deploy(
    rpcUrl: string,
    parameterCollection?: ParameterCollection,
    blockscoutBackendUrl?: string
  ): Promise<ContractsDeployResult> {
    try {
      logger.info("🚀 Deploying smart contracts...");

      const deployOptions = {
        rpcUrl,
        verified: this.options.verified,
        blockscoutBackendUrl
      };

      // Validate deployment parameters
      validateDeploymentParams(deployOptions);

      // Build contracts
      await buildContracts();

      // Construct and execute deployment
      const deployCommand = constructDeployCommand(deployOptions);
      await executeDeployment(deployCommand, parameterCollection);

      logger.success("Smart contracts deployed successfully");

      return {
        success: true,
        deployed: true
      };
    } catch (error) {
      logger.error("Failed to deploy contracts", error);
      return {
        success: false,
        error: error as Error,
        deployed: false
      };
    }
  }
}
