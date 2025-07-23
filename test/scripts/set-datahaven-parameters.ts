import { parseArgs } from "node:util";
import { datahaven } from "@polkadot-api/descriptors";
import { createClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import invariant from "tiny-invariant";
import { getEvmEcdsaSigner, logger, SUBSTRATE_FUNDED_ACCOUNTS } from "utils";
import { type ParsedDataHavenParameter, parseJsonToParameters } from "utils/types";

// Interface for the options object of setDataHavenParameters
interface SetDataHavenParametersOptions {
  rpcUrl: string;
  parametersFilePath: string;
}

/**
 * Sets DataHaven runtime parameters on the specified RPC URL from a JSON file.
 *
 * @param options - Configuration options for setting parameters
 * @param options.rpcUrl - The RPC URL of the DataHaven node
 * @param options.parametersFilePath - Path to the JSON file containing an array of parameters to set
 * @returns Promise resolving to true if parameters were set successfully, false if skipped
 */
export const setDataHavenParameters = async (
  options: SetDataHavenParametersOptions
): Promise<boolean> => {
  const { rpcUrl, parametersFilePath } = options;

  // Load parameters from the JSON file
  let parameters: ParsedDataHavenParameter[];
  try {
    logger.info(`📂 Reading parameters from file: ${parametersFilePath}`);
    const parametersFile = Bun.file(parametersFilePath);
    invariant(
      await parametersFile.exists(),
      `❌ Parameters file does not exist at '${parametersFilePath}'`
    );

    const parametersJson = await parametersFile.text();

    // Parse and convert the parameters using our utility
    parameters = parseJsonToParameters(JSON.parse(parametersJson));

    if (parameters.length === 0) {
      logger.warn("⚠️ The parameters file is empty. No parameters to set.");
      return false;
    }
  } catch (error: any) {
    logger.error(
      `❌ Error reading or parsing parameters file at '${parametersFilePath}': ${error.message}`
    );
    throw error;
  }

  const client = createClient(withPolkadotSdkCompat(getWsProvider(rpcUrl)));
  const dhApi = client.getTypedApi(datahaven);
  logger.trace("Substrate client created");

  const signer = getEvmEcdsaSigner(SUBSTRATE_FUNDED_ACCOUNTS.ALITH.privateKey);
  logger.trace("Signer created for SUDO (ALITH)");

  let allSuccessful = true;

  try {
    for (const param of parameters) {
      // TODO: Add a graceful way to print the value of the parameter, since it won't always be representable as a hex string
      logger.info(
        `🔧 Attempting to set parameter: ${param.name.toString()} = ${param.value.asHex()}`
      );

      const setParameterArgs: any = {
        key_value: {
          type: "RuntimeConfig" as const,
          value: {
            type: param.name,
            value: [param.value]
          }
        }
      };

      try {
        const setParameterCall = dhApi.tx.Parameters.set_parameter(setParameterArgs);

        logger.debug("Parameter set call:");
        logger.debug(setParameterCall.decodedCall);

        const sudoCall = dhApi.tx.Sudo.sudo({
          call: setParameterCall.decodedCall
        });

        logger.debug(`Submitting transaction to set ${String(param.name)}...`);
        const txFinalisedPayload = await sudoCall.signAndSubmit(signer);

        if (!txFinalisedPayload.ok) {
          logger.error(
            `❌ Transaction to set parameter ${String(param.name)} failed. Block: ${txFinalisedPayload.block.hash}, Tx Hash: ${txFinalisedPayload.txHash}`
          );
          logger.error(`Events: ${JSON.stringify(txFinalisedPayload.events)}`);
          allSuccessful = false;
        }
      } catch (txError: any) {
        logger.error(
          `❌ Error submitting transaction for parameter ${String(param.name)}: ${txError.message || txError}`
        );
        allSuccessful = false;
      }
    }
  } finally {
    client.destroy();
    logger.trace("Substrate client destroyed");
  }

  if (allSuccessful) {
    logger.success("All specified DataHaven parameters processed successfully.");
  } else {
    logger.warn("Some DataHaven parameters could not be set. Please check logs.");
  }

  return allSuccessful;
};

// Allow script to be run directly with CLI arguments
if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv,
    options: {
      rpcUrl: {
        type: "string",
        short: "r"
      },
      parametersFile: {
        type: "string",
        short: "f"
      }
    },
    strict: true
  });

  if (!values.rpcUrl) {
    console.error("Error: --rpc-url parameter is required");
    process.exit(1);
  }

  if (!values.parametersFile) {
    console.error("Error: --parameters-file <path_to_json_file> parameter is required.");
    process.exit(1);
  }

  setDataHavenParameters({
    rpcUrl: values.rpcUrl,
    parametersFilePath: values.parametersFile
  }).catch((error: Error) => {
    console.error("Setting DataHaven parameters failed:", error.message || error);
    process.exit(1);
  });
}
