import { logger, printDivider } from "utils";
import {
  buildNetworkId,
  getChainDeploymentParams,
  loadChainConfig
} from "../../../configs/contracts/config";
import { checkContractVerification } from "./verify";

/**
 * Shows the status of chain deployment and verification
 * @param chain - The target chain (hoodi, mainnet, anvil)
 * @param environment - Optional deployment environment (stagenet, testnet, mainnet)
 */
export const showDeploymentPlanAndStatus = async (chain: string, environment?: string) => {
  const networkId = buildNetworkId(chain, environment);

  try {
    const config = await loadChainConfig(chain, environment);
    const deploymentParams = getChainDeploymentParams(chain);

    const displayData: Record<string, string> = {
      Network: `${deploymentParams.network} (Chain ID: ${deploymentParams.chainId})`,
      "RPC URL": deploymentParams.rpcUrl,
      "Block Explorer": deploymentParams.blockExplorer,
      "Genesis Time": new Date(deploymentParams.genesisTime * 1000).toISOString(),
      "AVS Owner": `${config.avs.avsOwner.slice(0, 10)}...${config.avs.avsOwner.slice(-8)}`,
      "Rewards Initiator": `${config.avs.rewardsInitiator.slice(0, 10)}...${config.avs.rewardsInitiator.slice(-8)}`
    };

    if (environment) {
      displayData.Environment = environment;
    }

    console.table(displayData);

    await showDatahavenContractStatus(networkId, deploymentParams.rpcUrl);
    await showEigenLayerContractStatus(
      config,
      deploymentParams.chainId.toString(),
      deploymentParams.rpcUrl,
      networkId
    );

    printDivider();
  } catch (error) {
    logger.error(`❌ Failed to load ${networkId} configuration: ${error}`);
  }
};

/**
 * Common function to print contract status (deployment + verification)
 */
const printContractStatus = async (
  contract: { name: string; address: string },
  etherscanApiKey?: string,
  chainId?: string,
  rpcUrl?: string
) => {
  if (!contract.address || contract.address === "0x0000000000000000000000000000000000000000") {
    logger.info(`❌ ${contract.name}: Not deployed`);
  } else if (!etherscanApiKey) {
    logger.info(`⚠️ ${contract.name}: Deployed (${contract.address}) - verification unknown`);
  } else {
    try {
      const isVerified = await checkContractVerification(contract.address, chainId, rpcUrl);
      if (isVerified) {
        logger.info(`✅ ${contract.name}: Deployed and verified`);
      } else {
        logger.warn(`⚠️ ${contract.name}: Deployed but not verified`);
      }
    } catch (error) {
      logger.warn(
        `⚠️ ${contract.name}: Deployed but verification check failed with error: ${error}`
      );
    }

    // Add small delay to respect rate limits
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

/**
 * Shows the status of all contracts (deployment + verification)
 * @param networkId - The network identifier (e.g., "hoodi", "stagenet-hoodi")
 * @param rpcUrl - The RPC URL for the chain
 */
const showDatahavenContractStatus = async (networkId: string, rpcUrl: string) => {
  try {
    const contracts = [
      { name: "DataHavenServiceManager", key: "ServiceManagerImplementation" },
      { name: "Snowbridge BeefyClient", key: "BeefyClient" },
      { name: "Snowbridge AgentExecutor", key: "AgentExecutor" },
      { name: "Snowbridge Gateway", key: "Gateway" }
    ];

    logger.info("DataHaven contracts");

    const deploymentsPath = `../contracts/deployments/${networkId}.json`;
    const deploymentsFile = Bun.file(deploymentsPath);
    const exists = await deploymentsFile.exists();

    if (!exists) {
      contracts.forEach(({ name }) => {
        logger.info(`  ❌ ${name}: Not deployed`);
      });
      return;
    }

    const deployments = await deploymentsFile.json();
    const etherscanApiKey = process.env.ETHERSCAN_API_KEY;

    for (const contract of contracts) {
      const address = deployments[contract.key];
      await printContractStatus(
        { name: contract.name, address },
        etherscanApiKey,
        networkId,
        rpcUrl
      );
    }
  } catch (error) {
    logger.warn(`⚠️ Could not check contract status: ${error}`);
  }
};

/**
 * Shows the status of EigenLayer contracts (verification only)
 * @param config - The chain configuration
 * @param chainId - The chain ID
 * @param rpcUrl - The RPC URL for the chain
 * @param networkId - The network identifier (e.g., "hoodi", "stagenet-hoodi")
 */
const showEigenLayerContractStatus = async (
  config: any,
  chainId: string,
  rpcUrl: string,
  networkId: string
) => {
  try {
    // For local/anvil deployments, read addresses from deployments file
    // For testnet/mainnet, use addresses from config file
    let eigenLayerAddresses: Record<string, string> = {};
    const isLocal = networkId === "anvil" || networkId === "local";

    if (isLocal) {
      try {
        const deploymentsPath = `../contracts/deployments/${networkId === "local" ? "anvil" : networkId}.json`;
        const deploymentsFile = Bun.file(deploymentsPath);
        if (await deploymentsFile.exists()) {
          const deployments = await deploymentsFile.json();
          eigenLayerAddresses = {
            DelegationManager: deployments.DelegationManager,
            StrategyManager: deployments.StrategyManager,
            EigenPodManager: deployments.EigenPodManager,
            AVSDirectory: deployments.AVSDirectory,
            RewardsCoordinator: deployments.RewardsCoordinator,
            AllocationManager: deployments.AllocationManager,
            PermissionController: deployments.PermissionController
          };
        }
      } catch (error) {
        logger.debug(`Could not read deployments file for EigenLayer contracts: ${error}`);
      }
    }

    const contracts = [
      {
        name: "DelegationManager",
        address: eigenLayerAddresses.DelegationManager || config.eigenLayer?.delegationManager || ""
      },
      {
        name: "StrategyManager",
        address: eigenLayerAddresses.StrategyManager || config.eigenLayer?.strategyManager || ""
      },
      {
        name: "EigenPodManager",
        address: eigenLayerAddresses.EigenPodManager || config.eigenLayer?.eigenPodManager || ""
      },
      {
        name: "AVSDirectory",
        address: eigenLayerAddresses.AVSDirectory || config.eigenLayer?.avsDirectory || ""
      },
      {
        name: "RewardsCoordinator",
        address:
          eigenLayerAddresses.RewardsCoordinator || config.eigenLayer?.rewardsCoordinator || ""
      },
      {
        name: "AllocationManager",
        address: eigenLayerAddresses.AllocationManager || config.eigenLayer?.allocationManager || ""
      },
      {
        name: "PermissionController",
        address:
          eigenLayerAddresses.PermissionController || config.eigenLayer?.permissionController || ""
      }
    ];

    logger.info("EigenLayer contracts status:");
    const etherscanApiKey = process.env.ETHERSCAN_API_KEY;

    for (const contract of contracts) {
      await printContractStatus(contract, etherscanApiKey, chainId, rpcUrl);
    }
  } catch (error) {
    logger.warn(`⚠️ Could not check EigenLayer contract status: ${error}`);
  }
};
