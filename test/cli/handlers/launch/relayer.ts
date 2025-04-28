import fs from "node:fs";
import path from "node:path";
import { $ } from "bun";
import invariant from "tiny-invariant";
import {
  ANVIL_FUNDED_ACCOUNTS,
  type RelayerType,
  SUBSTRATE_FUNDED_ACCOUNTS,
  getPortFromKurtosis,
  logger,
  parseRelayConfig,
  printHeader
} from "utils";
import type { LaunchOptions } from "..";

type RelayerSpec = {
  name: string;
  type: RelayerType;
  config: string;
  pk: { type: "ethereum" | "substrate"; value: string };
};

export const performRelayerOperations = async (
  options: LaunchOptions,
  spawnedProcesses: Bun.Subprocess[]
) => {
  printHeader("Starting Snowbridge Relayers");
  logger.info("Preparing to generate configs");
  const anvilDeploymentsPath = "../contracts/deployments/anvil.json";
  const anvilDeploymentsFile = Bun.file(anvilDeploymentsPath);
  if (!(await anvilDeploymentsFile.exists())) {
    logger.error(`File ${anvilDeploymentsPath} does not exist`);
    throw new Error("Error reading anvil deployments file");
  }
  const anvilDeployments = await anvilDeploymentsFile.json();
  const beefyClientAddress = anvilDeployments.BeefyClient;
  const gatewayAddress = anvilDeployments.Gateway;
  invariant(beefyClientAddress, "❌ BeefyClient address not found in anvil.json");
  invariant(gatewayAddress, "❌ Gateway address not found in anvil.json");

  const outputDir = "tmp/configs";
  logger.debug(`Ensuring output directory exists: ${outputDir}`);
  await $`mkdir -p ${outputDir}`.quiet();

  const datastorePath = "tmp/datastore";
  logger.debug(`Ensuring datastore directory exists: ${datastorePath}`);
  await $`mkdir -p ${datastorePath}`.quiet();

  const logsPath = "tmp/logs";
  logger.debug(`Ensuring logs directory exists: ${logsPath}`);
  await $`mkdir -p ${logsPath}`.quiet();

  const relayersToStart: RelayerSpec[] = [
    {
      name: "relayer-🥩",
      type: "beefy",
      config: "beefy-relay.json",
      pk: {
        type: "ethereum",
        value: ANVIL_FUNDED_ACCOUNTS[1].privateKey
      }
    },
    {
      name: "relayer-🥓",
      type: "beacon",
      config: "beacon-relay.json",
      pk: {
        type: "substrate",
        value: SUBSTRATE_FUNDED_ACCOUNTS.GOLIATH.privateKey
      }
    }
  ];

  for (const { config: configFileName, type, name } of relayersToStart) {
    logger.debug(`Creating config for ${name}`);
    const templateFilePath = `configs/snowbridge/${configFileName}`;
    const outputFilePath = `tmp/configs/${configFileName}`;
    logger.debug(`Reading config file ${templateFilePath}`);
    const file = Bun.file(templateFilePath);

    if (!(await file.exists())) {
      logger.error(`File ${templateFilePath} does not exist`);
      throw new Error("Error reading snowbridge config file");
    }
    const json = await file.json();

    const ethWsPort = await getPortFromKurtosis("el-1-reth-lighthouse", "ws");
    const ethHttpPort = await getPortFromKurtosis("cl-1-lighthouse-reth", "http");
    const substrateWsPort = 9944;
    logger.debug(
      `Fetched ports: ETH WS=${ethWsPort}, ETH HTTP=${ethHttpPort}, Substrate WS=${substrateWsPort} (hardcoded)`
    );

    if (type === "beacon") {
      const cfg = parseRelayConfig(json, type);
      cfg.source.beacon.endpoint = `http://127.0.0.1:${ethHttpPort}`;
      cfg.source.beacon.stateEndpoint = `http://127.0.0.1:${ethHttpPort}`;

      cfg.source.beacon.datastore.location = datastorePath;

      cfg.sink.parachain.endpoint = `ws://127.0.0.1:${substrateWsPort}`;
      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beacon config written to ${outputFilePath}`);
    } else {
      const cfg = parseRelayConfig(json, type);
      cfg.source.polkadot.endpoint = `ws://127.0.0.1:${substrateWsPort}`;
      cfg.sink.ethereum.endpoint = `ws://127.0.0.1:${ethWsPort}`;
      cfg.sink.contracts.BeefyClient = beefyClientAddress;
      cfg.sink.contracts.Gateway = gatewayAddress;
      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beefy config written to ${outputFilePath}`);
    }
  }

  logger.info("Spawning Snowbridge relayers processes");

  invariant(options.relayerBinPath, "❌ Relayer binary path not defined");
  invariant(
    await Bun.file(options.relayerBinPath).exists(),
    `❌ Relayer binary does not exist at ${options.relayerBinPath}`
  );

  for (const { config, name, type, pk } of relayersToStart) {
    try {
      logger.info(`Starting relayer ${name} ...`);
      const logFileName = `${type}-${name.replace(/[^a-zA-Z0-9-]/g, "")}${Date.now()}.log`;
      const logFilePath = path.join(logsPath, logFileName);
      logger.debug(`Writing logs to ${logFilePath}`);

      const fd = fs.openSync(logFilePath, "a");

      const spawnCommand = [
        options.relayerBinPath,
        "run",
        type,
        "--config",
        path.join("tmp/configs", config),
        type === "beacon" ? "--substrate.private-key" : "--ethereum.private-key",
        pk.value
      ];

      logger.debug(`Spawning command: ${spawnCommand.join(" ")}`);

      const process = Bun.spawn(spawnCommand, {
        stdout: fd,
        stderr: fd
      });

      process.exited.then(() => {
        try {
          fs.closeSync(fd);
          logger.debug(`Closed log file descriptor for ${name}`);
        } catch (closeError) {
          logger.error(`Error closing log file descriptor for ${name}: ${closeError}`);
        }
      });

      logger.debug(`Started relayer ${name} with process ${process.pid}`);
      spawnedProcesses.push(process);
    } catch (e) {
      logger.error(`Error starting relayer ${name}`);
      logger.error(e);
    }
  }

  logger.success("Snowbridge relayers started");
};
