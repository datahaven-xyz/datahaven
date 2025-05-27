import { setDataHavenParameters } from "scripts/set-datahaven-parameters";
import { printDivider, printHeader } from "utils";
import type { ParameterCollection } from "utils/parameters";

/**
 * A helper function to set DataHaven parameters from a ParameterCollection
 *
 * @param options Options for setting parameters
 * @param options.rpcUrl The RPC URL of the DataHaven node
 * @param options.collection The parameter collection
 * @param options.setParameters Flag to control execution
 * @returns Promise resolving to true if parameters were set successfully
 */
export const setParametersFromCollection = async ({
  rpcUrl,
  collection
}: {
  rpcUrl: string;
  collection: ParameterCollection;
}): Promise<boolean> => {
  printHeader("Setting DataHaven Runtime Parameters");

  const parametersFilePath = await collection.generateParametersFile();

  const parametersSet = await setDataHavenParameters({
    rpcUrl,
    parametersFilePath
  });

  printDivider();
  return parametersSet;
};
