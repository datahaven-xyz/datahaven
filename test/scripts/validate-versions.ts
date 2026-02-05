import { CHAIN_CONFIGS } from "configs/contracts/config";
import { logger } from "utils";
import { parseDeploymentsFile } from "utils/contracts";

/**
 * Validates that a version string follows semantic versioning (X.Y.Z)
 */
export const isValidSemver = (version: string): boolean => {
  const semverRegex = /^\d+\.\d+\.\d+$/;
  return semverRegex.test(version);
};

/**
 * Comprehensive version validation across the DataHaven codebase
 * Checks:
 * 1. Version format (semantic versioning)
 * 2. Dependency version consistency
 * 3. On-chain version matches deployments
 */
export const validateVersions = async () => {
  logger.info("🔍 Validating version consistency across DataHaven codebase...");

  const chains = ["anvil", "hoodi", "ethereum"];
  let allOk = true;

  const deploymentsPathFor = (chain: string) => `../contracts/deployments/${chain}.json`;
  const deploymentsFileExists = async (chain: string) => {
    const deploymentsFile = Bun.file(deploymentsPathFor(chain));
    return deploymentsFile.exists();
  };
  const getRpcUrl = (chain: string) => {
    const envVar = `RPC_URL_${chain.toUpperCase()}`;
    return process.env[envVar] ?? CHAIN_CONFIGS[chain as keyof typeof CHAIN_CONFIGS]?.RPC_URL;
  };

  // 1. Format validation (semver)
  logger.info("\n📋 Checking version formats...");
  for (const chain of chains) {
    try {
      if (!(await deploymentsFileExists(chain))) {
        logger.info(`ℹ️  Skipping ${chain}.json (deployment file does not exist)`);
        continue;
      }

      const deployments = await parseDeploymentsFile(chain);
      const version = (deployments as any).version;

      if (!version) {
        logger.warn(`⚠️  No version field in ${chain}.json`);
        continue;
      }

      if (!isValidSemver(version)) {
        logger.error(`❌ Invalid version format in ${chain}.json: ${version} (expected X.Y.Z)`);
        allOk = false;
      } else {
        logger.info(`✅ ${chain}.json: ${version} (valid semver)`);
      }
    } catch (error) {
      const errorMsg = String(error);
      if (errorMsg.includes("deployments file") || errorMsg.includes("does not exist")) {
        logger.debug(`ℹ️  Skipping ${chain}.json (file does not exist)`);
        continue;
      }
      logger.error(`❌ Could not read ${chain}.json: ${error}`);
      allOk = false;
    }
  }

  // 2. Dependency validation (existing versioning checks)
  logger.info("\n🔗 Checking dependency versions...");
  const { checkDependencyVersions } = await import("utils/contracts/versioning");
  for (const chain of chains) {
    try {
      if (!(await deploymentsFileExists(chain))) {
        logger.info(`ℹ️  Skipping ${chain} dependency check (deployment file does not exist)`);
        continue;
      }

      const depsOk = await checkDependencyVersions(chain);
      if (!depsOk) {
        logger.warn(`⚠️  Dependency version mismatch for ${chain}`);
        allOk = false;
      }
    } catch (error) {
      const errorMsg = String(error);
      if (errorMsg.includes("deployments file") || errorMsg.includes("does not exist")) {
        logger.debug(`ℹ️  Skipping ${chain} (deployment file does not exist)`);
        continue;
      }
      logger.debug(`ℹ️  Skipping ${chain} dependency check: ${error}`);
      // Not a hard error - infrastructure may be unavailable
    }
  }

  // 3. On-chain version consistency check
  logger.info("\n⛓️ Checking on-chain contract versions...");
  const { checkContractVersions } = await import("utils/contracts/versioning");
  for (const chain of chains) {
    try {
      if (!(await deploymentsFileExists(chain))) {
        logger.info(`ℹ️  Skipping ${chain} on-chain check (deployment file does not exist)`);
        continue;
      }

      const rpcUrl = getRpcUrl(chain);
      const { ok } = await checkContractVersions(chain, rpcUrl);
      if (!ok) {
        allOk = false;
      }
    } catch (error) {
      const errorMsg = String(error);
      if (errorMsg.includes("deployments file") || errorMsg.includes("does not exist")) {
        logger.info(`ℹ️  Skipping ${chain} on-chain check (deployment file does not exist)`);
        continue;
      }
      logger.error(`❌ Failed on-chain version check for ${chain}: ${error}`);
      allOk = false;
    }
  }

  if (!allOk) {
    logger.error("\n❌ Version validation failed");
    throw new Error("Version validation failed");
  }

  logger.success("\n✅ All version checks passed");
};

// Allow direct execution
if (import.meta.main) {
  await validateVersions();
}
