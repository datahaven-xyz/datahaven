import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { platform } from "node:process";
import { $ } from "bun";
import { logger } from "utils";

const CHAOS_VERSION = "v0.1.2";
const CHAOS_RELEASE_URL = `https://github.com/undercover-cactus/Chaos/releases/download/${CHAOS_VERSION}/`;
const STATE_DIFF_PATH = "../contracts/deployments/state-diff.json";
const STATE_DIFF_CHECKSUM_PATH = "../contracts/deployments/state-diff.checksum";

/**
 * Finds the Reth container by name pattern and verifies contracts are deployed
 */
async function findRethContainer(): Promise<string> {
  const { stdout } = await $`docker ps --format "{{.Names}}" --filter name=el-1-reth`.quiet();
  const containerName = stdout.toString().trim();

  if (!containerName) {
    const setupCommand =
      "bun cli launch --launch-kurtosis --deploy-contracts --no-inject-contracts --no-datahaven --no-relayer --no-set-parameters --no-setup-validators --no-fund-validators";
    throw new Error(
      "❌ Could not find Reth container with contracts deployed.\n\n" +
        "To generate state-diff.json, you need a running Kurtosis network with contracts deployed.\n\n" +
        "Run this command to launch the network and deploy contracts:\n\n" +
        `   ${setupCommand}\n\n` +
        "Note: The --no-inject-contracts flag ensures contracts are actually deployed\n" +
        "instead of being injected from state-diff.json.\n\n" +
        `If you already have a Kurtosis network running, you'll need to deploy contracts\n` +
        "using the launch command with --no-launch-kurtosis --no-inject-contracts flags."
    );
  }

  logger.info(`📦 Found Reth container: ${containerName}`);
  return containerName;
}

async function copyDatabaseFromContainer(containerName: string): Promise<void> {
  logger.info("📋 Copying database from container...");

  // Copy database in the host machine
  logger.info("Import the database in the /tmp folder from the container");
  const result = await $`docker cp ${containerName}:/data/reth/execution-data/db /tmp/db`;
  if (result.exitCode !== 0) {
    throw new Error("Fail to copy the reth database into the /tmp folder.");
  }

  logger.info("✅ Database copied");
}

/**
 * Downloads and extracts Chaos tool inside the container
 */
async function setupChaos(): Promise<void> {
  logger.info("📥 Downloading Chaos tool...");

  // Check host platform
  let tarName: string;
  if (platform === "darwin") {
    tarName = `chaos-macos-amd64-${CHAOS_VERSION}`;
  } else if (platform === "linux") {
    tarName = `chaos-linux-amd64-${CHAOS_VERSION}`;
  } else {
    throw new Error(
      `Unsupported platform : ${platform}. Chaos tool doesn't have a build for your system yet.`
    );
  }

  const resultWget = await $`wget ${CHAOS_RELEASE_URL}/${tarName}.tar.gz -O /tmp/chaos.tar.gz`;
  if (resultWget.exitCode !== 0) {
    throw new Error("Fail to download binary. Verify if 'wget' is installed on your machine.");
  }

  // Untar binary
  logger.info("📦 Extracting Chaos tool...");
  const resultTar = await $`tar -xzvf /tmp/chaos.tar.gz -C /tmp/`;
  if (resultTar.exitCode !== 0) {
    throw new Error("Fail to unpack binary. Verify if 'wget' is installed on your machine.");
  }

  logger.info("✅ Chaos tool ready");
}

/**
 * Runs Chaos to generate state-diff.json
 */
async function runChaos(): Promise<void> {
  logger.info("🔍 Running Chaos to extract contract state...");

  const result = await $`/tmp/target/release/chaos --database-path /tmp/db`;
  if (result.exitCode !== 0) {
    throw new Error("Fail to generate state.");
  }

  logger.info("✅ State extraction complete");
}

/**
 * Copies state.json from container to host
 */
async function copyStateFile(): Promise<void> {
  logger.info("📋 Copying state.json to our repo");

  const stateFile = "state.json";

  if (!existsSync(stateFile)) {
    throw new Error("❌ Failed to copy state.json from our temp folder");
  }

  // Move to final location
  await $`mv ${stateFile} ${STATE_DIFF_PATH}`.quiet();

  logger.info(`✅ State file saved to ${STATE_DIFF_PATH}`);
}

/**
 * Formats the state-diff.json file using biome
 */
async function formatStateDiff(): Promise<void> {
  logger.info("🎨 Formatting state-diff.json...");

  // Use a higher max size (3MB) to handle the large state-diff.json file
  const result =
    await $`bun run biome format --files-max-size=3000000 --write ${STATE_DIFF_PATH}`.quiet();

  if (result.exitCode !== 0) {
    logger.warn("⚠️ Biome formatting had issues, but continuing...");
    logger.debug(result.stderr.toString());
  }

  logger.info("✅ Formatting complete");
}

/**
 * Generates a checksum for the state-diff.json file
 */
function generateChecksum(filePath: string): string {
  const content = readFileSync(filePath, "utf-8");
  const hash = createHash("sha256");
  hash.update(content);
  return hash.digest("hex");
}

/**
 * Saves the checksum to a file
 */
function saveChecksum(checksum: string): void {
  writeFileSync(STATE_DIFF_CHECKSUM_PATH, checksum, "utf-8");
  logger.info(`✅ Checksum saved to ${STATE_DIFF_CHECKSUM_PATH}`);
}

/**
 * Main function to generate contracts state-diff
 */
export async function generateContracts(): Promise<void> {
  logger.info("🚀 Starting contract state-diff generation...");

  try {
    // 1. Find Reth container
    const containerName = await findRethContainer();

    // 2. Copy database
    await copyDatabaseFromContainer(containerName);

    // 3. Setup Chaos tool
    await setupChaos();

    // 4. Run Chaos to extract state
    await runChaos();

    // 5. Copy state.json to host
    await copyStateFile();

    // 6. Format the JSON file
    await formatStateDiff();

    // 7. Generate checksum
    logger.info("🔐 Generating checksum...");
    const checksum = generateChecksum(STATE_DIFF_PATH);
    logger.info(`📝 Checksum: ${checksum}`);

    // 7. Save checksum
    saveChecksum(checksum);

    logger.info("✅ Contract state-diff generation complete!");
    logger.info(`   - State file: ${STATE_DIFF_PATH}`);
    logger.info(`   - Checksum: ${STATE_DIFF_CHECKSUM_PATH}`);
    logger.info(`   - Run 'bun test scripts/test-generated-contracts.ts' to validate`);
  } catch (error) {
    logger.error("❌ Failed to generate contract state-diff:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.main) {
  await generateContracts();
}
