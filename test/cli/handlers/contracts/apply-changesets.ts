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
 * Note: Multiple major bumps are aggregated into a single major bump
 */
const getHighestBumpType = (types: BumpType[]): BumpType => {
  if (types.includes("major")) return "major";
  if (types.includes("minor")) return "minor";
  return "patch";
};

interface ChangesetInfo {
  file: string;
  type: BumpType;
  description?: string;
}

interface ApplyChangesetsResult {
  newVersion: string;
  changesets: ChangesetInfo[];
  bumpType: BumpType;
}

/**
 * Applies all changesets in contracts/.changesets/
 * This is run manually before releases to prepare a version bump PR
 * @returns Result containing new version, changesets, and bump type
 */
export const contractsApplyChangesets = async (): Promise<ApplyChangesetsResult | null> => {
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
      return null;
    }

    logger.info(`📦 Found ${changesetFiles.length} changeset(s)`);

    // Read bump types and descriptions from changeset files
    const changesets: ChangesetInfo[] = [];
    for (const file of changesetFiles) {
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");
      const bumpType = lines[0].trim() as BumpType;

      if (!["major", "minor", "patch"].includes(bumpType)) {
        throw new Error(`Invalid bump type in ${file}: ${bumpType}`);
      }

      // Description is everything after the first line
      const description = lines.slice(1).join("\n").trim() || undefined;

      changesets.push({
        file: path.basename(file),
        type: bumpType,
        description
      });

      logger.info(
        `   - ${path.basename(file)}: ${bumpType.toUpperCase()}${description ? ` (${description.substring(0, 50)}${description.length > 50 ? "..." : ""})` : ""}`
      );
    }

    // Extract bump types and determine highest
    const bumpTypes = changesets.map((c) => c.type);
    const bumpType = getHighestBumpType(bumpTypes);

    // Count major bumps for logging
    const majorCount = bumpTypes.filter((t) => t === "major").length;
    if (majorCount > 1) {
      logger.info(
        `ℹ️  Multiple major bumps detected (${majorCount}), aggregating into single major version bump`
      );
    }

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
    logger.info("   1. Create PR with these changes");
    logger.info("   2. Review and approve PR");
    logger.info("   3. Checkout PR and run 'bun cli contracts upgrade'");
    logger.info("   4. Merge PR to main");

    return {
      newVersion,
      changesets,
      bumpType
    };
  } catch (error) {
    logger.error(`❌ Failed to apply changesets: ${error}`);
    throw error;
  }
};
