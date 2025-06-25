import type { Command } from "@commander-js/extra-typings";
import { $ } from "bun";
import invariant from "tiny-invariant";
import {
  confirmWithTimeout,
  getContainersByPrefix,
  getContainersMatchingImage,
  killExistingContainers,
  logger,
  printHeader,
  runShellCommandWithLogger
} from "utils";
import { getRunningKurtosisEnclaves } from "../../../launcher/kurtosis";
import { COMPONENTS } from "../../../launcher/utils/constants";
import { checkBaseDependencies } from "../common/checks";

export interface StopOptions {
  all?: boolean;
  datahaven?: boolean;
  enclave?: boolean;
  kurtosisEngine: boolean;
  relayer?: boolean;
}

export const stopPreActionHook = (thisCmd: Command<[], StopOptions & { [key: string]: any }>) => {
  const { all, datahaven, enclave, relayer } = thisCmd.opts();

  if (all && (datahaven === false || enclave === false || relayer === false)) {
    thisCmd.error("--all cannot be used with --no-datahaven, --no-enclave or --no-relayer");
  }
};

export const stop = async (options: StopOptions) => {
  logger.info("🛑 Stopping network components...");
  logger.debug(`Stop options: ${JSON.stringify(options)}`);

  await checkBaseDependencies();

  printHeader("Snowbridge Relayers");
  await stopDockerComponents("snowbridge", options);
  printHeader("Datahaven Network");
  await stopDockerComponents("datahaven", options);
  await removeDataHavenNetworks(options);
  printHeader("Ethereum Network");
  await stopAllEnclaves(options);
  printHeader("Kurtosis Engine");
  await stopKurtosisEngine(options);
};

export const stopDockerComponents = async (type: keyof typeof COMPONENTS, options: StopOptions) => {
  const name = COMPONENTS[type].componentName;
  logger.debug(`Checking currently running ${name} ...`);
  const components = await getContainersByPrefix(type);
  logger.info(`🔎 Found ${components.length} containers(s) running the ${name}`);
  if (components.length === 0) {
    logger.info(`🤷‍ No ${name} containers found running`);
    return;
  }
  let shouldStopComponent = options.all || options[COMPONENTS[type].optionName];
  if (shouldStopComponent === undefined) {
    shouldStopComponent = await confirmWithTimeout(
      `Do you want to stop the ${type} containers?`,
      true,
      10
    );
  } else {
    logger.info(
      `🏳️ Using flag option: ${shouldStopComponent ? "will stop" : "will not stop"} ${name}`
    );
  }

  if (!shouldStopComponent) {
    logger.info(`👍 Skipping stopping ${name} due to flag option`);
    return;
  }

  await killExistingContainers(type);
  const remaining = await getContainersByPrefix(type);
  invariant(
    remaining.length === 0,
    `❌ ${remaining.length} containers are still running and have not been stopped.`
  );
  logger.info(`🪓 ${components.length} ${name} containers stopped successfully`);
};

const removeDataHavenNetworks = async (options: StopOptions) => {
  logger.debug(`Checking for Docker networks with 'datahaven-' prefix...`);

  // Find all networks that start with "datahaven-"
  const networkOutput =
    await $`docker network ls --filter "name=^datahaven-" --format "{{.Name}}"`.text();

  // Parse the output to get network names
  const networks = networkOutput
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (networks.length === 0) {
    logger.info("🤷‍ No DataHaven Docker networks found, skipping");
    return;
  }

  logger.info(`🔎 Found ${networks.length} DataHaven Docker network(s): ${networks.join(", ")}`);

  let shouldRemoveNetworks = options.all || options.datahaven;
  if (shouldRemoveNetworks === undefined) {
    shouldRemoveNetworks = await confirmWithTimeout(
      `Do you want to remove ${networks.length} DataHaven Docker network(s)?`,
      true,
      10
    );
  }

  if (!shouldRemoveNetworks) {
    logger.info("👍 Skipping removing DataHaven Docker networks due to flag option");
    return;
  }

  // Remove each network
  let successCount = 0;
  for (const networkName of networks) {
    logger.info(`⛓️‍💥 Removing Docker network: ${networkName}`);
    const { exitCode, stderr } = await $`docker network rm -f ${networkName}`.nothrow().quiet();
    if (exitCode !== 0) {
      logger.warn(`⚠️ Failed to remove Docker network ${networkName}: ${stderr}`);
    } else {
      successCount++;
    }
  }

  if (successCount > 0) {
    logger.info(`🪓 ${successCount} DataHaven Docker network(s) removed successfully`);
  }
};

const stopAllEnclaves = async (options: StopOptions) => {
  logger.info("🔎 Checking for running Kurtosis enclaves...");

  let shouldStopEnclave = options.all || options.enclave;
  if (shouldStopEnclave === undefined) {
    shouldStopEnclave = await confirmWithTimeout(
      "Do you want to stop the all the Kurtosis enclaves?",
      true,
      10
    );
  } else {
    logger.debug(
      `🏳️ Using flag option: ${shouldStopEnclave ? "will stop" : "will not stop"} all Kurtosis enclaves`
    );
  }

  if (!shouldStopEnclave) {
    logger.info("👍 Skipping stopping Kurtosis enclaves due to flag option");
    return;
  }

  const enclaves = await getRunningKurtosisEnclaves();

  if (enclaves.length === 0) {
    logger.info("🤷‍ No Kurtosis enclaves found running.");
    return;
  }

  logger.info(`🔎 Found ${enclaves.length} Kurtosis enclave(s) running.`);
  logger.debug("Parsed enclave details:");

  for (const { creationTime, name, status, uuid } of enclaves) {
    logger.debug(`UUID: ${uuid}, Name: ${name}, Status: ${status}, Created: ${creationTime}`);
    logger.info(`🗑️ Removing enclave ${name}`);
    logger.debug(await $`kurtosis enclave rm ${uuid} -f`.text());
  }

  logger.info(`🪓 ${enclaves.length} enclaves cleaned`);
};

export const stopKurtosisEngine = async (options: StopOptions) => {
  logger.debug("Checking currently running kurtosis engine ...");
  const matches = await getContainersMatchingImage("kurtosistech/engine");

  logger.debug(`${matches.length} kurtosis engine(s) running`);
  logger.trace(JSON.stringify(matches));
  if (matches.length === 0) {
    logger.info("🤷‍ No Kurtosis engine found running, skipping");
    return;
  }

  if (!options.kurtosisEngine) {
    logger.info("👍 Skipping stopping Kurtosis engine due to flag option");
    return;
  }
  await runShellCommandWithLogger("kurtosis engine stop", {
    logLevel: "debug"
  });
  logger.info("🪓 Kurtosis engine stopped successfully");
};
