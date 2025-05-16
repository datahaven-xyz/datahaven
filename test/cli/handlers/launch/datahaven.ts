import fs from "node:fs";
import path from "node:path";
import { secp256k1 } from "@noble/curves/secp256k1";
import { datahaven } from "@polkadot-api/descriptors";
import { $ } from "bun";
import { type PolkadotClient, createClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import invariant from "tiny-invariant";
import { waitForContainerToStart, waitForLog } from "utils";
import { confirmWithTimeout, logger, printDivider, printHeader } from "utils";
import { type Hex, keccak256, toHex } from "viem";
import { publicKeyToAddress } from "viem/accounts";
import type { LaunchOptions } from ".";
import type { LaunchedNetwork } from "./launchedNetwork";

const COMMON_LAUNCH_ARGS = [
  "--unsafe-force-node-key-generation",
  "--tmp",
  "--validator",
  "--discover-local",
  "--no-prometheus",
  "--unsafe-rpc-external",
  "--rpc-cors=all",
  "--force-authoring",
  "--no-telemetry",
  "--enable-offchain-indexing=true"
];

const DEFAULT_PUBLIC_WS_PORT = 9944;

// We need 5 since the (2/3 + 1) of 6 authority set is 5
// <repo_root>/operator/runtime/src/genesis_config_presets.rs#L94
const CLI_AUTHORITY_IDS = ["alice", "bob", "charlie", "dave", "eve"] as const;

// 33-byte compressed public keys for DataHaven next validator set
// These correspond to Alice, Bob, Charlie, Dave, Eve, Ferdie
// These are the fallback keys if we can't fetch the next authorities directly from the network
const FALLBACK_DATAHAVEN_AUTHORITY_PUBLIC_KEYS: Record<string, string> = {
  alice: "0x020a1091341fe5664bfa1782d5e04779689068c916b04cb365ec3153755684d9a1",
  bob: "0x0390084fdbf27d2b79d26a4f13f0ccd982cb755a661969143c37cbc49ef5b91f27",
  charlie: "0x031d10105e323c4afce225208f71a6441ee327a65b9e646e772500c74d31f669aa",
  dave: "0x0291f1217d5a04cb83312ee3d88a6e6b33284e053e6ccfc3a90339a0299d12967c",
  eve: "0x0389411795514af1627765eceffcbd002719f031604fadd7d188e2dc585b4e1afb",
  ferdie: "0x03bc9d0ca094bd5b8b3225d7651eac5d18c1c04bf8ae8f8b263eebca4e1410ed0c"
} as const;

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
      await papiClient.destroy();
    } catch (error) {
      logger.error(
        `❌ Error fetching BEEFY next authorities from node ${firstNode.name}: ${error}. Falling back to hardcoded authority set.`
      );
      authorityPublicKeys = Object.values(FALLBACK_DATAHAVEN_AUTHORITY_PUBLIC_KEYS);
      if (papiClient) {
        await papiClient.destroy(); // Ensure client is destroyed even on error
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

/**
 * Launches a DataHaven solochain network for testing.
 *
 * @param options - Configuration options for launching the network.
 * @param launchedNetwork - An instance of LaunchedNetwork to track the network's state.
 */
export const launchDataHavenSolochain = async (
  options: LaunchOptions,
  launchedNetwork: LaunchedNetwork
) => {
  printHeader("Starting DataHaven Network");

  let shouldLaunchDataHaven = options.datahaven;

  if ((await checkDataHavenRunning()) && !options.alwaysClean) {
    logger.info("ℹ️  DataHaven network (Docker containers) is already running.");

    logger.trace("Checking if datahaven option was set via flags");
    if (options.datahaven === false) {
      logger.info("Keeping existing DataHaven containers.");

      await registerNodes(launchedNetwork);
      printDivider();
      return;
    }

    if (options.datahaven === true) {
      logger.info("Proceeding to clean and relaunch DataHaven containers...");
      await cleanDataHavenContainers();
    } else {
      const shouldRelaunch = await confirmWithTimeout(
        "Do you want to clean and relaunch the DataHaven containers?",
        true,
        10
      );

      if (!shouldRelaunch) {
        logger.info("Keeping existing DataHaven containers.");

        await registerNodes(launchedNetwork);
        printDivider();
        return;
      }
      logger.info("Proceeding to clean and relaunch DataHaven containers...");
      await cleanDataHavenContainers();
    }
  }

  if (shouldLaunchDataHaven === undefined) {
    shouldLaunchDataHaven = await confirmWithTimeout(
      "Do you want to launch the DataHaven network?",
      true,
      10
    );
  } else {
    logger.info(
      `Using flag option: ${shouldLaunchDataHaven ? "will launch" : "will not launch"} DataHaven network`
    );
  }

  if (!shouldLaunchDataHaven) {
    logger.info("Skipping DataHaven network launch. Done!");
    printDivider();
    return;
  }

  invariant(options.datahavenImageTag, "❌ Datahaven image tag not defined");

  await checkTagExists(options.datahavenImageTag);

  const logsPath = `tmp/logs/${launchedNetwork.getRunId()}/`;
  logger.debug(`Ensuring logs directory exists: ${logsPath}`);
  await $`mkdir -p ${logsPath}`.quiet();

  for (const id of CLI_AUTHORITY_IDS) {
    logger.info(`Starting ${id}...`);
    const containerName = `datahaven-${id}`;

    const command: string[] = [
      "docker",
      "run",
      "-d",
      "--platform",
      "linux/amd64",
      "--name",
      containerName,
      ...(id === "alice" ? ["-p", `${DEFAULT_PUBLIC_WS_PORT}:9944`] : []),
      options.datahavenImageTag,
      `--${id}`,
      ...COMMON_LAUNCH_ARGS
    ];

    logger.debug($`sh -c "${command.join(" ")}"`.text());

    await waitForContainerToStart(containerName);
    const listeningLine = await waitForLog({
      search: "Running JSON-RPC server: addr=0.0.0.0:",
      containerName,
      timeoutSeconds: 30
    });
    logger.debug(listeningLine);
  }

  for (let i = 0; i < 30; i++) {
    logger.info("Waiting for datahaven to start...");
    if (await isNetworkReady(DEFAULT_PUBLIC_WS_PORT)) {
      logger.success(
        `DataHaven network started, primary node accessible on port ${DEFAULT_PUBLIC_WS_PORT}`
      );

      await registerNodes(launchedNetwork);

      // Call setupDataHavenValidatorConfig now that nodes are up
      logger.info("Proceeding with DataHaven validator configuration setup...");
      await setupDataHavenValidatorConfig(launchedNetwork);

      printDivider();
      return;
    }
    logger.debug("Node not ready, waiting 1 second...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Datahaven network failed to start after 30 seconds");
};

/**
 * Checks if any DataHaven containers are currently running.
 *
 * @returns True if any DataHaven containers are running, false otherwise.
 */
const checkDataHavenRunning = async (): Promise<boolean> => {
  // Check for any container whose name starts with "datahaven-"
  const PIDS = await $`docker ps -q --filter "name=^datahaven-"`.text();
  return PIDS.trim().length > 0;
};

/**
 * Stops and removes all DataHaven containers.
 */
const cleanDataHavenContainers = async (): Promise<void> => {
  logger.info("🧹 Stopping and removing existing DataHaven containers...");
  const containerIds = (await $`docker ps -a -q --filter "name=^datahaven-"`.text()).trim();
  logger.debug(`Container IDs: ${containerIds}`);
  if (containerIds.length > 0) {
    const idsArray = containerIds
      .split("\n")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    for (const id of idsArray) {
      logger.debug(`Stopping container ${id}`);
      logger.debug(await $`docker stop ${id}`.nothrow().text());
      logger.debug(await $`docker rm ${id}`.nothrow().text());
    }
  }
  logger.info("✅ Existing DataHaven containers stopped and removed.");
};

/**
 * Checks if the DataHaven network is ready by sending a POST request to the system_chain method.
 *
 * @param port - The port number to check.
 * @returns True if the network is ready, false otherwise.
 */
export const isNetworkReady = async (port: number): Promise<boolean> => {
  const wsUrl = `ws://127.0.0.1:${port}`;
  let client: PolkadotClient | undefined;
  try {
    // Use withPolkadotSdkCompat for consistency, though _request might not strictly need it.
    client = createClient(withPolkadotSdkCompat(getWsProvider(wsUrl)));
    const chainName = await client._request<string>("system_chain", []);
    logger.debug(`isNetworkReady PAPI check successful for port ${port}, chain: ${chainName}`);
    await client.destroy();
    return !!chainName; // Ensure it's a boolean and chainName is truthy
  } catch (error) {
    logger.debug(`isNetworkReady PAPI check failed for port ${port}: ${error}`);
    if (client) {
      await client.destroy();
    }
    return false;
  }
};

/**
 * Checks if an image exists locally or on Docker Hub.
 *
 * @param tag - The tag of the image to check.
 * @returns A promise that resolves when the image is found.
 */
const checkTagExists = async (tag: string) => {
  const cleaned = tag.trim();
  logger.debug(`Checking if image  ${cleaned} is available locally`);
  const { exitCode: localExists } = await $`docker image inspect ${cleaned}`.nothrow().quiet();

  if (localExists !== 0) {
    logger.debug(`Checking if image ${cleaned} is available on docker hub`);
    const result = await $`docker manifest inspect ${cleaned}`.nothrow().quiet();
    invariant(
      result.exitCode === 0,
      `❌ Image ${tag} not found.\n Does this image exist?\n Are you logged and have access to the repository?`
    );
  }

  logger.success(`Image ${tag} found locally`);
};

const registerNodes = async (launchedNetwork: LaunchedNetwork) => {
  const targetContainerName = "datahaven-alice";
  const aliceHostWsPort = 9944; // Standard host port for Alice's WS, as set during launch.

  logger.debug(`Checking Docker status for container: ${targetContainerName}`);
  // Use ^ and $ for an exact name match in the filter.
  const dockerPsOutput = await $`docker ps -q --filter "name=^${targetContainerName}$"`.text();
  const isContainerRunning = dockerPsOutput.trim().length > 0;

  if (!isContainerRunning) {
    // If the target Docker container is not running, we cannot register it.
    throw new Error(
      `❌ Docker container ${targetContainerName} is not running. Cannot register node.`
    );
  }

  // If the Docker container is running, proceed to register it in launchedNetwork.
  // We use the standard host WS port that "datahaven-alice" is expected to use.
  logger.info(
    `✅ Docker container ${targetContainerName} is running. Registering with WS port ${aliceHostWsPort}.`
  );
  launchedNetwork.addContainer(targetContainerName, { ws: aliceHostWsPort });
  logger.success(`👍 Node ${targetContainerName} successfully registered in launchedNetwork.`);
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
