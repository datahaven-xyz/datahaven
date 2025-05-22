import type { Command } from "node_modules/@commander-js/extra-typings";
import { type DeployEnvironment, logger } from "utils";
import { checkBaseDependencies, checkDeployDependencies } from "../common/checks";
import { LaunchedNetwork } from "../launch/launchedNetwork";

// Non-optional properties determined by having default values
export interface DeployOptions {
  environment: DeployEnvironment;
  datahavenImageTag: string;
  kurtosisEnclaveName: string;
  kurtosisNetworkArgs?: string;
  verified?: boolean;
  blockscout?: boolean;
  relayerImageTag: string;
}

const deployFunction = async (options: DeployOptions, launchedNetwork: LaunchedNetwork) => {
  logger.debug("Running with options:");
  logger.debug(options);

  const timeStart = performance.now();

  await checkBaseDependencies();
  await checkDeployDependencies();

  const fullEnd = performance.now();
  const fullMinutes = ((fullEnd - timeStart) / (1000 * 60)).toFixed(1);
  logger.success(`Deploy function completed successfully in ${fullMinutes} minutes`);
};

export const deploy = async (options: DeployOptions) => {
  const run = new LaunchedNetwork();
  await deployFunction(options, run);
};

export const deployPreActionHook = (
  thisCmd: Command<
    [],
    {
      environment: DeployEnvironment;
      datahavenImageTag: string;
      kurtosisEnclaveName: string;
      kurtosisNetworkArgs?: string;
      verified?: boolean;
      blockscout?: boolean;
      relayerImageTag: string;
    }
  >
) => {
  const opts = thisCmd.opts();
  if (opts.verified && !opts.blockscout) {
    thisCmd.error("--verified requires --blockscout to be set");
  }
};
