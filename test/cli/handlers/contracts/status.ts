import { logger, printDivider } from "utils";
import { getChainDeploymentParams, loadChainConfig } from "../../../configs/contracts/config";
import { checkContractVerification } from "./verify";

/**
 * Shows the status of chain deployment and verification
 */
export const showDeploymentPlanAndStatus = async (chain: string) => {
  try {
    const config = await loadChainConfig(chain);
    const deploymentParams = getChainDeploymentParams(chain);

    const displayData = {
      Network: `${deploymentParams.network} (Chain ID: ${deploymentParams.chainId})`,
      "RPC URL": deploymentParams.rpcUrl,
      "Block Explorer": deploymentParams.blockExplorer,
      "Genesis Time": new Date(deploymentParams.genesisTime * 1000).toISOString(),
      "AVS Owner": `${config.avs.avsOwner.slice(0, 10)}...${config.avs.avsOwner.slice(-8)}`,
      "Rewards Initiator": `${config.avs.rewardsInitiator.slice(0, 10)}...${config.avs.rewardsInitiator.slice(-8)}`,
      "Veto Committee Member": `${config.avs.vetoCommitteeMember.slice(0, 10)}...${config.avs.vetoCommitteeMember.slice(-8)}`
    };
    console.table(displayData);

    await showDatahavenContractStatus(chain, deploymentParams.rpcUrl);
    await showEigenLayerContractStatus(
      config,
      deploymentParams.chainId.toString(),
      deploymentParams.rpcUrl
    );

    printDivider();
  } catch (error) {
    logger.error(`❌ Failed to load ${chain} configuration: ${error}`);
  }
};

/**
 * Common function to print contract status (deployment + verification)
 */
const printContractStatus = async (
  contract: { name: string; address: string },
  etherscanApiKey?: string,
  chain?: string,
  rpcUrl?: string
) => {
  if (!contract.address || contract.address === "0x0000000000000000000000000000000000000000") {
    logger.info(`❌ ${contract.name}: Not deployed`);
  } else if (!etherscanApiKey) {
    logger.info(`⚠️ ${contract.name}: Deployed (${contract.address}) - verification unknown`);
  } else {
    try {
      const isVerified = await checkContractVerification(contract.address, chain, rpcUrl);
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
 */
const showDatahavenContractStatus = async (chain: string, rpcUrl: string) => {
  try {
    const contracts = [
      { name: "DataHavenServiceManager", key: "ServiceManagerImplementation" },
      { name: "VetoableSlasher", key: "VetoableSlasher" },
      { name: "RewardsRegistry", key: "RewardsRegistry" },
      { name: "Snowbridge BeefyClient", key: "BeefyClient" },
      { name: "Snowbridge AgentExecutor", key: "AgentExecutor" },
      { name: "Snowbridge Gateway", key: "Gateway" },
      { name: "Snowbridge Agent", key: "RewardsAgent" }
    ];

    logger.info("DataHaven contracts");

    const deploymentsPath = `../contracts/deployments/${chain}.json`;
    const deploymentsFile = Bun.file(deploymentsPath);
    const exists = await deploymentsFile.exists();

    if (!exists) {
      contracts.forEach(({ name }) => logger.info(`  ❌ ${name}: Not deployed`));
      return;
    }

    const deployments = await deploymentsFile.json();
    const etherscanApiKey = process.env.ETHERSCAN_API_KEY;

    for (const contract of contracts) {
      const address = deployments[contract.key];
      await printContractStatus({ name: contract.name, address }, etherscanApiKey, chain, rpcUrl);
    }
  } catch (error) {
    logger.warn(`⚠️ Could not check contract status: ${error}`);
  }
};

/**
 * Shows the status of EigenLayer contracts (verification only)
 */
const showEigenLayerContractStatus = async (config: any, chainId: string, rpcUrl: string) => {
  try {
    const contracts = [
      {
        name: "DelegationManager",
        address: config.eigenLayer.delegationManager
      },
      { name: "StrategyManager", address: config.eigenLayer.strategyManager },
      { name: "EigenPodManager", address: config.eigenLayer.eigenPodManager },
      { name: "AVSDirectory", address: config.eigenLayer.avsDirectory },
      {
        name: "RewardsCoordinator",
        address: config.eigenLayer.rewardsCoordinator
      },
      {
        name: "AllocationManager",
        address: config.eigenLayer.allocationManager
      },
      {
        name: "PermissionController",
        address: config.eigenLayer.permissionController
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
