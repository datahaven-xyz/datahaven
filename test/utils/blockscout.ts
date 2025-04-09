import invariant from "tiny-invariant";
import { CONTAINER_NAMES, getPublicPort, logger } from "utils";
import type { Abi, Hash } from "viem";

export const getBlockScoutBEUrl = async (): Promise<string> => {
  const port = await getPublicPort(CONTAINER_NAMES["blockscout-be"], 4000);
  return `http://127.0.0.1:${port}`;
};

export const fetchContractAddressByName = async (name: string): Promise<Hash> => {
  const response = await fetch(`${await getBlockScoutBEUrl()}/api/v2/search?q=${name}`);
  logger.debug(`Fetching contract address for ${name}`);
  logger.debug(`Response status: ${response.status}`);
  logger.trace(response);
  const data: BlockscoutResponse<BlockscoutSearchItem> = await response.json();

  invariant(data.items.length > 0, `No contract found for ${name}`);

  invariant(data.items[0].is_smart_contract_verified, `Contract ${name} is not verified`);
  const address = data.items[0].address;
  invariant(address.startsWith("0x"), `Contract ${name} doesn't start with 0x`);
  return data.items[0].address as Hash;
};

export const fetchContractAbiByAddress = async (address: Hash): Promise<Abi> => {
  const response = await fetch(`${await getBlockScoutBEUrl()}/api/v2/smart-contracts/${address}`);
  logger.debug(`Fetching contract ABI for ${address}`);
  logger.debug(`Response status: ${response.status}`);
  logger.trace(response);
  invariant(response.ok, `Failed to fetch contract ABI for ${address}`);
  const data: BlockscoutDetailedContract = await response.json();

  return data.abi;
};

export interface BlockscoutResponse<T extends BlockscoutSearchItem | BlockscoutSmartContractItem> {
  items: T[];
  next_page_params: any;
}

export interface BlockscoutSearchItem {
  address: string;
  certified: boolean;
  ens_info: any;
  is_smart_contract_verified: boolean;
  name: string;
  priority: number;
  type: string;
  url: string;
}

export interface BlockscoutSmartContractItem {
  address: BlockscoutAddress;
  certified: boolean;
  coin_balance: string;
  compiler_version: string;
  has_constructor_args: boolean;
  language: string;
  license_type: string;
  market_cap: any;
  optimization_enabled: boolean;
  transaction_count: number;
  verified_at: string;
}

export interface BlockscoutAddress {
  ens_domain_name: any;
  hash: string;
  implementations: any[];
  is_contract: boolean;
  is_scam: boolean;
  is_verified: boolean;
  metadata: any;
  name: string;
  private_tags: any[];
  proxy_type: any;
  public_tags: any[];
  watchlist_names: any[];
}

export interface BlockscoutDetailedContract {
  // Root-level flags and basic info
  hasMethodsRead: boolean;
  isSelfDestructed: boolean;
  hasCustomMethodsWrite: boolean;
  filePath: string;
  sourceCode: string;
  deployedBytecode: string;
  optimizationEnabled: boolean;
  optimizationRuns: number; // originally at root and inside optimizer settings
  verifiedTwinAddressHash: any;
  isVerified: boolean;
  sourcifyRepoUrl: any;
  compilerVersion: string;
  verifiedAt: string;
  implementations: any[];
  proxyType: any;
  creationBytecode: string;
  name: string;
  isBlueprint: boolean;
  licenseType: string;
  isFullyVerified: boolean;
  hasMethodsReadProxy: boolean;
  isVyperContract: boolean;
  isVerifiedViaEthBytecodeDb: boolean;
  language: string;
  canBeVisualizedViaSol2uml: boolean;
  hasMethodsWrite: boolean;
  hasMethodsWriteProxy: boolean;
  hasCustomMethodsRead: boolean;
  isVerifiedViaVerifierAlliance: boolean;
  isVerifiedViaSourcify: boolean;
  certified: boolean;
  isChangedBytecode: boolean;
  isPartiallyVerified: boolean;
  constructorArgs: string;

  // Compiler settings (flattened)
  evmVersion: string;
  // Libraries: originally an object mapping file paths to an object with one property.
  // Here we simplify it to a record of file path → library identifier string.
  libraries: { [filePath: string]: string };

  // Metadata from compiler settings
  metadataAppendCBOR: boolean;
  metadataBytecodeHash: string;
  metadataUseLiteralContent: boolean;

  // Optimizer settings from compiler settings
  optimizerEnabled: boolean;
  optimizerRuns: number;

  // Output selection simplified from compiler settings (flattened)
  // Originally: { "*": { "*": string[] } } → here a simple record mapping keys to string arrays.
  outputSelection: { [key: string]: string[] };

  // Other compiler settings
  remappings: string[];
  viaIR: boolean;

  // Constructor arguments decoded (simplified)
  decodedConstructorArgs: Array<
    [
      string | undefined,
      {
        internalType: string;
        name: string;
        type: string;
        // Components are simplified to an optional array of basic objects.
        components?: Array<{ internalType: string; name: string; type: string }>;
      }
    ]
  >;

  // External libraries (flat array version)
  externalLibraries: Array<{
    name: string;
    addressHash: string;
  }>;

  // Additional source files for the contract
  additionalSources: Array<{
    filePath: string;
    sourceCode: string;
  }>;

  abi: Abi;
}
