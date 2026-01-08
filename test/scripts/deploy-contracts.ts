import { $ } from "bun";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CHAIN_CONFIGS, loadChainConfig } from "configs/contracts/config";
import invariant from "tiny-invariant";
import { logger, parseDeploymentsFile, parseRewardsInfoFile, runShellCommandWithLogger } from "utils";
import { getDependencyVersions } from "utils/dependencyVersions";
import type { ParameterCollection } from "utils/parameters";
import { encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { dataHavenServiceManagerAbi } from "../contract-bindings/generated";

interface ContractDeploymentOptions {
  chain?: string;
  rpcUrl?: string;
  privateKey?: string | undefined;
  verified?: boolean;
  blockscoutBackendUrl?: string;
  avsOwnerAddress?: string;
  avsOwnerKey?: string;
  txExecution?: boolean;
}

/**
 * Validates deployment parameters
 */
export const validateDeploymentParams = (options: ContractDeploymentOptions) => {
  const { rpcUrl, verified, blockscoutBackendUrl } = options;

  invariant(rpcUrl, "❌ RPC URL is required");
  if (verified) {
    invariant(blockscoutBackendUrl, "❌ Blockscout backend URL is required for verification");
  }
};

/**
 * Builds smart contracts using forge
 */
export const buildContracts = async () => {
  logger.info("🛳️ Building contracts...");
  const {
    exitCode: buildExitCode,
    stderr: buildStderr,
    stdout: buildStdout
  } = await $`forge build`.cwd("../contracts").nothrow().quiet();

  if (buildExitCode !== 0) {
    logger.error(buildStderr.toString());
    throw Error("❌ Contracts have failed to build properly.");
  }
  logger.debug(buildStdout.toString());
};

/**
 * Constructs the deployment command
 */
export const constructDeployCommand = (options: ContractDeploymentOptions): string => {
  const { chain, rpcUrl, verified, blockscoutBackendUrl } = options;

  const deploymentScript =
    !chain || chain === "anvil"
      ? "script/deploy/DeployLocal.s.sol"
      : "script/deploy/DeployTestnet.s.sol";

  logger.info(`🚀 Deploying contracts to ${chain} using ${deploymentScript}`);

  let deployCommand = `forge script ${deploymentScript} --rpc-url ${rpcUrl} --color never -vv --no-rpc-rate-limit --non-interactive --broadcast`;

  // Add environment variable for chain if specified
  if (chain) {
    deployCommand = `NETWORK=${chain} ${deployCommand}`;
  }

  if (verified && blockscoutBackendUrl) {
    // TODO: Allow for other verifiers like Etherscan.
    deployCommand += ` --verify --verifier blockscout --verifier-url ${blockscoutBackendUrl}/api/ --delay 0`;
    logger.info("🔍 Contract verification enabled");
  }

  return deployCommand;
};

/**
 * Executes contract deployment
 * Supports multiple calling patterns for backwards compatibility:
 */
export const executeDeployment = async (
  deployCommand: string,
  parameterCollection?: ParameterCollection,
  chain?: string,
  env?: Record<string, string>
) => {
  logger.info("⌛️ Deploying contracts (this might take a few minutes)...");

  // Using custom shell command to improve logging with forge's stdoutput
  await runShellCommandWithLogger(deployCommand, {
    cwd: "../contracts",
    env
  });

  // After deployment, read the:
  // - Gateway address
  // - RewardsAgent address
  // - RewardsAgentOrigin (bytes32)
  // and add it to parameters if collection is provided
  if (parameterCollection) {
    await updateParameters(parameterCollection, chain);
  }

  logger.success("Contracts deployed successfully");
};

export const bumpVersionAndUpdateDepsForDeploy = async (chain: string | undefined) => {
  if (!chain) {
    return;
  }

  try {
    const cwd = process.cwd();
    const repoRoot = path.basename(cwd) === "test" ? path.join(cwd, "..") : cwd;
    const deploymentPath = path.join(repoRoot, "contracts", "deployments", `${chain}.json`);

    const raw = readFileSync(deploymentPath, "utf8");
    const deploymentsJson = JSON.parse(
      raw
    ) as { version?: string; deps?: { eigenlayer?: any; snowbridge?: any } };

    const current = deploymentsJson.version;
    let next = "0.1.0";

    if (current) {
      const [majorStr, minorStr, patchStr] = current.split(".");
      const major = Number(majorStr);
      const minor = Number(minorStr);
      const patch = Number(patchStr);

      if (Number.isFinite(major) && Number.isFinite(minor) && Number.isFinite(patch)) {
        next = `${major}.${minor + 1}.0`;
      }
    }

    deploymentsJson.version = next;

    const deps = await getDependencyVersions();
    deploymentsJson.deps = {
      ...(deploymentsJson.deps ?? {}),
      eigenlayer: {
        ...(deploymentsJson.deps?.eigenlayer ?? {}),
        ...deps.eigenlayer
      },
      snowbridge: {
        ...(deploymentsJson.deps?.snowbridge ?? {}),
        ...deps.snowbridge
      }
    };

    writeFileSync(deploymentPath, JSON.stringify(deploymentsJson, null, 2));
    logger.info(`📝 Updated deployment version for ${chain} to ${next}`);
    logger.info(
      `📝 Updated dependency versions for ${chain}: eigenlayer=${deps.eigenlayer.release ?? deps.eigenlayer.gitCommit}, snowbridge=${deps.snowbridge.release ?? deps.snowbridge.gitCommit}`
    );
  } catch (error) {
    logger.warn(`⚠️ Failed to update deployment version/dependency metadata for ${chain}: ${error}`);
  }
};

/**
 * Read the parameters from the deployed contracts and add it to the collection.
 */
export const updateParameters = async (
  parameterCollection: ParameterCollection,
  chain?: string
) => {
  try {
    const deployments = await parseDeploymentsFile(chain);
    const rewardsInfo = await parseRewardsInfoFile(chain);
    const gatewayAddress = deployments.Gateway;
    const rewardsAgentOrigin = rewardsInfo.RewardsAgentOrigin;
    const updateRewardsMerkleRootSelector = rewardsInfo.updateRewardsMerkleRootSelector;
    const serviceManagerAddress = deployments.ServiceManager;

    if (gatewayAddress) {
      logger.debug(`📝 Adding EthereumGatewayAddress parameter: ${gatewayAddress}`);

      parameterCollection.addParameter({
        name: "EthereumGatewayAddress",
        value: gatewayAddress
      });
    } else {
      logger.warn("⚠️ Gateway address not found in deployments file");
    }

    if (updateRewardsMerkleRootSelector) {
      logger.debug(`📝 Adding RewardsUpdateSelector parameter: ${updateRewardsMerkleRootSelector}`);
      parameterCollection.addParameter({
        name: "RewardsUpdateSelector",
        value: updateRewardsMerkleRootSelector
      });
    } else {
      logger.warn("⚠️ updateRewardsMerkleRootSelector not found in rewards info file");
    }

    if (rewardsAgentOrigin) {
      logger.debug(`📝 Adding RewardsAgentOrigin parameter: ${rewardsAgentOrigin}`);
      parameterCollection.addParameter({
        name: "RewardsAgentOrigin",
        value: rewardsAgentOrigin
      });
    } else {
      logger.warn("⚠️ RewardsAgentOrigin not found in deployments file");
    }

    if (serviceManagerAddress) {
      logger.debug(`📝 Adding DatahavenServiceManagerAddress parameter: ${serviceManagerAddress}`);
      parameterCollection.addParameter({
        name: "DatahavenServiceManagerAddress",
        value: serviceManagerAddress
      });
    } else {
      logger.warn("⚠️ ServiceManager address not found in deployments file");
    }
  } catch (error) {
    logger.error(`Failed to read parameters from deployment: ${error}`);
  }
};

/**
 * Main function to deploy contracts with simplified interface
 * This is the main entry point for CLI handlers
 */
export const deployContracts = async (options: {
  chain: string;
  rpcUrl?: string;
  privateKey?: string | undefined;
  verified?: boolean;
  blockscoutBackendUrl?: string;
  avsOwnerKey?: string;
  avsOwnerAddress?: string;
  txExecution?: boolean;
}) => {
  const chainConfig = CHAIN_CONFIGS[options.chain as keyof typeof CHAIN_CONFIGS];

  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${options.chain}`);
  }

  const finalRpcUrl = options.rpcUrl || chainConfig.RPC_URL;
  const isLocalChain = options.chain === "anvil";
  const txExecutionEnabled = options.txExecution ?? isLocalChain;
  const normalizedOwnerKey = normalizePrivateKey(
    options.avsOwnerKey || process.env.AVS_OWNER_PRIVATE_KEY
  );

  let resolvedAvsOwnerAddress = options.avsOwnerAddress;
  if (!resolvedAvsOwnerAddress && normalizedOwnerKey) {
    resolvedAvsOwnerAddress = privateKeyToAccount(normalizedOwnerKey).address;
  }

  if (!resolvedAvsOwnerAddress && isLocalChain) {
    const config = await loadChainConfig(options.chain);
    resolvedAvsOwnerAddress = config?.avs?.avsOwner;
  }

  if (!resolvedAvsOwnerAddress) {
    throw new Error(
      "AVS owner address is required. Provide --avs-owner-address, --avs-owner-key, or AVS_OWNER_ADDRESS."
    );
  }

  if (txExecutionEnabled && !normalizedOwnerKey) {
    throw new Error(
      "Executing AVS owner transactions requires --avs-owner-key or AVS_OWNER_PRIVATE_KEY to be set."
    );
  }

  const deploymentOptions: ContractDeploymentOptions = {
    chain: options.chain,
    rpcUrl: finalRpcUrl,
    privateKey: options.privateKey,
    verified: options.verified,
    blockscoutBackendUrl: options.blockscoutBackendUrl,
    avsOwnerAddress: resolvedAvsOwnerAddress,
    avsOwnerKey: normalizedOwnerKey,
    txExecution: txExecutionEnabled
  };

  // Validate parameters
  validateDeploymentParams(deploymentOptions);

  // Build contracts
  await buildContracts();

  // Construct and execute deployment
  const deployCommand = constructDeployCommand(deploymentOptions);
  const env = buildDeploymentEnv(deploymentOptions);
  await executeDeployment(deployCommand, undefined, options.chain, env);

  if (!txExecutionEnabled) {
    await emitOwnerTransactionCalldata(options.chain);
  }

  await bumpVersionAndUpdateDepsForDeploy(options.chain);

  logger.success(`DataHaven contracts deployed successfully to ${options.chain}`);
};

const normalizePrivateKey = (key?: string): `0x${string}` | undefined => {
  if (!key) {
    return undefined;
  }
  return (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
};

const buildDeploymentEnv = (options: ContractDeploymentOptions) => {
  const env: Record<string, string> = {};

  if (options.privateKey) {
    env.DEPLOYER_PRIVATE_KEY = options.privateKey;
  }

  if (options.avsOwnerKey) {
    env.AVS_OWNER_PRIVATE_KEY = options.avsOwnerKey;
  }

  if (options.avsOwnerAddress) {
    env.AVS_OWNER_ADDRESS = options.avsOwnerAddress;
  }

  if (typeof options.txExecution === "boolean") {
    env.TX_EXECUTION = options.txExecution ? "true" : "false";
  }

  return env;
};

const emitOwnerTransactionCalldata = async (chain?: string) => {
  try {
    const deployments = await parseDeploymentsFile(chain);
    const rewardsInfo = await parseRewardsInfoFile(chain);

    const serviceManager = deployments.ServiceManager;
    const rewardsRegistry = deployments.RewardsRegistry;
    const rewardsAgent = rewardsInfo.RewardsAgent;

    if (!serviceManager || !rewardsRegistry || !rewardsAgent) {
      logger.warn("⚠️ Missing deployment artifacts; cannot produce multisig calldata.");
      return;
    }

    const calls = [
      {
        label: "Set metadata URI",
        description: 'DataHavenServiceManager.updateAVSMetadataURI("")',
        to: serviceManager,
        value: "0",
        data: encodeFunctionData({
          abi: dataHavenServiceManagerAbi,
          functionName: "updateAVSMetadataURI",
          args: [""]
        })
      },
      {
        label: "Attach RewardsRegistry",
        description: "DataHavenServiceManager.setRewardsRegistry(VALIDATORS_SET_ID, address)",
        to: serviceManager,
        value: "0",
        data: encodeFunctionData({
          abi: dataHavenServiceManagerAbi,
          functionName: "setRewardsRegistry",
          args: [0, rewardsRegistry]
        })
      },
      {
        label: "Set Rewards Agent",
        description: "DataHavenServiceManager.setRewardsAgent(VALIDATORS_SET_ID, address)",
        to: serviceManager,
        value: "0",
        data: encodeFunctionData({
          abi: dataHavenServiceManagerAbi,
          functionName: "setRewardsAgent",
          args: [0, rewardsAgent]
        })
      }
    ];

    logger.info(
      "🔐 On-chain owner transactions were deferred. Submit the following calls via your multisig:"
    );
    calls.forEach((call, index) => {
      logger.info(`\n#${index + 1} ${call.label}`);
      logger.info(call.description);
      logger.info(JSON.stringify(call, null, 2));
    });
  } catch (error) {
    logger.warn(`⚠️ Failed to build multisig calldata: ${error}`);
  }
};

// Allow script to be run directly with CLI arguments
if (import.meta.main) {
  const args = process.argv.slice(2);

  // Extract RPC URL
  const rpcUrlIndex = args.indexOf("--rpc-url");
  invariant(rpcUrlIndex !== -1, "❌ --rpc-url flag is required");
  invariant(rpcUrlIndex + 1 < args.length, "❌ --rpc-url flag requires an argument");

  // Extract private key
  const privateKeyIndex = args.indexOf("--private-key");
  invariant(privateKeyIndex !== -1, "❌ --private-key flag is required");
  invariant(privateKeyIndex + 1 < args.length, "❌ --private-key flag requires an argument");

  const options: {
    rpcUrl: string;
    privateKey: string;
    verified: boolean;
    blockscoutBackendUrl?: string;
  } = {
    rpcUrl: args[rpcUrlIndex + 1],
    privateKey: args[privateKeyIndex + 1],
    verified: args.includes("--verified")
  };

  // Extract Blockscout URL if verification is enabled
  if (options.verified) {
    const blockscoutUrlIndex = args.indexOf("--blockscout-url");
    if (blockscoutUrlIndex !== -1 && blockscoutUrlIndex + 1 < args.length) {
      options.blockscoutBackendUrl = args[blockscoutUrlIndex + 1];
    }
  }

  if (!options.rpcUrl) {
    console.error("Error: --rpc-url parameter is required");
    process.exit(1);
  }

  if (options.verified && !options.blockscoutBackendUrl) {
    console.error("Error: --blockscout-url parameter is required when using --verified");
    process.exit(1);
  }

  validateDeploymentParams(options);

  await buildContracts();

  const deployCommand = constructDeployCommand(options);
  const directEnv = options.privateKey ? { DEPLOYER_PRIVATE_KEY: options.privateKey } : undefined;
  await executeDeployment(deployCommand, undefined, undefined, directEnv);
}
