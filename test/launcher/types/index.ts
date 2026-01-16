export { LaunchedNetwork } from "./launchedNetwork";

import type { LaunchedNetwork } from "./launchedNetwork";

// Suite types for different test configurations
export enum SuiteType {
  CHAIN = "chain", // DataHaven chain only (2 validator nodes)
  STORAGE = "storage", // Chain + StorageHub components (MSP, BSP, Indexer)
  CROSSCHAIN = "crosschain" // Chain + Ethereum bridge (contracts + relayers)
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

// Chain-only launch result (base for all suites)
export interface ChainLaunchResult {
  launchedNetwork: LaunchedNetwork;
  dataHavenRpcUrl: string;
  cleanup: () => Promise<void>;
}

// Storage launch result (extends Chain with StorageHub components)
export interface StorageLaunchResult extends ChainLaunchResult {
  mspRpcUrl: string;
  bspRpcUrl: string;
  indexerRpcUrl: string;
  postgresUrl: string;
}

// CrossChain launch result (extends Chain with Ethereum bridge)
export interface CrossChainLaunchResult extends ChainLaunchResult {
  ethereumRpcUrl: string;
  ethereumWsUrl?: string;
  ethereumClEndpoint: string;
}
