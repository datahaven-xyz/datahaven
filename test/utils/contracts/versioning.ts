import { writeFileSync } from "node:fs";
import path from "node:path";
import { CHAIN_CONFIGS } from "configs/contracts/config";
import { logger } from "utils";
import { getContractInstance, parseDeploymentsFile } from "utils/contracts";
import { getDependencyVersions } from "utils/dependencyVersions";
import type { ViemClientInterface } from "utils/viem";
import { createWalletClient, defineChain, http, publicActions } from "viem";

export interface ContractVersionCheckResult {
  ok: boolean;
  skipped: boolean;
}

const assertValidChain = (chain: string) => {
  const supportedChains = ["hoodi", "ethereum", "anvil"];
  if (!supportedChains.includes(chain)) {
    throw new Error(`Unsupported chain: ${chain}. Supported chains: ${supportedChains.join(", ")}`);
  }
};

const isInfraUnavailableError = (error: unknown): boolean => {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : String(error);

  return (
    message.includes("Failed to connect to Docker daemon") ||
    (message.includes("container") &&
      message.includes("cannot be found  in running container list")) ||
    message.includes("ECONNREFUSED") ||
    message.includes("ECONNRESET") ||
    message.includes("ENOTFOUND") ||
    message.includes("EHOSTUNREACH") ||
    message.includes("Was there a typo in the url or port?")
  );
};

export const checkDependencyVersions = async (chain: string): Promise<boolean> => {
  assertValidChain(chain);
  logger.info(`🔍 Checking dependency versions for chain '${chain}'`);

  const deployments = await parseDeploymentsFile(chain);
  const deps = (deployments as any).deps as {
    eigenlayer?: { release?: string; gitCommit?: string };
    snowbridge?: { release?: string; gitCommit?: string };
  };

  if (!deps?.eigenlayer || !deps?.snowbridge) {
    throw new Error(
      `Missing 'deps.eigenlayer' or 'deps.snowbridge' in contracts/deployments/${chain}.json`
    );
  }

  const current = await getDependencyVersions();
  let ok = true;

  if (!deps.eigenlayer.gitCommit || deps.eigenlayer.gitCommit !== current.eigenlayer.gitCommit) {
    logger.error(
      `❌ eigenlayer gitCommit mismatch for '${chain}': deployments=${deps.eigenlayer.gitCommit ?? "(missing)"} current=${current.eigenlayer.gitCommit}`
    );
    ok = false;
  }

  if (!deps.snowbridge.gitCommit || deps.snowbridge.gitCommit !== current.snowbridge.gitCommit) {
    logger.error(
      `❌ snowbridge gitCommit mismatch for '${chain}': deployments=${deps.snowbridge.gitCommit ?? "(missing)"} current=${current.snowbridge.gitCommit}`
    );
    ok = false;
  }

  if (ok) {
    logger.info(
      `✅ Dependency versions match for '${chain}': eigenlayer=${current.eigenlayer.release ?? current.eigenlayer.gitCommit}, snowbridge=${current.snowbridge.release ?? current.snowbridge.gitCommit}`
    );
  }

  return ok;
};

export const updateDependencyVersions = async (chain: string): Promise<void> => {
  assertValidChain(chain);
  logger.info(`🔄 Refreshing dependency metadata for chain '${chain}'`);

  const cwd = process.cwd();
  const repoRoot = path.basename(cwd) === "test" ? path.join(cwd, "..") : cwd;
  const deploymentPath = path.join(repoRoot, "contracts", "deployments", `${chain}.json`);

  const raw = await Bun.file(deploymentPath).text();
  const deploymentsJson = JSON.parse(raw) as {
    deps?: { eigenlayer?: any; snowbridge?: any };
    version?: string;
  };

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

  logger.info(
    `📝 Updated dependency versions for ${chain}: eigenlayer=${deps.eigenlayer.release ?? deps.eigenlayer.gitCommit}, snowbridge=${deps.snowbridge.release ?? deps.snowbridge.gitCommit}`
  );
};

export const checkContractVersions = async (
  chain: string,
  rpcUrl?: string
): Promise<ContractVersionCheckResult> => {
  assertValidChain(chain);
  logger.info(`🔍 Checking contract versions for chain '${chain}'`);

  const deployments = await parseDeploymentsFile(chain);
  const version = (deployments as any).version as string | undefined;

  if (!version) {
    throw new Error(
      `No 'version' field found in contracts/deployments/${chain}.json. This file is the canonical source of truth for the AVS stack version.`
    );
  }

  let viemClient: ViemClientInterface | undefined;
  const chainConfig = CHAIN_CONFIGS[chain as keyof typeof CHAIN_CONFIGS];
  if (chainConfig && chain !== "anvil") {
    const chainDef = defineChain({
      id: chainConfig.CHAIN_ID,
      name: chainConfig.NETWORK_NAME,
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18
      },
      rpcUrls: {
        default: {
          http: [rpcUrl ?? chainConfig.RPC_URL]
        }
      },
      blockExplorers: chainConfig.BLOCK_EXPLORER
        ? {
            default: { name: "Explorer", url: chainConfig.BLOCK_EXPLORER }
          }
        : undefined
    });

    viemClient = createWalletClient({
      chain: chainDef,
      transport: http()
    }).extend(publicActions) as unknown as ViemClientInterface;
  }

  let ok = true;

  try {
    const serviceManager: any = await getContractInstance("ServiceManager", viemClient, chain);
    const smVersion: string = await serviceManager.read.DATAHAVEN_VERSION();

    if (smVersion !== version) {
      logger.error(
        `❌ DataHavenServiceManager DATAHAVEN_VERSION=${smVersion} does not match deployments version=${version} for chain='${chain}'.`
      );
      ok = false;
    } else {
      logger.info(
        `✅ DataHavenServiceManager version matches deployments version (${version}) for chain='${chain}'.`
      );
    }
  } catch (error) {
    if (isInfraUnavailableError(error)) {
      logger.warn(
        `⚠️ Skipping on-chain version checks for chain='${chain}': no local Ethereum node or containers detected (${error}).`
      );
      return { ok: true, skipped: true };
    }
    throw new Error(`Failed to read version from DataHavenServiceManager: ${error}`);
  }

  if (!ok) {
    return { ok: false, skipped: false };
  }

  logger.info(
    `✅ All checked contract versions match deployments version=${version} on '${chain}'.`
  );
  return { ok: true, skipped: false };
};

/**
 * Validates that a version string follows semantic versioning (X.Y.Z)
 */
export const isValidSemver = (version: string): boolean => {
  const semverRegex = /^\d+\.\d+\.\d+$/;
  return semverRegex.test(version);
};

/**
 * Validates version formats across all deployment files
 */
export const validateVersionFormats = async (): Promise<boolean> => {
  const chains = ["anvil", "hoodi", "ethereum"];
  let allValid = true;

  for (const chain of chains) {
    try {
      const deployments = await parseDeploymentsFile(chain);
      const version = (deployments as any).version;

      if (!version) {
        logger.warn(`⚠️ No version in ${chain}.json`);
        continue;
      }

      if (!isValidSemver(version)) {
        logger.error(`❌ Invalid version format in ${chain}.json: ${version}`);
        allValid = false;
      }
    } catch (error) {
      logger.warn(`⚠️ Could not validate ${chain}: ${error}`);
    }
  }

  return allValid;
};
