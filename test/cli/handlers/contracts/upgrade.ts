import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { logger, printDivider, printHeader } from "utils";
import { parseDeploymentsFile } from "utils/contracts";
import { CHAIN_CONFIGS } from "../../../configs/contracts/config";
import { verifyContracts } from "./verify";

interface ContractsUpgradeOptions {
  chain: string;
  rpcUrl?: string;
  privateKeyFile?: string;
  verify?: boolean;
}

/**
 * Reads private key from file securely
 */
const readPrivateKeyFromFile = (filePath: string): string => {
  try {
    const privateKey = readFileSync(filePath, "utf8").trim();
    if (!privateKey) {
      throw new Error("Private key file is empty");
    }
    return privateKey;
  } catch (error) {
    throw new Error(`Failed to read private key from file ${filePath}: ${error}`);
  }
};

/**
 * Executes a command safely using spawn to prevent command injection
 */
const executeCommand = async (
  command: string,
  args: string[],
  env: Record<string, string>,
  cwd: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      cwd,
      stdio: "pipe"
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    child.on("error", (error) => {
      reject(new Error(`Command execution failed: ${error.message}`));
    });
  });
};

/**
 * Handles contract upgrade by deploying only implementation contracts
 * and updating proxy contracts to point to new implementations
 */
export const contractsUpgrade = async (options: ContractsUpgradeOptions) => {
  printHeader(`Upgrading DataHaven Contracts on ${options.chain}`);

  try {
    logger.info("🔄 Starting contract upgrade...");
    logger.info(`📡 Using chain: ${options.chain}`);
    if (options.rpcUrl) {
      logger.info(`📡 Using RPC URL: ${options.rpcUrl}`);
    }

    // Build contracts first
    await buildContracts();

    // Deploy new implementation contracts
    await deployImplementationContracts(options);

    // Update proxy contracts to point to new implementations
    await updateProxyContracts(options);

    // Bump version (patch) to reflect upgraded contracts
    await bumpVersionForUpgrade(options.chain);

    // Verify contracts if requested
    if (options.verify) {
      logger.info("🔍 Verifying upgraded contracts...");
      await verifyContracts({
        chain: options.chain,
        rpcUrl: options.rpcUrl,
        skipVerification: false
      });
    }

    printDivider();
    logger.success("Contract upgrade completed successfully");
  } catch (error) {
    logger.error(`❌ Contract upgrade failed: ${error}`);
    throw error;
  }
};

/**
 * Builds smart contracts using forge
 */
const buildContracts = async () => {
  logger.info("🛳️ Building contracts...");
  try {
      const result = await executeCommand("forge", ["build"], process.env as Record<string, string>, "../contracts");
    logger.debug(result);
    logger.success("Contracts built successfully");
  } catch (error) {
    logger.error("❌ Failed to build contracts");
    throw error;
  }
};

/**
 * Deploys only the implementation contracts
 */
const deployImplementationContracts = async (options: ContractsUpgradeOptions) => {
  logger.info("🚀 Deploying new implementation contracts...");

  const chainConfig = CHAIN_CONFIGS[options.chain as keyof typeof CHAIN_CONFIGS];
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${options.chain}`);
  }

  const rpcUrl = options.rpcUrl || chainConfig.RPC_URL;
  let privateKey: string;

  if (options.privateKeyFile) {
    privateKey = readPrivateKeyFromFile(options.privateKeyFile);
  } else if (process.env.PRIVATE_KEY) {
    privateKey = process.env.PRIVATE_KEY;
  } else {
    throw new Error(
      "Private key is required. Provide either --private-key-file or set PRIVATE_KEY environment variable"
    );
  }

  // Deploy new ServiceManager implementation
  const serviceManagerImplAddress = await deployServiceManagerImplementation(
    options.chain,
    rpcUrl,
    privateKey
  );
  logger.success(`ServiceManager Implementation deployed: ${serviceManagerImplAddress}`);

  // Deploy new VetoableSlasher (not upgradeable, but may need new version)
  const vetoableSlasherAddress = await deployVetoableSlasher(options.chain, rpcUrl, privateKey);
  logger.success(`VetoableSlasher deployed: ${vetoableSlasherAddress}`);

  // Deploy new RewardsRegistry (not upgradeable, but may need new version)
  const rewardsRegistryAddress = await deployRewardsRegistry(options.chain, rpcUrl, privateKey);
  logger.success(`RewardsRegistry deployed: ${rewardsRegistryAddress}`);

  // Update deployment file with new implementation addresses
  await updateDeploymentFile(options.chain, {
    ServiceManagerImplementation: serviceManagerImplAddress,
    VetoableSlasher: vetoableSlasherAddress,
    RewardsRegistry: rewardsRegistryAddress
  });
};

/**
 * Deploys new ServiceManager implementation contract
 */
const deployServiceManagerImplementation = async (
  chain: string,
  rpcUrl: string,
  privateKey: string
): Promise<string> => {
  logger.info("📦 Deploying ServiceManager implementation...");

  // Get existing deployment addresses for constructor parameters
  const chainConfig = CHAIN_CONFIGS[chain as keyof typeof CHAIN_CONFIGS];
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${chain}`);
  }
  const actualDeployments = await parseDeploymentsFile(chain);

  // Use environment variables to avoid command injection
  // Note: Private key is passed via environment variable as required by forge
  // This is a known limitation of the forge toolchain
  const env = {
    ...process.env,
    PRIVATE_KEY: privateKey,
    RPC_URL: rpcUrl,
    REWARDS_COORDINATOR: actualDeployments.RewardsCoordinator,
    PERMISSION_CONTROLLER: actualDeployments.PermissionController,
    ALLOCATION_MANAGER: actualDeployments.AllocationManager,
    ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY
  };

  const deployArgs = [
    "script",
    "script/deploy/DeployImplementation.s.sol:DeployImplementation",
    "--sig",
    "deployServiceManagerImpl()",
    "--broadcast",
    "--verify",
    "--verifier",
    "etherscan",
    "--verifier-url",
    chainConfig.BLOCK_EXPLORER,
    "--etherscan-api-key",
    process.env.ETHERSCAN_API_KEY || ""
  ];

  try {
    const result = await executeCommand("forge", deployArgs, env as Record<string, string>, "../contracts");

    // Extract the deployed address from the output
    const addressMatch = result.match(
      /ServiceManager Implementation deployed at: (0x[a-fA-F0-9]{40})/
    );
    if (addressMatch) {
      return addressMatch[1];
    }

    throw new Error(
      "Failed to extract ServiceManager implementation address from deployment output"
    );
  } catch (error) {
    logger.error(`❌ Failed to deploy ServiceManager implementation: ${error}`);
    throw error;
  }
};

/**
 * Deploys new VetoableSlasher contract
 */
const deployVetoableSlasher = async (
  chain: string,
  rpcUrl: string,
  privateKey: string
): Promise<string> => {
  logger.info("📦 Deploying VetoableSlasher...");

  const chainConfig = CHAIN_CONFIGS[chain as keyof typeof CHAIN_CONFIGS];
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${chain}`);
  }
  const actualDeployments = await parseDeploymentsFile(chain);

  // Note: Private key is passed via environment variable as required by forge
  // This is a known limitation of the forge toolchain
  const env = {
    ...process.env,
    PRIVATE_KEY: privateKey,
    RPC_URL: rpcUrl,
    ALLOCATION_MANAGER: actualDeployments.AllocationManager,
    SERVICE_MANAGER: actualDeployments.ServiceManager,
    ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY
  };

  const deployArgs = [
    "script",
    "script/deploy/DeployImplementation.s.sol:DeployImplementation",
    "--sig",
    "deployVetoableSlasher()",
    "--broadcast",
    "--verify",
    "--verifier",
    "etherscan",
    "--verifier-url",
    chainConfig.BLOCK_EXPLORER,
    "--etherscan-api-key",
    process.env.ETHERSCAN_API_KEY || ""
  ];

  try {
    const result = await executeCommand("forge", deployArgs, env as Record<string, string>, "../contracts");

    const addressMatch = result.match(/VetoableSlasher deployed at: (0x[a-fA-F0-9]{40})/);
    if (addressMatch) {
      return addressMatch[1];
    }

    throw new Error("Failed to extract VetoableSlasher address from deployment output");
  } catch (error) {
    logger.error(`❌ Failed to deploy VetoableSlasher: ${error}`);
    throw error;
  }
};

/**
 * Deploys new RewardsRegistry contract
 */
const deployRewardsRegistry = async (
  chain: string,
  rpcUrl: string,
  privateKey: string
): Promise<string> => {
  logger.info("📦 Deploying RewardsRegistry...");

  const chainConfig = CHAIN_CONFIGS[chain as keyof typeof CHAIN_CONFIGS];
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${chain}`);
  }
  const actualDeployments = await parseDeploymentsFile(chain);

  // Note: Private key is passed via environment variable as required by forge
  // This is a known limitation of the forge toolchain
  const env = {
    ...process.env,
    PRIVATE_KEY: privateKey,
    RPC_URL: rpcUrl,
    SERVICE_MANAGER: actualDeployments.ServiceManager,
    REWARDS_AGENT: actualDeployments.RewardsAgent,
    ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY
  };

  const deployArgs = [
    "script",
    "script/deploy/DeployImplementation.s.sol:DeployImplementation",
    "--sig",
    "deployRewardsRegistry()",
    "--broadcast",
    "--verify",
    "--verifier",
    "etherscan",
    "--verifier-url",
    chainConfig.BLOCK_EXPLORER,
    "--etherscan-api-key",
    process.env.ETHERSCAN_API_KEY || ""
  ];

  try {
    const result = await executeCommand("forge", deployArgs, env as Record<string, string>, "../contracts");

    const addressMatch = result.match(/RewardsRegistry deployed at: (0x[a-fA-F0-9]{40})/);
    if (addressMatch) {
      return addressMatch[1];
    }

    throw new Error("Failed to extract RewardsRegistry address from deployment output");
  } catch (error) {
    logger.error(`❌ Failed to deploy RewardsRegistry: ${error}`);
    throw error;
  }
};

/**
 * Updates proxy contracts to point to new implementations
 */
const updateProxyContracts = async (options: ContractsUpgradeOptions) => {
  logger.info("🔄 Updating proxy contracts...");

  const deployments = await parseDeploymentsFile(options.chain);
  const chainConfig = CHAIN_CONFIGS[options.chain as keyof typeof CHAIN_CONFIGS];
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${options.chain}`);
  }
  const rpcUrl = options.rpcUrl || chainConfig.RPC_URL;

  // Get private key using the same logic as deployImplementationContracts
  let privateKey: string;
  if (options.privateKeyFile) {
    privateKey = readPrivateKeyFromFile(options.privateKeyFile);
  } else if (process.env.PRIVATE_KEY) {
    privateKey = process.env.PRIVATE_KEY;
  } else {
    throw new Error(
      "Private key is required for proxy updates. Provide either --private-key-file or set PRIVATE_KEY environment variable"
    );
  }

  // Update ServiceManager proxy to point to new implementation
  await updateServiceManagerProxy(deployments, rpcUrl, privateKey);

  logger.success("Proxy contracts updated successfully");
};

/**
 * Updates ServiceManager proxy to point to new implementation
 */
const updateServiceManagerProxy = async (deployments: any, rpcUrl: string, privateKey: string) => {
  logger.info("🔄 Updating ServiceManager proxy...");

  // Note: Private key is passed via environment variable as required by forge
  // This is a known limitation of the forge toolchain
  const proxyAdmin = (deployments as any).ProxyAdmin ?? process.env.PROXY_ADMIN;
  if (!proxyAdmin) {
    throw new Error(
      "ProxyAdmin address is required for proxy updates. Add `ProxyAdmin` to the deployments file or set the PROXY_ADMIN environment variable."
    );
  }

  const env = {
    ...process.env,
    PRIVATE_KEY: privateKey,
    RPC_URL: rpcUrl,
    SERVICE_MANAGER: deployments.ServiceManager,
    SERVICE_MANAGER_IMPL: deployments.ServiceManagerImplementation,
    PROXY_ADMIN: proxyAdmin
  };

  const updateArgs = [
    "script",
    "script/deploy/DeployImplementation.s.sol:DeployImplementation",
    "--sig",
    "updateServiceManagerProxy()",
    "--broadcast"
  ];

  try {
    const result = await executeCommand("forge", updateArgs, env, "../contracts");

    logger.success("ServiceManager proxy updated successfully");
    logger.debug(result);
  } catch (error) {
    logger.error(`❌ Failed to update ServiceManager proxy: ${error}`);
    throw error;
  }
};

/**
 * Updates the deployment file with new contract addresses
 */
const updateDeploymentFile = async (chain: string, newAddresses: Record<string, string>) => {
  logger.info("📝 Updating deployment file...");

  try {
    const deployments = await parseDeploymentsFile(chain);
    const updatedDeployments = { ...deployments, ...newAddresses };

    const deploymentPath = `../contracts/deployments/${chain}.json`;
    const jsonContent = JSON.stringify(updatedDeployments, null, 2);

    writeFileSync(deploymentPath, jsonContent);
    logger.success(`Deployment file updated: ${deploymentPath}`);
  } catch (error) {
    logger.error(`❌ Failed to update deployment file: ${error}`);
    throw error;
  }
};

const bumpVersionForUpgrade = async (chain: string) => {
  try {
    const deployments = await parseDeploymentsFile(chain);
    const anyDeployments = deployments as any;

    const current = anyDeployments.version as string | undefined;
    let next = "0.0.1";

    if (current) {
      const [majorStr, minorStr, patchStr] = current.split(".");
      const major = Number(majorStr);
      const minor = Number(minorStr);
      const patch = Number(patchStr);

      if (Number.isFinite(major) && Number.isFinite(minor) && Number.isFinite(patch)) {
        next = `${major}.${minor}.${patch + 1}`;
      }
    }

    const updated = { ...anyDeployments, version: next };
    const deploymentPath = `../contracts/deployments/${chain}.json`;
    const jsonContent = JSON.stringify(updated, null, 2);
    writeFileSync(deploymentPath, jsonContent);

    logger.info(`📝 Updated deployment version for ${chain} to ${next}`);
  } catch (error) {
    logger.warn(`⚠️ Failed to bump deployment version for ${chain}: ${error}`);
  }
};
