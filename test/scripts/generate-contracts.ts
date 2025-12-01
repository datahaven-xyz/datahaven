import { $ } from "bun";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { logger } from "utils";

const CHAOS_VERSION = "v0.1.2";
const CHAOS_RELEASE_URL = `https://github.com/undercover-cactus/Chaos/releases/download/${CHAOS_VERSION}/chaos-linux-amd64-${CHAOS_VERSION}.tar.gz`;
const STATE_DIFF_PATH = "../contracts/deployments/state-diff.json";
const STATE_DIFF_CHECKSUM_PATH = "../contracts/deployments/state-diff.checksum";

/**
 * Finds the Reth container by name pattern and verifies contracts are deployed
 */
async function findRethContainer(): Promise<string> {
  const { stdout } = await $`docker ps --format "{{.Names}}" --filter name=el-1-reth`.quiet();
  const containerName = stdout.toString().trim();

  if (!containerName) {
    const setupCommand = "bun cli launch --launch-kurtosis --deploy-contracts --no-inject-contracts --no-datahaven --no-relayer --no-set-parameters";
    throw new Error(
      `❌ Could not find Reth container with contracts deployed.\n\n` +
      `To generate state-diff.json, you need a running Kurtosis network with contracts deployed.\n\n` +
      `Run this command to launch the network and deploy contracts:\n\n` +
      `   ${setupCommand}\n\n` +
      `Note: The --no-inject-contracts flag ensures contracts are actually deployed\n` +
      `instead of being injected from state-diff.json.\n\n` +
      `If you already have a Kurtosis network running, you'll need to deploy contracts\n` +
      `using the launch command with --no-launch-kurtosis --no-inject-contracts flags.`
    );
  }

  logger.info(`📦 Found Reth container: ${containerName}`);
  return containerName;
}

/**
 * Gets the container's architecture
 */
async function getContainerArchitecture(containerName: string): Promise<string> {
  const result = await $`docker exec ${containerName} bash -c "uname -m"`.quiet();
  return result.stdout.toString().trim();
}

/**
 * Downloads and extracts Chaos tool inside the container
 */
async function setupChaos(containerName: string): Promise<void> {
  logger.info("📥 Downloading Chaos tool...");

  // Check container architecture
  const arch = await getContainerArchitecture(containerName);
  logger.info(`🔍 Container architecture: ${arch}`);

  // Install wget and x86_64 compatibility libraries
  // Chaos only provides amd64 binaries, so we need x86_64 libraries even if container is ARM
  logger.info("📦 Installing required dependencies...");
  await $`docker exec ${containerName} bash -c "apt update && apt install -y wget"`.quiet();

  // Install x86_64 libraries needed for the Chaos binary
  // This is needed because Chaos only provides linux-amd64 binaries
  logger.info("🔧 Installing x86_64 compatibility libraries...");
  await $`docker exec ${containerName} bash -c "dpkg --add-architecture amd64 && apt update && apt install -y libc6:amd64 || apt install -y libc6-x32 || true"`.quiet();

  // Download Chaos - always use amd64 version (Chaos only provides amd64)
  const downloadResult = await $`docker exec ${containerName} bash -c "wget -q ${CHAOS_RELEASE_URL} || echo 'DOWNLOAD_FAILED'"`.quiet();
  if (downloadResult.stdout.toString().includes("DOWNLOAD_FAILED")) {
    throw new Error(`❌ Failed to download Chaos from ${CHAOS_RELEASE_URL}`);
  }

  // Extract Chaos
  logger.info("📦 Extracting Chaos tool...");
  await $`docker exec ${containerName} bash -c "tar -xzf chaos-linux-amd64-${CHAOS_VERSION}.tar.gz"`.quiet();

  // Make sure the binary is executable
  await $`docker exec ${containerName} bash -c "chmod +x target/release/chaos"`.quiet();

  logger.info("✅ Chaos tool ready");
}

/**
 * Runs Chaos to generate state-diff.json
 */
async function runChaos(containerName: string): Promise<void> {
  logger.info("🔍 Running Chaos to extract contract state...");

  // Try running chaos, with better error handling
  const result = await $`docker exec ${containerName} bash -c "./target/release/chaos --database-path /data/reth/execution-data/db"`.nothrow().quiet();

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    const stdout = result.stdout.toString();

    logger.error(`Chaos stderr: ${stderr}`);
    logger.error(`Chaos stdout: ${stdout}`);

    // Check for architecture mismatch
    if (stderr.includes("rosetta") || stderr.includes("elf") || stderr.includes("ld-linux")) {
      throw new Error(
        `❌ Architecture mismatch error. The Chaos binary may not be compatible with the container architecture.\n` +
        `Error: ${stderr}\n\n` +
        `Possible solutions:\n` +
        `1. Ensure the container is running on linux/amd64 platform\n` +
        `2. Check if Chaos has a release for your container's architecture\n` +
        `3. Try running the container with --platform linux/amd64`
      );
    }

    throw new Error(`❌ Chaos execution failed with exit code ${result.exitCode}: ${stderr || stdout}`);
  }

  logger.info("✅ State extraction complete");
}

/**
 * Copies state.json from container to host
 */
async function copyStateFile(containerName: string): Promise<void> {
  logger.info("📋 Copying state.json from container...");

  const tempPath = "tmp/state.json";
  await $`mkdir -p tmp`.quiet();

  await $`docker cp ${containerName}:state.json ${tempPath}`.quiet();

  if (!existsSync(tempPath)) {
    throw new Error("❌ Failed to copy state.json from container");
  }

  // Move to final location
  await $`mv ${tempPath} ${STATE_DIFF_PATH}`.quiet();

  logger.info(`✅ State file saved to ${STATE_DIFF_PATH}`);
}

/**
 * Formats the state-diff.json file using biome
 */
async function formatStateDiff(): Promise<void> {
  logger.info("🎨 Formatting state-diff.json...");

  // Use a higher max size (3MB) to handle the large state-diff.json file
  const result = await $`bun run biome format --files-max-size=3000000 --write ${STATE_DIFF_PATH}`.quiet();

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

    // 2. Setup Chaos tool
    await setupChaos(containerName);

    // 3. Run Chaos to extract state
    await runChaos(containerName);

    // 4. Copy state.json to host
    await copyStateFile(containerName);

    // 5. Format the JSON file
    await formatStateDiff();

    // 6. Generate checksum
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

