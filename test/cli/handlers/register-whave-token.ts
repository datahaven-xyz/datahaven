import { datahaven } from "@polkadot-api/descriptors";
import { createClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { getEvmEcdsaSigner, logger, printDivider, printHeader } from "utils";

export const registerWhaveToken = async (options: any, command: any) => {
  printHeader("Registering wHAVE Token on DataHaven");

  try {
    logger.info("🚀 Starting wHAVE token registration...");

    // Use DataHaven RPC URL (defaults to localhost for development)
    const rpcUrl = options.rpcUrl || "ws://localhost:9944";

    logger.info(`📡 Using DataHaven RPC URL: ${rpcUrl}`);

    // Create Substrate client
    const wsProvider = getWsProvider(rpcUrl);
    const client = createClient(withPolkadotSdkCompat(wsProvider));
    const dhApi = client.getTypedApi(datahaven);

    logger.debug("Substrate client created");

    // Create signer from private key
    const signer = getEvmEcdsaSigner(options.privateKey);
    logger.debug("Signer created");

    // Define token metadata for wHAVE
    const tokenMetadata = {
      name: "HAVE",
      symbol: "wHAVE",
      decimals: 18
    };

    // Define locations - use V5 version for both sender and asset_id
    const rootLocation = {
      type: "V5" as const,
      value: {
        parents: 0,
        interior: { type: "Here" as const, value: undefined }
      }
    };

    const nativeTokenLocation = {
      type: "V5" as const,
      value: {
        parents: 0,
        interior: { type: "Here" as const, value: undefined }
      }
    };

    logger.info("📝 Registering native token with Snowbridge...");
    logger.info("   Name: HAVE");
    logger.info("   Symbol: wHAVE");
    logger.info(`   Decimals: ${tokenMetadata.decimals}`);

    // Create the register_token call
    const registerTokenCall = dhApi.tx.SnowbridgeSystemV2.register_token({
      sender: rootLocation,
      asset_id: nativeTokenLocation,
      metadata: tokenMetadata
    });

    logger.debug("Register token call:");
    logger.debug(registerTokenCall.decodedCall);

    // Wrap in sudo call since registration requires root origin
    const sudoCall = dhApi.tx.Sudo.sudo({
      call: registerTokenCall.decodedCall
    });

    logger.debug("Sudo call:");
    logger.debug(sudoCall.decodedCall);

    logger.info("📤 Submitting registration transaction...");

    // Sign and submit the transaction
    const txFinalisedPayload = await sudoCall.signAndSubmit(signer);

    if (!txFinalisedPayload.ok) {
      throw new Error("❌ Token registration transaction failed");
    }

    logger.success("✅ wHAVE token registration successful!");
    logger.info(`📪 Transaction hash: ${txFinalisedPayload.txHash}`);
    logger.info(`📦 Block: ${txFinalisedPayload.block.hash}`);

    printDivider();
  } catch (error) {
    logger.error(`❌ Registration failed: ${error}`);
    throw error;
  }
};

export const registerWhaveTokenPreActionHook = async (thisCommand: any) => {
  const privateKey = thisCommand.getOptionValue("privateKey");

  if (!privateKey) {
    logger.warn("⚠️ Private key not provided. Will use PRIVATE_KEY environment variable");
  }
};
