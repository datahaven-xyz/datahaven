import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { logger, printDivider } from "utils";
import { type Deployments, parseDeploymentsFile } from "utils/contracts";
import { encodeFunctionData } from "viem";
import { CHAIN_CONFIGS } from "../../../configs/contracts/config";
import { buildContracts } from "../../../scripts/deploy-contracts";
import { verifyContracts } from "./verify";

interface ContractsUpgradeOptions {
  chain: string;
  rpcUrl?: string;
  privateKeyFile?: string;
  verify?: boolean;
  version?: string; // Explicit version to upgrade to (writes to VERSION file); omit to read from VERSION file
  execute?: boolean; // When false (default), output calldata for multisig; when true, broadcast on-chain
}

const resolveUpgradeContext = (options: ContractsUpgradeOptions) => {
  const chainConfig = CHAIN_CONFIGS[options.chain as keyof typeof CHAIN_CONFIGS];
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${options.chain}`);
  }

  const rpcUrl = options.rpcUrl || chainConfig.RPC_URL;

  // Key used to deploy new implementation contracts (any funded account works)
  let deployerKey: string;
  if (options.privateKeyFile) {
    deployerKey = readPrivateKeyFromFile(options.privateKeyFile);
  } else if (process.env.DEPLOYER_PRIVATE_KEY) {
    deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  } else if (process.env.PRIVATE_KEY) {
    deployerKey = process.env.PRIVATE_KEY;
  } else {
    throw new Error(
      "Deployer key is required. Provide either --private-key-file or set DEPLOYER_PRIVATE_KEY/PRIVATE_KEY environment variable"
    );
  }

  // AVS owner key — owns the ProxyAdmin and the ServiceManager contract.
  // Required only when --execute is set; in dry-run mode the calldata is printed for manual multisig execution.
  const avsOwnerKey = process.env.AVS_OWNER_PRIVATE_KEY;
  if (options.execute && !avsOwnerKey) {
    throw new Error(
      "AVS_OWNER_PRIVATE_KEY environment variable is required when using --execute to perform upgrades"
    );
  }

  return { chainConfig, rpcUrl, deployerKey, avsOwnerKey };
};

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
 * and updating proxy contracts to point to new implementations.
 *
 * Dry-run mode (default, --execute not set):
 *   Deploys the new implementation, then prints the ProxyAdmin.upgradeAndCall
 *   calldata so the multisig team can execute it manually. No AVS owner key needed.
 *
 * Execute mode (--execute):
 *   Full on-chain upgrade — deploys the implementation and broadcasts the proxy
 *   upgrade + version update transaction signed by the AVS owner.
 */
export const contractsUpgrade = async (options: ContractsUpgradeOptions) => {
  const isDryRun = !options.execute;

  try {
    logger.info("🔄 Starting contract upgrade...");
    logger.info(`📡 Using chain: ${options.chain}`);
    if (isDryRun) {
      logger.info(
        "ℹ️  Dry-run mode: the proxy upgrade transaction will NOT be broadcast. Calldata will be printed for manual multisig execution."
      );
      logger.info("   Pass --execute to broadcast the upgrade on-chain.");
    }

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
    const { rpcUrl, deployerKey, avsOwnerKey } = resolveUpgradeContext(upgradeOptions);

    // Resolve target version:
    // - If an explicit version is provided, write it to contracts/VERSION and use it.
    // - Otherwise read the current version from contracts/VERSION.
    const targetVersion = await resolveTargetVersion(options.version);
    logger.info(`🎯 Target version: ${targetVersion}`);

    // Build contracts first
    await buildContracts();

    // Deploy new implementation contracts (signed by deployer — any funded account)
    const serviceManagerImplAddress = await deployImplementationContracts(
      options.chain,
      rpcUrl,
      deployerKey
    );

    if (isDryRun) {
      // Print the calldata for the proxy upgrade so the multisig team can execute it
      await printProxyUpgradeCalldata(options.chain, serviceManagerImplAddress, targetVersion);
    } else {
      // Update proxy contracts to point to new implementations AND update version in one transaction.
      // Must be signed by the AVS owner, who owns both the ProxyAdmin and the ServiceManager.
      await updateProxyContracts(
        options.chain,
        rpcUrl,
        avsOwnerKey as string,
        serviceManagerImplAddress,
        targetVersion
      );

      // Verify contracts if requested
      if (options.verify) {
        logger.info("🔍 Verifying upgraded contracts...");
        await verifyContracts({
          chain: options.chain,
          rpcUrl,
          skipVerification: false
        });
      }
    }

    printDivider();
    logger.success(
      isDryRun
        ? "Dry-run complete. Submit the transaction above via your multisig to finalize the upgrade."
        : "Contract upgrade completed successfully"
    );
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
    ...currentDeployments,
    ServiceManagerImplementation: serviceManagerImplAddress as `0x${string}`
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

  const { privateKeyToAccount } = await import("viem/accounts");
  const normalizedKey = (
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  ) as `0x${string}`;
  const deployerAddress = privateKeyToAccount(normalizedKey).address;

  const deployArgs = [
    "script",
    "script/deploy/DeployImplementation.s.sol:DeployImplementation",
    "--sig",
    "deployServiceManagerImpl()",
    "--rpc-url",
    rpcUrl,
    "--sender",
    deployerAddress,
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
 * Minimal ABI for ProxyAdmin.upgradeAndCall — the only function needed to upgrade a
 * TransparentUpgradeableProxy and call an initializer in a single transaction.
 */
const PROXY_ADMIN_ABI = [
  {
    name: "upgradeAndCall",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "proxy", type: "address" },
      { name: "implementation", type: "address" },
      { name: "data", type: "bytes" }
    ],
    outputs: []
  }
] as const;

/**
 * Prints the ProxyAdmin.upgradeAndCall calldata for manual multisig execution (dry-run).
 *
 * The upgrader team should submit this transaction from the multisig that owns the ProxyAdmin.
 * The call combines the proxy upgrade and the version update in one atomic transaction.
 */
const printProxyUpgradeCalldata = async (
  chain: string,
  serviceManagerImplAddress: string,
  version: string
) => {
  const deployments = await parseDeploymentsFile(chain);

  const proxyAdmin = deployments.ProxyAdmin ?? process.env.PROXY_ADMIN;
  if (!proxyAdmin) {
    throw new Error(
      "ProxyAdmin address is required to generate upgrade calldata. Add `ProxyAdmin` to the deployments file or set the PROXY_ADMIN environment variable."
    );
  }

  const serviceManager = deployments.ServiceManager;
  if (!serviceManager) {
    throw new Error("ServiceManager address not found in deployments file");
  }

  // Encode the updateVersion(string) call that will be passed as the `data` argument
  // to upgradeAndCall, so the version is set atomically with the proxy upgrade.
  const updateVersionData = encodeFunctionData({
    abi: [
      {
        name: "updateVersion",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "newVersion", type: "string" }],
        outputs: []
      }
    ] as const,
    functionName: "updateVersion",
    args: [version]
  });

  const calldata = encodeFunctionData({
    abi: PROXY_ADMIN_ABI,
    functionName: "upgradeAndCall",
    args: [
      serviceManager as `0x${string}`,
      serviceManagerImplAddress as `0x${string}`,
      updateVersionData
    ]
  });

  logger.info("");
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info("🔐 PROXY UPGRADE TRANSACTION (submit via multisig)");
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const payload = {
    to: proxyAdmin,
    value: "0",
    data: calldata,
    description: `Upgrade ServiceManager proxy to ${serviceManagerImplAddress} and set version to ${version}`
  };
  logger.info(JSON.stringify(payload, null, 2));
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info("");

  return payload;
};

/**
 * Updates proxy contracts to point to new implementations and sets version
 */
const updateProxyContracts = async (
  chain: string,
  rpcUrl: string,
  avsOwnerKey: string,
  serviceManagerImplAddress: string,
  version: string
) => {
  logger.info("🔄 Updating proxy contracts and version...");

  const deployments = await parseDeploymentsFile(chain);

  // Update ServiceManager proxy to point to new implementation and update version in one transaction
  await updateServiceManagerProxyWithVersion(
    deployments,
    rpcUrl,
    avsOwnerKey,
    serviceManagerImplAddress,
    version
  );

  logger.success("Proxy contracts updated and version set successfully");
};

/**
 * Updates ServiceManager proxy to point to new implementation and updates version in one transaction.
 * Signed by the AVS owner, who owns both the ProxyAdmin and the ServiceManager.
 */
const updateServiceManagerProxyWithVersion = async (
  deployments: Deployments,
  rpcUrl: string,
  avsOwnerKey: string,
  serviceManagerImplAddress: string,
  version: string
) => {
  logger.info(`🔄 Updating ServiceManager proxy and setting version to ${version}...`);

  const proxyAdmin = deployments.ProxyAdmin ?? process.env.PROXY_ADMIN;
  if (!proxyAdmin) {
    throw new Error(
      "ProxyAdmin address is required for proxy updates. Add `ProxyAdmin` to the deployments file or set the PROXY_ADMIN environment variable."
    );
  }

  // AVS_OWNER_PRIVATE_KEY is passed via environment variable (not command-line)
  // to prevent it from appearing in system process lists (security best practice)
  const env = {
    ...process.env,
    AVS_OWNER_PRIVATE_KEY: avsOwnerKey,
    RPC_URL: rpcUrl,
    SERVICE_MANAGER: deployments.ServiceManager,
    SERVICE_MANAGER_IMPL: serviceManagerImplAddress,
    PROXY_ADMIN: proxyAdmin,
    NEW_VERSION: version
  };

  // Derive the sender address from the AVS owner key so forge doesn't complain
  // about using the default sender when vm.broadcast is called with a key loaded
  // from an environment variable rather than --private-key.
  const { privateKeyToAccount } = await import("viem/accounts");
  const avsOwnerAddress = privateKeyToAccount(avsOwnerKey as `0x${string}`).address;

  const updateArgs = [
    "script",
    "script/deploy/DeployImplementation.s.sol:DeployImplementation",
    "--sig",
    "updateServiceManagerProxyWithVersion()",
    "--rpc-url",
    rpcUrl,
    "--sender",
    avsOwnerAddress,
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
 * Resolves the target version for upgrade.
 *
 * - If an explicit semver string is provided, it is written to contracts/VERSION and returned.
 * - If undefined/empty, the current value of contracts/VERSION is read and returned unchanged.
 */
const resolveTargetVersion = async (versionSpec: string | undefined): Promise<string> => {
  const cwd = process.cwd();
  const repoRoot = path.basename(cwd) === "test" ? path.join(cwd, "..") : cwd;
  const versionFile = path.join(repoRoot, "contracts", "VERSION");

  if (!versionSpec) {
    // No version provided — read from VERSION file
    const version = readFileSync(versionFile, "utf8").trim();
    logger.info(`📖 Reading version from VERSION file: ${version}`);
    return version;
  }

  // Validate semver format
  const semverRegex = /^\d+\.\d+\.\d+$/;
  if (!semverRegex.test(versionSpec)) {
    throw new Error(`Invalid version format: ${versionSpec}. Expected X.Y.Z`);
  }

  // Write the new version to the VERSION file
  writeFileSync(versionFile, versionSpec);
  logger.info(`📝 Updated contracts/VERSION to ${versionSpec}`);

  return versionSpec;
};
