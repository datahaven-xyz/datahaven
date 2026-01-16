import { $ } from "bun";
import { getContainersMatchingImage, getPortFromKurtosis, logger } from "utils";
import { ParameterCollection } from "utils/parameters";
import { updateParameters } from "../../scripts/deploy-contracts";
import { deployContracts } from "../contracts";
import { launchLocalDataHavenSolochain } from "../datahaven";
import { getRunningKurtosisEnclaves, launchKurtosisNetwork } from "../kurtosis";
import { setDataHavenParameters } from "../parameters";
import { launchRelayers } from "../relayers";
import {
  launchBspNode,
  launchFishermanNode,
  launchIndexerNode,
  launchMspNode,
  launchStorageHubPostgres
} from "../storagehub-docker";
import type {
  ChainLaunchResult,
  CrossChainLaunchResult,
  NetworkLaunchOptions,
  StorageLaunchResult
} from "../types";
import { LaunchedNetwork, SuiteType } from "../types";
import { checkBaseDependencies } from "../utils";
import { COMPONENTS } from "../utils/constants";
import { fundValidators, setupValidators } from "../validators";

// Authority IDs for test networks
const TEST_AUTHORITY_IDS = ["alice", "bob"] as const;

/**
 * Validates that the network ID is unique and no resources with this ID exist.
 * @throws {Error} if resources with the network ID already exist
 */
const validateNetworkIdUnique = async (networkId: string): Promise<void> => {
  logger.info(`🔍 Validating network ID uniqueness: ${networkId}`);

  // Check for existing DataHaven containers
  const datahavenContainers = await getContainersMatchingImage(COMPONENTS.datahaven.imageName);
  const conflictingDatahaven = datahavenContainers.filter((c) =>
    c.Names.some((name) => name.includes(networkId))
  );
  if (conflictingDatahaven.length > 0) {
    throw new Error(
      `DataHaven containers with network ID '${networkId}' already exist. ` +
        `Run 'bun cli stop --all' or remove containers manually.`
    );
  }

  // Check for existing relayer containers
  const relayerContainers = await getContainersMatchingImage(COMPONENTS.snowbridge.imageName);
  const conflictingRelayers = relayerContainers.filter((c) =>
    c.Names.some((name) => name.includes(networkId))
  );
  if (conflictingRelayers.length > 0) {
    throw new Error(
      `Relayer containers with network ID '${networkId}' already exist. ` +
        `Run 'bun cli stop --all' or remove containers manually.`
    );
  }

  // Check for existing Kurtosis enclaves
  const enclaves = await getRunningKurtosisEnclaves();
  const enclaveName = `eth-${networkId}`;
  const conflictingEnclaves = enclaves.filter((e) => e.name === enclaveName);
  if (conflictingEnclaves.length > 0) {
    throw new Error(
      `Kurtosis enclave '${enclaveName}' already exists. ` +
        `Run 'kurtosis enclave rm ${enclaveName}' to remove it.`
    );
  }

  // Check for existing Docker network
  const dockerNetworkName = `datahaven-${networkId}`;
  const networkOutput =
    await $`docker network ls --filter "name=^${dockerNetworkName}$" --format "{{.Name}}"`.text();
  if (networkOutput.trim()) {
    throw new Error(
      `Docker network '${dockerNetworkName}' already exists. ` +
        `Run 'docker network rm ${dockerNetworkName}' to remove it.`
    );
  }

  logger.success(`Network ID '${networkId}' is available`);
};

/**
 * Creates a cleanup function for Chain-only networks.
 */
const createChainCleanupFunction = (networkId: string) => {
  return async () => {
    logger.info(`🧹 Cleaning up Chain network: ${networkId}`);

    try {
      // Stop DataHaven containers
      const datahavenContainers = await getContainersMatchingImage(COMPONENTS.datahaven.imageName);
      const networkDatahaven = datahavenContainers.filter((c) =>
        c.Names.some((name) => name.includes(networkId))
      );
      if (networkDatahaven.length > 0) {
        logger.info(`🔨 Stopping ${networkDatahaven.length} DataHaven containers...`);
        for (const container of networkDatahaven) {
          await $`docker stop ${container.Id}`.nothrow();
          await $`docker rm ${container.Id}`.nothrow();
        }
      }

      // Remove Docker network
      const dockerNetworkName = `datahaven-${networkId}`;
      logger.info(`🔨 Removing Docker network: ${dockerNetworkName}`);
      await $`docker network rm -f ${dockerNetworkName}`.nothrow();

      logger.success(`Cleanup completed for Chain network: ${networkId}`);
    } catch (error) {
      logger.error(`❌ Cleanup failed for network ${networkId}:`, error);
    }
  };
};

/**
 * Creates a cleanup function for Storage networks.
 */
const createStorageCleanupFunction = (networkId: string) => {
  return async () => {
    logger.info(`🧹 Cleaning up Storage network: ${networkId}`);

    try {
      // Stop StorageHub containers (postgres, msp, bsp, indexer, fisherman)
      const storagehubContainers = [
        `storagehub-postgres-${networkId}`,
        `storagehub-msp-${networkId}`,
        `storagehub-bsp-${networkId}`,
        `storagehub-indexer-${networkId}`,
        `storagehub-fisherman-${networkId}`
      ];
      for (const containerName of storagehubContainers) {
        await $`docker stop ${containerName}`.nothrow();
        await $`docker rm ${containerName}`.nothrow();
      }

      // Stop DataHaven containers
      const datahavenContainers = await getContainersMatchingImage(COMPONENTS.datahaven.imageName);
      const networkDatahaven = datahavenContainers.filter((c) =>
        c.Names.some((name) => name.includes(networkId))
      );
      if (networkDatahaven.length > 0) {
        logger.info(`🔨 Stopping ${networkDatahaven.length} DataHaven containers...`);
        for (const container of networkDatahaven) {
          await $`docker stop ${container.Id}`.nothrow();
          await $`docker rm ${container.Id}`.nothrow();
        }
      }

      // Remove Docker network
      const dockerNetworkName = `datahaven-${networkId}`;
      logger.info(`🔨 Removing Docker network: ${dockerNetworkName}`);
      await $`docker network rm -f ${dockerNetworkName}`.nothrow();

      logger.success(`Cleanup completed for Storage network: ${networkId}`);
    } catch (error) {
      logger.error(`❌ Cleanup failed for network ${networkId}:`, error);
    }
  };
};

/**
 * Creates a cleanup function for CrossChain networks.
 */
const createCrossChainCleanupFunction = (networkId: string) => {
  return async () => {
    logger.info(`🧹 Cleaning up CrossChain network: ${networkId}`);

    try {
      // 1. Stop relayer containers
      const relayerContainers = await getContainersMatchingImage(COMPONENTS.snowbridge.imageName);
      const networkRelayers = relayerContainers.filter((c) =>
        c.Names.some((name) => name.includes(networkId))
      );
      if (networkRelayers.length > 0) {
        logger.info(`🔨 Stopping ${networkRelayers.length} relayer containers...`);
        for (const container of networkRelayers) {
          await $`docker stop ${container.Id}`.nothrow();
          await $`docker rm ${container.Id}`.nothrow();
        }
      }

      // 2. Stop DataHaven containers
      const datahavenContainers = await getContainersMatchingImage(COMPONENTS.datahaven.imageName);
      const networkDatahaven = datahavenContainers.filter((c) =>
        c.Names.some((name) => name.includes(networkId))
      );
      if (networkDatahaven.length > 0) {
        logger.info(`🔨 Stopping ${networkDatahaven.length} DataHaven containers...`);
        for (const container of networkDatahaven) {
          await $`docker stop ${container.Id}`.nothrow();
          await $`docker rm ${container.Id}`.nothrow();
        }
      }

      // 3. Remove Docker network
      const dockerNetworkName = `datahaven-${networkId}`;
      logger.info(`🔨 Removing Docker network: ${dockerNetworkName}`);
      await $`docker network rm -f ${dockerNetworkName}`.nothrow();

      // 4. Remove Kurtosis enclave
      const enclaveName = `eth-${networkId}`;
      logger.info(`🔨 Removing Kurtosis enclave: ${enclaveName}`);
      await $`kurtosis enclave rm ${enclaveName} -f`.nothrow();

      logger.success(`Cleanup completed for CrossChain network: ${networkId}`);
    } catch (error) {
      logger.error(`❌ Cleanup failed for network ${networkId}:`, error);
    }
  };
};

/**
 * Launches a Chain-only network (2 validator nodes).
 *
 * This is the base network setup used by all suite types.
 *
 * @param options - Configuration options for the network launch
 * @returns ChainLaunchResult with cleanup function
 */
export const launchChainNetwork = async (
  options: NetworkLaunchOptions
): Promise<ChainLaunchResult> => {
  const networkId = options.networkId;
  const launchedNetwork = new LaunchedNetwork();
  launchedNetwork.networkName = networkId;

  let cleanup: (() => Promise<void>) | undefined;

  try {
    logger.info(`🚀 Launching Chain network with ID: ${networkId}`);
    const startTime = performance.now();

    // Check base dependencies
    await checkBaseDependencies();

    // Validate network ID is unique
    await validateNetworkIdUnique(networkId);

    // Create cleanup function
    cleanup = createChainCleanupFunction(networkId);

    // Launch Chain network
    logger.info("📦 Launching Chain validator nodes...");
    await launchLocalDataHavenSolochain(
      {
        networkId,
        datahavenImageTag: options.datahavenImageTag || "datahavenxyz/datahaven:local",
        relayerImageTag: options.relayerImageTag || "datahavenxyz/snowbridge-relay:latest",
        authorityIds: TEST_AUTHORITY_IDS,
        buildDatahaven: options.buildDatahaven ?? !isCI,
        datahavenBuildExtraArgs: options.datahavenBuildExtraArgs || "--features=fast-runtime"
      },
      launchedNetwork
    );

    // Log success
    const endTime = performance.now();
    const seconds = ((endTime - startTime) / 1000).toFixed(1);
    logger.success(`Chain network launched successfully in ${seconds} seconds`);

    // Return connectors
    const aliceContainerName = `datahaven-alice-${networkId}`;
    const wsPort = launchedNetwork.getContainerPort(aliceContainerName);

    return {
      launchedNetwork,
      dataHavenRpcUrl: `http://127.0.0.1:${wsPort}`,
      cleanup
    };
  } catch (error) {
    logger.error("❌ Failed to launch Chain network", error);

    if (cleanup) {
      logger.info("🧹 Running cleanup due to launch failure...");
      await cleanup();
    }

    throw error;
  }
};

/**
 * Launches a Storage network (Chain + StorageHub components).
 *
 * Includes: 2 validator nodes, PostgreSQL, MSP, BSP, Indexer, Fisherman
 *
 * @param options - Configuration options for the network launch
 * @returns StorageLaunchResult with cleanup function
 */
export const launchStorageNetwork = async (
  options: NetworkLaunchOptions
): Promise<StorageLaunchResult> => {
  const networkId = options.networkId;
  const launchedNetwork = new LaunchedNetwork();
  launchedNetwork.networkName = networkId;

  let cleanup: (() => Promise<void>) | undefined;

  try {
    logger.info(`🚀 Launching Storage network with ID: ${networkId}`);
    const startTime = performance.now();

    // Check base dependencies
    await checkBaseDependencies();

    // Validate network ID is unique
    await validateNetworkIdUnique(networkId);

    // Create cleanup function
    cleanup = createStorageCleanupFunction(networkId);

    const datahavenOptions = {
      networkId,
      datahavenImageTag: options.datahavenImageTag || "datahavenxyz/datahaven:local",
      relayerImageTag: options.relayerImageTag || "datahavenxyz/snowbridge-relay:latest",
      authorityIds: TEST_AUTHORITY_IDS,
      buildDatahaven: options.buildDatahaven ?? !isCI,
      datahavenBuildExtraArgs: options.datahavenBuildExtraArgs || "--features=fast-runtime"
    };

    // 1. Launch DataHaven validator nodes
    logger.info("📦 Launching DataHaven validator nodes...");
    await launchLocalDataHavenSolochain(datahavenOptions, launchedNetwork);

    // 2. Launch PostgreSQL database
    logger.info("🗄️ Launching StorageHub PostgreSQL...");
    await launchStorageHubPostgres(datahavenOptions, launchedNetwork);

    // 3. Launch MSP node
    logger.info("📦 Launching MSP node...");
    await launchMspNode(datahavenOptions, launchedNetwork);

    // 4. Launch BSP node
    logger.info("📦 Launching BSP node...");
    await launchBspNode(datahavenOptions, launchedNetwork);

    // 5. Launch Indexer node
    logger.info("📦 Launching Indexer node...");
    await launchIndexerNode(datahavenOptions, launchedNetwork);

    // 6. Launch Fisherman node
    logger.info("📦 Launching Fisherman node...");
    await launchFishermanNode(datahavenOptions, launchedNetwork);

    // Log success
    const endTime = performance.now();
    const minutes = ((endTime - startTime) / (1000 * 60)).toFixed(1);
    logger.success(`Storage network launched successfully in ${minutes} minutes`);

    // Get container ports
    const aliceContainerName = `datahaven-alice-${networkId}`;
    const mspContainerName = `storagehub-msp-${networkId}`;
    const bspContainerName = `storagehub-bsp-${networkId}`;
    const indexerContainerName = `storagehub-indexer-${networkId}`;
    const postgresContainerName = `storagehub-postgres-${networkId}`;

    return {
      launchedNetwork,
      dataHavenRpcUrl: `http://127.0.0.1:${launchedNetwork.getContainerPort(aliceContainerName)}`,
      mspRpcUrl: `http://127.0.0.1:${launchedNetwork.getContainerPort(mspContainerName, "ws")}`,
      bspRpcUrl: `http://127.0.0.1:${launchedNetwork.getContainerPort(bspContainerName, "ws")}`,
      indexerRpcUrl: `http://127.0.0.1:${launchedNetwork.getContainerPort(indexerContainerName, "ws")}`,
      postgresUrl: `postgresql://indexer:indexer@127.0.0.1:${launchedNetwork.getContainerPort(postgresContainerName, "postgres")}/datahaven`,
      cleanup
    };
  } catch (error) {
    logger.error("❌ Failed to launch Storage network", error);

    if (cleanup) {
      logger.info("🧹 Running cleanup due to launch failure...");
      await cleanup();
    }

    throw error;
  }
};

/**
 * Launches a CrossChain network (Chain + Ethereum + contracts + relayers).
 *
 * This is the full network setup for cross-chain testing.
 *
 * @param options - Configuration options for the network launch
 * @returns CrossChainLaunchResult with cleanup function
 */
export const launchCrossChainNetwork = async (
  options: NetworkLaunchOptions
): Promise<CrossChainLaunchResult> => {
  const networkId = options.networkId;
  const launchedNetwork = new LaunchedNetwork();
  launchedNetwork.networkName = networkId;
  let injectContracts = false;

  if (process.env.INJECT_CONTRACTS === "true") {
    injectContracts = true;
  }

  let cleanup: (() => Promise<void>) | undefined;

  try {
    logger.info(`🚀 Launching CrossChain network stack with ID: ${networkId}`);
    const startTime = performance.now();

    // Check base dependencies
    await checkBaseDependencies();

    // Validate network ID is unique
    await validateNetworkIdUnique(networkId);

    // Create cleanup function
    cleanup = createCrossChainCleanupFunction(networkId);

    // Create parameter collection for use throughout the launch
    const parameterCollection = new ParameterCollection();

    // 1. Launch DataHaven network
    logger.info("📦 Launching DataHaven network...");
    await launchLocalDataHavenSolochain(
      {
        networkId,
        datahavenImageTag: options.datahavenImageTag || "datahavenxyz/datahaven:local",
        relayerImageTag: options.relayerImageTag || "datahavenxyz/snowbridge-relay:latest",
        authorityIds: TEST_AUTHORITY_IDS,
        buildDatahaven: options.buildDatahaven ?? !isCI,
        datahavenBuildExtraArgs: options.datahavenBuildExtraArgs || "--features=fast-runtime"
      },
      launchedNetwork
    );

    // 2. Launch Ethereum/Kurtosis network
    logger.info("⚡️ Launching Kurtosis Ethereum network...");
    const kurtosisEnclaveName = `eth-${networkId}`;
    await launchKurtosisNetwork(
      {
        kurtosisEnclaveName: kurtosisEnclaveName,
        blockscout: options.blockscout ?? false,
        slotTime: options.slotTime || 1,
        kurtosisNetworkArgs: options.kurtosisNetworkArgs,
        injectContracts
      },
      launchedNetwork
    );

    // 3. Deploy contracts
    if (injectContracts) {
      logger.info("📄 Smart contracts injected.");
    } else {
      logger.info("📄 Deploying smart contracts...");
      let blockscoutBackendUrl: string | undefined;
      if (options.blockscout) {
        const blockscoutPort = await getPortFromKurtosis("blockscout", "http", kurtosisEnclaveName);
        blockscoutBackendUrl = `http://127.0.0.1:${blockscoutPort}`;
      }

      await deployContracts({
        rpcUrl: launchedNetwork.elRpcUrl,
        verified: options.verified ?? false,
        blockscoutBackendUrl,
        parameterCollection
      });
    }

    if (!launchedNetwork.elRpcUrl) {
      throw new Error("Ethereum RPC URL not available");
    }

    // 4. Fund validators
    logger.info("💰 Funding validators...");
    await fundValidators({
      rpcUrl: launchedNetwork.elRpcUrl
    });

    // 5. Setup validators
    logger.info("🔐 Setting up validators...");
    await setupValidators({
      rpcUrl: launchedNetwork.elRpcUrl
    });

    if (injectContracts) {
      await updateParameters(parameterCollection);
    }

    // 6. Set DataHaven runtime parameters
    logger.info("⚙️ Setting DataHaven parameters...");
    await setDataHavenParameters({
      launchedNetwork,
      collection: parameterCollection
    });

    // 7. Launch relayers
    logger.info("❄️ Launching Snowbridge relayers...");
    if (!options.relayerImageTag) {
      throw new Error("Relayer image tag not specified");
    }

    await launchRelayers(
      {
        networkId,
        relayerImageTag: options.relayerImageTag,
        kurtosisEnclaveName
      },
      launchedNetwork
    );

    // Log success
    const endTime = performance.now();
    const minutes = ((endTime - startTime) / (1000 * 60)).toFixed(1);
    logger.success(`CrossChain network launched successfully in ${minutes} minutes`);

    // Validate required endpoints
    if (!launchedNetwork.clEndpoint) {
      throw new Error("Consensus layer endpoint not available");
    }

    // Return connectors
    const aliceContainerName = `datahaven-alice-${networkId}`;
    const wsPort = launchedNetwork.getContainerPort(aliceContainerName);
    const ethereumWsUrl = launchedNetwork.elWsUrl;

    return {
      launchedNetwork,
      dataHavenRpcUrl: `http://127.0.0.1:${wsPort}`,
      ethereumRpcUrl: launchedNetwork.elRpcUrl,
      ethereumWsUrl,
      ethereumClEndpoint: launchedNetwork.clEndpoint,
      cleanup
    };
  } catch (error) {
    logger.error("❌ Failed to launch CrossChain network", error);

    if (cleanup) {
      logger.info("🧹 Running cleanup due to launch failure...");
      await cleanup();
    }

    throw error;
  }
};

/**
 * Launches a network based on the specified suite type.
 *
 * This is the main entry point that dispatches to the appropriate launcher.
 *
 * @param options - Configuration options including suiteType
 * @returns The appropriate launch result based on suite type
 */
export const launchNetwork = async (
  options: NetworkLaunchOptions
): Promise<CrossChainLaunchResult | StorageLaunchResult | ChainLaunchResult> => {
  const suiteType = options.suiteType ?? SuiteType.CROSSCHAIN;

  switch (suiteType) {
    case SuiteType.CHAIN:
      return launchChainNetwork(options);
    case SuiteType.STORAGE:
      return launchStorageNetwork(options);
    case SuiteType.CROSSCHAIN:
    default:
      return launchCrossChainNetwork(options);
  }
};

export const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
