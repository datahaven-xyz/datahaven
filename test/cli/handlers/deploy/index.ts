import type { Command } from "node_modules/@commander-js/extra-typings";
import { type DeployEnvironment, logger } from "utils";
import { createParameterCollection } from "utils/parameters";
import { checkBaseDependencies, checkDeployDependencies } from "../common/checks";
import { LaunchedNetwork } from "../common/launchedNetwork";
import { cleanup } from "./cleanup";
import { deployContracts } from "./contracts";
import { deployDataHavenSolochain } from "./datahaven";
import { deployKurtosis } from "./kurtosis";
import { setParametersFromCollection } from "./parameters";
import { performValidatorOperations } from "./validator";

// Non-optional properties determined by having default values
export interface DeployOptions {
  environment: DeployEnvironment;
  kubeNamespace?: string;
  kurtosisEnclaveName: string;
  slotTime?: number;
  kurtosisNetworkArgs?: string;
  verified?: boolean;
  blockscout?: boolean;
  datahavenImageTag: string;
  elRpcUrl?: string;
  clEndpoint?: string;
  relayerImageTag: string;
  // TODO: This shouldn't be necessary once the repo is public
  dockerUsername?: string;
  // TODO: This shouldn't be necessary once the repo is public
  dockerPassword?: string;
  // TODO: This shouldn't be necessary once the repo is public
  dockerEmail?: string;
}

const deployFunction = async (options: DeployOptions, launchedNetwork: LaunchedNetwork) => {
  logger.debug("Running with options:");
  logger.debug(options);

  const timeStart = performance.now();

  await checkBaseDependencies();
  await checkDeployDependencies(options, launchedNetwork);

  await cleanup(options, launchedNetwork);

  // Create parameter collection to be used throughout the launch process
  const parameterCollection = await createParameterCollection();

  await deployKurtosis(options, launchedNetwork);

  await deployDataHavenSolochain(options, launchedNetwork);

  // TODO: Handle Blockscout and verifier parameters to verify contracts if that is the intention.
  const blockscoutBackendUrl = undefined;

  await deployContracts({
    rpcUrl: launchedNetwork.elRpcUrl,
    verified: options.verified,
    blockscoutBackendUrl,
    parameterCollection
  });

  await performValidatorOperations(options, launchedNetwork.elRpcUrl);

  const dhRpcUrl = `ws://127.0.0.1:${launchedNetwork.getPublicWsPort()}`;
  await setParametersFromCollection({
    rpcUrl: dhRpcUrl,
    collection: parameterCollection
  });

  // TODO: Deploy Snowbridge relayers

  // TODO: Add summary to suggest the user to forward ports and show commands to do so.

  const fullEnd = performance.now();
  const fullMinutes = ((fullEnd - timeStart) / (1000 * 60)).toFixed(1);
  logger.success(`Deploy function completed successfully in ${fullMinutes} minutes`);
};

export const deploy = async (options: DeployOptions) => {
  const run = new LaunchedNetwork();
  await deployFunction(options, run);
};

export const deployPreActionHook = (
  thisCmd: Command<[], DeployOptions & { [key: string]: any }>
) => {
  const opts = thisCmd.opts();
  if (opts.verified && !opts.blockscout) {
    thisCmd.error("--verified requires --blockscout to be set");
  }

  if (opts.environment === "stagenet" && opts.kubeNamespace !== undefined) {
    logger.warn(
      "⚠️ --kube-namespace is not allowed in stagenet environment. The Kurtosis namespace will be used instead."
    );
  }

  if (opts.environment !== "stagenet" && opts.elRpcUrl === undefined) {
    thisCmd.error("--eth-rpc-url is required in non-stagenet environment");
  }
};
