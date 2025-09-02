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
  holesky: {
    NETWORK_NAME: "holesky",
    CHAIN_ID: 17000,
    RPC_URL: "https://ethereum-holesky-rpc.publicnode.com",
    BLOCK_EXPLORER: "https://holesky.etherscan.io/",
    GENESIS_TIME: 1695902400,
    SLOT_TIME: 12, // seconds
    EPOCHS_PER_SYNC_COMMITTEE_PERIOD: 256,
    SYNC_COMMITTEE_SIZE: 512
  },
  mainnet: {
    NETWORK_NAME: "mainnet",
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

export const loadChainConfig = async (chain: string) => {
  try {
    const configPath = `../contracts/config/${chain}.json`;
    const configFile = Bun.file(configPath);

    if (!(await configFile.exists())) {
      throw new Error(`${chain} configuration file not found at ${configPath}`);
    }

    const configContent = await configFile.text();
    const config = JSON.parse(configContent);

    logger.debug(`✅ ${chain} configuration loaded successfully`);
    return config;
  } catch (error) {
    logger.error(`❌ Failed to load ${chain} configuration: ${error}`);
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
