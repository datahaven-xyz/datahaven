import { $ } from "bun";
import { getContainersMatchingImage, getPortFromKurtosis, logger } from "utils";
import { ParameterCollection } from "utils/parameters";
import { deployContracts } from "../contracts";
import { launchLocalDataHavenSolochain } from "../datahaven";
import { getRunningKurtosisEnclaves, launchKurtosisNetwork } from "../kurtosis";
import { setDataHavenParameters } from "../parameters";
import { launchRelayers } from "../relayers";
import type { NetworkConnectors, NetworkLaunchOptions } from "../types";
import { LaunchedNetwork } from "../types/launchedNetwork";
import { checkBaseDependencies } from "../utils";
import { COMPONENTS } from "../utils/constants";
import { fundValidators, setupValidators, updateValidatorSet } from "../validators";

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
 * Creates a cleanup function for the test network.
 */
const createCleanupFunction = (networkId: string) => {
  return async () => {
    logger.info(`🧹 Cleaning up test network: ${networkId}`);

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

      logger.success(`Cleanup completed for network: ${networkId}`);
    } catch (error) {
      logger.error(`❌ Cleanup failed for network ${networkId}:`, error);
      // Continue cleanup, don't throw
    }
  };
};

/**
 * Launches a complete network stack for E2E testing.
 *
 * This function orchestrates the launch of all network components:
 * 1. DataHaven blockchain nodes
 * 2. Kurtosis Ethereum network
 * 3. Smart contracts deployment
 * 4. Validator setup
 * 5. Runtime parameter configuration
 * 6. Relayer services
 * 7. Validator set update
 *
 * @param options - Configuration options for the network launch
 * @returns NetworkConnectors with cleanup function
 * @throws {Error} if network ID is not unique or any component fails to launch
 */
export const launchNetwork = async (options: NetworkLaunchOptions): Promise<NetworkConnectors> => {
  const networkId = options.networkId;
  const launchedNetwork = new LaunchedNetwork();
  launchedNetwork.networkName = networkId;

  let cleanup: (() => Promise<void>) | undefined;

  try {
    logger.info(`🚀 Launching complete network stack with ID: ${networkId}`);
    const startTime = performance.now();

    // Check base dependencies
    await checkBaseDependencies();

    // Validate network ID is unique
    await validateNetworkIdUnique(networkId);

    // Create cleanup function
    cleanup = createCleanupFunction(networkId);

    // Create parameter collection for use throughout the launch
    const parameterCollection = new ParameterCollection();

    // 1. Launch DataHaven network
    logger.info("📦 Launching DataHaven network...");
    await launchLocalDataHavenSolochain(
      {
        datahavenImageTag: options.datahavenImageTag || "moonsonglabs/datahaven:local",
        relayerImageTag: options.relayerImageTag || "moonsonglabs/snowbridge-relay:latest",
        authorityIds: TEST_AUTHORITY_IDS,
        buildDatahaven: options.buildDatahaven ?? false,
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
        kurtosisNetworkArgs: options.kurtosisNetworkArgs
      },
      launchedNetwork
    );

    // 3. Deploy contracts
    logger.info("📄 Deploying smart contracts...");
    let blockscoutBackendUrl: string | undefined;
    if (options.blockscout) {
      const blockscoutPort = await getPortFromKurtosis("blockscout", "http", kurtosisEnclaveName);
      blockscoutBackendUrl = `http://127.0.0.1:${blockscoutPort}`;
    }

    if (!launchedNetwork.elRpcUrl) {
      throw new Error("Ethereum RPC URL not available");
    }

    await deployContracts({
      rpcUrl: launchedNetwork.elRpcUrl,
      verified: options.verified ?? false,
      blockscoutBackendUrl,
      parameterCollection
    });

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
        relayerImageTag: options.relayerImageTag,
        kurtosisEnclaveName
      },
      launchedNetwork
    );

    // 8. Update validator set (after relayers are running)
    logger.info("🔄 Updating validator set...");
    await updateValidatorSet({
      rpcUrl: launchedNetwork.elRpcUrl
    });

    // Log success
    const endTime = performance.now();
    const minutes = ((endTime - startTime) / (1000 * 60)).toFixed(1);
    logger.success(`Network launched successfully in ${minutes} minutes`);

    // Validate required endpoints
    if (!launchedNetwork.clEndpoint) {
      throw new Error("Consensus layer endpoint not available");
    }

    // Return connectors
    const wsPort = launchedNetwork.getPublicWsPort();
    return {
      launchedNetwork,
      dataHavenRpcUrl: `http://127.0.0.1:${wsPort}`,
      ethereumRpcUrl: launchedNetwork.elRpcUrl,
      ethereumClEndpoint: launchedNetwork.clEndpoint,
      cleanup
    };
  } catch (error) {
    logger.error("❌ Failed to launch network", error);

    // Run cleanup if we created it
    if (cleanup) {
      logger.info("🧹 Running cleanup due to launch failure...");
      await cleanup();
    }

    throw error;
  }
};
