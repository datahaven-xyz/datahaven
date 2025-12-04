import { logger, printHeader } from "utils";
import type { DataHavenOptions } from "../../../launcher/datahaven";
import {
  launchBspNode,
  launchFishermanNode,
  launchIndexerNode,
  launchMspNode,
  launchStorageHubPostgres
} from "../../../launcher/storagehub-docker";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";
import { fundProviders } from "../../../scripts/fund-providers";
import { registerProviders } from "../../../scripts/register-providers";
import { deployStorageHubComponents } from "../deploy/storagehub";
import type { LaunchOptions } from ".";
import { NETWORK_ID } from ".";

/**
 * Launches StorageHub components for local Docker-based development.
 *
 * @param options - Launch options
 * @param launchedNetwork - The launched network instance
 * @returns A promise that resolves when StorageHub components are launched
 */
export const launchStorageHubComponents = async (
  options: LaunchOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  if (options.storagehub === false) {
    logger.info("🏳️  Skipping StorageHub components");
    return;
  }

  printHeader("Launching StorageHub Components");
  logger.info(
    "🚀 Launching StorageHub components (MSP, BSP, Indexer, Fisherman nodes and databases)..."
  );

  // Check if we're in local Docker mode or K8s deploy mode
  if (launchedNetwork.networkId === NETWORK_ID) {
    // LOCAL DOCKER MODE (CLI launch)
    await launchStorageHubDocker(options, launchedNetwork);
  } else {
    // KUBERNETES MODE (deploy command)
    const deployOptions = {
      environment: "local" as const,
      skipStorageHub: !options.storagehub,
      datahavenImageTag: options.datahavenImageTag,
      dockerUsername: undefined,
      dockerPassword: undefined,
      dockerEmail: undefined
    };
    await deployStorageHubComponents(deployOptions as any, launchedNetwork);
  }

  logger.success("StorageHub components launched successfully");
};

/**
 * Launches StorageHub components using Docker containers.
 *
 * @param options - Launch options
 * @param launchedNetwork - The launched network instance
 */
async function launchStorageHubDocker(
  options: LaunchOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> {
  // Create DataHaven options for StorageHub nodes
  const datahavenOptions: DataHavenOptions = {
    networkId: launchedNetwork.networkId,
    datahavenImageTag: options.datahavenImageTag,
    relayerImageTag: options.relayerImageTag,
    buildDatahaven: false, // Already built for validators
    authorityIds: [], // Not used for StorageHub nodes
    datahavenBuildExtraArgs: options.datahavenBuildExtraArgs
  };

  // Launch components in order
  logger.info("📦 Launching PostgreSQL database...");
  await launchStorageHubPostgres(datahavenOptions, launchedNetwork);

  logger.info("📦 Launching MSP node...");
  await launchMspNode(datahavenOptions, launchedNetwork);

  logger.info("📦 Launching BSP node...");
  await launchBspNode(datahavenOptions, launchedNetwork);

  logger.info("📦 Launching Indexer node...");
  await launchIndexerNode(datahavenOptions, launchedNetwork);

  logger.info("📦 Launching Fisherman node...");
  await launchFishermanNode(datahavenOptions, launchedNetwork);

  // Fund provider accounts
  logger.info("💰 Funding provider accounts...");
  await fundProviders({ launchedNetwork });

  // Register providers
  logger.info("📝 Registering providers...");
  await registerProviders({ launchedNetwork });

  logger.success("All StorageHub components launched and registered");
}
