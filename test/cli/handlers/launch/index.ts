import type { Command } from "@commander-js/extra-typings";
import { deployContracts } from "scripts/deploy-contracts";
import { launchKurtosis } from "scripts/launch-kurtosis";
import sendTxn from "scripts/send-txn";
import invariant from "tiny-invariant";
import {
  ANVIL_FUNDED_ACCOUNTS,
  getPortFromKurtosis,
  logger,
  printDivider,
  printHeader
} from "utils";
import { checkDependencies } from "./checks";
import { performDatahavenOperations } from "./datahaven";
import { LaunchedNetwork } from "./launchedNetwork";
import { performRelayerOperations } from "./relayer";
import { performSummaryOperations } from "./summary";
import { performValidatorOperations } from "./validator";

export interface LaunchOptions {
  verified?: boolean;
  launchKurtosis?: boolean;
  deployContracts?: boolean;
  fundValidators?: boolean;
  setupValidators?: boolean;
  updateValidatorSet?: boolean;
  blockscout?: boolean;
  relayer?: boolean;
  relayerBinPath?: string;
  skipCleaning?: boolean;
  datahavenBinPath?: string;
  datahaven?: boolean;
}

export const BASE_SERVICES = [
  "cl-1-lighthouse-reth",
  "cl-1-lighthouse-reth",
  "el-1-reth-lighthouse",
  "el-2-reth-lighthouse",
  "dora"
];

// =====  Launch Handler Functions  =====

const launchFunction = async (options: LaunchOptions, launchedNetwork: LaunchedNetwork) => {
  logger.debug("Running with options:");
  logger.debug(options);

  const timeStart = performance.now();

  printHeader("Environment Checks");

  await checkDependencies();

  logger.trace("Launching Kurtosis enclave");
  await launchKurtosis({
    launchKurtosis: options.launchKurtosis,
    blockscout: options.blockscout,
    skipCleaning: options.skipCleaning
  });
  logger.trace("Kurtosis enclave launched");

  logger.trace("Send test transaction");
  printHeader("Setting Up Blockchain");
  logger.debug(`Using account ${ANVIL_FUNDED_ACCOUNTS[1].publicKey}`);
  const privateKey = ANVIL_FUNDED_ACCOUNTS[1].privateKey;
  const rethPublicPort = await getPortFromKurtosis("el-1-reth-lighthouse", "rpc");
  const networkRpcUrl = `http://127.0.0.1:${rethPublicPort}`;
  invariant(networkRpcUrl, "❌ Network RPC URL not found");

  logger.info("💸 Sending test transaction...");
  await sendTxn(privateKey, networkRpcUrl);

  printDivider();

  logger.trace("Show completion information");
  const timeEnd = performance.now();
  const minutes = ((timeEnd - timeStart) / (1000 * 60)).toFixed(1);

  logger.success(`Kurtosis network started successfully in ${minutes} minutes`);

  logger.trace("Deploy contracts using the extracted function");
  let blockscoutBackendUrl: string | undefined = undefined;

  if (options.blockscout === true) {
    const blockscoutPublicPort = await getPortFromKurtosis("blockscout", "http");
    blockscoutBackendUrl = `http://127.0.0.1:${blockscoutPublicPort}`;
  } else if (options.verified) {
    logger.warn(
      "⚠️ Contract verification (--verified) requested, but Blockscout is disabled (--no-blockscout). Verification will be skipped."
    );
  }

  const contractsDeployed = await deployContracts({
    rpcUrl: networkRpcUrl,
    verified: options.verified,
    blockscoutBackendUrl,
    deployContracts: options.deployContracts
  });

  if (contractsDeployed) {
    await performValidatorOperations(options, networkRpcUrl);
  } else if (options.setupValidators || options.fundValidators) {
    logger.warn(
      "⚠️ Validator operations requested but contracts were not deployed. Skipping validator operations."
    );
  }
  if (options.datahaven) {
    await performDatahavenOperations(options, launchedNetwork);
  }

  if (options.relayer) {
    await performRelayerOperations(options, launchedNetwork);
  }

  printDivider();

  performSummaryOperations(options, launchedNetwork);
  logger.debug("Launch function completed successfully");
};

export const launch = async (options: LaunchOptions) => {
  const run = new LaunchedNetwork();
  try {
    await launchFunction(options, run);
    logger.success("Launch script completed successfully");
  } finally {
    await run.cleanup();
  }
};

export const launchPreActionHook = (
  thisCmd: Command<[], LaunchOptions & { [key: string]: any }>
) => {
  const {
    blockscout,
    verified,
    fundValidators,
    setupValidators,
    updateValidatorSet,
    deployContracts
  } = thisCmd.opts();
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
