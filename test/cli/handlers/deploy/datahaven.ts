import fs from "node:fs";
import path from "node:path";
import { secp256k1 } from "@noble/curves/secp256k1";
import { $ } from "bun";
import invariant from "tiny-invariant";
import { createPapiConnectors, logger, printDivider, printHeader } from "utils";
import { waitFor } from "utils/waits";
import { type Hex, keccak256, toHex } from "viem";
import { publicKeyToAddress } from "viem/accounts";
import { isNetworkReady } from "../common/datahaven";
import { forwardPort } from "../common/kubernetes";
import type { LaunchedNetwork } from "../common/launchedNetwork";
import type { DeployOptions } from ".";

const DEFAULT_PUBLIC_WS_PORT = 9944;

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

  // Forward port from validator to localhost, to interact with the network.
  const { cleanup: validatorPortForwardCleanup } = await forwardPort(
    "dh-validator-0",
    DEFAULT_PUBLIC_WS_PORT,
    DEFAULT_PUBLIC_WS_PORT,
    launchedNetwork
  );

  // Wait for the network to start.
  logger.info("⌛️ Waiting for DataHaven to start...");
  await waitFor({
    lambda: async () => {
      const isReady = await isNetworkReady(DEFAULT_PUBLIC_WS_PORT);
      if (!isReady) {
        logger.debug("Node not ready, waiting 1 second...");
      }
      return isReady;
    },
    iterations: 30,
    delay: 1000,
    errorMessage: "DataHaven network not ready"
  });

  logger.success(
    `DataHaven network started, primary node accessible on port ${DEFAULT_PUBLIC_WS_PORT}`
  );

  await registerNodes(launchedNetwork);

  await setupDataHavenValidatorConfig(launchedNetwork);

  await validatorPortForwardCleanup();

  printDivider();
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

const registerNodes = async (launchedNetwork: LaunchedNetwork) => {
  // Register the validator node, using the standard host WS port that we just forwarded.
  launchedNetwork.addContainer("dh-validator-0", { ws: DEFAULT_PUBLIC_WS_PORT });
  logger.info("📝 Node dh-validator-0 successfully registered in launchedNetwork.");
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
export const setupDataHavenValidatorConfig = async (
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  const networkName = process.env.NETWORK || "anvil";
  logger.info(`🔧 Preparing DataHaven authorities configuration for network: ${networkName}...`);

  let authorityPublicKeys: string[] = [];
  const dhNodes = launchedNetwork.containers.filter((x) => x.name.startsWith("dh-validator-"));

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
