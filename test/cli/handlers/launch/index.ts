import type { Command } from "@commander-js/extra-typings";
import { deployContracts } from "scripts/deploy-contracts";
import { getPortFromKurtosis, logger } from "utils";
import { checkDependencies } from "./checks";
import { launchDataHavenSolochain } from "./datahaven";
import { launchKurtosis } from "./kurtosis";
import { LaunchedNetwork } from "./launchedNetwork";
import { launchRelayers } from "./relayer";
import { performSummaryOperations } from "./summary";
import { performValidatorOperations } from "./validator";
import { performValidatorSetUpdate } from "./validator";

// Non-optional properties determined by having default values
export interface LaunchOptions {
  verified?: boolean;
  launchKurtosis?: boolean;
  deployContracts?: boolean;
  fundValidators?: boolean;
  setupValidators?: boolean;
  updateValidatorSet?: boolean;
  kurtosisEnclaveName: string;
  blockscout?: boolean;
  relayer?: boolean;
  relayerImageTag: string;
  cleanNetwork?: boolean;
  datahaven?: boolean;
  buildDatahaven?: boolean;
  datahavenImageTag: string;
  datahavenBuildExtraArgs: string;
  kurtosisNetworkArgs?: string;
  // Kept as optional due to parse fn
  slotTime?: number;
}

export const BASE_SERVICES = [
  "cl-1-lighthouse-reth",
  "cl-2-lighthouse-reth",
  "el-1-reth-lighthouse",
  "el-2-reth-lighthouse",
  "dora"
];

// =====  Launch Handler Functions  =====

const launchFunction = async (options: LaunchOptions, launchedNetwork: LaunchedNetwork) => {
  logger.debug("Running with options:");
  logger.debug(options);

  const timeStart = performance.now();

  await checkDependencies();

  await launchDataHavenSolochain(options, launchedNetwork);

  await launchKurtosis(launchedNetwork, options);

  logger.trace("Deploy contracts using the extracted function");
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
    deployContracts: options.deployContracts
  });

  await performValidatorOperations(options, launchedNetwork.elRpcUrl, contractsDeployed);

  await launchRelayers(options, launchedNetwork);

  // After relayers are set up, update the validator set so the execution relayer can pick up the message
  await performValidatorSetUpdate(options, launchedNetwork.elRpcUrl, contractsDeployed);

  await performSummaryOperations(options, launchedNetwork);
  const fullEnd = performance.now();
  const fullMinutes = ((fullEnd - timeStart) / (1000 * 60)).toFixed(1);
  logger.success(`Launch function completed successfully in ${fullMinutes} minutes`);
};

export const launch = async (options: LaunchOptions) => {
  const run = new LaunchedNetwork();
  try {
    await launchFunction(options, run);
  } finally {
    await run.cleanup();
  }
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
