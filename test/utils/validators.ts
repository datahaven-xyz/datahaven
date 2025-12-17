/**
 * DataHaven utility functions for launching and managing validator nodes
 */

import { $ } from "bun";
import { dataHavenServiceManagerAbi } from "contract-bindings";
import { logger, waitForContainerToStart } from "utils";
import { DEFAULT_SUBSTRATE_WS_PORT } from "utils/constants";
import { getPublicPort } from "utils/docker";
import { privateKeyToAccount } from "viem/accounts";
import type { LaunchedNetwork } from "../launcher/types/launchedNetwork";

export interface ValidatorInfo {
  publicKey: string;
  privateKey: string;
  solochainAddress: string;
  solochainPrivateKey: string;
  solochainAuthorityName: string;
  isActive: boolean;
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

/** Checks if a DataHaven validator container is running */
export const isValidatorRunning = async (name: string, networkId: string) =>
  (await $`docker ps -q -f name=^datahaven-${name}-${networkId}`.text()).trim().length > 0;

/**
 * Launches a single DataHaven validator node on demand
 * @param name - The validator name (e.g., "alice", "bob", "charlie")
 * @param options - Configuration options for launching the node
 * @returns Information about the launched node
 */
export const launchDatahavenValidator = async (
  name: string,
  options: LaunchValidatorOptions
): Promise<LaunchedValidatorInfo> => {
  const nodeId = name.toLowerCase();
  const networkId = options.launchedNetwork.networkId;
  const datahavenImageTag = options.datahavenImageTag || "datahavenxyz/datahaven:local";
  const containerName = `datahaven-${nodeId}-${networkId}`;

  // Check if node is already running
  if (await isValidatorRunning(nodeId, networkId)) {
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

  logger.success(`DataHaven validator node ${nodeId} launched successfully on port ${publicPort}`);

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

/**
 * Get node info by account name from validator set JSON
 * @param validatorSetJson - Validator set JSON
 * @param name - Validator name (e.g., "alice", "bob")
 * @returns Node info
 */
export const getValidatorInfoByName = (
  validatorSetJson: any,
  name: string
): ValidatorInfo => {
  const validatorsRaw = validatorSetJson.validators as Array<ValidatorInfo>;
  const node = validatorsRaw.find((v) => v.solochainAuthorityName === name.toLowerCase());
  if (!node) {
    throw new Error(`Node ${name} not found in validator set`);
  }
  return node;
};

/**
 * Adds a validator to the EigenLayer allowlist
 * @param connectors - The connectors to use
 * @param validator - The validator to add to the allowlist
 */
export const addValidatorToAllowlist = async (
  connectors: any,
  validator: ValidatorInfo,
  deployments: any
) => {
  logger.info(`Adding validator ${validator.publicKey} to allowlist...`);
  const hash = await connectors.walletClient.writeContract({
    address: deployments.ServiceManager as `0x${string}`,
    abi: dataHavenServiceManagerAbi,
    functionName: "addValidatorToAllowlist",
    args: [validator.publicKey as `0x${string}`],
    account: privateKeyToAccount(validator.privateKey as `0x${string}`),
    chain: null
  });
  await connectors.publicClient.waitForTransactionReceipt({ hash });
  logger.info(`✅ Validator ${validator.publicKey} added to allowlist`);
};
