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
import { z } from "zod";
import { checkDependencies } from "../launch/checks";

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
  logger.info("Stopping network components...");
  logger.debug(`Stop options: ${JSON.stringify(options)}`);

  await checkDependencies();

  printHeader("Snowbridge Relayers");
  await stopDockerComponents("snowbridge", options);
  printHeader("Datahaven network");
  await stopDockerComponents("datahaven", options);
  printHeader("Ethereum Network");
  await stopAllEnclaves(options);
  printHeader("Kurtosis Engine");
  await stopKurtosisEngine(options);
};

const COMPONENTS = {
  datahaven: {
    imageName: "moonsonglabs/datahaven",
    componentName: "Datahaven Network",
    optionName: "datahaven"
  },
  snowbridge: {
    imageName: "snowbridge-relayer",
    componentName: "Snowbridge Relayers",
    optionName: "relayer"
  }
} as const;

export const stopDockerComponents = async (type: keyof typeof COMPONENTS, options: StopOptions) => {
  const name = COMPONENTS[type].componentName;
  const imageName = COMPONENTS[type].imageName;
  logger.debug(`Checking currently running ${name} ...`);
  const relayers = await getContainersMatchingImage(imageName);
  logger.info(`Found ${relayers.length} containers(s) running`);
  if (relayers.length === 0) {
    logger.info(`No ${name} containers found running`);
    return;
  }
  let shouldStopComponent = options.all || options[COMPONENTS[type].optionName];
  if (shouldStopComponent === undefined) {
    shouldStopComponent = await confirmWithTimeout(
      `Do you want to stop the ${imageName} relayers?`,
      true,
      5
    );
  } else {
    logger.debug(
      `🏳️ Using flag option: ${shouldStopComponent ? "will stop" : "will not stop"} ${name}`
    );
  }

  if (!shouldStopComponent) {
    logger.info(`Skipping stopping ${name} due to flag option`);
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

const stopAllEnclaves = async (options: StopOptions) => {
  logger.info("Checking for running Kurtosis enclaves...");

  let shouldStopEnclave = options.all || options.enclave;
  if (shouldStopEnclave === undefined) {
    shouldStopEnclave = await confirmWithTimeout(
      "Do you want to stop the all the Kurtosis enclaves?",
      true,
      5
    );
  } else {
    logger.debug(
      `🏳️ Using flag option: ${shouldStopEnclave ? "will stop" : "will not stop"} all Kurtosis enclaves`
    );
  }

  if (!shouldStopEnclave) {
    logger.info("Skipping stopping Kurtosis enclaves due to flag option");
    return;
  }

  const lines = (await Array.fromAsync($`kurtosis enclave ls`.lines())).filter(
    (line) => line.length > 0
  );
  logger.trace(lines);

  lines.shift();
  const enclaveCount = lines.length;
  const KurtosisEnclaveInfoSchema = z.object({
    uuid: z.string().min(1),
    name: z.string().min(1),
    status: z.string().min(1),
    creationTime: z.string().min(1)
  });

  type KurtosisEnclaveInfo = z.infer<typeof KurtosisEnclaveInfoSchema>;
  const enclaves: KurtosisEnclaveInfo[] = [];

  if (enclaveCount > 0) {
    logger.info(`Found ${enclaveCount} Kurtosis enclave(s) running.`);
    // Regex to capture the columns: UUID, Name, Status, Creation Time
    const enclaveRegex = /^(\S+)\s+(.+?)\s+(\S+)\s+([\w,: ]+)$/;

    for (const line of lines) {
      const match = line.match(enclaveRegex);
      if (match) {
        const [, uuid, name, status, creationTime] = match;
        const parseResult = KurtosisEnclaveInfoSchema.safeParse({
          uuid: uuid.trim(),
          name: name.trim(),
          status: status.trim(),
          creationTime: creationTime.trim()
        });

        if (parseResult.success) {
          enclaves.push(parseResult.data);
        } else {
          logger.warn(
            `Could not parse enclave line: "${line}". Error: ${parseResult.error.message}`
          );
        }
      } else {
        logger.warn(`Could not parse enclave line (regex mismatch): "${line}"`);
      }
    }

    if (enclaves.length > 0) {
      logger.debug("Parsed enclave details:");

      for (const { creationTime, name, status, uuid } of enclaves) {
        logger.debug(`UUID: ${uuid}, Name: ${name}, Status: ${status}, Created: ${creationTime}`);
        logger.info(`Removing enclave ${name}`);
        logger.debug(await $`kurtosis enclave rm ${uuid} -f`.text());
      }
    } else if (lines.length > 0 && enclaves.length === 0) {
      logger.warn("Found enclave lines in output, but failed to parse any of them.");
    }
  } else {
    logger.info("No Kurtosis enclaves found running.");
    return;
  }
  logger.info(`🪓 ${lines.length} enclaves cleaned`);
};

export const stopKurtosisEngine = async (options: StopOptions) => {
  logger.debug("Checking currently running kurtosis engine ...");
  const matches = await getContainersMatchingImage("kurtosistech/engine");

  logger.debug(`${matches.length} kurtosis engine(s) running`);
  logger.trace(JSON.stringify(matches));
  if (matches.length === 0) {
    logger.info("No Kurtosis engine found running, skipping");
    return;
  }

  if (!options.kurtosisEngine) {
    logger.info("Skipping stopping Kurtosis engine due to flag option");
    return;
  }
  await runShellCommandWithLogger("kurtosis engine stop", {
    logLevel: "debug"
  });
  logger.info("🪓 Kurtosis engine stopped successfully");
};
