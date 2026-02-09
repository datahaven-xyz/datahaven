import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { logger, printDivider, printHeader } from "utils";
import { generateContractsChecksum } from "../../../scripts/contracts-checksum";

type BumpType = "major" | "minor" | "patch";

interface VersionsMatrix {
  code: {
    version: string;
    checksum: string;
    lastModified: string;
  };
  deployments: Record<
    string,
    {
      version: string;
      lastDeployed: string;
    }
  >;
}

/**
 * Parses semantic version string into components
 */
const parseSemver = (version: string): [number, number, number] => {
  const parts = version.split(".");
  if (parts.length !== 3) {
    throw new Error(`Invalid semver: ${version}`);
  }
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
};

/**
 * Bumps a semantic version based on bump type
 */
const bumpVersion = (current: string, type: BumpType): string => {
  const [major, minor, patch] = parseSemver(current);

  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
};

/**
 * Determines the highest priority bump type
 * major > minor > patch
 */
const getHighestBumpType = (types: BumpType[]): BumpType => {
  if (types.includes("major")) return "major";
  if (types.includes("minor")) return "minor";
  return "patch";
};

/**
 * Applies all changesets in contracts/.changesets/
 * This is run by CI after merging to main
 */
export const contractsApplyChangesets = async () => {
  printHeader("Applying Version Changesets");

  try {
    const cwd = process.cwd();
    const repoRoot = path.basename(cwd) === "test" ? path.join(cwd, "..") : cwd;
    const changesetsDir = path.join(repoRoot, "contracts", ".changesets");
    const versionFile = path.join(repoRoot, "contracts", "VERSION");
    const matrixFile = path.join(repoRoot, "contracts", "versions-matrix.json");
    const contractsPath = path.join(repoRoot, "contracts", "src");

    // Read changeset files
    const changesetFiles = readdirSync(changesetsDir)
      .filter((f) => f.endsWith(".txt"))
      .map((f) => path.join(changesetsDir, f));

    if (changesetFiles.length === 0) {
      logger.info("ℹ️  No changesets to apply");
      return;
    }

    logger.info(`📦 Found ${changesetFiles.length} changeset(s)`);

    // Read bump types from changeset files
    const bumpTypes: BumpType[] = [];
    for (const file of changesetFiles) {
      const content = readFileSync(file, "utf8").trim() as BumpType;
      if (!["major", "minor", "patch"].includes(content)) {
        throw new Error(`Invalid bump type in ${file}: ${content}`);
      }
      bumpTypes.push(content);
      logger.info(`   - ${path.basename(file)}: ${content}`);
    }

    // Determine highest bump type
    const bumpType = getHighestBumpType(bumpTypes);
    logger.info(`🎯 Using highest bump type: ${bumpType.toUpperCase()}`);

    // Read current VERSION
    const currentVersion = readFileSync(versionFile, "utf8").trim();
    logger.info(`📌 Current version: ${currentVersion}`);

    // Calculate new version
    const newVersion = bumpVersion(currentVersion, bumpType);
    logger.info(`🆕 New version: ${newVersion}`);

    // Update VERSION file
    writeFileSync(versionFile, `${newVersion}\n`);
    logger.success(`Updated VERSION file to ${newVersion}`);

    // Calculate new checksum
    const newChecksum = generateContractsChecksum(contractsPath);
    logger.info(`🔐 New checksum: ${newChecksum}`);

    // Update versions-matrix.json
    const matrixContent = readFileSync(matrixFile, "utf8");
    const matrix: VersionsMatrix = JSON.parse(matrixContent);

    matrix.code.version = newVersion;
    matrix.code.checksum = newChecksum;
    matrix.code.lastModified = new Date().toISOString();

    writeFileSync(matrixFile, JSON.stringify(matrix, null, 2));
    logger.success("Updated versions-matrix.json");

    // Delete changeset files
    for (const file of changesetFiles) {
      unlinkSync(file);
      logger.debug(`   Deleted ${path.basename(file)}`);
    }
    logger.success(`Deleted ${changesetFiles.length} changeset file(s)`);

    printDivider();
    logger.success(`Version bumped to ${newVersion}`);
    logger.info("");
    logger.info("📋 Next steps:");
    logger.info("   1. Commit these changes");
    logger.info("   2. Push to main branch");
  } catch (error) {
    logger.error(`❌ Failed to apply changesets: ${error}`);
    throw error;
  }
};
