/**
 * E2E test helper functions for validator management
 * These functions depend on TestConnectors and are only used in e2e tests
 */

import { $ } from "bun";
import {
  allocationManagerAbi,
  dataHavenServiceManagerAbi,
  delegationManagerAbi,
  strategyManagerAbi
} from "contract-bindings";
import { type Deployments, logger, waitForContainerToStart } from "utils";
import { DEFAULT_SUBSTRATE_WS_PORT } from "utils/constants";
import { getPublicPort } from "utils/docker";
import { erc20Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import validatorSet from "../../configs/validator-set.json";
import type { LaunchedNetwork } from "../../launcher/types/launchedNetwork";
import { getOwnerAccount } from "../../launcher/validators";
import type { TestConnectors } from "./connectors";

/**
 * Get validator info by name from validator set JSON
 * @param name - Validator name (e.g., "alice", "bob")
 * @returns Validator info
 */
export const getValidator = (name: string) => {
  const node = validatorSet.validators.find((v) => v.solochainAuthorityName === name.toLowerCase());
  if (!node) throw new Error(`Validator ${name} not found`);
  return node;
};

/** Checks if a DataHaven validator container is running */
export const isValidatorRunning = async (name: string, networkId: string) =>
  (await $`docker ps -q -f name=^datahaven-${name}-${networkId}`.text()).trim().length > 0;

/** Launches a single DataHaven validator node on demand */
export const launchDatahavenValidator = async (
  name: string,
  options: { launchedNetwork: LaunchedNetwork; datahavenImageTag?: string }
): Promise<void> => {
  const { launchedNetwork, datahavenImageTag = "datahavenxyz/datahaven:local" } = options;
  const nodeId = name.toLowerCase();
  const containerName = `datahaven-${nodeId}-${launchedNetwork.networkId}`;

  if (await isValidatorRunning(nodeId, launchedNetwork.networkId)) {
    logger.warn(`⚠️ Node ${nodeId} is already running`);
    return;
  }

  logger.debug(`Launching DataHaven validator node: ${nodeId}...`);

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

  const args = [
    "run",
    "-d",
    "--name",
    containerName,
    "--network",
    launchedNetwork.networkName,
    "-p",
    String(DEFAULT_SUBSTRATE_WS_PORT),
    datahavenImageTag,
    `--${nodeId}`,
    ...COMMON_LAUNCH_ARGS
  ];

  await $`docker ${args}`.quiet();

  await waitForContainerToStart(containerName);

  const publicPort = await getPublicPort(containerName, DEFAULT_SUBSTRATE_WS_PORT);
  launchedNetwork.addContainer(
    containerName,
    { ws: publicPort },
    { ws: DEFAULT_SUBSTRATE_WS_PORT }
  );

  logger.debug(`DataHaven validator ${nodeId} launched on port ${publicPort}`);
};

/** Adds a validator to the EigenLayer allowlist */
export const addValidatorToAllowlist = async (
  validatorName: string,
  options: { connectors: TestConnectors; deployments: Deployments }
): Promise<void> => {
  logger.debug(`Adding validator ${validatorName} to allowlist...`);

  const { connectors, deployments } = options;
  const validator = getValidator(validatorName);
  const hash = await connectors.walletClient.writeContract({
    address: deployments.ServiceManager as `0x${string}`,
    abi: dataHavenServiceManagerAbi,
    functionName: "addValidatorToAllowlist",
    args: [validator.publicKey as `0x${string}`],
    account: getOwnerAccount(),
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
  const validator = getValidator(validatorName);
  const account = privateKeyToAccount(validator.privateKey as `0x${string}`);
  const { publicClient, walletClient } = connectors;

  // Deposit tokens into deployed strategies
  const deployedStrategies = deployments.DeployedStrategies ?? [];
  for (const strategy of deployedStrategies) {
    const balance = await publicClient.readContract({
      address: strategy.underlyingToken as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address]
    });

    if (balance > 0n) {
      const depositAmount = balance / 10n;

      const approveHash = await walletClient.writeContract({
        address: strategy.underlyingToken as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [deployments.StrategyManager, depositAmount],
        account,
        chain: null
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      const depositHash = await walletClient.writeContract({
        address: deployments.StrategyManager,
        abi: strategyManagerAbi,
        functionName: "depositIntoStrategy",
        args: [
          strategy.address as `0x${string}`,
          strategy.underlyingToken as `0x${string}`,
          depositAmount
        ],
        account,
        chain: null
      });
      await publicClient.waitForTransactionReceipt({ hash: depositHash });
      logger.debug(`Deposited ${depositAmount} tokens into strategy ${strategy.address}`);
    }
  }

  // Register as EigenLayer operator
  const operatorHash = await walletClient.writeContract({
    address: deployments.DelegationManager as `0x${string}`,
    abi: delegationManagerAbi,
    functionName: "registerAsOperator",
    args: ["0x0000000000000000000000000000000000000000", 0, ""],
    account,
    chain: null
  });

  const operatorReceipt = await publicClient.waitForTransactionReceipt({
    hash: operatorHash
  });
  if (operatorReceipt.status !== "success") {
    throw new Error(`EigenLayer operator registration failed: ${operatorReceipt.status}`);
  }

  // Register for operator sets
  const registerHash = await walletClient.writeContract({
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

  const registerReceipt = await publicClient.waitForTransactionReceipt({ hash: registerHash });
  if (registerReceipt.status !== "success") {
    throw new Error(`Operator set registration failed: ${registerReceipt.status}`);
  }

  // Allocate full magnitude to the validator operator set
  const strategyAddresses = deployedStrategies.map((s) => s.address as `0x${string}`);
  const newMagnitudes = strategyAddresses.map(() => BigInt(1e18));

  const allocateHash = await walletClient.writeContract({
    address: deployments.AllocationManager as `0x${string}`,
    abi: allocationManagerAbi,
    functionName: "modifyAllocations",
    args: [
      account.address,
      [
        {
          operatorSet: {
            avs: deployments.ServiceManager as `0x${string}`,
            id: 0
          },
          strategies: strategyAddresses,
          newMagnitudes
        }
      ]
    ],
    account,
    chain: null
  });

  const allocateReceipt = await publicClient.waitForTransactionReceipt({ hash: allocateHash });
  if (allocateReceipt.status !== "success") {
    throw new Error(`Magnitude allocation failed: ${allocateReceipt.status}`);
  }

  logger.debug(`Registered ${validatorName} as operator (gas: ${registerReceipt.gasUsed})`);
}
