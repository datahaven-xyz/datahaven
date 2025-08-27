import { logger, parseDeploymentsFile, printDivider } from "utils";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChainDeploymentParams } from "../../../configs/contracts/config";
import { dataHavenServiceManagerAbi } from "../../../contract-bindings/generated";

/**
 * Updates the AVS metadata URI for the DataHaven Service Manager
 */
export const updateAVSMetadataURI = async (chain: string, uri: string) => {
  try {
    // Load environment variables
    const avsOwnerPrivateKey = process.env.AVS_OWNER_PRIVATE_KEY;
    if (!avsOwnerPrivateKey) {
      throw new Error("AVS_OWNER_PRIVATE_KEY environment variable is required");
    }

    // Get chain configuration
    const deploymentParams = getChainDeploymentParams(chain);
    logger.info(`🫎 Updating AVS metadata URI on ${chain} chain`);
    logger.info(`Network: ${deploymentParams.network} (Chain ID: ${deploymentParams.chainId})`);
    logger.info(`RPC URL: ${deploymentParams.rpcUrl}`);
    logger.info(`New URI: ${uri}`);

    // Create wallet client for the AVS owner
    const account = privateKeyToAccount(avsOwnerPrivateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      transport: http(deploymentParams.rpcUrl)
    });

    // Create public client for reading transaction receipts
    const publicClient = createPublicClient({
      transport: http(deploymentParams.rpcUrl)
    });

    logger.info(`Using account: ${account.address}`);

    const deployments = await parseDeploymentsFile(chain);
    const serviceManagerAddress = deployments.ServiceManager;

    logger.info(`ServiceManager contract address: ${serviceManagerAddress}`);

    // Call the updateAVSMetadataURI function
    logger.info("📝 Calling updateAVSMetadataURI...");

    const hash = await walletClient.writeContract({
      address: serviceManagerAddress,
      abi: dataHavenServiceManagerAbi,
      functionName: "updateAVSMetadataURI",
      args: [uri],
      chain: null
    });

    logger.info("✅ Transaction submitted successfully!");
    logger.info(`Transaction hash: ${hash}`);

    // Wait for transaction confirmation
    logger.info("⏳ Waiting for transaction confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      logger.info(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
      logger.info(`Gas used: ${receipt.gasUsed}`);
    } else {
      logger.error("❌ Transaction failed");
    }

    printDivider();
    return hash;
  } catch (error) {
    logger.error(`❌ Failed to update AVS metadata URI: ${error}`);
    throw error;
  }
};
