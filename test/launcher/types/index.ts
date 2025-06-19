export * from "./launched-network";

import type { LaunchedNetwork } from "./launched-network";

export type { ContractsDeployOptions, ContractsDeployResult } from "../contracts/types";
// Re-export component types
export type { DataHavenLaunchOptions, DataHavenLaunchResult } from "../datahaven/types";
export type { EthereumLaunchOptions, EthereumLaunchResult } from "../ethereum/types";
export type { RelayersLaunchOptions, RelayersLaunchResult } from "../relayers/types";
export type {
  StrategyInfo,
  ValidatorConfig,
  ValidatorsLaunchOptions,
  ValidatorsLaunchResult
} from "../validators/types";

// Common result type
export interface LaunchResult {
  success: boolean;
  error?: Error;
  cleanup?: () => Promise<void>;
}

// Network launch options (combines all component options)
export interface NetworkLaunchOptions {
  networkId: string;
  environment?: "local" | "stagenet" | "testnet" | "mainnet";
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
}

// Network connectors returned by the launcher
export interface NetworkConnectors {
  launchedNetwork: LaunchedNetwork;
  dataHavenWsUrl: string;
  dataHavenRpcUrl: string;
  ethereumWsUrl: string;
  ethereumRpcUrl: string;
  // Legacy properties for backwards compatibility
  dhWsUrl?: string;
  elRpcUrl?: string;
  clEndpoint?: string;
  cleanup?: () => Promise<void>;
}
