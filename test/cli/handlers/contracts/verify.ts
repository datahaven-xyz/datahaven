import { execSync } from "node:child_process";
import { logger } from "utils";
import { parseDeploymentsFile } from "utils/contracts";
import { CHAIN_CONFIGS, getChainConfig } from "../../../configs/contracts/config";

interface ContractsVerifyOptions {
  chain: string;
  rpcUrl?: string;
  skipVerification: boolean;
}

interface ContractToVerify {
  name: string;
  address: string;
  artifactName: string;
  constructorArgs: string[];
  constructorArgTypes: string[];
}

/**
 * Handles contract verification on block explorer using Foundry's built-in verification
 */
export const verifyContracts = async (options: ContractsVerifyOptions) => {
  if (options.skipVerification) {
    logger.info("🏳️ Skipping contract verification");
    return;
  }

  logger.info(`🔍 Verifying contracts on ${options.chain} block explorer using Foundry...`);

  const etherscanApiKey = process.env.ETHERSCAN_API_KEY;
  if (!etherscanApiKey) {
    logger.warn("⚠️ ETHERSCAN_API_KEY not found, skipping verification");
    logger.info("💡 Set ETHERSCAN_API_KEY environment variable to enable verification");
    return;
  }

  const deployments = await parseDeploymentsFile(options.chain);

  const contractsToVerify: ContractToVerify[] = [
    {
      name: "ServiceManager Implementation",
      address: deployments.ServiceManagerImplementation,
      artifactName: "DataHavenServiceManager",
      constructorArgs: [
        deployments.RewardsCoordinator,
        deployments.PermissionController,
        deployments.AllocationManager
      ],
      constructorArgTypes: ["address", "address", "address"]
    },
    {
      name: "RewardsRegistry",
      address: deployments.RewardsRegistry,
      artifactName: "RewardsRegistry",
      constructorArgs: [deployments.ServiceManager, deployments.RewardsAgent],
      constructorArgTypes: ["address", "address"]
    },
    {
      name: "Gateway",
      address: deployments.Gateway,
      artifactName: "Gateway",
      constructorArgs: [],
      constructorArgTypes: []
    },
    {
      name: "BeefyClient",
      address: deployments.BeefyClient,
      artifactName: "BeefyClient",
      constructorArgs: [],
      constructorArgTypes: []
    },
    {
      name: "AgentExecutor",
      address: deployments.AgentExecutor,
      artifactName: "AgentExecutor",
      constructorArgs: [],
      constructorArgTypes: []
    }
  ];

  try {
    logger.info("📋 Contracts to verify:");
    contractsToVerify.forEach((contract) => {
      logger.info(`  • ${contract.name}: ${contract.address}`);
    });
    logger.info(`🔗 View contracts on ${options.chain} block explorer:`);
    logger.info(`  • ${getChainConfig(options.chain).BLOCK_EXPLORER}`);

    // Verify each contract with delay to respect rate limits
    for (const contract of contractsToVerify) {
      await verifySingleContract(contract, options);

      // Add delay between requests to respect rate limits
      if (contract !== contractsToVerify[contractsToVerify.length - 1]) {
        logger.info("⏳ Waiting 1 second before next verification...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.success("Contract verification completed");
    logger.info("  - Check the block explorer for verification status");
  } catch (error) {
    logger.error(`❌ Contract verification failed: ${error}`);
    throw error;
  }
};

/**
 * Verify a single contract using Foundry's built-in verification
 */
async function verifySingleContract(contract: ContractToVerify, options: ContractsVerifyOptions) {
  logger.info(`\n🔍 Verifying ${contract.name} (${contract.address})...`);

  const { address, artifactName, constructorArgs: args, constructorArgTypes: types } = contract;

  const abiEncodedArgs = getEncodedConstructorArgs(args, types);
  const constructorArgsStr = abiEncodedArgs ? `--constructor-args ${abiEncodedArgs}` : "";

  try {
    const chainConfig = CHAIN_CONFIGS[options.chain as keyof typeof CHAIN_CONFIGS];
    const rpcUrl = options.rpcUrl || chainConfig.RPC_URL;
    const chainParameter =
      options.chain === "hoodi" ? "--chain-id 560048" : `--chain ${options.chain}`;
    const verifyCommand = `forge verify-contract ${address} src/${artifactName}.sol:${artifactName} --rpc-url ${rpcUrl} ${chainParameter} ${constructorArgsStr} --watch`;

    logger.info(`Running: ${verifyCommand}`);

    // Execute forge verify-contract
    const result = execSync(verifyCommand, {
      encoding: "utf8",
      stdio: "pipe",
      cwd: "../contracts", // Run from contracts directory
      env: {
        ...process.env,
        ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY
      }
    });

    logger.success(`${contract.name} verified successfully using Foundry!`);
    logger.debug(result);
  } catch (error) {
    logger.warn(`⚠️ ${contract.name} verification failed: ${error}`);
    const chainConfig = CHAIN_CONFIGS[options.chain as keyof typeof CHAIN_CONFIGS];
    logger.info(`Check manually at: ${chainConfig.BLOCK_EXPLORER}address/${contract.address}`);
    logger.info("You can also try running the command manually from the contracts directory:");
    const rpcUrl = options.rpcUrl || chainConfig.RPC_URL;
    const manualCommand = `forge verify-contract ${contract.address} src/${contract.artifactName}.sol:${contract.artifactName} --rpc-url ${rpcUrl} --chain ${options.chain} ${constructorArgsStr}`;
    logger.info(`cd ../contracts && ${manualCommand}`);
  }
}

const getEncodedConstructorArgs = (args: string[], types: string[]): string => {
  if (args.length > 0) {
    try {
      return execSync(
        `cast abi-encode "constructor(${types.join(",")})" ${args.map((arg) => `"${arg}"`).join(" ")}`,
        { encoding: "utf8", stdio: "pipe", cwd: "../contracts" }
      ).trim();
    } catch (error) {
      logger.error(`Failed to ABI-encode constructor arguments: ${error}`);
      throw error;
    }
  }
  return "";
};

/**
 * Checks if contracts are already verified. For proxies, checks implementation contracts.
 */
export const checkContractVerification = async (
  contractAddress: string,
  chain?: string,
  rpcUrl?: string
): Promise<boolean> => {
  try {
    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (!apiKey) throw new Error("ETHERSCAN_API_KEY not found");

    // Try to get implementation address for proxy contracts
    if (rpcUrl) {
      const implAddress = await getProxyImplementation(contractAddress, rpcUrl);
      if (implAddress && implAddress !== contractAddress) {
        const implVerified = await isVerified(implAddress, chain, apiKey);
        if (implVerified) return true;
      }
    }

    // Check the original contract
    return await isVerified(contractAddress, chain, apiKey);
  } catch (error) {
    logger.warn(`Failed to check verification status for ${contractAddress}: ${error}`);
    return false;
  }
};

const getProxyImplementation = async (address: string, rpcUrl: string): Promise<string | null> => {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getStorageAt",
        params: [
          address,
          "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
          "latest"
        ],
        id: 1
      })
    });
    const data = (await response.json()) as any;
    return data.result ? `0x${data.result.slice(-40)}` : null;
  } catch {
    return null;
  }
};

const isVerified = async (
  address: string,
  chain: string | undefined,
  apiKey: string
): Promise<boolean> => {
  if (!chain) {
    return false;
  }
  const response = await fetch(
    `https://api.etherscan.io/v2/api?module=contract&action=getsourcecode&address=${address}&chainid=${chain}&apikey=${apiKey}`
  );
  const data = (await response.json()) as any;
  return data.result?.[0]?.SourceCode && data.result[0].SourceCode !== "";
};
