import fs from "node:fs";
import path from "node:path";
import { secp256k1 } from "@noble/curves/secp256k1";
import { createClient, type PolkadotClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import invariant from "tiny-invariant";
import { createPapiConnectors, logger } from "utils";
import { type Hex, keccak256, toHex } from "viem";
import { publicKeyToAddress } from "viem/accounts";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";

/**
 * Checks if the DataHaven network is ready by sending a POST request to the system_chain method.
 *
 * @param port - The port number to check.
 * @param timeoutMs - The timeout in milliseconds for the attempt to connect to the network.
 * @returns True if the network is ready, false otherwise.
 */
export const isNetworkReady = async (port: number, timeoutMs: number): Promise<boolean> => {
  const wsUrl = `ws://127.0.0.1:${port}`;
  let client: PolkadotClient | undefined;

  // Temporarily capture and suppress error logs during connection attempts.
  // This is to avoid the "Unable to connect to ws:" error logs from the `client._request` call.
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    // Use withPolkadotSdkCompat for consistency, though _request might not strictly need it.
    client = createClient(withPolkadotSdkCompat(getWsProvider(wsUrl)));

    // Add timeout to the RPC call to prevent hanging.
    const chainNamePromise = client._request<string>("system_chain", []);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("RPC call timeout")), timeoutMs);
    });

    const chainName = await Promise.race([chainNamePromise, timeoutPromise]);
    logger.debug(`isNetworkReady PAPI check successful for port ${port}, chain: ${chainName}`);
    client.destroy();
    return !!chainName; // Ensure it's a boolean and chainName is truthy
  } catch (error) {
    logger.debug(`isNetworkReady PAPI check failed for port ${port}: ${error}`);
    if (client) {
      client.destroy();
    }
    return false;
  } finally {
    // Restore original console methods.
    console.error = originalConsoleError;
  }
};

/**
 * Converts a compressed secp256k1 public key to an Ethereum address.
 *
 * This function takes a compressed public key (33 bytes), decompresses it to get the full
 * uncompressed public key (64 bytes of x and y coordinates), and then derives the
 * corresponding Ethereum address using the standard Ethereum address derivation algorithm.
 *
 * @param compressedPubKey - The compressed public key as a hex string (with or without "0x" prefix)
 * @returns The corresponding Ethereum address (checksummed, with "0x" prefix)
 *
 * @throws {Error} If the provided public key is invalid or cannot be decompressed
 */
export const compressedPubKeyToEthereumAddress = (compressedPubKey: string): string => {
  // Ensure the input is a hex string and remove "0x" prefix
  const compressedKeyHex = compressedPubKey.startsWith("0x")
    ? compressedPubKey.substring(2)
    : compressedPubKey;

  // Decompress the public key
  const point = secp256k1.ProjectivePoint.fromHex(compressedKeyHex);
  // toRawBytes(false) returns the uncompressed key (64 bytes, x and y coordinates)
  const uncompressedPubKeyBytes = point.toRawBytes(false);
  const uncompressedPubKeyHex = toHex(uncompressedPubKeyBytes); // Prefixes with "0x"

  // Compute the Ethereum address from the uncompressed public key
  // publicKeyToAddress expects a 0x-prefixed hex string representing the 64-byte uncompressed public key
  const address = publicKeyToAddress(uncompressedPubKeyHex);
  return address;
};

/**
 * Prepares the configuration for DataHaven authorities by fetching their BEEFY public keys,
 * converting them to Ethereum addresses, and updating the network configuration file.
 *
 * This function performs the following steps:
 * 1. Connects to the first available DataHaven node matching the container prefix
 * 2. Fetches the BEEFY NextAuthorities from the node's runtime
 * 3. Converts each compressed public key to an Ethereum address
 * 4. Computes the keccak256 hash of each address (authority hash)
 * 5. Updates the network configuration file with the authority hashes
 *
 * The configuration is saved to `../contracts/config/{NETWORK}.json` where NETWORK
 * defaults to "anvil" if not specified in environment variables.
 *
 * @param launchedNetwork - The launched network instance containing container information
 * @param containerNamePrefix - The prefix to filter DataHaven containers by (e.g., "datahaven-", "dh-validator-")
 *
 * @throws {Error} If no DataHaven nodes are found in the launched network
 * @throws {Error} If BEEFY authorities cannot be fetched from the node
 * @throws {Error} If public key conversion fails
 * @throws {Error} If the configuration file cannot be read or written
 */
export const setupDataHavenValidatorConfig = async (
  launchedNetwork: LaunchedNetwork,
  containerNamePrefix: string
): Promise<void> => {
  const networkName = process.env.NETWORK || "anvil";
  logger.info(`🔧 Preparing DataHaven authorities configuration for network: ${networkName}...`);

  let authorityPublicKeys: string[] = [];
  const dhNodes = launchedNetwork.containers.filter((x) => x.name.startsWith(containerNamePrefix));

  invariant(dhNodes.length > 0, "No DataHaven nodes found in launchedNetwork");

  const firstNode = dhNodes[0];
  const wsUrl = `ws://127.0.0.1:${firstNode.publicPorts.ws}`;
  const { client: papiClient, typedApi: dhApi } = createPapiConnectors(wsUrl);

  logger.info(
    `📡 Attempting to fetch BEEFY next authorities from node ${firstNode.name} (port ${firstNode.publicPorts.ws})...`
  );

  // Fetch NextAuthorities
  // Beefy.NextAuthorities returns a fixed-length array of bytes representing the authority public keys
  const nextAuthoritiesRaw = await dhApi.query.Beefy.NextAuthorities.getValue({ at: "best" });

  invariant(nextAuthoritiesRaw && nextAuthoritiesRaw.length > 0, "No BEEFY next authorities found");

  authorityPublicKeys = nextAuthoritiesRaw.map((key) => key.asHex()); // .asHex() returns the hex string representation of the corresponding key
  logger.success(
    `Successfully fetched ${authorityPublicKeys.length} BEEFY next authorities directly.`
  );

  // Clean up PAPI client, otherwise it will hang around and prevent this process from exiting.
  papiClient.destroy();

  const authorityHashes: string[] = [];
  for (const compressedKey of authorityPublicKeys) {
    try {
      const ethAddress = compressedPubKeyToEthereumAddress(compressedKey);
      const authorityHash = keccak256(ethAddress as Hex);
      authorityHashes.push(authorityHash);
      logger.debug(
        `Processed public key ${compressedKey} -> ETH address ${ethAddress} -> Authority hash ${authorityHash}`
      );
    } catch (error) {
      logger.error(`❌ Failed to process public key ${compressedKey}: ${error}`);
      throw new Error(`Failed to process public key ${compressedKey}`);
    }
  }

  // process.cwd() is 'test/', so config is at '../contracts/config'
  const configDir = path.join(process.cwd(), "../contracts/config");
  const configFilePath = path.join(configDir, `${networkName}.json`);

  try {
    if (!fs.existsSync(configFilePath)) {
      logger.warn(
        `⚠️ Configuration file ${configFilePath} not found. Skipping update of validator sets.`
      );
      // Optionally, create a default structure if it makes sense, or simply return.
      // For now, if the base network config doesn't exist, we can't update it.
      return;
    }

    const configFileContent = fs.readFileSync(configFilePath, "utf-8");
    const configJson = JSON.parse(configFileContent);

    if (!configJson.snowbridge) {
      logger.warn(`⚠️ "snowbridge" section not found in ${configFilePath}, creating it.`);
      configJson.snowbridge = {};
    }

    configJson.snowbridge.initialValidators = authorityHashes;
    configJson.snowbridge.nextValidators = authorityHashes;

    fs.writeFileSync(configFilePath, JSON.stringify(configJson, null, 2));
    logger.success(`DataHaven authority hashes updated in: ${configFilePath}`);
  } catch (error) {
    logger.error(`❌ Failed to read or update ${configFilePath}: ${error}`);
    throw new Error(`Failed to update authority hashes in ${configFilePath}.`);
  }
};
