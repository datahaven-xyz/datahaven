import { parseArgs } from "node:util";
import { datahaven } from "@polkadot-api/descriptors";
import { createClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { getEvmEcdsaSigner, logger, SUBSTRATE_FUNDED_ACCOUNTS } from "utils";
import { parseJsonToParameters } from "utils/types";

/**
 * Sets DataHaven runtime parameters on the specified RPC URL from a JSON file.
 */
export const setDataHavenParameters = async (
  rpcUrl: string,
  parametersFilePath: string
): Promise<boolean> => {
  const parametersJson = await Bun.file(parametersFilePath).json();
  const parameters = parseJsonToParameters(parametersJson).filter((p) => p.value !== undefined);

  if (parameters.length === 0) {
    logger.warn("⚠️ No parameters to set.");
    return false;
  }

  const client = createClient(withPolkadotSdkCompat(getWsProvider(rpcUrl)));

  try {
    const dhApi = client.getTypedApi(datahaven);
    const signer = getEvmEcdsaSigner(SUBSTRATE_FUNDED_ACCOUNTS.ALITH.privateKey);

    // Log parameters being set
    for (const p of parameters) {
      logger.debug(`🔧 Setting ${p.name} = ${p.value!.asHex()}`);
    }

    // Build parameter calls
    const calls = parameters.map(
      (p) =>
        dhApi.tx.Parameters.set_parameter({
          key_value: {
            type: "RuntimeConfig",
            value: { type: p.name, value: [p.value] }
          }
        }).decodedCall
    );

    // Batch all calls and wrap in sudo
    const tx = dhApi.tx.Sudo.sudo({
      call: dhApi.tx.Utility.batch_all({ calls }).decodedCall
    });

    const result = await tx.signAndSubmit(signer);

    if (!result.ok) {
      logger.error(`❌ Transaction failed: ${result.block.hash}`);
      return false;
    }

    logger.success("Runtime parameters set successfully");
    return true;
  } catch (error) {
    logger.error(`❌ ${error instanceof Error ? error.message : error}`);
    return false;
  } finally {
    client.destroy();
  }
};

// CLI entry point
if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv,
    options: {
      rpcUrl: { type: "string", short: "r" },
      parametersFile: { type: "string", short: "f" }
    },
    strict: true
  });

  if (!values.rpcUrl || !values.parametersFile) {
    console.error("Usage: --rpc-url <url> --parameters-file <path>");
    process.exit(1);
  }

  setDataHavenParameters(values.rpcUrl, values.parametersFile)
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
