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

const DeployedStrategySchema = z.object({
  address: ethAddress,
  underlyingToken: ethAddress,
  tokenCreator: ethAddress
});

const AnvilDeploymentsSchema = z.object({
  network: z.string(),
  BeefyClient: ethAddressCustom,
  AgentExecutor: ethAddressCustom,
  Gateway: ethAddressCustom,
  ServiceManager: ethAddressCustom,
  VetoableSlasher: ethAddressCustom,
  RewardsRegistry: ethAddressCustom,
  RewardsAgent: ethAddressCustom,
  RewardsAgentOrigin: ethBytes32,
  DelegationManager: ethAddressCustom,
  StrategyManager: ethAddressCustom,
  AVSDirectory: ethAddressCustom,
  EigenPodManager: ethAddressCustom,
  EigenPodBeacon: ethAddressCustom,
  RewardsCoordinator: ethAddressCustom,
  AllocationManager: ethAddressCustom,
  PermissionController: ethAddressCustom,
  ETHPOSDeposit: ethAddressCustom,
  BaseStrategyImplementation: ethAddressCustom,
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

// Add to this if we add any new contracts
const abiMap = {
  BeefyClient: generated.beefyClientAbi,
  AgentExecutor: generated.agentExecutorAbi,
  Gateway: generated.gatewayAbi,
  ServiceManager: generated.dataHavenServiceManagerAbi,
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
} as const satisfies Record<keyof Omit<AnvilDeployments, "network" | "RewardsAgentOrigin">, Abi>;

type ContractName = keyof typeof abiMap;
type AbiFor<C extends ContractName> = (typeof abiMap)[C];
export type ContractInstance<C extends ContractName> = Awaited<
  ReturnType<typeof getContractInstance<C>>
>;

// TODO: make this work with DeployedStrategies
export const getContractInstance = async <C extends ContractName>(
  contract: C,
  viemClient?: ViemClientInterface
) => {
  const deployments = await parseDeploymentsFile();
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
