export { LaunchedNetwork } from "./launchedNetwork";

import type { LaunchedNetwork } from "./launchedNetwork";

// Suite types for different test configurations
export enum SuiteType {
  DATAHAVEN = "datahaven", // DataHaven nodes only
  STORAGEHUB = "storagehub", // DataHaven + StorageHub components
  ETHEREUM = "ethereum" // Full setup: DataHaven + Ethereum + contracts + relayers
}

// Network launch options (combines all component options)
export interface NetworkLaunchOptions {
  networkId: string;
  suiteType?: SuiteType; // Defaults to ETHEREUM for backward compatibility
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

// DataHaven-only launch result (base for all suites)
export interface DataHavenLaunchResult {
  launchedNetwork: LaunchedNetwork;
  dataHavenRpcUrl: string;
  cleanup: () => Promise<void>;
}

// StorageHub launch result (extends DataHaven)
export interface StorageHubLaunchResult extends DataHavenLaunchResult {
  mspRpcUrl: string;
  bspRpcUrl: string;
  indexerRpcUrl: string;
  postgresUrl: string;
}

// Full Ethereum network launch result (existing type, for backward compatibility)
export interface LaunchNetworkResult {
  launchedNetwork: LaunchedNetwork;
  dataHavenRpcUrl: string;
  ethereumRpcUrl: string;
  ethereumWsUrl?: string;
  ethereumClEndpoint: string;
  cleanup: () => Promise<void>;
}
