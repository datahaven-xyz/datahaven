export interface EthereumLaunchOptions {
  networkId: string;
  kurtosisEnclaveName?: string;
  blockscout?: boolean;
  slotTime?: number;
  kurtosisNetworkArgs?: string;
}

export interface EthereumLaunchResult {
  success: boolean;
  error?: Error;
  elRpcUrl?: string;
  clEndpoint?: string;
  cleanup?: () => Promise<void>;
}
