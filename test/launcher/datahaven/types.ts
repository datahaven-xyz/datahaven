export interface DataHavenLaunchOptions {
  networkId: string;
  datahavenImageTag: string;
  buildDatahaven?: boolean;
  datahavenBuildExtraArgs?: string;
  slotTime?: number;
}

export interface DataHavenLaunchResult {
  success: boolean;
  error?: Error;
  wsPort?: number;
  rpcPort?: number;
  cleanup?: () => Promise<void>;
}
