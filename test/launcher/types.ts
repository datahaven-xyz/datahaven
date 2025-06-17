import type { DeployEnvironment, RelayerType } from "utils";

export interface NetworkLaunchOptions {
  environment?: DeployEnvironment;
  networkId: string;
  slotTime?: number;
  datahavenImageTag?: string;
  relayerImageTag?: string;
  buildDatahaven?: boolean;
  datahavenBuildExtraArgs?: string;
  verified?: boolean;
  blockscout?: boolean;
  kurtosisNetworkArgs?: string;
  elRpcUrl?: string;
  clEndpoint?: string;
  kubeNamespace?: string;
}

export interface LaunchResult {
  success: boolean;
  error?: Error;
  cleanup?: () => Promise<void>;
}

export interface DataHavenLaunchResult extends LaunchResult {
  wsPort?: number;
  rpcPort?: number;
}

export interface EthereumLaunchResult extends LaunchResult {
  elRpcUrl?: string;
  clEndpoint?: string;
}

export interface ContractsDeployResult extends LaunchResult {
  deployed?: boolean;
}

export interface RelayersLaunchResult extends LaunchResult {
  activeRelayers?: RelayerType[];
}
