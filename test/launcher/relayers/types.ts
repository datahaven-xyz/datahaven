import type { Hex } from "viem";

export interface RelayersLaunchOptions {
  networkId: string;
  relayerImageTag: string;
}

export interface RelayersLaunchResult {
  success: boolean;
  error?: Error;
  activeRelayers?: RelayerType[];
  cleanup?: () => Promise<void>;
}

export type RelayerType = "beefy" | "beacon" | "execution" | "solochain";

export interface BeaconConfig {
  ethereum: {
    endpoint: string;
  };
  substrate: {
    endpoint: string;
  };
  sink: {
    ethereum: {
      contracts: {
        BeefyClient: string;
        Gateway: string;
      };
    };
  };
}

export interface BeefyConfig extends BeaconConfig {
  sink: BeaconConfig["sink"] & {
    ethereum: BeaconConfig["sink"]["ethereum"] & {
      "fast-forward-blocks": number;
    };
  };
}

export interface ExecutionConfig {
  ethereum: {
    endpoint: string;
  };
  substrate: {
    endpoint: string;
  };
  sink: {
    substrate: {
      "para-id": number;
    };
  };
}

export interface SolochainConfig extends ExecutionConfig {
  source: {
    ethereum: {
      contracts: {
        Gateway: string;
      };
    };
  };
}

export type RelayerConfigType = BeefyConfig | BeaconConfig | ExecutionConfig | SolochainConfig;

export interface RelayerSpec {
  name: string;
  configFilePath: string;
  config: {
    type: RelayerType;
    ethElRpcEndpoint: string;
    ethClEndpoint?: string;
    substrateWsEndpoint: string;
    beefyClientAddress?: string;
    gatewayAddress?: string;
  };
  pk?: {
    ethereum?: Hex;
    substrate?: string;
  };
}
