import fs from "node:fs";
import path from "node:path";
import { secp256k1 } from "@noble/curves/secp256k1";
import { datahaven } from "@polkadot-api/descriptors";
import { $ } from "bun";
import { createClient, type PolkadotClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";
import { type Hex, keccak256, toHex } from "viem";
import { publicKeyToAddress } from "viem/accounts";
import { DOCKER_NETWORK_NAME } from "../common/consts";
import type { LaunchedNetwork } from "../common/launchedNetwork";
import type { DeployOptions } from ".";

const DEFAULT_PUBLIC_WS_PORT = 9944;

// 33-byte compressed public keys for DataHaven next validator set
// These correspond to Alice & Bob
// These are the fallback keys if we can't fetch the next authorities directly from the network
const FALLBACK_DATAHAVEN_AUTHORITY_PUBLIC_KEYS: Record<string, string> = {
  alice: "0x020a1091341fe5664bfa1782d5e04779689068c916b04cb365ec3153755684d9a1",
  bob: "0x0390084fdbf27d2b79d26a4f13f0ccd982cb755a661969143c37cbc49ef5b91f27"
} as const;

/**
 * Deploys a DataHaven solochain network in a Kubernetes namespace.
 *
 * @param options - Configuration options for launching the network.
 * @param launchedNetwork - An instance of LaunchedNetwork to track the network's state.
 */
export const deployDataHavenSolochain = async (
  options: DeployOptions,
  launchedNetwork: LaunchedNetwork
) => {
  printHeader("Deploying DataHaven Network");

  invariant(options.datahavenImageTag, "❌ DataHaven image tag not defined");

  await checkTagExists(options.datahavenImageTag);

  await checkOrCreateKubernetesNamespace(launchedNetwork.kubeNamespace);

  // Create secret for Docker Hub credentials, if they were provided.
  if (options.dockerUsername && options.dockerPassword && options.dockerEmail) {
    logger.info("🔐 Creating Docker Hub secret...");
    logger.debug(
      await $`kubectl create secret docker-registry datahaven-dockerhub \
        --docker-username=${options.dockerUsername} \
        --docker-password=${options.dockerPassword} \
        --docker-email=${options.dockerEmail}`.text()
    );
    logger.success("Docker Hub secret created successfully");
  }

  // Deploy DataHaven bootnode and validators with helm chart.
  logger.info("🚀 Deploying DataHaven bootnode with helm chart...");
  logger.debug(
    await $`helm upgrade --install dh-bootnode . -f ./datahaven/dh-bootnode.yaml -n ${launchedNetwork.kubeNamespace}`
      .cwd(path.join(process.cwd(), "../deployment/charts/node"))
      .text()
  );
  logger.success("DataHaven bootnode deployed successfully");

  logger.info("🚀 Deploying DataHaven validators with helm chart...");
  logger.debug(
    await $`helm upgrade --install dh-validator . -f ./datahaven/dh-validator.yaml -n ${launchedNetwork.kubeNamespace}`
      .cwd(path.join(process.cwd(), "../deployment/charts/node"))
      .text()
  );
  logger.success("DataHaven validators deployed successfully");

  for (let i = 0; i < 30; i++) {
    logger.info("⌛️ Waiting for DataHaven to start...");
    if (await isNetworkReady(DEFAULT_PUBLIC_WS_PORT)) {
      logger.success(
        `DataHaven network started, primary node accessible on port ${DEFAULT_PUBLIC_WS_PORT}`
      );

      await registerNodes(launchedNetwork);

      // Call setupDataHavenValidatorConfig now that nodes are up.
      logger.info("🔧 Proceeding with DataHaven validator configuration setup...");
      await setupDataHavenValidatorConfig(launchedNetwork);

      printDivider();
      return;
    }
    logger.debug("Node not ready, waiting 1 second...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("DataHaven network failed to start after 30 seconds");
};

/**
 * Checks if an image exists in Docker Hub.
 *
 * @param tag - The tag of the image to check.
 * @returns A promise that resolves when the image is found.
 */
const checkTagExists = async (tag: string) => {
  const cleanTag = tag.trim();
  logger.debug(`Checking if image ${cleanTag} is available on Docker Hub`);
  const result = await $`docker manifest inspect ${cleanTag}`.nothrow().quiet();
  invariant(
    result.exitCode === 0,
    `❌ Image ${tag} not found.\n Does this image exist?\n Are you logged and have access to the repository?`
  );

  logger.success(`Image ${cleanTag} found on Docker Hub`);
};

/**
 * Checks if a Kubernetes namespace exists and creates it if it doesn't.
 *
 * @param namespace - The name of the namespace to check or create.
 * @returns A promise that resolves when the namespace exists or has been created.
 */
const checkOrCreateKubernetesNamespace = async (namespace: string) => {
  logger.info(`🔍 Checking if Kubernetes namespace "${namespace}" exists...`);

  // Check if namespace exists
  const checkResult = await $`kubectl get namespace ${namespace}`.nothrow().quiet();

  if (checkResult.exitCode === 0) {
    logger.success(`Namespace "${namespace}" already exists`);
    return;
  }

  logger.info(`📦 Creating Kubernetes namespace "${namespace}"...`);
  const createResult = await $`kubectl create namespace ${namespace}`.nothrow();

  if (createResult.exitCode !== 0) {
    throw new Error(`Failed to create namespace "${namespace}": ${createResult.stderr}`);
  }

  logger.success(`Successfully created namespace "${namespace}"`);
};

/**
 * Checks if the DataHaven network is ready by sending a POST request to the system_chain method.
 *
 * @param port - The port number to check.
 * @returns True if the network is ready, false otherwise.
 */
const isNetworkReady = async (port: number): Promise<boolean> => {
  const wsUrl = `ws://127.0.0.1:${port}`;
  let client: PolkadotClient | undefined;
  try {
    // Use withPolkadotSdkCompat for consistency, though _request might not strictly need it.
    client = createClient(withPolkadotSdkCompat(getWsProvider(wsUrl)));
    const chainName = await client._request<string>("system_chain", []);
    logger.debug(`isNetworkReady PAPI check successful for port ${port}, chain: ${chainName}`);
    client.destroy();
    return !!chainName; // Ensure it's a boolean and chainName is truthy
  } catch (error) {
    logger.debug(`isNetworkReady PAPI check failed for port ${port}: ${error}`);
    if (client) {
      client.destroy();
    }
    return false;
  }
};

const registerNodes = async (launchedNetwork: LaunchedNetwork) => {
  // Registering DataHaven nodes Docker network.
  launchedNetwork.networkName = DOCKER_NETWORK_NAME;

  const targetContainerName = "datahaven-alice";
  const aliceHostWsPort = 9944; // Standard host port for Alice's WS, as set during launch.

  logger.debug(`Checking Docker status for container: ${targetContainerName}`);
  // Use ^ and $ for an exact name match in the filter.
  const dockerPsOutput = await $`docker ps -q --filter "name=^${targetContainerName}$"`.text();
  const isContainerRunning = dockerPsOutput.trim().length > 0;

  if (!isContainerRunning) {
    // If the target Docker container is not running, we cannot register it.
    logger.warn(`⚠️ Docker container ${targetContainerName} is not running. Cannot register node.`);
    return;
  }

  // If the Docker container is running, proceed to register it in launchedNetwork.
  // We use the standard host WS port that "datahaven-alice" is expected to use.
  logger.debug(
    `Docker container ${targetContainerName} is running. Registering with WS port ${aliceHostWsPort}.`
  );
  launchedNetwork.addContainer(targetContainerName, { ws: aliceHostWsPort });
  logger.info(`📝 Node ${targetContainerName} successfully registered in launchedNetwork.`);
};

// Function to convert compressed public key to Ethereum address
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
 * Prepares the configuration for DataHaven authorities by converting their
 * compressed public keys to Ethereum addresses and saving them to a JSON file.
 */
export async function setupDataHavenValidatorConfig(
  launchedNetwork: LaunchedNetwork
): Promise<void> {
  const networkName = process.env.NETWORK || "anvil";
  logger.info(`🔧 Preparing DataHaven authorities configuration for network: ${networkName}...`);

  let authorityPublicKeys: string[] = [];
  const dhNodes = launchedNetwork.containers.filter((x) => x.name.startsWith("datahaven-"));

  if (dhNodes.length === 0) {
    logger.warn(
      "⚠️ No DataHaven nodes found in launchedNetwork. Falling back to hardcoded authority set for validator config."
    );
    authorityPublicKeys = Object.values(FALLBACK_DATAHAVEN_AUTHORITY_PUBLIC_KEYS);
  } else {
    const firstNode = dhNodes[0];
    const wsUrl = `ws://127.0.0.1:${firstNode.publicPorts.ws}`;
    let papiClient: PolkadotClient | undefined;
    try {
      logger.info(
        `📡 Attempting to fetch BEEFY next authorities from node ${firstNode.name} (port ${firstNode.publicPorts.ws})...`
      );
      papiClient = createClient(withPolkadotSdkCompat(getWsProvider(wsUrl)));
      const dhApi = papiClient.getTypedApi(datahaven);

      // Fetch NextAuthorities
      // Beefy.NextAuthorities returns a fixed-length array of bytes representing the authority public keys
      const nextAuthoritiesRaw = await dhApi.query.Beefy.NextAuthorities.getValue({ at: "best" });

      if (nextAuthoritiesRaw && nextAuthoritiesRaw.length > 0) {
        authorityPublicKeys = nextAuthoritiesRaw.map((key) => key.asHex()); // .asHex() returns the hex string representation of the corresponding key
        logger.success(
          `Successfully fetched ${authorityPublicKeys.length} BEEFY next authorities directly.`
        );
      } else {
        logger.warn(
          "⚠️ Fetched BEEFY nextAuthorities is empty. Falling back to hardcoded authority set."
        );
        authorityPublicKeys = Object.values(FALLBACK_DATAHAVEN_AUTHORITY_PUBLIC_KEYS);
      }
      papiClient.destroy();
    } catch (error) {
      logger.error(
        `❌ Error fetching BEEFY next authorities from node ${firstNode.name}: ${error}. Falling back to hardcoded authority set.`
      );
      authorityPublicKeys = Object.values(FALLBACK_DATAHAVEN_AUTHORITY_PUBLIC_KEYS);
      if (papiClient) {
        papiClient.destroy();
      }
    }
  }

  if (authorityPublicKeys.length === 0) {
    logger.error(
      "❌ No authority public keys available (neither fetched nor hardcoded). Cannot prepare validator config."
    );
    throw new Error("No DataHaven authority keys available.");
  }

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
      configJson.snowbridge = {};
      logger.warn(`"snowbridge" section not found in ${configFilePath}, created it.`);
    }

    configJson.snowbridge.initialValidators = authorityHashes;
    configJson.snowbridge.nextValidators = authorityHashes;

    fs.writeFileSync(configFilePath, JSON.stringify(configJson, null, 2));
    logger.success(`DataHaven authority hashes updated in: ${configFilePath}`);
  } catch (error) {
    logger.error(`❌ Failed to read or update ${configFilePath}: ${error}`);
    throw new Error(`Failed to update authority hashes in ${configFilePath}.`);
  }
}
