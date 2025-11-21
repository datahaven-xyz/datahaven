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

const JSON_RPC_HEADERS = {
  "Content-Type": "application/json"
} as const;

async function getLocalPeerId(
  containerName: string,
  launchedNetwork: LaunchedNetwork
): Promise<string | null> {
  const port = launchedNetwork.getContainerPort(containerName);
  const response = await fetch(`http://127.0.0.1:${port}`, {
    method: "POST",
    headers: JSON_RPC_HEADERS,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "system_localPeerId", params: [] })
  });
  if (!response.ok) {
    logger.error(`HTTP ${response.status} for ${containerName} on port ${port}`);
    return "";
  }
  return (await response.json()) as string;
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

    const networkId = options.launchedNetwork.networkId;
    const mspContainerName = `storagehub-msp-${networkId}`;
    const bspContainerName = `storagehub-bsp-${networkId}`;

    const [mspPeerId, bspPeerId] = await Promise.all([
      getLocalPeerId(mspContainerName, options.launchedNetwork),
      getLocalPeerId(bspContainerName, options.launchedNetwork)
    ]);

    const mspMultiaddresses = mspPeerId
      ? [`/dns/${mspContainerName}/tcp/30333/p2p/${mspPeerId}`]
      : [];
    if (mspMultiaddresses.length > 0) {
      logger.info(`📡 MSP multiaddresses: ${mspMultiaddresses.join(", ")}`);
    } else {
      logger.warn("⚠️ MSP peer ID unavailable; registering without multiaddresses");
    }
    const bspMultiaddresses = bspPeerId
      ? [`/dns/${bspContainerName}/tcp/30333/p2p/${bspPeerId}`]
      : [];
    if (bspMultiaddresses.length > 0) {
      logger.info(`📡 BSP multiaddresses: ${bspMultiaddresses.join(", ")}`);
    } else {
      logger.warn("⚠️ BSP peer ID unavailable; registering without multiaddresses");
    }

    // Register MSP
    logger.info(`Registering MSP (${PROVIDERS.msp.name})...`);
    const mspId = generateProviderId(PROVIDERS.msp.accountId);
    logger.debug(`MSP ID: ${mspId}`);

    const mspCall = typedApi.tx.Providers.force_msp_sign_up({
      who: PROVIDERS.msp.accountId,
      msp_id: mspId,
      capacity: PROVIDERS.msp.capacity,
      value_prop_price_per_giga_unit_of_data_per_block: BigInt(1000),
      multiaddresses: mspMultiaddresses.map((addr) => Binary.fromText(addr)),
      commitment: Binary.fromText(`msp-${PROVIDERS.msp.name.toLowerCase()}`),
      value_prop_max_data_limit: BigInt(1_000_000),
      payment_account: PROVIDERS.msp.accountId
    });

    const mspTx = typedApi.tx.Sudo.sudo({ call: mspCall.decodedCall });
    const mspResult = await mspTx.signAndSubmit(aliceSigner);
    if (!mspResult.ok) {
      logger.error(
        `❌ MSP registration failed. Block: ${mspResult.block.hash}, tx: ${mspResult.txHash}`
      );
      logger.error(`Events: ${JSON.stringify(mspResult.events)}`);
      throw new Error("MSP registration extrinsic failed");
    }
    logger.success(
      `MSP (${PROVIDERS.msp.name}) registered successfully in block ${mspResult.block.hash}`
    );

    // Register BSP
    logger.info(`Registering BSP (${PROVIDERS.bsp.name})...`);
    const bspId = generateProviderId(PROVIDERS.bsp.accountId);
    logger.debug(`BSP ID: ${bspId}`);

    const bspCall = typedApi.tx.Providers.force_bsp_sign_up({
      who: PROVIDERS.bsp.accountId,
      bsp_id: bspId,
      capacity: PROVIDERS.bsp.capacity,
      multiaddresses: bspMultiaddresses.map((addr) => Binary.fromText(addr)),
      payment_account: PROVIDERS.bsp.accountId,
      weight: undefined
    });

    const bspTx = typedApi.tx.Sudo.sudo({ call: bspCall.decodedCall });
    const bspResult = await bspTx.signAndSubmit(aliceSigner);
    if (!bspResult.ok) {
      logger.error(
        `❌ BSP registration failed. Block: ${bspResult.block.hash}, tx: ${bspResult.txHash}`
      );
      logger.error(`Events: ${JSON.stringify(bspResult.events)}`);
      throw new Error("BSP registration extrinsic failed");
    }
    logger.success(
      `BSP(${ PROVIDERS.bsp.name }) registered successfully in block ${ bspResult.block.hash }`
    );

    const registeredMspId =
      await typedApi.query.Providers.AccountIdToMainStorageProviderId.getValue(
        PROVIDERS.msp.accountId
      );
    if (registeredMspId) {
      logger.success(`🔎 Confirmed MSP AccountId mapping -> ${ registeredMspId }`);
    } else {
      logger.warn("⚠️ MSP account mapping missing immediately after registration");
    }

    const registeredBspId =
      await typedApi.query.Providers.AccountIdToBackupStorageProviderId.getValue(
        PROVIDERS.bsp.accountId
      );
    if (registeredBspId) {
      logger.success(`🔎 Confirmed BSP AccountId mapping -> ${ registeredBspId }`);
    } else {
      logger.warn("⚠️ BSP account mapping missing immediately after registration");
    }

    logger.success("All providers registered successfully");
  } catch (error) {
    logger.error(`Provider registration failed: ${ error }`);
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

  const aliceContainerName = `datahaven - alice - ${ options.launchedNetwork.networkId } `;
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
      logger.success(`MSP registered with ID: ${mspId}`);

      // Check if BSP is registered
      logger.debug("Checking BSP registration...");
      const bspId = await typedApi.query.Providers.AccountIdToBackupStorageProviderId.getValue(
        PROVIDERS.bsp.accountId
      );

      if (!bspId) {
        logger.error(`❌ BSP (${PROVIDERS.bsp.name}) is NOT registered`);
        return false;
      }
      logger.success(`BSP registered with ID: ${bspId}`);

      logger.success("All providers verified successfully");
      return true;
    } catch (error) {
      logger.error(`Provider verification failed: ${error}`);
      return false;
    } finally {
        client.destroy();
    }
  }
