import fs from "node:fs";
import path from "node:path";
import { $ } from "bun";
import invariant from "tiny-invariant";
import { confirmWithTimeout, logger, printDivider, printHeader } from "utils";
import type { LaunchOptions } from ".";
import type { LaunchedNetwork } from "./launchedNetwork";
import { ethers } from "ethers";
import { ApiPromise, WsProvider } from "@polkadot/api";
import type { Option } from "@polkadot/types";
import type { AuthorityId } from "@polkadot/types/interfaces/consensus";
import type { ValidatorSet } from "@polkadot/types/interfaces/beefy";

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

// 33-byte compressed public keys for Datahaven next validator set
// These correspond to Alice, Bob, Charlie, Dave, Eve, Ferdie
// These are the fallback keys if we can't fetch the next authorities directly from the network
const FALLBACK_DATAHAVEN_AUTHORITY_PUBLIC_KEYS: Record<string, string> = {
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
export async function setupDatahavenValidatorConfig(
  options: LaunchOptions,
  launchedNetwork: LaunchedNetwork
): Promise<void> {
  const networkName = process.env.NETWORK || "anvil";
  logger.info(
    `🔧 Preparing Datahaven authorities configuration for network: ${networkName}...`
  );

  let authorityPublicKeys: string[] = [];
  const dhNodes = launchedNetwork.getDHNodes();

  if (dhNodes.length === 0) {
    logger.warn(
      "⚠️ No DataHaven nodes found in launchedNetwork. Falling back to hardcoded authority set for validator config."
    );
    authorityPublicKeys = Object.values(FALLBACK_DATAHAVEN_AUTHORITY_PUBLIC_KEYS);
  } else {
    const firstNode = dhNodes[0];
    const provider = new WsProvider(`ws://127.0.0.1:${firstNode.port}`);
    try {
      logger.info(
        `📡 Attempting to fetch BEEFY next authorities from node ${firstNode.id} (port ${firstNode.port})...`
      );
      const api = await ApiPromise.create({ provider, noInitWarn: true });
      await api.isReady;

      // Read NextAuthorities directly from storage, which contains the next authority set
      const nextAuthorities: AuthorityId[] = (await api.query.beefy.nextAuthorities()) as unknown as AuthorityId[];

      if (nextAuthorities && nextAuthorities.length > 0) {
        authorityPublicKeys = nextAuthorities.map((v: AuthorityId) => v.toHex());
        logger.success(
          `Successfully fetched ${authorityPublicKeys.length} BEEFY next authorities directly from storage.`
        );
      } else {
        logger.warn(
          "⚠️ Fetched BEEFY nextAuthorities is empty. Falling back to hardcoded authority set."
        );
        authorityPublicKeys = Object.values(FALLBACK_DATAHAVEN_AUTHORITY_PUBLIC_KEYS);
      }
      await api.disconnect();
    } catch (error) {
      logger.error(
        `❌ Error fetching BEEFY next authorities from node ${firstNode.id}: ${error}. Falling back to hardcoded authority set.`
      );
      authorityPublicKeys = Object.values(FALLBACK_DATAHAVEN_AUTHORITY_PUBLIC_KEYS);
      if (provider.isConnected) {
        await provider.disconnect(); // Ensure provider is disconnected even on error
      }
    }
  }

  if (authorityPublicKeys.length === 0) {
    logger.error(
      "❌ No authority public keys available (neither fetched nor hardcoded). Cannot prepare validator config."
    );
    throw new Error("No Datahaven authority keys available.");
  }

  const authorityHashes: string[] = [];
  for (const compressedKey of authorityPublicKeys) {
    try {
      const ethAddress = compressedPubKeyToEthereumAddress(compressedKey);
      const authorityHash = ethers.keccak256(ethAddress);
      authorityHashes.push(authorityHash);
      logger.debug(
        `Processed public key ${compressedKey} -> ETH address ${ethAddress} -> Authority hash ${authorityHash}`
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

    configJson.snowbridge.initialValidators = authorityHashes;
    configJson.snowbridge.nextValidators = authorityHashes;

    fs.writeFileSync(configFilePath, JSON.stringify(configJson, null, 2));
    logger.success(`Datahaven authority hashes updated in: ${configFilePath}`);
  } catch (error) {
    logger.error(`❌ Failed to read or update ${configFilePath}: ${error}`);
    throw new Error(`Failed to update authority hashes in ${configFilePath}.`);
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
    // Check for uncommitted changes in the operator folder
    logger.debug(`Checking for uncommitted changes in 'operator/' directory...`);
    // We use .nothrow() because grep exits with 1 if no lines are selected, which would throw an error.
    const statusCheckProcess = await $`git status --porcelain | grep 'operator/'`.nothrow().quiet();

    if (statusCheckProcess.exitCode === 0) {
      // exitCode 0 means grep found matches
      logger.info(
        `🔄 Found uncommitted changes related to 'operator/', rebuild required.`
      );
      logger.debug(`Grep match for uncommitted changes stdout: ${statusCheckProcess.stdout.toString().trim()}`);
      return true;
    }
    if (statusCheckProcess.exitCode !== 1) {
      // exitCode 1 means grep found no matches. Other codes are errors.
      logger.warn(`⚠️ Git status or grep command failed (uncommitted changes check). Exit code: ${statusCheckProcess.exitCode}. Stderr: ${statusCheckProcess.stderr.toString().trim()}. Will rebuild to be safe.`);
      return true;
    }

    // Get the current branch name
    logger.debug(`Checking for changes in 'operator/' directory compared to default branch...`);
    const currentBranchProcess =
      await $`git rev-parse --abbrev-ref HEAD`.quiet();

    if (currentBranchProcess.exitCode !== 0) {
      logger.warn(`⚠️ Failed to get current branch name. Stderr: ${currentBranchProcess.stderr.toString().trim()}. Will rebuild to be safe.`);
      return true;
    }
    const currentBranch = currentBranchProcess.stdout.toString().trim();

    if (currentBranch === "main") {
      logger.debug(`✅ Currently on default branch ('${currentBranch}'), no diff to check for 'operator/' changes.`);
    } else {
      logger.debug(`Attempting to diff 'operator/' in main..${currentBranch}`);
      const diffCheckProcess = await $`git diff --name-only main..${currentBranch} -- operator/ | grep 'operator/'`.nothrow().quiet();

      if (diffCheckProcess.exitCode === 0) {
        logger.info(
          `🔄 Found changes related to 'operator/' (comparing main..${currentBranch}), rebuild required.`
        );
        logger.debug(`Grep match for diff (main..${currentBranch}) stdout: ${diffCheckProcess.stdout.toString().trim()}`);
        return true;
      }
      if (diffCheckProcess.exitCode !== 1) {
        logger.warn(`⚠️ Git diff or grep command failed for main..${currentBranch}. Exit code: ${diffCheckProcess.exitCode}. Stderr: ${diffCheckProcess.stderr.toString().trim()}.`);
        return true;
      } else {
        logger.debug(`✅ No changes found in 'operator/' folder when comparing main..${currentBranch}.`);
      }
    }

    logger.info(`✅ No relevant uncommitted changes or diffs detected for 'operator/'. Skipping build.`);
    return false;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`⚠️ Error during Git checks for 'operator/': ${errorMessage}. Will rebuild to be safe.`);
    return true;
  }
};

// TODO: This is very rough and will need something more substantial when we know what we want!
/**
 * Launches a DataHaven solochain network for testing.
 *
 * @param options - Configuration options for launching the network.
 * @param launchedNetwork - An instance of LaunchedNetwork to track the network's state.
 */
export const launchDataHavenSolochain = async (
  options: LaunchOptions,
  launchedNetwork: LaunchedNetwork
) => {
  printHeader("Starting DataHaven Network");

  let shouldLaunchDataHaven = options.datahaven;
  if (shouldLaunchDataHaven === undefined) {
    shouldLaunchDataHaven = await confirmWithTimeout(
      "Do you want to launch the DataHaven network?",
      true,
      10
    );
  } else {
    logger.info(
      `Using flag option: ${shouldLaunchDataHaven ? "will launch" : "will not launch"} DataHaven network`
    );
  }

  if (!shouldLaunchDataHaven) {
    logger.info("Skipping DataHaven network launch. Done!");
    printDivider();
    return;
  }

  // Kill any pre-existing datahaven processes if they exist
  await $`pkill datahaven`.nothrow().quiet();

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
    for (let i = 0; i < 60; i++) {
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

  // Check if network is ready
  for (let i = 0; i < 10; i++) {
    logger.info("Waiting for datahaven to start...");

    // Get the port of the primary node (or default)
    const primaryNodePort = launchedNetwork.getDHNodes()[0]?.port || 9944;

    if (await isNetworkReady(primaryNodePort)) {
      logger.success(`Datahaven network started, primary node accessible on port ${primaryNodePort}`);

      // Call setupDatahavenValidatorConfig now that nodes are up
      logger.info("Proceeding with DataHaven validator configuration setup...");
      await setupDatahavenValidatorConfig(options, launchedNetwork);

      printDivider();
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

