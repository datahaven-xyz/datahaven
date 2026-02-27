import { readdirSync } from "node:fs";
import path from "node:path";
import { $ } from "bun";
import { logger, printDivider, printHeader } from "utils";

/**
 * Validates that changesets exist when contracts have been modified
 * Used in CI to enforce version bump discipline
 */
export const contractsValidateChangesets = async () => {
  printHeader("Validating Changesets");

  try {
    // Allow skipping this check via env var
    if (process.env.SKIP_VERSION_CHECK === "true") {
      logger.warn("⚠️  Version check skipped (SKIP_VERSION_CHECK=true)");
      return;
    }

    const cwd = process.cwd();
    const repoRoot = path.basename(cwd) === "test" ? path.join(cwd, "..") : cwd;
    const changesetsDir = path.join(repoRoot, "contracts", ".changesets");

    // Check if contracts/src has changed compared to main
    logger.info("🔍 Checking for contract changes...");

    // Get the main branch name
    const { stdout: mainBranchOut } =
      await $`git -C ${repoRoot} symbolic-ref refs/remotes/origin/HEAD`.nothrow().quiet();
    const mainBranch =
      mainBranchOut.toString().trim().replace("refs/remotes/origin/", "") || "main";

    // Check for changes in contracts/src
    const { exitCode: diffCode } =
      await $`git -C ${repoRoot} diff --quiet ${mainBranch} -- contracts/src/`.nothrow().quiet();

    const hasContractChanges = diffCode !== 0; // diff --quiet exits with 1 if there are differences

    if (!hasContractChanges) {
      logger.success("No contract changes detected - changeset not required");
      return;
    }

    logger.info("📝 Contract changes detected in contracts/src/");

    // Check for changeset files
    const changesetFiles = readdirSync(changesetsDir).filter((f) => f.endsWith(".txt"));

    if (changesetFiles.length === 0) {
      logger.error("❌ Contract changes detected but no changeset found!");
      logger.error("");
      logger.error("📋 You must create a version bump changeset:");
      logger.error("   bun cli contracts bump --type [major|minor|patch]");
      logger.error("");
      logger.error("💡 Guidelines:");
      logger.error("   - major: Breaking changes");
      logger.error("   - minor: New features (backwards compatible)");
      logger.error("   - patch: Bug fixes (backwards compatible)");
      logger.error("");
      logger.error("🔧 To skip this check (not recommended):");
      logger.error("   Set SKIP_VERSION_CHECK=true");
      process.exitCode = 1;
      printDivider();
      return;
    }

    logger.success(`Found ${changesetFiles.length} changeset(s):`);
    for (const file of changesetFiles) {
      logger.info(`   - ${file}`);
    }

    printDivider();
  } catch (error) {
    logger.error(`❌ Changeset validation failed: ${error}`);
    throw error;
  }
};
