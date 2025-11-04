import { logger, printHeader } from "utils";
import type { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";
import { deployStorageHubComponents } from "../deploy/storagehub";
import type { LaunchOptions } from ".";

/**
 * Launches StorageHub components by delegating to the deploy function.
 *
 * @param options - Launch options.
 * @param launchedNetwork - The launched network instance.
 * @returns A promise that resolves when StorageHub components are launched.
 */
export const launchStorageHubComponents = async (
  options: LaunchOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> => {
  // Convert launch options to deploy options format
  const deployOptions = {
    environment: "local" as const, // Launch is typically used for local development
    skipStorageHub: !options.storagehub,
    datahavenImageTag: options.datahavenImageTag,
    dockerUsername: undefined,
    dockerPassword: undefined,
    dockerEmail: undefined
  };

  printHeader("Launching StorageHub Components");
  logger.info(
    "🚀 Launching StorageHub components (MSP, BSP, Indexer, Fisherman nodes and databases)..."
  );

  // Reuse the deploy StorageHub function
  await deployStorageHubComponents(deployOptions as any, launchedNetwork);

  logger.success("StorageHub components launched successfully");
};
