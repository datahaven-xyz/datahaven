import fs from "node:fs";
import path from "node:path";
import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger, printHeader } from "utils";
import type { LaunchOptions } from ".";
import type { LaunchedNetwork } from "./launchedNetwork";
import { ethers } from "ethers";

const COMMON_LAUNCH_ARGS = [
  "--unsafe-force-node-key-generation",
  "--tmp",
  "--port=0",
  "--validator",
  "--no-prometheus",
  "--force-authoring",
  "--no-telemetry",
  "--enable-offchain-indexing=true"
];

// We need 5 since the (2/3 + 1) of 6 authority set is 5
// <repo_root>/operator/runtime/src/genesis_config_presets.rs#L94
const CLI_AUTHORITY_IDS = ["alice", "bob", "charlie", "dave", "eve"];

// Actual 33-byte compressed public keys for Datahaven next validators
// These correspond to Alice, Bob, Charlie, Dave, Eve, Ferdie
// TODO: Ideally, we launch first the Datahaven network, obtain the BEEFY authorities from there and use them here
const DATAHAVEN_AUTHORITY_PUBLIC_KEYS: Record<string, string> = {
  alice: "0x020a1091341fe5664bfa1782d5e04779689068c916b04cb365ec3153755684d9a1",
  bob: "0x0390084fdbf27d2b79d26a4f13f0ccd982cb755a661969143c37cbc49ef5b91f27",
  charlie: "0x031d10105e323c4afce225208f71a6441ee327a65b9e646e772500c74d31f669aa",
  dave: "0x0291f1217d5a04cb83312ee3d88a6e6b33284e053e6ccfc3a90339a0299d12967c",
  eve: "0x0389411795514af1627765eceffcbd002719f031604fadd7d188e2dc585b4e1afb",
  ferdie: "0x03bc9d0ca094bd5b8b3225d7651eac5d18c1c04bf8ae8f8b263eebca4e1410ed0c"
};

// Function to convert compressed public key to Ethereum address
function compressedPubKeyToEthereumAddress(compressedPubKey: string): string {
  const uncompressedPubKey = ethers.SigningKey.computePublicKey(compressedPubKey, false);
  const address = ethers.computeAddress(uncompressedPubKey);
  return address;
}

/**
 * Prepares the configuration for Datahaven authorities by converting their
 * compressed public keys to Ethereum addresses and saving them to a JSON file.
 */
export async function prepareDatahavenAuthoritiesConfig(): Promise<void> {
  const networkName = process.env.NETWORK || "anvil";
  logger.info(`🔧 Preparing Datahaven authorities configuration for network: ${networkName}...`);

  const validatorHashes: string[] = [];
  const authoritiesToProcess = Object.values(DATAHAVEN_AUTHORITY_PUBLIC_KEYS);

  for (const compressedKey of authoritiesToProcess) {
    try {
      const ethAddress = compressedPubKeyToEthereumAddress(compressedKey);
      const validatorHash = ethers.keccak256(ethAddress);
      validatorHashes.push(validatorHash);
      logger.debug(
        `Processed public key ${compressedKey} -> ETH address ${ethAddress} -> Validator hash ${validatorHash}`
      );
    } catch (error) {
      logger.error(`❌ Failed to process public key ${compressedKey}: ${error}`);
      throw new Error(`Failed to process public key ${compressedKey}`);
    }
  }

  // process.cwd() is 'test/', so config is at '../contracts/config'
  const configDir = path.join(process.cwd(), "../contracts/config");
  const configFilePath = path.join(configDir, `${networkName}.json`);

  try {
    if (!fs.existsSync(configFilePath)) {
      logger.warn(
        `⚠️ Configuration file ${configFilePath} not found. Skipping update of validator sets.`
      );
      // Optionally, create a default structure if it makes sense, or simply return.
      // For now, if the base network config doesn't exist, we can't update it.
      return;
    }

    const configFileContent = fs.readFileSync(configFilePath, "utf-8");
    const configJson = JSON.parse(configFileContent);

    if (!configJson.snowbridge) {
      configJson.snowbridge = {};
      logger.warn(`"snowbridge" section not found in ${configFilePath}, created it.`);
    }

    configJson.snowbridge.initialValidators = validatorHashes;
    configJson.snowbridge.nextValidators = validatorHashes;

    fs.writeFileSync(configFilePath, JSON.stringify(configJson, null, 2));
    logger.success(`✅ Datahaven validator hashes updated in: ${configFilePath}`);
  } catch (error) {
    logger.error(`❌ Failed to read or update ${configFilePath}: ${error}`);
    throw new Error(`Failed to update validator sets in ${configFilePath}.`);
  }
}

/**
 * Checks if the binary needs to be rebuilt based on:
 * 1. If the binary doesn't exist
 * 2. If there are changes in the operator folder compared to the main branch
 * 3. If there are uncommitted changes in the operator folder
 */
const shouldRebuildBinary = async (binaryPath: string): Promise<boolean> => {
  // Check if binary exists
  if (!(await Bun.file(binaryPath).exists())) {
    logger.info("📦 Binary doesn't exist, build required");
    return true;
  }

  try {
    const operatorPath = "../operator";

    // Check for uncommitted changes in the operator folder
    const gitStatusProcess = await $`cd ${operatorPath} && git status --porcelain`.quiet();

    // If command failed, rebuild to be safe
    if (gitStatusProcess.exitCode !== 0) {
      logger.warn("⚠️ Git status command failed. Will rebuild to be safe.");
      return true;
    }

    // Parse Git status output to check if there are uncommitted changes
    const uncommittedChanges = gitStatusProcess.stdout
      .toString()
      .split("\n")
      .filter((line) => line.trim() !== "");

    if (uncommittedChanges.length > 0) {
      logger.info(
        `🔄 Found ${uncommittedChanges.length} uncommitted changes in the operator folder, rebuild required`
      );
      return true;
    }

    // Get the current branch name
    const currentBranchProcess =
      await $`cd ${operatorPath} && git rev-parse --abbrev-ref HEAD`.quiet();
    const currentBranch = currentBranchProcess.stdout.toString().trim();

    // Check for differences between current branch and main branch
    const diffProcess =
      await $`cd ${operatorPath} && git diff --name-only main..${currentBranch}`.quiet();

    // If command failed, rebuild to be safe
    if (diffProcess.exitCode !== 0) {
      logger.warn("⚠️ Git diff command failed. Will rebuild to be safe.");
      return true;
    }

    // Parse Git diff output to check if there are changes compared to main
    const changedFiles = diffProcess.stdout
      .toString()
      .split("\n")
      .filter((line) => line.trim() !== "" && line.startsWith("operator/"));

    if (changedFiles.length > 0) {
      logger.info(
        `🔄 Found ${changedFiles.length} changes compared to main branch in the operator folder, rebuild required`
      );
      return true;
    }

    logger.info("✅ No changes detected in the operator folder, skipping build");
    return false;
  } catch (error) {
    logger.warn(`⚠️ Error checking Git status/diff: ${error}. Will rebuild to be safe.`);
    return true;
  }
};

// TODO: This is very rough and will need something more substantial when we know what we want!
export const performDatahavenOperations = async (
  options: LaunchOptions,
  launchedNetwork: LaunchedNetwork
) => {
  printHeader("Starting Datahaven Network");

  invariant(options.datahavenBinPath, "❌ Datahaven binary path not defined");

  // Check if we need to rebuild
  const needsRebuild = await shouldRebuildBinary(options.datahavenBinPath);

  // Build the Datahaven binary with the appropriate options if needed
  if (needsRebuild) {
    const buildCommand = ["cargo", "build", "--release"];
    if (options.fastRuntime) {
      buildCommand.push("--features", "fast-runtime");
      logger.info("🚀 Building Datahaven binary with fast runtime enabled");
    } else {
      logger.info("🏗️ Building Datahaven binary in normal mode");
    }

    logger.debug(`Running build command: ${buildCommand.join(" ")}`);
    try {
      await $`cd ../operator && ${buildCommand}`.quiet();
      logger.success("Datahaven binary built successfully");
    } catch (error) {
      logger.error(`Failed to build Datahaven binary: ${error}`);
      throw new Error("Failed to build Datahaven binary");
    }
  } else if (options.fastRuntime) {
    logger.info("Using existing Datahaven binary with fast runtime");
  } else {
    logger.info("Using existing Datahaven binary in normal mode");
  }

  invariant(
    await Bun.file(options.datahavenBinPath).exists(),
    "❌ Datahaven binary does not exist"
  );

  const logsPath = `tmp/logs/${launchedNetwork.getRunId()}/`;
  logger.debug(`Ensuring logs directory exists: ${logsPath}`);
  await $`mkdir -p ${logsPath}`.quiet();

  for (const id of CLI_AUTHORITY_IDS) {
    logger.info(`Starting ${id}...`);

    const command: string[] = [options.datahavenBinPath, ...COMMON_LAUNCH_ARGS, `--${id}`];

    const logFileName = `datahaven-${id}.log`;
    const logFilePath = path.join(logsPath, logFileName);
    logger.debug(`Writing logs to ${logFilePath}`);

    const fd = fs.openSync(logFilePath, "a");
    launchedNetwork.addFileDescriptor(fd);

    logger.debug(`Spawning command: ${command.join(" ")}`);
    const process = Bun.spawn(command, {
      stdout: fd,
      stderr: fd
    });

    process.unref();

    let completed = false;
    const file = Bun.file(logFilePath);
    for (let i = 0; i < 10; i++) {
      const pattern = "Running JSON-RPC server: addr=127.0.0.1:";
      const blob = await file.text();
      logger.debug(`Blob: ${blob}`);
      if (blob.includes(pattern)) {
        const port = blob.split(pattern)[1].split("\n")[0].replaceAll(",", "");
        launchedNetwork.addDHNode(id, Number.parseInt(port));
        logger.debug(`${id} started at port ${port}`);
        completed = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    invariant(completed, "❌ Could not find 'Running JSON-RPC server:' in logs");

    launchedNetwork.addProcess(process);
    logger.debug(`Started ${id} at ${process.pid}`);
  }

  for (let i = 0; i < 10; i++) {
    logger.info("Waiting for datahaven to start...");

    if (await isNetworkReady(9944)) {
      logger.success("Datahaven network started");
      return;
    }
    logger.debug("Node not ready, waiting 1 second...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Datahaven network failed to start after 10 seconds");
};

export const isNetworkReady = async (port: number): Promise<boolean> => {
  try {
    const response = await fetch(`http://localhost:${port}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "system_chain",
        params: []
      })
    });
    logger.debug(`isNodeReady check response: ${response.status}`);
    logger.trace(await response.json());
    return response.ok;
  } catch (error) {
    logger.debug(`isNodeReady check failed for port ${port}: ${error}`);
    return false;
  }
};
