import { logger } from "utils";

/**
 * Chain-specific configuration constants
 */
export const CHAIN_CONFIGS = {
  hoodi: {
    NETWORK_NAME: "hoodi",
    CHAIN_ID: 560048,
    RPC_URL: "https://rpc.hoodi.ethpandaops.io",
    BLOCK_EXPLORER: "https://hoodi.etherscan.io/",
    GENESIS_TIME: 1710666600,
    SLOT_TIME: 12, // seconds
    EPOCHS_PER_SYNC_COMMITTEE_PERIOD: 256,
    SYNC_COMMITTEE_SIZE: 512
  },
  ethereum: {
    NETWORK_NAME: "ethereum",
    CHAIN_ID: 1,
    RPC_URL: "https://eth.llamarpc.com",
    BLOCK_EXPLORER: "https://etherscan.io/",
    GENESIS_TIME: 1606824023,
    SLOT_TIME: 12, // seconds
    EPOCHS_PER_SYNC_COMMITTEE_PERIOD: 256,
    SYNC_COMMITTEE_SIZE: 512
  },
  anvil: {
    NETWORK_NAME: "anvil",
    CHAIN_ID: 31337,
    RPC_URL: "http://localhost:8545",
    BLOCK_EXPLORER: "https://etherscan.io/",
    GENESIS_TIME: 1606824023
  }
};

export type ChainConfigType = typeof CHAIN_CONFIGS;

export const getChainConfig = (chain: string) => {
  return CHAIN_CONFIGS[chain as keyof ChainConfigType];
};

/**
 * Builds the network identifier from chain and optional environment
 * When environment is specified: {environment}-{chain} (e.g., "stagenet-hoodi")
 * When environment is not specified: {chain} (e.g., "hoodi")
 */
export const buildNetworkId = (chain: string, environment?: string): string => {
  return environment ? `${environment}-${chain}` : chain;
};

/**
 * Loads chain configuration from the config file
 * @param chain - The target chain (hoodi, mainnet, anvil)
 * @param environment - Optional deployment environment (stagenet, testnet, mainnet)
 *                      When specified, loads from {environment}-{chain}.json
 */
export const loadChainConfig = async (chain: string, environment?: string) => {
  const networkId = buildNetworkId(chain, environment);

  try {
    const configPath = `../contracts/config/${networkId}.json`;
    const configFile = Bun.file(configPath);

    if (!(await configFile.exists())) {
      throw new Error(`${networkId} configuration file not found at ${configPath}`);
    }

    const configContent = await configFile.text();
    const config = JSON.parse(configContent);

    logger.debug(`✅ ${networkId} configuration loaded successfully`);
    return config;
  } catch (error) {
    logger.error(`❌ Failed to load ${networkId} configuration: ${error}`);
    throw error;
  }
};

export const getChainDeploymentParams = (chain?: string) => {
  let chainConfig = CHAIN_CONFIGS[chain as keyof typeof CHAIN_CONFIGS];
  if (!chainConfig) {
    chainConfig = CHAIN_CONFIGS.anvil;
  }

  return {
    network: chainConfig.NETWORK_NAME,
    chainId: chainConfig.CHAIN_ID,
    rpcUrl: chainConfig.RPC_URL,
    blockExplorer: chainConfig.BLOCK_EXPLORER,
    genesisTime: chainConfig.GENESIS_TIME
  };
};
