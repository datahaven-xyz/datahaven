import { logger, parseDeploymentsFile, printDivider } from "utils";
import { createPublicClient, createWalletClient, encodeFunctionData, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChainDeploymentParams } from "../../../configs/contracts/config";
import { dataHavenServiceManagerAbi } from "../../../contract-bindings/generated";

/**
 * Updates the AVS metadata URI for the DataHaven Service Manager
 */
export const updateAVSMetadataURI = async (
  chain: string,
  uri: string,
  opts: { execute?: boolean; avsOwnerKey?: string } = {}
) => {
  try {
    const execute = opts.execute ?? false;
    const avsOwnerPrivateKey = normalizePrivateKey(
      opts.avsOwnerKey || process.env.AVS_OWNER_PRIVATE_KEY
    );

    if (execute && !avsOwnerPrivateKey) {
      throw new Error("AVS owner private key is required to execute this transaction");
    }

    // Get chain configuration
    const deploymentParams = getChainDeploymentParams(chain);
    logger.info(`🫎 Updating AVS metadata URI on ${chain} chain`);
    logger.info(`Network: ${deploymentParams.network} (Chain ID: ${deploymentParams.chainId})`);
    logger.info(`RPC URL: ${deploymentParams.rpcUrl}`);
    logger.info(`New URI: ${uri}`);

    const deployments = await parseDeploymentsFile(chain);
    const serviceManagerAddress = deployments.ServiceManager;

    if (!serviceManagerAddress) {
      throw new Error("ServiceManager address not found in deployments file");
    }

    const calldata = encodeFunctionData({
      abi: dataHavenServiceManagerAbi,
      functionName: "updateAVSMetadataURI",
      args: [uri]
    });

    if (!execute) {
      logger.info("🔐 Tx execution disabled: submit the following transaction via your multisig");
      const payload = {
        to: serviceManagerAddress,
        value: "0",
        data: calldata
      };
      logger.info(JSON.stringify(payload, null, 2));
      printDivider();
      return payload;
    }

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

const normalizePrivateKey = (key?: string): `0x${string}` | undefined => {
  if (!key) {
    return undefined;
  }
  return (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
};
