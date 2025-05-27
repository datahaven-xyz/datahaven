import { setDataHavenParameters } from "scripts/set-datahaven-parameters";
import { logger, printDivider, printHeader } from "utils";
import { confirmWithTimeout } from "utils/input";
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
  collection,
  setParameters
}: {
  rpcUrl: string;
  collection: ParameterCollection;
  setParameters?: boolean;
}): Promise<boolean> => {
  printHeader("Setting DataHaven Runtime Parameters");

  const parametersFilePath = await collection.generateParametersFile();

  // Check if setParameters option was set via flags, or prompt if not
  let shouldSetParameters = setParameters;
  if (shouldSetParameters === undefined) {
    shouldSetParameters = await confirmWithTimeout(
      "Do you want to set the DataHaven runtime parameters?",
      true,
      10
    );
  } else {
    logger.info(
      `🏳️ Using flag option: ${
        shouldSetParameters ? "will set" : "will not set"
      } DataHaven parameters`
    );
  }

  if (!shouldSetParameters) {
    logger.info("👍 Skipping DataHaven parameter setting. Done!");
    printDivider();
    return false;
  }

  const parametersSet = await setDataHavenParameters({
    rpcUrl,
    parametersFilePath
  });

  printDivider();
  return parametersSet;
};
