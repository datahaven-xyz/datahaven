import { parseArgs } from "node:util";
import { datahaven } from "@polkadot-api/descriptors";
import { createClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
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
    const parametersFile = Bun.file(parametersFilePath);
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

  try {
    // Build all parameter set calls
    const setParameterCalls = parameters.map((param) => {
      logger.info(`🔧 Preparing parameter: ${param.name.toString()} = ${param.value.asHex()}`);

      const setParameterArgs: any = {
        key_value: {
          type: "RuntimeConfig" as const,
          value: {
            type: param.name,
            value: [param.value]
          }
        }
      };

      const setParameterCall = dhApi.tx.Parameters.set_parameter(setParameterArgs);
      logger.debug(`Parameter call: ${JSON.stringify(setParameterCall.decodedCall)}`);
      return setParameterCall.decodedCall;
    });

    // Batch all parameter calls into a single Utility.batch_all call
    const batchCall = dhApi.tx.Utility.batch_all({
      calls: setParameterCalls
    });

    logger.debug("Batch call:");
    logger.debug(batchCall.decodedCall);

    // Wrap in Sudo to execute with elevated privileges
    const sudoCall = dhApi.tx.Sudo.sudo({
      call: batchCall.decodedCall
    });

    logger.info(`📦 Submitting batched transaction with ${parameters.length} parameters...`);
    const txResult = await sudoCall.signAndSubmit(signer);

    if (!txResult.ok) {
      logger.error(
        `❌ Batched transaction failed. Block: ${txResult.block.hash}, Tx Hash: ${txResult.txHash}`
      );
      logger.error(`Events: ${JSON.stringify(txResult.events)}`);
      return false;
    }

    logger.success("All specified DataHaven parameters processed successfully.");
    return true;
  } catch (txError: any) {
    logger.error(`❌ Error submitting batched transaction: ${txError.message || txError}`);
    return false;
  } finally {
    client.destroy();
    logger.trace("Substrate client destroyed");
  }
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
