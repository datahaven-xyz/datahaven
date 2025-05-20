import fs from "node:fs";
import path from "node:path";
import { $ } from "bun";
import { Octokit } from "octokit";
import invariant from "tiny-invariant";
import { logger, printHeader } from "utils";

const DEFAULT_IMAGE_NAME = "snowbridge-relay:local";
const RELATIVE_DOCKER_FILE_PATH = "../docker/snowbridge-relayer.dockerfile";
const CONTEXT = "../.."; // Relative to this script, resolves to project root
const TMP_DIR = path.resolve(__dirname, "../tmp/bin");
const TARGET_BINARY_IN_TMP_PATH = path.resolve(TMP_DIR, "snowbridge-relay");

// Parses command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let localBinaryPath: string | undefined;
  let imageName: string = DEFAULT_IMAGE_NAME;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--local-binary-path" && i + 1 < args.length) {
      localBinaryPath = args[i + 1];
      i++;
    } else if (args[i] === "--image-name" && i + 1 < args.length) {
      imageName = args[i + 1];
      i++;
    }
  }
  return { localBinaryPath, imageName };
}

// Downloads the latest snowbridge-relay binary from SnowFork's GitHub releases
async function downloadRelayBinary(targetPath: string) {
  printHeader("Downloading latest snowbridge-relay binary");
  const octokit = new Octokit();

  try {
    logger.info("Fetching latest release info from Snowfork/snowbridge");
    const latestRelease = await octokit.rest.repos.getLatestRelease({
      owner: "Snowfork",
      repo: "snowbridge"
    });
    const tagName = latestRelease.data.tag_name;
    logger.info(`🔎 Found latest release: ${tagName}`);

    const relayAsset = latestRelease.data.assets.find((asset) => asset.name === "snowbridge-relay");

    if (!relayAsset) {
      throw new Error("Could not find snowbridge-relay asset in the latest release");
    }

    logger.info(
      `Downloading snowbridge-relay (${Math.round((relayAsset.size / 1024 / 1024) * 100) / 100} MB)`
    );

    const response = await fetch(relayAsset.browser_download_url);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await Bun.write(targetPath, buffer);
    await $`chmod +x ${targetPath}`;

    logger.success(`Successfully downloaded snowbridge-relay ${tagName} to ${targetPath}`);
    return targetPath;
  } catch (error: any) {
    logger.error(`Failed to download snowbridge-relay: ${error.message}`);
    throw error;
  }
}

async function prepareRelayBinary(
  localBinaryPathFromArg: string | undefined,
  downloadTargetPath: string
): Promise<string> {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }

  // If no local binary path is provided, download the latest release
  if (!localBinaryPathFromArg) {
    logger.info("No local binary path provided, will download the latest release.");
    return downloadRelayBinary(downloadTargetPath);
  }

  // If a local binary path is provided, use it
  const absoluteLocalBinaryPath = path.resolve(localBinaryPathFromArg);
  logger.info(`Using local binary from: ${absoluteLocalBinaryPath}`);
  if (!fs.existsSync(absoluteLocalBinaryPath)) {
    throw new Error(`Local binary not found at: ${absoluteLocalBinaryPath}`);
  }
  // Copy local binary to the target path in tmp
  await Bun.write(downloadTargetPath, Bun.file(absoluteLocalBinaryPath));
  await $`chmod +x ${downloadTargetPath}`;
  logger.success(`Copied local binary to ${downloadTargetPath} and made it executable.`);
  return downloadTargetPath;
}

// This can be run with `bun test/scripts/snowbridge-relayer.ts`
// or with options: `bun test/scripts/snowbridge-relayer.ts --local-binary-path ./path/to/bin --image-name myimage:tag`
export default async function buildRelayer() {
  const { localBinaryPath, imageName } = parseArgs();

  await prepareRelayBinary(localBinaryPath, TARGET_BINARY_IN_TMP_PATH);

  printHeader(`Building Docker image: ${imageName}`);
  const dockerfilePath = path.resolve(__dirname, RELATIVE_DOCKER_FILE_PATH);
  // Context path should be project root for Dockerfile to find `test/tmp/snowbridge-relay`
  const contextPath = path.resolve(__dirname, CONTEXT);

  const dockerfile = Bun.file(dockerfilePath);
  invariant(await dockerfile.exists(), `Dockerfile not found at ${dockerfilePath}`);
  logger.debug(`Dockerfile found at ${dockerfilePath}`);
  logger.debug(`Build context: ${contextPath}`);
  logger.debug(
    `Binary for Docker build (expected by Dockerfile at test/tmp/snowbridge-relay relative to context): ${TARGET_BINARY_IN_TMP_PATH}`
  );

  const dockerCommand = `docker build -t ${imageName} -f ${dockerfilePath} ${contextPath}`;
  logger.info(`Executing docker command: ${dockerCommand}`);
  const { stdout, stderr, exitCode } = await $`sh -c ${dockerCommand}`.nothrow().quiet();

  if (exitCode !== 0) {
    logger.error(`Docker build failed with exit code ${exitCode}`);
    logger.error(`stdout: ${stdout.toString()}`);
    logger.error(`stderr: ${stderr.toString()}`);
    process.exit(exitCode);
  }

  logger.success(`Docker image ${imageName} built successfully.`);
  logger.info(
    `You can now use this image tag in your launch configurations (e.g., --relayer-image-tag ${imageName})`
  );
}

// If called directly, run buildRelayer
if (import.meta.path === Bun.main) {
  buildRelayer().catch((err) => {
    logger.error("Script failed:", err);
    process.exit(1);
  });
}
