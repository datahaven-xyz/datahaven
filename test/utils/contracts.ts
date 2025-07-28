import * as generated from "contract-bindings";
import invariant from "tiny-invariant";
import { type Abi, erc20Abi, getContract, isAddress } from "viem";
import { z } from "zod";
import { logger } from "./logger";
import { createDefaultClient, type ViemClientInterface } from "./viem";

const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
const ethAddress = z.string().regex(ethAddressRegex, "Invalid Ethereum address");
const ethAddressCustom = z.custom<`0x${string}`>(
  (val) => typeof val === "string" && ethAddressRegex.test(val),
  { message: "Invalid Ethereum address" }
);
const ethBytes32Regex = /^0x[a-fA-F0-9]{64}$/;
const ethBytes32 = z.string().regex(ethBytes32Regex, "Invalid Ethereum bytes32");
const ethBytes4Regex = /^0x[a-fA-F0-9]{8}$/;
const ethBytes4 = z.string().regex(ethBytes4Regex, "Invalid Ethereum bytes4");

const DeployedStrategySchema = z.object({
  address: ethAddress,
  underlyingToken: ethAddress,
  tokenCreator: ethAddress
});

const DeploymentsSchema = z.object({
  network: z.string(),
  BeefyClient: ethAddressCustom,
  AgentExecutor: ethAddressCustom,
  Gateway: ethAddressCustom,
  ServiceManager: ethAddressCustom,
  ServiceManagerImplementation: ethAddressCustom,
  VetoableSlasher: ethAddressCustom,
  RewardsRegistry: ethAddressCustom,
  RewardsAgent: ethAddressCustom,
  DelegationManager: ethAddressCustom,
  StrategyManager: ethAddressCustom,
  AVSDirectory: ethAddressCustom,
  EigenPodManager: ethAddressCustom.optional(),
  EigenPodBeacon: ethAddressCustom.optional(),
  RewardsCoordinator: ethAddressCustom,
  AllocationManager: ethAddressCustom,
  PermissionController: ethAddressCustom,
  ETHPOSDeposit: ethAddressCustom.optional(),
  BaseStrategyImplementation: ethAddressCustom.optional(),
  DeployedStrategies: z.array(DeployedStrategySchema).optional()
});

export type Deployments = z.infer<typeof DeploymentsSchema>;

const RewardsInfoSchema = z.object({
  RewardsAgent: ethAddressCustom,
  RewardsAgentOrigin: ethBytes32,
  updateRewardsMerkleRootSelector: ethBytes4
});

export type RewardsInfo = z.infer<typeof RewardsInfoSchema>;

export const parseDeploymentsFile = async (network = "anvil"): Promise<Deployments> => {
  const deploymentsPath = `../contracts/deployments/${network}.json`;
  const deploymentsFile = Bun.file(deploymentsPath);
  if (!(await deploymentsFile.exists())) {
    logger.error(`File ${deploymentsPath} does not exist`);
    throw new Error(`Error reading ${network} deployments file`);
  }
  const deploymentsJson = await deploymentsFile.json();
  logger.info(`Deployments: ${JSON.stringify(deploymentsJson, null, 2)}`);
  try {
    const parsedDeployments = DeploymentsSchema.parse(deploymentsJson);
    logger.debug(`Successfully parsed ${network} deployments file.`);
    return parsedDeployments;
  } catch (error) {
    logger.error(`Failed to parse ${network} deployments file:`, error);
    throw new Error(`Invalid ${network} deployments file format`);
  }
};

export const parseRewardsInfoFile = async (network = "anvil"): Promise<RewardsInfo> => {
  const rewardsInfoPath = `../contracts/deployments/${network}-rewards-info.json`;
  const rewardsInfoFile = Bun.file(rewardsInfoPath);
  if (!(await rewardsInfoFile.exists())) {
    logger.error(`File ${rewardsInfoPath} does not exist`);
    throw new Error(`Error reading ${network} rewards info file`);
  }
  const rewardsInfoJson = await rewardsInfoFile.json();
  try {
    const parsedRewardsInfo = RewardsInfoSchema.parse(rewardsInfoJson);
    logger.debug(`Successfully parsed ${network} rewards info file.`);
    return parsedRewardsInfo;
  } catch (error) {
    logger.error(`Failed to parse ${network} rewards info file:`, error);
    throw new Error(`Invalid ${network} rewards info file format`);
  }
};

// Add to this if we add any new contracts
const abiMap = {
  BeefyClient: generated.beefyClientAbi,
  AgentExecutor: generated.agentExecutorAbi,
  Gateway: generated.gatewayAbi,
  ServiceManager: generated.dataHavenServiceManagerAbi,
  ServiceManagerImplementation: generated.dataHavenServiceManagerAbi,
  VetoableSlasher: generated.vetoableSlasherAbi,
  RewardsRegistry: generated.rewardsRegistryAbi,
  RewardsAgent: generated.agentAbi,
  DelegationManager: generated.delegationManagerAbi,
  StrategyManager: generated.strategyManagerAbi,
  AVSDirectory: generated.avsDirectoryAbi,
  EigenPodManager: generated.eigenPodManagerAbi,
  EigenPodBeacon: generated.eigenPodAbi,
  RewardsCoordinator: generated.rewardsCoordinatorAbi,
  AllocationManager: generated.allocationManagerAbi,
  PermissionController: generated.permissionControllerAbi,
  ETHPOSDeposit: generated.iethposDepositAbi,
  BaseStrategyImplementation: generated.strategyBaseTvlLimitsAbi,
  DeployedStrategies: erc20Abi
} as const satisfies Record<keyof Omit<Deployments, "network" | "RewardsAgentOrigin">, Abi>;

type ContractName = keyof typeof abiMap;
type AbiFor<C extends ContractName> = (typeof abiMap)[C];
export type ContractInstance<C extends ContractName> = Awaited<
  ReturnType<typeof getContractInstance<C>>
>;

// TODO: make this work with DeployedStrategies
export const getContractInstance = async <C extends ContractName>(
  contract: C,
  viemClient?: ViemClientInterface,
  network = "anvil"
) => {
  const deployments = await parseDeploymentsFile(network);
  const contractAddress = deployments[contract];
  logger.debug(`Contract ${contract} deployed to ${contractAddress}`);

  const client = viemClient ?? (await createDefaultClient());
  invariant(
    typeof contractAddress === "string" && isAddress(contractAddress),
    `Contract address for ${contract} is not a valid address`
  );

  const abi: AbiFor<C> = abiMap[contract];
  invariant(abi, `ABI for contract ${contract} not found`);

  return getContract({
    address: contractAddress,
    abi,
    client
  });
};
