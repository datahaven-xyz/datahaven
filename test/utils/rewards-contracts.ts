import { getContract, type Address } from "viem";
import * as generated from "contract-bindings";
import { parseDeploymentsFile, parseRewardsInfoFile } from "./contracts";
import type { ViemClientInterface } from "./viem";
import { logger } from "./logger";

export async function getRewardsRegistryContract(client: ViemClientInterface) {
  const deployments = await parseDeploymentsFile();
  
  return getContract({
    address: deployments.RewardsRegistry,
    abi: generated.rewardsRegistryAbi,
    client: client as any
  });
}

export async function getServiceManagerContract(client: ViemClientInterface) {
  const deployments = await parseDeploymentsFile();
  
  return getContract({
    address: deployments.ServiceManager,
    abi: generated.dataHavenServiceManagerAbi,
    client: client as any
  });
}

export async function getGatewayContract(client: ViemClientInterface) {
  const deployments = await parseDeploymentsFile();
  
  return getContract({
    address: deployments.Gateway,
    abi: generated.gatewayAbi,
    client: client as any
  });
}

export async function getRewardsAgentAddress(): Promise<Address> {
  const rewardsInfo = await parseRewardsInfoFile();
  return rewardsInfo.RewardsAgent;
}

export async function getRewardsAgentOrigin(): Promise<string> {
  const rewardsInfo = await parseRewardsInfoFile();
  return rewardsInfo.RewardsAgentOrigin;
}

// Helper to wait for contract events
export async function waitForRewardsRegistryEvent(
  client: ViemClientInterface,
  eventName: string,
  filter?: (log: any) => boolean
): Promise<any> {
  const contract = await getRewardsRegistryContract(client);
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${eventName}`));
    }, 120000);
    
    const unwatch = client.watchContractEvent({
      address: contract.address,
      abi: contract.abi,
      eventName,
      onLogs: (logs) => {
        const matchingLog = filter ? logs.find(filter) : logs[0];
        if (matchingLog) {
          clearTimeout(timeout);
          unwatch();
          resolve(matchingLog);
        }
      }
    });
  });
}