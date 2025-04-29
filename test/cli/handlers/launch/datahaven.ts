import fs from "node:fs";
import path from "node:path";
import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger, printHeader } from "utils";
import type { LaunchOptions } from ".";
import type { LaunchedNetwork } from "./launchedNetwork";

const COMMON_LAUNCH_ARGS = [
  "--unsafe-force-node-key-generation",
  "--tmp",
  "--port=0",
  "--validator",
  "--no-prometheus",
  "--force-authoring",
  "--no-telemetry"
];

// We need 5 since the (2/3 + 1) of 6 authority set is 5
// <repo_root>/operator/runtime/src/genesis_config_presets.rs#L94
const AUTHORITY_IDS = ["alice", "bob", "charlie", "dave", "eve"];

// TODO: This is very rough and will need something more substantial when we know what we want!
export const performDatahavenOperations = async (
  options: LaunchOptions,
  launchedNetwork: LaunchedNetwork
) => {
  printHeader("Starting Datahaven Network");

  invariant(options.datahavenBinPath, "❌ Datahaven binary path not defined");
  invariant(
    await Bun.file(options.datahavenBinPath).exists(),
    "❌ Datahaven binary does not exist"
  );

  const logsPath = `tmp/logs/${launchedNetwork.getRunId()}/`;
  logger.debug(`Ensuring logs directory exists: ${logsPath}`);
  await $`mkdir -p ${logsPath}`.quiet();

  for (const id of AUTHORITY_IDS) {
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
