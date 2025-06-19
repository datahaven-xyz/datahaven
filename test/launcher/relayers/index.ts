import path from "node:path";
import { $ } from "bun";
import { createClient, type PolkadotClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { ANVIL_FUNDED_ACCOUNTS, getPortFromKurtosis, logger } from "utils";
import { waitFor } from "utils/waits";
import type { LaunchedNetwork } from "../types/launchedNetwork";
import { waitForContainerToStart, ZERO_HASH } from "../utils";
import { generateRelayerConfig } from "./config";
import { initEthClientPallet } from "./init-pallet";
import type {
  RelayerSpec,
  RelayersLaunchOptions,
  RelayersLaunchResult,
  RelayerType
} from "./types";

const CONFIG_DIR = "tmp/configs";
const DATASTORE_DIR = "tmp/snowbridge-relay-store";

export const launchRelayers = async (
  options: RelayersLaunchOptions,
  launchedNetwork: LaunchedNetwork
): Promise<RelayersLaunchResult> => {
  try {
    logger.info("🚀 Launching Snowbridge relayers...");

    // Get DataHaven node port
    const substrateWsPort = launchedNetwork.getPublicWsPort();
    const substrateNodeId = launchedNetwork.containers[0]?.name || "default";

    // Clean up existing containers
    await cleanupRelayers(options.networkId);

    // Wait for BEEFY to be ready
    await waitBeefyReady(launchedNetwork);

    // Get deployed contract addresses
    const deployments = await getDeployments();
    const beefyClientAddress = deployments.BeefyClient;
    const gatewayAddress = deployments.Gateway;

    if (!beefyClientAddress || !gatewayAddress) {
      throw new Error("❌ Required contract addresses not found in deployments");
    }

    // Get Ethereum endpoints
    const enclaveName = `eth-${options.networkId}`;
    const ethWsPort = await getPortFromKurtosis("el-1-reth-lodestar", "ws", enclaveName);
    const ethHttpPort = await getPortFromKurtosis("cl-1-lodestar-reth", "http", enclaveName);

    const ethElRpcEndpoint = `ws://host.docker.internal:${ethWsPort}`;
    const ethClEndpoint = `http://host.docker.internal:${ethHttpPort}`;
    const substrateWsEndpoint = `ws://${substrateNodeId}:${substrateWsPort}`;

    // Define relayers
    const relayers = defineRelayers({
      ethElRpcEndpoint,
      ethClEndpoint,
      substrateWsEndpoint,
      beefyClientAddress,
      gatewayAddress,
      networkId: options.networkId
    });

    // Setup directories
    const configDir = `${CONFIG_DIR}/${options.networkId}`;
    const datastorePath = `${DATASTORE_DIR}/${options.networkId}`;
    await $`mkdir -p ${configDir} ${datastorePath}`.quiet();

    // Generate configs
    for (const relayer of relayers) {
      await generateRelayerConfig(relayer, "local", configDir);
    }

    // Initialize EthClient pallet
    await initEthClientPallet(
      path.resolve(`${configDir}/beacon-relay.json`),
      options.relayerImageTag,
      datastorePath,
      launchedNetwork
    );

    // Launch relayers
    const activeRelayers = await launchRelayerContainers(
      relayers,
      datastorePath,
      launchedNetwork,
      options
    );

    logger.success("Snowbridge relayers launched successfully");

    return {
      success: true,
      activeRelayers: activeRelayers.map((r) => r.config.type),
      cleanup: () => cleanupRelayers(options.networkId)
    };
  } catch (error) {
    logger.error("Failed to launch relayers", error);
    await cleanupRelayers(options.networkId);
    return {
      success: false,
      error: error as Error
    };
  }
}

const cleanupRelayers = async (networkId: string): Promise<void> => {
  logger.info("🧹 Cleaning up relayer containers...");

  const containerPrefix = `snowbridge-${networkId}`;
  const containerIds = await $`docker ps -aq --filter "name=^${containerPrefix}-"`.text();

  if (containerIds.trim()) {
    await $`docker rm -f ${containerIds.split("\n").filter(Boolean)}`.quiet();
  }

  logger.success("Relayers cleanup completed");
}

const waitBeefyReady = async (launchedNetwork: LaunchedNetwork): Promise<void> => {
  logger.info("⏳ Waiting for BEEFY to be ready...");

  const dhWsPort = launchedNetwork.getPublicWsPort();
  const client: PolkadotClient = createClient(
    withPolkadotSdkCompat(getWsProvider(`ws://127.0.0.1:${dhWsPort}`))
  );

  await waitFor({
    lambda: async () => {
      const latestBeefyBlockHash = await client.getUnsafeApi().apis.BeefyApi.validator_set();
      return latestBeefyBlockHash !== ZERO_HASH;
    },
    iterations: 30,
    delay: 2000,
    errorMessage: "BEEFY not ready"
  });

  client.destroy();
  logger.success("BEEFY is ready");
}

const getDeployments = async (): Promise<Record<string, string>> => {
  const deploymentsFile = Bun.file("../contracts/deployments/anvil.json");
  const deployments = await deploymentsFile.json();
  return deployments;
}

const defineRelayers = (params: {
  ethElRpcEndpoint: string;
  ethClEndpoint: string;
  substrateWsEndpoint: string;
  beefyClientAddress: string;
  gatewayAddress: string;
  networkId: string;
}): RelayerSpec[] => {
  const containerPrefix = `snowbridge-${params.networkId}`;

  return [
    {
      name: `${containerPrefix}-🥩`,
      configFilePath: `${CONFIG_DIR}/${params.networkId}/beefy-relay.json`,
      config: {
        type: "beefy" as RelayerType,
        ethElRpcEndpoint: params.ethElRpcEndpoint,
        substrateWsEndpoint: params.substrateWsEndpoint,
        beefyClientAddress: params.beefyClientAddress,
        gatewayAddress: params.gatewayAddress
      },
      pk: {
        ethereum: ANVIL_FUNDED_ACCOUNTS[1].privateKey
      }
    },
    {
      name: `${containerPrefix}-🍻`,
      configFilePath: `${CONFIG_DIR}/${params.networkId}/beacon-relay.json`,
      config: {
        type: "beacon" as RelayerType,
        ethElRpcEndpoint: params.ethElRpcEndpoint,
        ethClEndpoint: params.ethClEndpoint,
        substrateWsEndpoint: params.substrateWsEndpoint,
        beefyClientAddress: params.beefyClientAddress,
        gatewayAddress: params.gatewayAddress
      }
    },
    {
      name: `${containerPrefix}-⚙️`,
      configFilePath: `${CONFIG_DIR}/${params.networkId}/execution-relay.json`,
      config: {
        type: "execution" as RelayerType,
        ethElRpcEndpoint: params.ethElRpcEndpoint,
        substrateWsEndpoint: params.substrateWsEndpoint
      }
    },
    {
      name: `${containerPrefix}-🚆`,
      configFilePath: `${CONFIG_DIR}/${params.networkId}/solochain-relay.json`,
      config: {
        type: "solochain" as RelayerType,
        ethElRpcEndpoint: params.ethElRpcEndpoint,
        substrateWsEndpoint: params.substrateWsEndpoint,
        gatewayAddress: params.gatewayAddress
      },
      pk: {
        substrate: "//Relay"
      }
    }
  ];
}

const launchRelayerContainers = async (
  relayers: RelayerSpec[],
  datastorePath: string,
  launchedNetwork: LaunchedNetwork,
  options: RelayersLaunchOptions
): Promise<RelayerSpec[]> => {
  const isLocal = options.relayerImageTag.endsWith(":local");

  for (const relayer of relayers) {
    const containerName = relayer.name;

    if (!isLocal) {
      await $`docker pull ${options.relayerImageTag}`.quiet();
    }

    const configAbsPath = path.resolve(relayer.configFilePath);
    const command = [
      "docker",
      "run",
      "-d",
      "--name",
      containerName,
      "--network",
      launchedNetwork.networkName,
      "--add-host",
      "host.docker.internal:host-gateway",
      "-v",
      `${configAbsPath}:/config/config.json`,
      "-v",
      `${path.resolve(datastorePath)}:/data/`,
      options.relayerImageTag,
      "run",
      "--",
      "--config",
      "/config/config.json"
    ];

    if (relayer.pk?.ethereum) {
      command.push("--ethereum.private-key", relayer.pk.ethereum);
    }
    if (relayer.pk?.substrate) {
      command.push("--substrate.private-key", relayer.pk.substrate);
    }

    await $`sh -c "${command.join(" ")}"`.quiet();
    await waitForContainerToStart(containerName);
  }

  return relayers;
}
