import type { Command } from "@commander-js/extra-typings";
import invariant from "tiny-invariant";
import {
  confirmWithTimeout,
  getContainersMatchingImage,
  killExistingContainers,
  logger,
  printHeader
} from "utils";

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

  printHeader("Snowbridge Relayers");
  await stopRelayers(options);
  printHeader("Datahaven network");
  // await stopDatahavenNetwork(options);
  printHeader("Ethereum Network");
  // await stopKurtosisEnclave(options);
  printHeader("Kurtosis Enging");
  // await stopKurtosisEngine(options);
};

export const stopRelayers = async (options: StopOptions) => {
  logger.debug("Checking currently running Snowbridge Relayers ...");
  const relayers = await getContainersMatchingImage("snowbridge-relayer");
  logger.info(`Found ${relayers.length} relayer(s) running`);
  // Check to see if relayers are running
  // If none are running then print log line and return
  // If some, then ask question or use flag
  let shouldStopRelayers = options.relayer;
  if (shouldStopRelayers === undefined) {
    shouldStopRelayers = await confirmWithTimeout(
      "Do you want to stop the Snowbridge relayers?",
      true,
      5
    );
  } else {
    logger.debug(
      `🏳️ Using flag option: ${shouldStopRelayers ? "will stop" : "will not stop"} Snowbridge relayers`
    );
  }

  if (!shouldStopRelayers) {
    logger.info("Skipping stopping Snowbridge relayers");
    return;
  }

  await killExistingContainers("snowbridge-relayer");

  const remaining = await getContainersMatchingImage("snowbridge-relayer");

  invariant(
    remaining.length === 0,
    `❌ ${remaining.length} relayers are still running and have not been stopped.`
  );
  logger.info(`✅ ${relayers.length} Snowbridge relayers stopped successfully`);
};
