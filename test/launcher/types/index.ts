export { LaunchedNetwork } from "./launchedNetwork";

import type { LaunchedNetwork } from "./launchedNetwork";

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
export interface LaunchNetworkResult {
  launchedNetwork: LaunchedNetwork;
  dataHavenRpcUrl: string;
  ethereumRpcUrl: string;
  ethereumWsUrl?: string;
  ethereumClEndpoint: string;
  cleanup: () => Promise<void>;
}
