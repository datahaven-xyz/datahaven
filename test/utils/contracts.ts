import * as generated from "contract-bindings";
import {
  type Abi,
  type ChainConfig,
  type Client,
  createClient,
  getContract,
  isAddress
} from "viem";
import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { z } from "zod";
import { logger } from "./logger";
import { type ViemClientInterface, createChainConfig, createDefaultClient } from "./viem";

import type { Config } from "@wagmi/core";
import invariant from "tiny-invariant";

const DeployedStrategySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  underlyingToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokenCreator: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
});

const AnvilDeploymentsSchema = z.object({
  network: z.string(),
  BeefyClient: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  AgentExecutor: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  Gateway: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  ServiceManager: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  VetoableSlasher: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  RewardsRegistry: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  Agent: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  DelegationManager: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  StrategyManager: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  AVSDirectory: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  EigenPodManager: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  EigenPodBeacon: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  RewardsCoordinator: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  AllocationManager: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  PermissionController: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  ETHPOSDeposit: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  BaseStrategyImplementation: z.custom<`0x${string}`>(
    (val) => typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)
  ),
  DeployedStrategies: z.array(DeployedStrategySchema)
});

export type AnvilDeployments = z.infer<typeof AnvilDeploymentsSchema>;

export const parseDeploymentsFile = async (): Promise<AnvilDeployments> => {
  const anvilDeploymentsPath = "../contracts/deployments/anvil.json";
  const anvilDeploymentsFile = Bun.file(anvilDeploymentsPath);
  if (!(await anvilDeploymentsFile.exists())) {
    logger.error(`File ${anvilDeploymentsPath} does not exist`);
    throw new Error("Error reading anvil deployments file");
  }
  const anvilDeploymentsJson = await anvilDeploymentsFile.json();
  try {
    const parsedDeployments = AnvilDeploymentsSchema.parse(anvilDeploymentsJson);
    logger.debug("Successfully parsed anvil deployments file.");
    return parsedDeployments;
  } catch (error) {
    logger.error("Failed to parse anvil deployments file:", error);
    throw new Error("Invalid anvil deployments file format");
  }
};

export const getContractInstance = async <TContract extends keyof AnvilDeployments>(
  contract: TContract,
  viemClient?: ViemClientInterface
) => {
  const deployments = await parseDeploymentsFile();
  const contractAddress = deployments[contract];

  const client = viemClient ?? (await createDefaultClient());
  invariant(
    typeof contractAddress === "string" && isAddress(contractAddress),
    `Contract address for ${contract} is not a valid address`
  );

  const abiMap: Record<keyof AnvilDeployments, Abi> = {
    BeefyClient: generated.beefyClientAbi,
    AgentExecutor: generated.agentExecutorAbi,
    Gateway: generated.gatewayAbi,
    ServiceManager: generated.transparentUpgradeableProxyAbi,
    VetoableSlasher: generated.vetoableSlasherAbi,
    RewardsRegistry: generated.rewardsRegistryAbi,
    Agent: generated.agentAbi,
    DelegationManager: generated.delegationManagerAbi,
    StrategyManager: generated.strategyManagerAbi,
    AVSDirectory: generated.avsDirectoryAbi,
    EigenPodManager: generated.eigenPodManagerAbi,
    EigenPodBeacon: generated.upgradeableBeaconAbi,
    RewardsCoordinator: generated.rewardsCoordinatorAbi,
    AllocationManager: generated.allocationManagerAbi,
    PermissionController: generated.permissionControllerAbi,
    ETHPOSDeposit: generated.iethposDepositAbi,
    BaseStrategyImplementation: generated.strategyBaseTvlLimitsAbi,
    network: generated.beefyClientAbi, // Default or placeholder, adjust if needed
    DeployedStrategies: generated.beefyClientAbi // Default or placeholder, adjust if needed
  };

  const abi = abiMap[contract];
  invariant(abi, `ABI for contract ${contract} not found`);

  return getContract({
    address: contractAddress,
    abi,
    client
  });
};
