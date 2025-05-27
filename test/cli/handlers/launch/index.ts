import type { Command } from "@commander-js/extra-typings";
import { getPortFromKurtosis, logger } from "utils";
import { createParameterCollection } from "utils/parameters";
import { checkBaseDependencies } from "../common/checks";
import { LaunchedNetwork } from "../common/launchedNetwork";
import { deployContracts } from "./contracts";
import { launchDataHavenSolochain } from "./datahaven";
import { launchKurtosis } from "./kurtosis";
import { setParametersFromCollection } from "./parameters";
import { launchRelayers } from "./relayer";
import { performSummaryOperations } from "./summary";
import { performValidatorOperations } from "./validator";

// Non-optional properties should have default values set by the CLI
export interface LaunchOptions {
  datahaven?: boolean;
  buildDatahaven?: boolean;
  datahavenBuildExtraArgs: string;
  datahavenImageTag: string;
  launchKurtosis?: boolean;
  kurtosisEnclaveName: string;
  slotTime?: number;
  kurtosisNetworkArgs?: string;
  verified?: boolean;
  blockscout?: boolean;
  deployContracts?: boolean;
  fundValidators?: boolean;
  setupValidators?: boolean;
  updateValidatorSet?: boolean;
  setParameters?: boolean;
  relayer?: boolean;
  relayerImageTag: string;
  cleanNetwork?: boolean;
}

// =====  Launch Handler Functions  =====

const launchFunction = async (options: LaunchOptions, launchedNetwork: LaunchedNetwork) => {
  logger.debug("Running with options:");
  logger.debug(options);

  const timeStart = performance.now();

  await checkBaseDependencies();

  // Create parameter collection to be used throughout the launch process
  const parameterCollection = await createParameterCollection();

  await launchDataHavenSolochain(options, launchedNetwork);

  await launchKurtosis(options, launchedNetwork);

  logger.trace("Checking if Blockscout is enabled...");
  let blockscoutBackendUrl: string | undefined;

  if (options.blockscout === true) {
    const blockscoutPublicPort = await getPortFromKurtosis(
      "blockscout",
      "http",
      options.kurtosisEnclaveName
    );
    blockscoutBackendUrl = `http://127.0.0.1:${blockscoutPublicPort}`;
    logger.trace("Blockscout backend URL:", blockscoutBackendUrl);
  } else if (options.verified) {
    logger.warn(
      "⚠️ Contract verification (--verified) requested, but Blockscout is disabled (--no-blockscout). Verification will be skipped."
    );
  }

  const contractsDeployed = await deployContracts({
    rpcUrl: launchedNetwork.elRpcUrl,
    verified: options.verified,
    blockscoutBackendUrl,
    deployContracts: options.deployContracts,
    parameterCollection
  });

  await performValidatorOperations(options, launchedNetwork.elRpcUrl, contractsDeployed);

  const dhRpcUrl = `ws://127.0.0.1:${launchedNetwork.getPublicWsPort()}`;
  await setParametersFromCollection({
    rpcUrl: dhRpcUrl,
    collection: parameterCollection,
    setParameters: options.setParameters
  });

  await launchRelayers(options, launchedNetwork);

  await performSummaryOperations(options, launchedNetwork);
  const fullEnd = performance.now();
  const fullMinutes = ((fullEnd - timeStart) / (1000 * 60)).toFixed(1);
  logger.success(`Launch function completed successfully in ${fullMinutes} minutes`);
};

export const launch = async (options: LaunchOptions) => {
  const run = new LaunchedNetwork();
  await launchFunction(options, run);
};

export const launchPreActionHook = (
  thisCmd: Command<[], LaunchOptions & { [key: string]: any }>
) => {
  const { blockscout, verified, fundValidators, setupValidators, deployContracts } = thisCmd.opts();
  if (verified && !blockscout) {
    thisCmd.error("--verified requires --blockscout to be set");
  }
  if (deployContracts === false && setupValidators) {
    thisCmd.error("--setupValidators requires --deployContracts to be set");
  }
  if (deployContracts === false && fundValidators) {
    thisCmd.error("--fundValidators requires --deployContracts to be set");
  }
};
