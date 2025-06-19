import { setDataHavenParameters } from "scripts/set-datahaven-parameters";
import { logger, printDivider, printHeader } from "utils";
import { confirmWithTimeout } from "utils/input";
import type { ParameterCollection } from "utils/parameters";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";

/**
 * A helper function to set DataHaven parameters from a ParameterCollection
 *
 * @param options Options for setting parameters
 * @param options.launchedNetwork The launched network instance
 * @param options.collection The parameter collection
 * @param options.setParameters Flag to control execution
 * @returns Promise resolving to true if parameters were set successfully
 */
export const setParametersFromCollection = async ({
  launchedNetwork,
  collection,
  setParameters
}: {
  launchedNetwork: LaunchedNetwork;
  collection: ParameterCollection;
  setParameters?: boolean;
}): Promise<boolean> => {
  printHeader("Setting DataHaven Runtime Parameters");

  const parametersFilePath = await collection.generateParametersFile();
  const rpcUrl = `ws://127.0.0.1:${launchedNetwork.getPublicWsPort()}`;

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
