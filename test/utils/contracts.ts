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
  ProxyAdmin: ethAddressCustom.optional(),
  // Version tag for this set of deployed contracts (optional for backwards compatibility)
  version: z.string().optional(),
  deps: z
    .object({
      eigenlayer: z
        .object({
          release: z.string().optional(),
          gitCommit: z.string().optional()
        })
        .optional(),
      snowbridge: z
        .object({
          release: z.string().optional(),
          gitCommit: z.string().optional()
        })
        .optional()
    })
    .optional(),
  DeployedStrategies: z.array(DeployedStrategySchema).optional()
});

export type Deployments = z.infer<typeof DeploymentsSchema>;

/**
 * Parses the deployments file for a given network
 * @param networkId - The network identifier (e.g., "anvil", "hoodi", "stagenet-hoodi")
 *                    This can include an environment prefix like "stagenet-" or "testnet-"
 */
export const parseDeploymentsFile = async (networkId = "anvil"): Promise<Deployments> => {
  const deploymentsPath = `../contracts/deployments/${networkId}.json`;
  const deploymentsFile = Bun.file(deploymentsPath);
  if (!(await deploymentsFile.exists())) {
    logger.error(`File ${deploymentsPath} does not exist`);
    throw new Error(`Error reading ${networkId} deployments file`);
  }
  const deploymentsJson = await deploymentsFile.json();
  logger.debug(`Deployments: ${JSON.stringify(deploymentsJson, null, 2)}`);
  try {
    const parsedDeployments = DeploymentsSchema.parse(deploymentsJson);
    logger.debug(`Successfully parsed ${networkId} deployments file.`);
    return parsedDeployments;
  } catch (error) {
    logger.error(`Failed to parse ${networkId} deployments file:`, error);
    throw new Error(`Invalid ${networkId} deployments file format`);
  }
};

// Add to this if we add any new contracts
const abiMap = {
  BeefyClient: generated.beefyClientAbi,
  AgentExecutor: generated.agentExecutorAbi,
  Gateway: generated.gatewayAbi,
  ServiceManager: generated.dataHavenServiceManagerAbi,
  ServiceManagerImplementation: generated.dataHavenServiceManagerAbi,
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
} as const satisfies Record<
  keyof Omit<Deployments, "network" | "ProxyAdmin" | "version" | "deps">,
  Abi
>;

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
  invariant(
    contract !== "DeployedStrategies",
    "getContractInstance does not support 'DeployedStrategies' as it is an array. Use a different method to access deployed strategies."
  );
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

export const getAbi = async (contract: string) => {
  const contractInstance = await getContractInstance(contract as ContractName);
  return contractInstance.abi;
};
