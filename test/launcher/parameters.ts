import { setDataHavenParameters as setDataHavenParametersScript } from "scripts/set-datahaven-parameters";
import { logger } from "utils";
import type { ParameterCollection } from "utils/parameters";
import type { LaunchedNetwork } from "./types/launchedNetwork";

/**
 * Configuration options for setting DataHaven runtime parameters.
 */
export interface ParametersOptions {
  launchedNetwork: LaunchedNetwork;
  collection: ParameterCollection;
}

/**
 * Sets DataHaven runtime parameters from a parameter collection.
 *
 * This function updates various runtime parameters on the DataHaven chain:
 * - Bridge configuration parameters
 * - Network timing parameters
 * - Validator configuration
 * - Fee structures
 * - Other protocol-specific settings
 *
 * The parameters are collected throughout the deployment process and
 * applied in a single transaction to minimize gas costs and ensure
 * consistency.
 *
 * @param options - Configuration options for setting parameters
 * @param options.launchedNetwork - The launched network instance containing connection details
 * @param options.collection - The parameter collection containing all parameters to set
 *
 * @throws {Error} If the parameter file generation fails
 * @throws {Error} If the RPC connection cannot be established
 * @throws {Error} If the parameter update transaction fails
 */
export const setDataHavenParameters = async (options: ParametersOptions): Promise<void> => {
  logger.info("⚙️ Setting DataHaven runtime parameters...");

  const { launchedNetwork, collection } = options;

  // Generate the parameters file from the collection
  const parametersFilePath = await collection.generateParametersFile();

  // Get the WebSocket RPC URL from the launched network
  const rpcUrl = `ws://127.0.0.1:${launchedNetwork.getPublicWsPort()}`;

  // Execute the parameter update
  await setDataHavenParametersScript(rpcUrl, parametersFilePath);

  logger.success("DataHaven parameters set successfully");
};
