import { execSync } from "node:child_process";
import { logger } from "utils";
import { parseDeploymentsFile } from "utils/contracts";
import { CHAIN_CONFIGS } from "../../../configs/contracts/config";

// TODO: unhardcode constructor args
function getConstructorArgs(artifactName: string): string[] {
  switch (artifactName) {
    case "DataHavenServiceManager":
      return [
        "0x29e8572678e0c272350aa0b4B8f304E47EBcd5e7",
        "0xdcCF401fD121d8C542E96BC1d0078884422aFAD2",
        "0x95a7431400F362F3647a69535C5666cA0133CAA0"
      ];
    case "RewardsRegistry":
      return [
        "0x29e8572678e0c272350aa0b4B8f304E47EBcd5e7",
        "0xdcCF401fD121d8C542E96BC1d0078884422aFAD2"
      ];
    default:
      return [];
  }
}

interface ContractsVerifyOptions {
  chain: string;
  rpcUrl?: string;
  skipVerification: boolean;
}

interface ContractToVerify {
  name: string;
  address: string;
  artifactName: string;
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
      artifactName: "DataHavenServiceManager"
    }
    // {
    // 	name: "VetoableSlasher",
    // 	address: deployments.VetoableSlasher,
    // 	artifactName: "VetoableSlasher",
    // },
    // {
    // 	name: "RewardsRegistry",
    // 	address: deployments.RewardsRegistry,
    // 	artifactName: "RewardsRegistry",
    // },
    // { name: "Gateway", address: deployments.Gateway, artifactName: "Gateway" },
    // {
    // 	name: "BeefyClient",
    // 	address: deployments.BeefyClient,
    // 	artifactName: "BeefyClient",
    // },
    // {
    // 	name: "AgentExecutor",
    // 	address: deployments.AgentExecutor,
    // 	artifactName: "AgentExecutor",
    // },
  ];

  try {
    logger.info("📋 Contracts to verify:");
    contractsToVerify.forEach((contract) => {
      logger.info(`  • ${contract.name}: ${contract.address}`);
    });

    logger.info("🔗 View contracts on Hoodi block explorer:");
    logger.info("  • https://hoodi.etherscan.io/");

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

  // Get constructor arguments for the contract
  const constructorArgs = getConstructorArgs(contract.artifactName);

  // Build the forge verify-contract command
  const constructorArgsStr =
    constructorArgs.length > 0 ? `--constructor-args ${constructorArgs.join(",")}` : "";

  try {
    const chainConfig = CHAIN_CONFIGS[options.chain as keyof typeof CHAIN_CONFIGS];
    const rpcUrl = options.rpcUrl || chainConfig.RPC_URL;
    const chainParameter =
      options.chain === "hoodi" ? "--chain-id 560048" : `--chain ${options.chain}`;
    const verifyCommand = `forge verify-contract ${contract.address} src/${contract.artifactName}.sol:${contract.artifactName} --rpc-url ${rpcUrl} ${chainParameter} ${constructorArgsStr} --watch`;

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

/**
 * Checks if contracts are already verified using a simple HTTP request
 */
export const checkContractVerification = async (contractAddress: string): Promise<boolean> => {
  try {
    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (!apiKey) {
      throw new Error("ETHERSCAN_API_KEY not found");
    }

    const response = await fetch(
      `https://api.etherscan.io/v2/api?module=contract&action=getsourcecode&address=${contractAddress}&chainid=560048&apikey=${apiKey}`
    );
    const data = (await response.json()) as any;
    return data.result?.[0]?.SourceCode && data.result[0].SourceCode !== "";
  } catch (error) {
    logger.warn(`Failed to check verification status for ${contractAddress}: ${error}`);
    return false;
  }
};
