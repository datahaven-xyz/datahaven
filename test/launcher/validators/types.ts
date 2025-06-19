export interface ValidatorsLaunchOptions {
  rpcUrl: string;
}

export interface ValidatorsLaunchResult {
  success: boolean;
  error?: Error;
  cleanup?: () => Promise<void>;
}

export interface ValidatorConfig {
  validators: {
    publicKey: string;
    privateKey: string;
    solochainAddress?: string;
  }[];
  notes?: string;
}

export interface StrategyInfo {
  address: string;
  underlyingToken: string;
  tokenCreator: string;
}
