import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { logger, printDivider, printHeader } from "utils";
import { parseDeploymentsFile } from "utils/contracts";
import { CHAIN_CONFIGS } from "../../../configs/contracts/config";
import { buildContracts } from "../../../scripts/deploy-contracts";
import { verifyContracts } from "./verify";

interface ContractsUpgradeOptions {
  chain: string;
  rpcUrl?: string;
  privateKeyFile?: string;
  verify?: boolean;
}

const resolveUpgradeContext = (options: ContractsUpgradeOptions) => {
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

  return { chainConfig, rpcUrl, privateKey };
};

/**
 * Reads private key from file
 */
const readPrivateKeyFromFile = (filePath: string): string => {
  const privateKey = readFileSync(filePath, "utf8").trim();
  if (!privateKey) {
    throw new Error("Private key file is empty");
  }
  return privateKey;
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

    const { rpcUrl, privateKey } = resolveUpgradeContext(options);

    // Build contracts first
    await buildContracts();

    // Deploy new implementation contracts
    const serviceManagerImplAddress = await deployImplementationContracts(
      options.chain,
      rpcUrl,
      privateKey
    );

    // Update proxy contracts to point to new implementations
    await updateProxyContracts(options.chain, rpcUrl, privateKey, serviceManagerImplAddress);

    // Bump version (patch) to reflect upgraded contracts
    await bumpVersionForUpgrade(options.chain);

    // Verify contracts if requested
    if (options.verify) {
      logger.info("🔍 Verifying upgraded contracts...");
      await verifyContracts({
        chain: options.chain,
        rpcUrl,
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
 * Deploys only the implementation contracts
 */
const deployImplementationContracts = async (
  chain: string,
  rpcUrl: string,
  privateKey: string
): Promise<string> => {
  logger.info("🚀 Deploying new implementation contracts...");

  // Deploy new ServiceManager implementation
  const serviceManagerImplAddress = await deployServiceManagerImplementation(
    chain,
    rpcUrl,
    privateKey
  );
  logger.success(`ServiceManager Implementation deployed: ${serviceManagerImplAddress}`);

  // Persist the new implementation address so it becomes the source-of-truth for subsequent steps.
  const deploymentPath = `../contracts/deployments/${chain}.json`;
  const currentDeployments = await parseDeploymentsFile(chain);
  const updatedDeployments = {
    ...(currentDeployments as any),
    ServiceManagerImplementation: serviceManagerImplAddress
  };
  writeFileSync(deploymentPath, JSON.stringify(updatedDeployments, null, 2));
  logger.info(`📝 Updated ${deploymentPath} with new ServiceManagerImplementation`);

  return serviceManagerImplAddress;
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
    "--broadcast"
  ];

  try {
    const result = await executeCommand(
      "forge",
      deployArgs,
      env as Record<string, string>,
      "../contracts"
    );

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
 * Updates proxy contracts to point to new implementations
 */
const updateProxyContracts = async (
  chain: string,
  rpcUrl: string,
  privateKey: string,
  serviceManagerImplAddress: string
) => {
  logger.info("🔄 Updating proxy contracts...");

  const deployments = await parseDeploymentsFile(chain);

  // Update ServiceManager proxy to point to new implementation
  await updateServiceManagerProxy(deployments, rpcUrl, privateKey, serviceManagerImplAddress);

  logger.success("Proxy contracts updated successfully");
};

/**
 * Updates ServiceManager proxy to point to new implementation
 */
const updateServiceManagerProxy = async (
  deployments: any,
  rpcUrl: string,
  privateKey: string,
  serviceManagerImplAddress: string
) => {
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
    SERVICE_MANAGER_IMPL: serviceManagerImplAddress,
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

const bumpVersionForUpgrade = async (chain: string) => {
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
  const cwd = process.cwd();
  const repoRoot = path.basename(cwd) === "test" ? path.join(cwd, "..") : cwd;
  const deploymentPath = path.join(repoRoot, "contracts", "deployments", `${chain}.json`);
  const jsonContent = JSON.stringify(updated, null, 2);
  writeFileSync(deploymentPath, jsonContent);

  logger.info(`📝 Updated deployment version for ${chain} to ${next}`);
};
