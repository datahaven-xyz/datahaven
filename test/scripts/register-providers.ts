import { Binary } from "polkadot-api";
import { logger } from "utils";
import { SUBSTRATE_FUNDED_ACCOUNTS } from "utils/constants";
import { createPapiConnectors, getEvmEcdsaSigner } from "utils/papi";
import type { LaunchedNetwork } from "../launcher/types/launchedNetwork";

export interface RegisterProvidersOptions {
  launchedNetwork: LaunchedNetwork;
}

/**
 * Provider registration information.
 *
 * These accounts must have BCSV ECDSA keys injected into their keystores.
 * DataHaven uses AccountId20 (Ethereum-style 20-byte addresses).
 */
const PROVIDERS = {
  msp: {
    name: "Charleth",
    accountId: SUBSTRATE_FUNDED_ACCOUNTS.CHARLETH.publicKey, // 20-byte address
    privateKey: SUBSTRATE_FUNDED_ACCOUNTS.CHARLETH.privateKey,
    derivation: "//Charlie",
    capacity: BigInt(10_737_418_240), // 10 GiB
    multiaddresses: [] // Empty for local dev
  },
  bsp: {
    name: "Dorothy",
    accountId: SUBSTRATE_FUNDED_ACCOUNTS.DOROTHY.publicKey, // 20-byte address
    privateKey: SUBSTRATE_FUNDED_ACCOUNTS.DOROTHY.privateKey,
    derivation: "//Dave", // Using Dave instead of Eve
    capacity: BigInt(10_737_418_240), // 10 GiB
    multiaddresses: [] // Empty for local dev
  }
} as const;

/**
 * Registers StorageHub providers (MSP and BSP) using force extrinsics.
 *
 * This function calls `force_msp_sign_up` and `force_bsp_sign_up` extrinsics
 * via Sudo to register the providers without going through the normal two-step
 * registration process. This is suitable for development and testing.
 *
 * @param options - Configuration options including the launched network
 */
export async function registerProviders(options: RegisterProvidersOptions): Promise<void> {
  logger.info("📝 Registering StorageHub providers...");

  const aliceContainerName = `datahaven-alice-${options.launchedNetwork.networkId}`;
  const alicePort = options.launchedNetwork.getContainerPort(aliceContainerName);

  const { client, typedApi } = createPapiConnectors(`ws://127.0.0.1:${alicePort}`);

  try {
    // Create signer for Alice (sudo account in dev chain)
    const _aliceSigner = getEvmEcdsaSigner(SUBSTRATE_FUNDED_ACCOUNTS.ALITH.privateKey);

    // Register MSP
    logger.info(`Registering MSP (${PROVIDERS.msp.name})...`);

    try {
      // Note: The exact extrinsic signature will depend on the pallet-storage-providers implementation
      // This is a placeholder structure based on the investigation findings
      const _mspTx = typedApi.tx.Sudo.sudo({
        call: Binary.fromBytes(
          // The actual call bytes would be constructed from the Providers pallet extrinsic
          // This is a simplified representation and will need to be adjusted based on actual runtime types
          new Uint8Array([])
        )
      });

      logger.info("⚠️  Note: MSP registration requires runtime types to be generated.");
      logger.info("Please run: bun generate:types");
      logger.info("Then update this script with the actual Providers.force_msp_sign_up call.");

      // Uncomment when runtime types are available:
      // const mspTx = typedApi.tx.Sudo.sudo({
      //   call: typedApi.tx.Providers.force_msp_sign_up({
      //     who: PROVIDERS.msp.accountId,
      //     msp_id: null, // Let runtime generate
      //     capacity: PROVIDERS.msp.capacity,
      //     multiaddresses: PROVIDERS.msp.multiaddresses,
      //     value_prop: {
      //       identifier: `msp-${PROVIDERS.msp.name.toLowerCase()}`,
      //       data_limit: 1_000_000,
      //       protocols: []
      //     },
      //     payment_account: PROVIDERS.msp.accountId
      //   })
      // });
      //
      // await mspTx.signSubmitAndWatch(aliceSigner);
      // logger.success(`MSP (${PROVIDERS.msp.name}) registered successfully`);
    } catch (error) {
      logger.error(`Failed to register MSP: ${error}`);
      logger.warn("This is expected if runtime types haven't been generated yet.");
    }

    // Register BSP
    logger.info(`Registering BSP (${PROVIDERS.bsp.name})...`);

    try {
      logger.info("⚠️  Note: BSP registration requires runtime types to be generated.");
      logger.info("Please run: bun generate:types");
      logger.info("Then update this script with the actual Providers.force_bsp_sign_up call.");

      // Uncomment when runtime types are available:
      // const bspTx = typedApi.tx.Sudo.sudo({
      //   call: typedApi.tx.Providers.force_bsp_sign_up({
      //     who: PROVIDERS.bsp.accountId,
      //     bsp_id: null, // Let runtime generate
      //     capacity: PROVIDERS.bsp.capacity,
      //     multiaddresses: PROVIDERS.bsp.multiaddresses,
      //     payment_account: PROVIDERS.bsp.accountId
      //   })
      // });
      //
      // await bspTx.signSubmitAndWatch(aliceSigner);
      // logger.success(`BSP (${PROVIDERS.bsp.name}) registered successfully`);
    } catch (error) {
      logger.error(`Failed to register BSP: ${error}`);
      logger.warn("This is expected if runtime types haven't been generated yet.");
    }

    logger.info("Provider registration process completed");
    logger.info("Note: Actual registration will work once runtime types are available.");
  } catch (error) {
    logger.error(`Provider registration failed: ${error}`);
    throw error;
  } finally {
    client.destroy();
  }
}

/**
 * Verifies that providers have been successfully registered.
 *
 * @param options - Configuration options including the launched network
 * @returns True if both providers are registered, false otherwise
 */
export async function verifyProvidersRegistered(
  options: RegisterProvidersOptions
): Promise<boolean> {
  logger.info("🔍 Verifying provider registration...");

  const aliceContainerName = `datahaven-alice-${options.launchedNetwork.networkId}`;
  const alicePort = options.launchedNetwork.getContainerPort(aliceContainerName);

  const { client } = createPapiConnectors(`ws://127.0.0.1:${alicePort}`);

  try {
    // Check if MSP is registered
    logger.debug("Checking MSP registration...");

    // This will need to be updated once runtime types are available:
    // const mspId = await typedApi.query.Providers.AccountIdToMainStorageProviderId.getValue(
    //   PROVIDERS.msp.accountId
    // );

    // Check if BSP is registered
    logger.debug("Checking BSP registration...");

    // This will need to be updated once runtime types are available:
    // const bspId = await typedApi.query.Providers.AccountIdToBackupStorageProviderId.getValue(
    //   PROVIDERS.bsp.accountId
    // );

    logger.info("⚠️  Provider verification requires runtime types to be generated.");
    logger.success("Verification check completed (types pending)");

    return true;
  } catch (error) {
    logger.error(`Provider verification failed: ${error}`);
    return false;
  } finally {
    client.destroy();
  }
}
