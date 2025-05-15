import fs from "node:fs";
import path from "node:path";
import { $ } from "bun";
import invariant from "tiny-invariant";
import {
  ANVIL_FUNDED_ACCOUNTS,
  type RelayerType,
  SUBSTRATE_FUNDED_ACCOUNTS,
  confirmWithTimeout,
  getPortFromKurtosis,
  killRunningContainers,
  logger,
  parseDeploymentsFile,
  parseRelayConfig,
  printDivider,
  printHeader,
  waitForContainerToStart
} from "utils";
import type { LaunchOptions } from ".";
import type { LaunchedNetwork } from "./launchedNetwork";

type RelayerSpec = {
  name: string;
  type: RelayerType;
  config: string;
  pk: { type: "ethereum" | "substrate"; value: string };
};

/**
 * Launches Snowbridge relayers for the DataHaven network.
 *
 * @param options - Configuration options for launching the relayers.
 * @param launchedNetwork - An instance of LaunchedNetwork to track the network's state.
 */
export const launchRelayers = async (options: LaunchOptions, launchedNetwork: LaunchedNetwork) => {
  printHeader("Starting Snowbridge Relayers");

  let shouldLaunchRelayers = options.relayer;
  if (shouldLaunchRelayers === undefined) {
    shouldLaunchRelayers = await confirmWithTimeout(
      "Do you want to launch the Snowbridge relayers?",
      true,
      10
    );
  } else {
    logger.info(
      `Using flag option: ${shouldLaunchRelayers ? "will launch" : "will not launch"} Snowbridge relayers`
    );
  }

  if (!shouldLaunchRelayers) {
    logger.info("Skipping Snowbridge relayers launch. Done!");
    printDivider();
    return;
  }

  invariant(options.relayerImageTag, "❌ relayerImageTag is required");
  await killRunningContainers(options.relayerImageTag);

  const anvilDeployments = await parseDeploymentsFile();
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
      cfg.source.beacon.endpoint = `http://host.docker.internal:${ethHttpPort}`;
      cfg.source.beacon.stateEndpoint = `http://host.docker.internal:${ethHttpPort}`;
      cfg.source.beacon.datastore.location = "/data";
      cfg.sink.parachain.endpoint = "ws://datahaven-alice:9944";

      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beacon config written to ${outputFilePath}`);
    } else {
      const cfg = parseRelayConfig(json, type);
      cfg.source.polkadot.endpoint = "ws://datahaven-alice:9944";
      cfg.sink.ethereum.endpoint = `ws://host.docker.internal:${ethWsPort}`;
      cfg.sink.contracts.BeefyClient = beefyClientAddress;
      cfg.sink.contracts.Gateway = gatewayAddress;
      await Bun.write(outputFilePath, JSON.stringify(cfg, null, 4));
      logger.success(`Updated beefy config written to ${outputFilePath}`);
    }
  }

  logger.info("Spawning Snowbridge relayers processes");

  for (const { config, name, type, pk } of relayersToStart) {
    try {
      const containerName = `snowbridge-${type}-relay`;
      logger.info(`Starting relayer ${containerName} ...`);

      const hostConfigFilePath = path.resolve("tmp/configs", config);
      const containerConfigFilePath = `/app/${config}`;
      const networkName = launchedNetwork.networkName;
      invariant(networkName, "❌ Docker network name not found in LaunchedNetwork instance");

      const commandBase: string[] = [
        "docker",
        "run",
        "-d",
        "--platform",
        "linux/amd64",
        "--add-host",
        "host.docker.internal:host-gateway",
        "--name",
        containerName,
        "--network",
        networkName
      ];

      const volumeMounts: string[] = ["-v", `${hostConfigFilePath}:${containerConfigFilePath}`];

      if (type === "beacon") {
        const hostDatastorePath = path.resolve(datastorePath);
        const containerDatastorePath = "/data";
        volumeMounts.push("-v", `${hostDatastorePath}:${containerDatastorePath}`);
      }

      const relayerCommandArgs: string[] = [
        "run",
        type,
        "--config",
        containerConfigFilePath,
        type === "beacon" ? "--substrate.private-key" : "--ethereum.private-key",
        pk.value
      ];

      const command: string[] = [
        ...commandBase,
        ...volumeMounts,
        options.relayerImageTag,
        ...relayerCommandArgs
      ];

      logger.debug(`Spawning command: ${command.join(" ")}`);
      const process = Bun.spawn(command);
      process.unref();

      launchedNetwork.addContainer(containerName);

      await waitForContainerToStart(containerName);

      // TODO: Renable when we know what we want to tail for
      // await waitForLog({
      //   searchString: "<LOG LINE TO WAIT FOR>",
      //   containerName,
      //   timeoutSeconds: 30,
      //   tail: 1
      // });

      launchedNetwork.addProcess(process);
      logger.debug(`Started relayer ${name} with process ${process.pid}`);
    } catch (e) {
      logger.error(`Error starting relayer ${name}`);
      logger.error(e);
    }
  }

  logger.success("Snowbridge relayers started");
  printDivider();
};
