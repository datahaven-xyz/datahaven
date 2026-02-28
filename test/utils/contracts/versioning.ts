import { readFileSync } from "node:fs";
import path from "node:path";
import { CHAIN_CONFIGS } from "configs/contracts/config";
import { logger } from "utils";
import { getContractInstance } from "utils/contracts";
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

/**
 * Reads the expected version from contracts/VERSION file.
 * Returns undefined if the file cannot be read.
 */
const readVersionFile = (): string | undefined => {
  try {
    const cwd = process.cwd();
    const repoRoot = path.basename(cwd) === "test" ? path.join(cwd, "..") : cwd;
    const versionFile = path.join(repoRoot, "contracts", "VERSION");
    return readFileSync(versionFile, "utf8").trim();
  } catch {
    return undefined;
  }
};

export const checkContractVersions = async (
  chain: string,
  rpcUrl?: string
): Promise<ContractVersionCheckResult> => {
  assertValidChain(chain);
  logger.info(`🔍 Checking contract versions for chain '${chain}'`);

  // Read expected version from contracts/VERSION file
  const version = readVersionFile();
  if (!version) {
    logger.info(
      "ℹ️  Could not read contracts/VERSION - skipping version check (probably fresh deployment)"
    );
    return { ok: true, skipped: true };
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
        `❌ DataHavenServiceManager DATAHAVEN_VERSION=${smVersion} does not match contracts/VERSION=${version} for chain='${chain}'.`
      );
      ok = false;
    } else {
      logger.info(
        `✅ DataHavenServiceManager version matches contracts/VERSION (${version}) for chain='${chain}'.`
      );
    }
  } catch (error) {
    if (isInfraUnavailableError(error)) {
      logger.warn(
        `⚠️ Skipping on-chain version checks for chain='${chain}': no local Ethereum node or containers detected (${error}).`
      );
      return { ok: true, skipped: true };
    }
    const errorMsg = String(error);

    // Check if function doesn't exist (old deployment without version tracking)
    if (
      errorMsg.includes("DATAHAVEN_VERSION") &&
      (errorMsg.includes("returned no data") || errorMsg.includes("does not have the function"))
    ) {
      logger.warn(
        `⚠️ ServiceManager at ${chain} does not have DATAHAVEN_VERSION() function yet (old deployment). Skipping on-chain version check.`
      );
      return { ok: true, skipped: true };
    }

    if (
      errorMsg.includes("DATAHAVEN_VERSION") &&
      (errorMsg.includes("reverted") || errorMsg.includes("missing revert data"))
    ) {
      throw new Error(
        `ServiceManager at ${chain} does not expose DATAHAVEN_VERSION() yet. ` +
          "This usually means the on-chain implementation is older than the versioning update. " +
          "Upgrade the ServiceManager implementation, then re-run the check."
      );
    }
    throw new Error(`Failed to read version from DataHavenServiceManager: ${error}`);
  }

  if (!ok) {
    return { ok: false, skipped: false };
  }

  logger.info(`✅ All checked contract versions match contracts/VERSION=${version} on '${chain}'.`);
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
 * Validates that contracts/VERSION contains a valid semver string
 */
export const validateVersionFormats = async (): Promise<boolean> => {
  const version = readVersionFile();

  if (!version) {
    logger.warn("⚠️ Could not read contracts/VERSION");
    return false;
  }

  if (!isValidSemver(version)) {
    logger.error(`❌ Invalid version format in contracts/VERSION: ${version}`);
    return false;
  }

  logger.info(`✅ contracts/VERSION is valid semver: ${version}`);
  return true;
};
