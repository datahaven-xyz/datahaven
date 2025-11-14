import { blake2b } from "@noble/hashes/blake2";
import type { FixedSizeBinary } from "polkadot-api";
import { Binary } from "polkadot-api";
import { logger } from "utils";
import { SUBSTRATE_FUNDED_ACCOUNTS } from "utils/constants";
import { createPapiConnectors, getEvmEcdsaSigner } from "utils/papi";
import { hexToBytes } from "viem";
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
 * Generates a deterministic provider ID from an account ID.
 * For dev/testing purposes, we use blake2b_256(accountId) as the provider ID.
 *
 * @param accountId - The account ID (20-byte Ethereum address)
 * @returns A 32-byte provider ID
 */
function generateProviderId(accountId: string): FixedSizeBinary<32> {
  const accountBytes = hexToBytes(accountId as `0x${string}`);
  const hash = blake2b(accountBytes, { dkLen: 32 });
  const binary = Binary.fromBytes(hash);
  return binary as FixedSizeBinary<32>;
}

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
    const aliceSigner = getEvmEcdsaSigner(SUBSTRATE_FUNDED_ACCOUNTS.ALITH.privateKey);

    // Register MSP
    logger.info(`Registering MSP (${PROVIDERS.msp.name})...`);
    const mspId = generateProviderId(PROVIDERS.msp.accountId);
    logger.debug(`MSP ID: ${mspId}`);

    const mspCall = typedApi.tx.Providers.force_msp_sign_up({
      who: PROVIDERS.msp.accountId,
      msp_id: mspId,
      capacity: PROVIDERS.msp.capacity,
      multiaddresses: [],
      value_prop_price_per_giga_unit_of_data_per_block: BigInt(1000),
      commitment: Binary.fromText(`msp-${PROVIDERS.msp.name.toLowerCase()}`),
      value_prop_max_data_limit: BigInt(1_000_000),
      payment_account: PROVIDERS.msp.accountId
    });

    const mspTx = typedApi.tx.Sudo.sudo({ call: mspCall.decodedCall });
    await mspTx.signSubmitAndWatch(aliceSigner);
    logger.success(`✅ MSP (${PROVIDERS.msp.name}) registered successfully`);

    // Register BSP
    logger.info(`Registering BSP (${PROVIDERS.bsp.name})...`);
    const bspId = generateProviderId(PROVIDERS.bsp.accountId);
    logger.debug(`BSP ID: ${bspId}`);

    const bspCall = typedApi.tx.Providers.force_bsp_sign_up({
      who: PROVIDERS.bsp.accountId,
      bsp_id: bspId,
      capacity: PROVIDERS.bsp.capacity,
      multiaddresses: [],
      payment_account: PROVIDERS.bsp.accountId,
      weight: undefined
    });

    const bspTx = typedApi.tx.Sudo.sudo({ call: bspCall.decodedCall });
    await bspTx.signSubmitAndWatch(aliceSigner);
    logger.success(`✅ BSP (${PROVIDERS.bsp.name}) registered successfully`);

    logger.success("✅ All providers registered successfully");
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

  const { client, typedApi } = createPapiConnectors(`ws://127.0.0.1:${alicePort}`);

  try {
    // Check if MSP is registered
    logger.debug("Checking MSP registration...");
    const mspId = await typedApi.query.Providers.AccountIdToMainStorageProviderId.getValue(
      PROVIDERS.msp.accountId
    );

    if (!mspId) {
      logger.error(`❌ MSP (${PROVIDERS.msp.name}) is NOT registered`);
      return false;
    }
    logger.success(`✅ MSP registered with ID: ${mspId}`);

    // Check if BSP is registered
    logger.debug("Checking BSP registration...");
    const bspId = await typedApi.query.Providers.AccountIdToBackupStorageProviderId.getValue(
      PROVIDERS.bsp.accountId
    );

    if (!bspId) {
      logger.error(`❌ BSP (${PROVIDERS.bsp.name}) is NOT registered`);
      return false;
    }
    logger.success(`✅ BSP registered with ID: ${bspId}`);

    logger.success("✅ All providers verified successfully");
    return true;
  } catch (error) {
    logger.error(`Provider verification failed: ${error}`);
    return false;
  } finally {
    client.destroy();
  }
}
