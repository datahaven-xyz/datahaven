import fs from "node:fs";
import path from "node:path";
import { $ } from "bun";
import { Octokit } from "octokit";
import invariant from "tiny-invariant";
import { logger, printHeader } from "utils";

const IMAGE_NAME = "snowbridge-relay:local";
const RELATIVE_DOCKER_FILE_PATH = "../../docker/SnowbridgeRelayer.dockerfile";
const CONTEXT = "../..";
const TMP_DIR = path.resolve(__dirname, "../tmp");
const RELAY_BINARY_PATH = path.resolve(TMP_DIR, "snowbridge-relay");

//Downloads the latest snowbridge-relay binary from SnowFork's GitHub releases
async function downloadRelayBinary() {
  printHeader("Downloading latest snowbridge-relay binary");
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }

  const octokit = new Octokit();

  try {
    logger.info("Fetching latest release info from Snowfork/snowbridge");
    const latestRelease = await octokit.rest.repos.getLatestRelease({
      owner: "Snowfork",
      repo: "snowbridge"
    });
    const tagName = latestRelease.data.tag_name;
    logger.info(`Found latest release: ${tagName}`);

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
    await Bun.write(RELAY_BINARY_PATH, buffer);

    await $`chmod +x ${RELAY_BINARY_PATH}`;

    logger.success(`Successfully downloaded snowbridge-relay ${tagName} to ${RELAY_BINARY_PATH}`);
    return RELAY_BINARY_PATH;
  } catch (error: any) {
    logger.error(`Failed to download snowbridge-relay: ${error.message}`);
    throw error;
  }
}

// This can be run with `bun build:docker:relayer` or via a script by importing the below function
export default async function buildRelayer() {
  await downloadRelayBinary();

  printHeader(`Running docker-build at: ${__dirname}`);
  const dockerfilePath = path.resolve(__dirname, RELATIVE_DOCKER_FILE_PATH);
  const contextPath = path.resolve(__dirname, CONTEXT);

  const file = Bun.file(dockerfilePath);
  invariant(await file.exists(), `Dockerfile not found at ${dockerfilePath}`);
  logger.debug(`Dockerfile found at ${dockerfilePath}`);

  const dockerCommand = `docker build -t ${IMAGE_NAME} -f ${dockerfilePath} ${contextPath}`;
  logger.debug(`Executing docker command: ${dockerCommand}`);
  const { stdout, stderr, exitCode } = await $`sh -c ${dockerCommand}`.nothrow().quiet();

  if (exitCode !== 0) {
    logger.error(`Docker build failed with exit code ${exitCode}`);
    logger.error(`stdout: ${stdout.toString()}`);
    logger.error(`stderr: ${stderr.toString()}`);
    process.exit(exitCode);
  }

  logger.info("Docker build action completed");

  const {
    exitCode: runExitCode,
    stdout: runStdout,
    stderr: runStderr
  } = await $`sh -c docker run ${IMAGE_NAME}`.quiet().nothrow();

  if (runExitCode !== 0) {
    logger.error(`Docker run failed with exit code ${runExitCode}`);
    logger.error(`stdout: ${runStdout.toString()}`);
    logger.error(`stderr: ${runStderr.toString()}`);
    process.exit(runExitCode);
  }

  logger.info("Docker run action completed");
  logger.success("Docker image built successfully");
}
