/**
 * DataHaven utility functions for launching and managing validator nodes
 */

import { $ } from "bun";
import {
  allocationManagerAbi,
  dataHavenServiceManagerAbi,
  delegationManagerAbi
} from "contract-bindings";
import { logger, waitForContainerToStart, type Deployments } from "utils";
import { DEFAULT_SUBSTRATE_WS_PORT } from "utils/constants";
import { getPublicPort } from "utils/docker";
import { privateKeyToAccount } from "viem/accounts";
import type { LaunchedNetwork } from "../launcher/types/launchedNetwork";
import type { TestConnectors } from "framework";

export interface ValidatorInfo {
  publicKey: string;
  privateKey: string;
  solochainAddress: string;
  solochainPrivateKey: string;
  solochainAuthorityName: string;
  isActive: boolean;
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
 */
export const launchDatahavenValidator = async (
  name: string,
  options: LaunchValidatorOptions
): Promise<void> => {
  const nodeId = name.toLowerCase();
  const networkId = options.launchedNetwork.networkId;
  const datahavenImageTag = options.datahavenImageTag || "datahavenxyz/datahaven:local";
  const containerName = `datahaven-${nodeId}-${networkId}`;

  // Check if node is already running
  if (await isValidatorRunning(nodeId, networkId)) {
    logger.warn(`⚠️ Node ${nodeId} is already running in network ${networkId}`);
    return;
  }

  logger.info(`🚀 Launching DataHaven validator node: ${nodeId}...`);

  // Expose internal port, Docker assigns random external port
  const portArg = `-p ${DEFAULT_SUBSTRATE_WS_PORT}`;

  const command: string[] = [
    "docker",
    "run",
    "-d",
    "--name",
    containerName,
    "--network",
    options.launchedNetwork.networkName,
    ...portArg.split(" "),
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
};


/**
 * Get node info by account name from validator set JSON
 * @param name - Validator name (e.g., "alice", "bob")
 * @returns Node info
 */
export const getValidatorInfo = async (name: string): Promise<ValidatorInfo> => {
  const validatorSetJson = await Bun.file("./configs/validator-set.json").json();
  const validatorsRaw = validatorSetJson.validators as Array<ValidatorInfo>;
  const node = validatorsRaw.find((v) => v.solochainAuthorityName === name.toLowerCase());
  if (!node) {
    throw new Error(`Node ${name} not found in validator set`);
  }
  return node;
};

/** Adds a validator to the EigenLayer allowlist */
export const addValidatorToAllowlist = async (
  validatorName: string,
  options: { connectors: TestConnectors; deployments: Deployments }
): Promise<void> => {
  logger.debug(`Adding validator ${validatorName} to allowlist...`);

  const { connectors, deployments } = options;
  const validator = await getValidatorInfo(validatorName);
  const hash = await connectors.walletClient.writeContract({
    address: deployments.ServiceManager as `0x${string}`,
    abi: dataHavenServiceManagerAbi,
    functionName: "addValidatorToAllowlist",
    args: [validator.publicKey as `0x${string}`],
    account: privateKeyToAccount(validator.privateKey as `0x${string}`),
    chain: null
  });
  await connectors.publicClient.waitForTransactionReceipt({ hash });

  logger.debug(`Validator ${validatorName} added to allowlist`);
};

/** Register an operator in EigenLayer and for operator sets */
export async function registerOperator(
  validatorName: string,
  options: { connectors: TestConnectors; deployments: Deployments }
): Promise<void> {
  const { connectors, deployments } = options;
  const validator = await getValidatorInfo(validatorName);
  const account = privateKeyToAccount(validator.privateKey as `0x${string}`);

  // Register as EigenLayer operator
  const operatorHash = await connectors.walletClient.writeContract({
    address: deployments.DelegationManager as `0x${string}`,
    abi: delegationManagerAbi,
    functionName: "registerAsOperator",
    args: ["0x0000000000000000000000000000000000000000", 0, ""],
    account,
    chain: null
  });

  const operatorReceipt = await connectors.publicClient.waitForTransactionReceipt({
    hash: operatorHash
  });
  if (operatorReceipt.status !== "success") {
    throw new Error(`EigenLayer operator registration failed: ${operatorReceipt.status}`);
  }

  // Register for operator sets
  const hash = await connectors.walletClient.writeContract({
    address: deployments.AllocationManager as `0x${string}`,
    abi: allocationManagerAbi,
    functionName: "registerForOperatorSets",
    args: [
      validator.publicKey as `0x${string}`,
      {
        avs: deployments.ServiceManager as `0x${string}`,
        operatorSetIds: [0],
        data: validator.solochainAddress as `0x${string}`
      }
    ],
    account,
    chain: null
  });

  const receipt = await connectors.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Operator set registration failed: ${receipt.status}`);
  }

  logger.debug(`Registered ${validatorName} as operator (gas: ${receipt.gasUsed})`);
}
