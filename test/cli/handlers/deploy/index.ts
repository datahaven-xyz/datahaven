import type { Command } from "node_modules/@commander-js/extra-typings";
import { type DeployEnvironment, logger } from "utils";
import { createParameterCollection } from "utils/parameters";
import { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";
import { checkBaseDependencies, deploymentChecks } from "../common/checks";
import { cleanup } from "./cleanup";
import { deployContracts } from "../../../launcher/contracts";
import { deployDataHavenSolochain } from "./datahaven";
import { deployKurtosis } from "./kurtosis";
import { setParametersFromCollection } from "./parameters";
import { deployRelayers } from "./relayer";
import { performValidatorOperations } from "./validator";

// Non-optional properties determined by having default values
export interface DeployOptions {
  environment: DeployEnvironment;
  isPrivateNetwork?: boolean;
  kubeNamespace?: string;
  kurtosisEnclaveName: string;
  slotTime: number;
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
  skipCleanup: boolean;
  skipKurtosis: boolean;
  skipDatahavenSolochain: boolean;
  skipContracts: boolean;
  skipValidatorOperations: boolean;
  skipSetParameters: boolean;
  skipRelayers: boolean;
}

const deployFunction = async (options: DeployOptions, launchedNetwork: LaunchedNetwork) => {
  logger.debug("Running with options:");
  logger.debug(options);

  const timeStart = performance.now();

  await checkBaseDependencies();
  await deploymentChecks(options, launchedNetwork);

  await cleanup(options, launchedNetwork);

  // Create parameter collection to be used throughout the launch process
  const parameterCollection = await createParameterCollection();

  await deployKurtosis(options, launchedNetwork);

  // Inside the deployDataHavenSolochain function, it will forward the port from the validator to the local machine.
  // This is to allow the rest of the script to interact with the network.
  // The cleanup function is returned to allow the script to clean up the port forwarding.
  const validatorPortForwardCleanup = await deployDataHavenSolochain(options, launchedNetwork);

  // TODO: Handle Blockscout and verifier parameters to verify contracts if that is the intention.
  const blockscoutBackendUrl = undefined;

  await deployContracts({
    rpcUrl: launchedNetwork.elRpcUrl,
    verified: options.verified,
    blockscoutBackendUrl,
    parameterCollection,
    // skipContracts: options.skipContracts
  });

  await performValidatorOperations(options, launchedNetwork.elRpcUrl);

  await setParametersFromCollection({
    collection: parameterCollection,
    skipSetParameters: options.skipSetParameters
  });

  await deployRelayers(options, launchedNetwork);

  // Cleaning up the port forwarding for the validator.
  await validatorPortForwardCleanup();

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

  opts.isPrivateNetwork = opts.environment === "local" || opts.environment === "stagenet";

  if (opts.isPrivateNetwork && opts.kubeNamespace !== undefined) {
    logger.warn(
      "⚠️ --kube-namespace is not allowed in private networks (local and stagenet). The Kurtosis namespace will be used instead."
    );
  }

  if (!opts.isPrivateNetwork && opts.elRpcUrl === undefined) {
    thisCmd.error("--eth-rpc-url is required in public networks (testnet and mainnet)");
  }
};
