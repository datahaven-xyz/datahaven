import { writeFileSync } from "node:fs";
import path from "node:path";
import { logger, printDivider, printHeader } from "utils";

interface ContractsBumpOptions {
  type: "major" | "minor" | "patch";
  description?: string;
}

/**
 * Creates a changeset file to declare a version bump
 * This avoids merge conflicts by creating uniquely named files
 */
export const contractsBump = async (options: ContractsBumpOptions) => {
  printHeader("Creating Version Bump Changeset");

  try {
    const bumpType = options.type;

    // Validate bump type
    if (!["major", "minor", "patch"].includes(bumpType)) {
      throw new Error(`Invalid bump type: ${bumpType}. Must be major, minor, or patch.`);
    }

    // Determine changeset filename
    let changesetName: string;

    // Try to get PR number from GitHub Actions environment
    if (process.env.CI && process.env.GITHUB_REF) {
      const prMatch = process.env.GITHUB_REF.match(/refs\/pull\/(\d+)\//);
      if (prMatch) {
        changesetName = `pr-${prMatch[1]}.txt`;
        logger.info(`📝 Creating changeset for PR #${prMatch[1]}`);
      } else {
        // Fallback to timestamp in CI if not a PR
        changesetName = `bump-${Date.now()}.txt`;
        logger.info("📝 Creating timestamped changeset (not a PR)");
      }
    } else {
      // Local development - use timestamp
      changesetName = `bump-${Date.now()}.txt`;
      logger.info("📝 Creating local changeset (not in CI)");
    }

    // Resolve path to changesets directory
    const cwd = process.cwd();
    const repoRoot = path.basename(cwd) === "test" ? path.join(cwd, "..") : cwd;
    const changesetsDir = path.join(repoRoot, "contracts", ".changesets");
    const changesetPath = path.join(changesetsDir, changesetName);

    // Write changeset file (bump type on first line, optional description on subsequent lines)
    let changesetContent = bumpType;
    if (options.description) {
      changesetContent += `\n${options.description}`;
    }
    writeFileSync(changesetPath, changesetContent);

    logger.success(`Created changeset: ${changesetName}`);
    logger.info(`   Type: ${bumpType.toUpperCase()}`);
    if (options.description) {
      logger.info(`   Description: ${options.description}`);
    }
    logger.info(`   Path: ${changesetPath}`);
    logger.info("");
    logger.info("📋 Next steps:");
    logger.info("   1. Commit this changeset file: git add contracts/.changesets/");
    logger.info("   2. Push your changes");
    logger.info("   3. Before release, manually run the version bump GitHub Action to create a PR");

    printDivider();
  } catch (error) {
    logger.error(`❌ Failed to create changeset: ${error}`);
    throw error;
  }
};
