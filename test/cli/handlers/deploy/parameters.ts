import { setDataHavenParameters } from "scripts/set-datahaven-parameters";
import { printDivider, printHeader } from "utils";
import type { ParameterCollection } from "utils/parameters";
import { forwardPort } from "../common/kubernetes";
import type { LaunchedNetwork } from "../common/launchedNetwork";

// Standard ports for the substrate network
const DEFAULT_SUBSTRATE_WS_PORT = 9944;

/**
 * A helper function to set DataHaven parameters from a ParameterCollection
 *
 * @param options Options for setting parameters
 * @param options.launchedNetwork The launched network instance
 * @param options.collection The parameter collection
 * @returns Promise resolving to true if parameters were set successfully
 */
export const setParametersFromCollection = async ({
  launchedNetwork,
  collection
}: {
  launchedNetwork: LaunchedNetwork;
  collection: ParameterCollection;
}): Promise<boolean> => {
  printHeader("Setting DataHaven Runtime Parameters");

  const parametersFilePath = await collection.generateParametersFile();

  // Forward port from validator to localhost, to interact with the network.
  const { cleanup: validatorPortForwardCleanup } = await forwardPort(
    "dh-validator-0",
    DEFAULT_SUBSTRATE_WS_PORT,
    DEFAULT_SUBSTRATE_WS_PORT,
    launchedNetwork
  );

  const rpcUrl = `ws://127.0.0.1:${DEFAULT_SUBSTRATE_WS_PORT}`;

  const parametersSet = await setDataHavenParameters({
    rpcUrl,
    parametersFilePath
  });

  await validatorPortForwardCleanup();

  printDivider();
  return parametersSet;
};
