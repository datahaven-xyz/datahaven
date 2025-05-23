import type { Command } from "@commander-js/extra-typings";
import { $ } from "bun";
import invariant from "tiny-invariant";
import {
  confirmWithTimeout,
  getContainersMatchingImage,
  killExistingContainers,
  logger,
  printHeader,
  runShellCommandWithLogger
} from "utils";
import { checkBaseDependencies } from "../common/checks";
import { COMPONENTS, DOCKER_NETWORK_NAME } from "../common/consts";
import { getRunningKurtosisEnclaves } from "../common/kurtosis";

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
  await removeDockerNetwork(DOCKER_NETWORK_NAME, options);
  printHeader("Ethereum Network");
  await stopAllEnclaves(options);
  printHeader("Kurtosis Engine");
  await stopKurtosisEngine(options);
};

export const stopDockerComponents = async (type: keyof typeof COMPONENTS, options: StopOptions) => {
  const name = COMPONENTS[type].componentName;
  const imageName = COMPONENTS[type].imageName;
  logger.debug(`Checking currently running ${name} ...`);
  const relayers = await getContainersMatchingImage(imageName);
  logger.info(`🔎 Found ${relayers.length} containers(s) running`);
  if (relayers.length === 0) {
    logger.info(`🤷‍ No ${name} containers found running`);
    return;
  }
  let shouldStopComponent = options.all || options[COMPONENTS[type].optionName];
  if (shouldStopComponent === undefined) {
    shouldStopComponent = await confirmWithTimeout(
      `Do you want to stop the ${imageName} relayers?`,
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

  await killExistingContainers(imageName);
  const remaining = await getContainersMatchingImage(imageName);
  invariant(
    remaining.length === 0,
    `❌ ${remaining.length} containers are still running and have not been stopped.`
  );
  logger.info(`🪓 ${relayers.length} ${name} containers stopped successfully`);
};

const removeDockerNetwork = async (networkName: string, options: StopOptions) => {
  logger.debug(`Checking if Docker network ${networkName} exists...`);
  const networkOutput =
    await $`docker network ls --filter "name=^${DOCKER_NETWORK_NAME}$" --format "{{.Name}}"`.text();

  // Check if networkOutput has any network names (not just whitespace or empty lines)
  const networksExist =
    networkOutput
      .trim()
      .split("\n")
      .filter((line) => line.trim().length > 0).length > 0;
  if (!networksExist) {
    logger.info(`🤷‍ Docker network ${networkName} does not exist, skipping`);
    return;
  }

  let shouldRemoveNetwork = options.all || options.datahaven;
  if (shouldRemoveNetwork === undefined) {
    shouldRemoveNetwork = await confirmWithTimeout(
      `Do you want to remove the Docker network ${networkName}?`,
      true,
      10
    );
  }

  if (!shouldRemoveNetwork) {
    logger.info(`👍 Skipping removing Docker network ${networkName} due to flag option`);
    return;
  }

  logger.info(`⛓️‍💥 Removing Docker network: ${networkName}`);
  const { exitCode, stderr } = await $`docker network rm -f ${networkName}`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.warn(`⚠️ Failed to remove Docker network: ${stderr}`);
  } else {
    logger.info(`🪓 Docker network ${networkName} removed successfully`);
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
