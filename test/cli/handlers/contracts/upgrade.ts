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
  version?: string; // Version to upgrade to ("latest" or specific semver)
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
  } else if (process.env.DEPLOYER_PRIVATE_KEY) {
    // ProxyAdmin is owned by deployer, so use that key for proxy upgrades
    privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  } else if (process.env.PRIVATE_KEY) {
    privateKey = process.env.PRIVATE_KEY;
  } else {
    throw new Error(
      "Private key is required. Provide either --private-key-file or set DEPLOYER_PRIVATE_KEY/PRIVATE_KEY environment variable"
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

    // For anvil, auto-detect RPC URL from Kurtosis if not provided
    let resolvedRpcUrl = options.rpcUrl;
    if (options.chain === "anvil" && !resolvedRpcUrl) {
      const { getAnvilRpcUrl } = await import("../../../utils/anvil");
      resolvedRpcUrl = await getAnvilRpcUrl();
      logger.info(`📡 Auto-detected Anvil RPC URL: ${resolvedRpcUrl}`);
    } else if (resolvedRpcUrl) {
      logger.info(`📡 Using RPC URL: ${resolvedRpcUrl}`);
    }

    const upgradeOptions = { ...options, rpcUrl: resolvedRpcUrl };
    const { rpcUrl, privateKey } = resolveUpgradeContext(upgradeOptions);

    // Determine version FIRST (before any upgrade operations)
    const targetVersion = await resolveTargetVersion(options.version || "latest");
    logger.info(`🎯 Target version: ${targetVersion}`);

    // Validate that contracts match the target version's checksum
    await validateVersionChecksum(targetVersion);

    // Build contracts first
    await buildContracts();

    // Deploy new implementation contracts
    const serviceManagerImplAddress = await deployImplementationContracts(
      options.chain,
      rpcUrl,
      privateKey
    );

    // Update proxy contracts to point to new implementations AND update version in one transaction
    await updateProxyContracts(
      options.chain,
      rpcUrl,
      privateKey,
      serviceManagerImplAddress,
      targetVersion
    );

    // Update versions-matrix.json with deployment info
    await updateVersionsMatrix(options.chain, targetVersion);

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

  // Use environment variables to avoid command injection and process list exposure
  // Note: Private key is passed via PRIVATE_KEY environment variable (not command-line)
  // to prevent it from appearing in system process lists (security best practice)
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
    "--rpc-url",
    rpcUrl,
    "--broadcast",
    "--non-interactive"
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
 * Updates proxy contracts to point to new implementations and sets version
 */
const updateProxyContracts = async (
  chain: string,
  rpcUrl: string,
  privateKey: string,
  serviceManagerImplAddress: string,
  version: string
) => {
  logger.info("🔄 Updating proxy contracts and version...");

  const deployments = await parseDeploymentsFile(chain);

  // Update ServiceManager proxy to point to new implementation and update version in one transaction
  await updateServiceManagerProxyWithVersion(
    deployments,
    rpcUrl,
    privateKey,
    serviceManagerImplAddress,
    version
  );

  logger.success("Proxy contracts updated and version set successfully");
};

/**
 * Updates ServiceManager proxy to point to new implementation and updates version in one transaction
 * This saves gas by combining upgrade and version update
 */
const updateServiceManagerProxyWithVersion = async (
  deployments: any,
  rpcUrl: string,
  privateKey: string,
  serviceManagerImplAddress: string,
  version: string
) => {
  logger.info(`🔄 Updating ServiceManager proxy and setting version to ${version}...`);

  // Note: Private key is passed via PRIVATE_KEY environment variable (not command-line)
  // to prevent it from appearing in system process lists (security best practice)
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
    PROXY_ADMIN: proxyAdmin,
    NEW_VERSION: version
  };

  const updateArgs = [
    "script",
    "script/deploy/DeployImplementation.s.sol:DeployImplementation",
    "--sig",
    "updateServiceManagerProxyWithVersion()",
    "--rpc-url",
    rpcUrl,
    "--broadcast",
    "--non-interactive"
  ];

  try {
    const result = await executeCommand("forge", updateArgs, env, "../contracts");

    logger.success(`ServiceManager proxy updated and version set to ${version}`);
    logger.debug(result);
  } catch (error) {
    logger.error(`❌ Failed to update ServiceManager proxy: ${error}`);
    throw error;
  }
};

/**
 * Resolves the target version for upgrade
 * "latest" reads from VERSION file, otherwise uses provided semver
 */
const resolveTargetVersion = async (versionSpec: string): Promise<string> => {
  if (versionSpec === "latest") {
    const cwd = process.cwd();
    const repoRoot = path.basename(cwd) === "test" ? path.join(cwd, "..") : cwd;
    const versionFile = path.join(repoRoot, "contracts", "VERSION");
    const version = readFileSync(versionFile, "utf8").trim();
    logger.info(`📖 Reading version from VERSION file: ${version}`);
    return version;
  }

  // Validate semver format
  const semverRegex = /^\d+\.\d+\.\d+$/;
  if (!semverRegex.test(versionSpec)) {
    throw new Error(`Invalid version format: ${versionSpec}. Expected X.Y.Z`);
  }

  return versionSpec;
};

/**
 * Validates that current contracts match the expected checksum for target version
 */
const validateVersionChecksum = async (version: string): Promise<void> => {
  const cwd = process.cwd();
  const repoRoot = path.basename(cwd) === "test" ? path.join(cwd, "..") : cwd;
  const matrixFile = path.join(repoRoot, "contracts", "versions-matrix.json");
  const contractsPath = path.join(repoRoot, "contracts", "src");

  // Read versions matrix
  const matrixContent = readFileSync(matrixFile, "utf8");
  const matrix = JSON.parse(matrixContent);

  // Calculate current checksum
  const { generateContractsChecksum } = await import("../../../scripts/contracts-checksum");
  const currentChecksum = generateContractsChecksum(contractsPath);

  // Check if version matches code version in matrix
  if (matrix.code.version !== version) {
    throw new Error(
      `Version mismatch: VERSION file says ${version} but versions-matrix.json code.version is ${matrix.code.version}. ` +
        "Run 'bun cli contracts apply-changesets' or update VERSION file manually."
    );
  }

  // Validate checksum matches
  if (matrix.code.checksum !== currentChecksum) {
    throw new Error(
      `Checksum mismatch: versions-matrix.json says ${matrix.code.checksum} but current contracts checksum is ${currentChecksum}. ` +
        "Either contracts changed without version bump, or versions-matrix.json is stale."
    );
  }

  logger.success(`Contracts checksum validated for version ${version}`);
};

/**
 * Updates versions-matrix.json with new deployment info
 */
const updateVersionsMatrix = async (chain: string, version: string): Promise<void> => {
  const cwd = process.cwd();
  const repoRoot = path.basename(cwd) === "test" ? path.join(cwd, "..") : cwd;
  const matrixFile = path.join(repoRoot, "contracts", "versions-matrix.json");

  const matrixContent = readFileSync(matrixFile, "utf8");
  const matrix = JSON.parse(matrixContent);

  // Update deployment info
  if (!matrix.deployments) {
    matrix.deployments = {};
  }
  matrix.deployments[chain] = {
    version,
    lastDeployed: new Date().toISOString()
  };

  writeFileSync(matrixFile, JSON.stringify(matrix, null, 2));
  logger.info(`📝 Updated versions-matrix.json for chain ${chain}`);
};
