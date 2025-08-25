/**
 * DataHaven utility functions for launching and managing validator nodes
 * 
 * This module provides utilities for launching individual DataHaven validator nodes
 * on demand, checking their status, and managing their lifecycle.
 * 
 * @example
 * ```typescript
 * import { launchDatahavenValidator, TestAccounts } from "utils";
 * 
 * // Launch a new Charlie validator node
 * const charlieNode = await launchDatahavenValidator(TestAccounts.Charlie, {
 *   datahavenImageTag: "moonsonglabs/datahaven:local",
 *   launchedNetwork: suite.getLaunchedNetwork()
 * });
 * 
 * console.log(`Charlie node launched on port ${charlieNode.publicPort}`);
 * console.log(`WebSocket URL: ${charlieNode.wsUrl}`);
 * ```
 * 
 * @example
 * ```typescript
 * // Check if a node is already running before launching
 * if (await isValidatorNodeRunning("charlie", "test-network")) {
 *   console.log("Charlie node is already running");
 * } else {
 *   // Launch the node
 *   const node = await launchDatahavenValidator(TestAccounts.Charlie, options);
 * }
 * ```
 */

import { $ } from "bun";
import { logger } from "utils";
import { getPublicPort } from "utils/docker";
import { DEFAULT_SUBSTRATE_WS_PORT } from "utils/constants";
import { waitForContainerToStart } from "utils";
import { LaunchedNetwork } from "../launcher/types/launchedNetwork";

/**
 * Enum for test account names that are prefunded in substrate
 */
export enum TestAccounts {
  Alice = "alice",
  Bob = "bob",
  Charlie = "charlie",
  Dave = "dave",
  Eve = "eve",
  Ferdie = "ferdie"
}

/**
 * Information about a launched DataHaven validator node
 */
export interface LaunchedValidatorInfo {
  nodeId: string;
  containerName: string;
  rpcUrl: string;
  wsUrl: string;
  publicPort: number;
  internalPort: number;
}

/**
 * Options for launching a DataHaven validator
 */
export interface LaunchValidatorOptions {
  datahavenImageTag?: string;
  launchedNetwork: LaunchedNetwork;
}

export const COMMON_LAUNCH_ARGS = [
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

/**
 * Checks if a DataHaven validator node is already running
 * @param nodeId - The node identifier (e.g., "alice", "bob")
 * @param networkId - The network identifier
 * @returns True if the node is running, false otherwise
 */
export const isValidatorNodeRunning = async (nodeId: string, networkId: string): Promise<boolean> => {
  const containerName = `datahaven-${nodeId}-${networkId}`;
  const dockerPsOutput = await $`docker ps -q --filter "name=^${containerName}"`.text();
  return dockerPsOutput.trim().length > 0;
};

/**
 * Launches a single DataHaven validator node on demand
 * @param name - The test account name to launch
 * @param options - Configuration options for launching the node
 * @returns Information about the launched node
 */
export const launchDatahavenValidator = async (
  name: TestAccounts,
  options: LaunchValidatorOptions
): Promise<LaunchedValidatorInfo> => {
  const nodeId = name.toLowerCase();
  const networkId = options.launchedNetwork.networkId;
  const datahavenImageTag = options.datahavenImageTag || "moonsonglabs/datahaven:local";
  const containerName = `datahaven-${nodeId}-${networkId}`;

  // Check if node is already running
  if (await isValidatorNodeRunning(nodeId, networkId)) {
    logger.warn(`⚠️ Node ${nodeId} is already running in network ${networkId}`);

    // Get existing node info
    const publicPort = await getPublicPort(containerName, DEFAULT_SUBSTRATE_WS_PORT);
    return {
      nodeId,
      containerName,
      rpcUrl: `http://127.0.0.1:${publicPort}`,
      wsUrl: `ws://127.0.0.1:${publicPort}`,
      publicPort,
      internalPort: DEFAULT_SUBSTRATE_WS_PORT
    };
  }

  logger.info(`🚀 Launching DataHaven validator node: ${nodeId}...`);

  // Get port mapping for the node
  const portMapping = getPortMappingForNode(nodeId, networkId);

  const command: string[] = [
    "docker",
    "run",
    "-d",
    "--name",
    containerName,
    "--network",
    options.launchedNetwork.networkName,
    ...portMapping,
    datahavenImageTag,
    `--${nodeId}`,
    ...COMMON_LAUNCH_ARGS
  ];

  logger.debug(await $`sh -c "${command.join(" ")}"`.text());

  await waitForContainerToStart(containerName);

  // Get the dynamic port and register in the network
  const publicPort = await getPublicPort(containerName, DEFAULT_SUBSTRATE_WS_PORT);

  // Add container to the launched network
  options.launchedNetwork.addContainer(
    containerName,
    { ws: publicPort },
    { ws: DEFAULT_SUBSTRATE_WS_PORT }
  );

  logger.success(`✅ DataHaven validator node ${nodeId} launched successfully on port ${publicPort}`);

  return {
    nodeId,
    containerName,
    rpcUrl: `http://127.0.0.1:${publicPort}`,
    wsUrl: `ws://127.0.0.1:${publicPort}`,
    publicPort,
    internalPort: DEFAULT_SUBSTRATE_WS_PORT
  };
};

/**
 * Determines the port mapping for a DataHaven node based on the network type.
 * Reused from launcher/datahaven.ts
 * @param nodeId - The node identifier (e.g., "alice", "bob")
 * @param networkId - The network identifier
 * @returns Array of port mapping arguments for Docker run command
 */
const getPortMappingForNode = (nodeId: string, networkId: string): string[] => {
  const isCliLaunch = networkId === "cli-launch";

  if (isCliLaunch && nodeId === "alice") {
    // For CLI-launch networks, only alice gets the fixed port mapping
    return ["-p", `${DEFAULT_SUBSTRATE_WS_PORT}:${DEFAULT_SUBSTRATE_WS_PORT}`];
  }

  // For other networks or non-alice nodes, only expose internal port
  // Docker will assign a random external port
  return ["-p", `${DEFAULT_SUBSTRATE_WS_PORT}`];
};
