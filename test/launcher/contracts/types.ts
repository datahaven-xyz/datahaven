import type { ParameterCollection } from "utils/parameters";

export interface ContractsDeployOptions {
  rpcUrl: string;
  verified?: boolean;
  blockscoutBackendUrl?: string;
  parameterCollection?: ParameterCollection;
}

export interface ContractsDeployResult {
  success: boolean;
  error?: Error;
  deployed?: boolean;
  cleanup?: () => Promise<void>;
}
