import { setDataHavenParameters } from "scripts/set-datahaven-parameters";
import { logger, printDivider, printHeader } from "utils";
import { DEFAULT_SUBSTRATE_WS_PORT } from "utils/constants";
import type { ParameterCollection } from "utils/parameters";

/**
 * A helper function to set DataHaven parameters from a ParameterCollection
 *
 * @param options Options for setting parameters
 * @param options.launchedNetwork The launched network instance
 * @param options.collection The parameter collection
 * @returns Promise resolving to true if parameters were set successfully
 */
export const setParametersFromCollection = async ({
  collection,
  skipSetParameters
}: {
  collection: ParameterCollection;
  skipSetParameters: boolean;
}): Promise<boolean> => {
  printHeader("Setting DataHaven Runtime Parameters");

  if (skipSetParameters) {
    logger.info("🏳️ Skipping parameter setting");
    printDivider();
    return false;
  }

  const parametersFilePath = await collection.generateParametersFile();

  const rpcUrl = `ws://127.0.0.1:${DEFAULT_SUBSTRATE_WS_PORT}`;

  const parametersSet = await setDataHavenParameters(rpcUrl, parametersFilePath);

  printDivider();
  return parametersSet;
};
