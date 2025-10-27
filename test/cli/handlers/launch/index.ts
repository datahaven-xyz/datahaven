import type { Command } from "@commander-js/extra-typings";
import { logger } from "utils";
import { DEFAULT_SUBSTRATE_WS_PORT } from "utils/constants";
import { createParameterCollection } from "utils/parameters";
import { getBlockscoutUrl } from "../../../launcher/kurtosis";
import { LaunchedNetwork } from "../../../launcher/types/launchedNetwork";
import { checkBaseDependencies } from "../common/checks";
import { deployContracts } from "./contracts";
import { launchDataHavenSolochain } from "./datahaven";
import { launchKurtosis } from "./kurtosis";
import { setParametersFromCollection } from "./parameters";
import { launchRelayers } from "./relayer";
import { launchStorageHubComponents } from "./storagehub";
import { performSummaryOperations } from "./summary";
import { performValidatorOperations } from "./validator";

export const NETWORK_ID = "cli-launch";

export interface NetworkOptions {
  networkId: string;
  dhInternalPort?: number;
}

export const CLI_NETWORK_OPTIONS: NetworkOptions = {
  networkId: NETWORK_ID,
  dhInternalPort: DEFAULT_SUBSTRATE_WS_PORT
};

// Non-optional properties should have default values set by the CLI
export interface LaunchOptions {
  all?: boolean;
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
  setParameters?: boolean;
  relayer?: boolean;
  relayerImageTag: string;
  storagehub?: boolean;
  cleanNetwork?: boolean;
  injectContracts?: boolean;
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
    blockscoutBackendUrl = await getBlockscoutUrl(options.kurtosisEnclaveName);
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
    parameterCollection,
    injectContracts: options.injectContracts
  });

  // If we're injecting contracts instead of deploying, still read the Gateway address
  if (options.injectContracts && !contractsDeployed) {
    try {
      const { parseDeploymentsFile, parseRewardsInfoFile } = await import("utils/contracts");
      const deployments = await parseDeploymentsFile();
      const gatewayAddress = deployments.Gateway;
      const rewardsRegistryAddress = deployments.RewardsRegistry;
      const rewardsInfo = await parseRewardsInfoFile();
      const rewardsAgentOrigin = rewardsInfo.RewardsAgentOrigin;
      const updateRewardsMerkleRootSelector = rewardsInfo.updateRewardsMerkleRootSelector;

      if (gatewayAddress) {
        logger.debug(
          `📝 Reading EthereumGatewayAddress from existing deployment: ${gatewayAddress}`
        );
        parameterCollection.addParameter({
          name: "EthereumGatewayAddress",
          value: gatewayAddress
        });
      }

      if (rewardsRegistryAddress) {
        logger.debug(`📝 Adding RewardsRegistryAddress parameter: ${rewardsRegistryAddress}`);
        parameterCollection.addParameter({
          name: "RewardsRegistryAddress",
          value: rewardsRegistryAddress
        });
      } else {
        logger.warn("⚠️ RewardsRegistry address not found in deployments file");
      }

      if (updateRewardsMerkleRootSelector) {
        logger.debug(
          `📝 Adding RewardsUpdateSelector parameter: ${updateRewardsMerkleRootSelector}`
        );
        parameterCollection.addParameter({
          name: "RewardsUpdateSelector",
          value: updateRewardsMerkleRootSelector
        });
      } else {
        logger.warn("⚠️ updateRewardsMerkleRootSelector not found in rewards info file");
      }

      if (rewardsAgentOrigin) {
        logger.debug(`📝 Adding RewardsAgentOrigin parameter: ${rewardsAgentOrigin}`);
        parameterCollection.addParameter({
          name: "RewardsAgentOrigin",
          value: rewardsAgentOrigin
        });
      } else {
        logger.warn("⚠️ RewardsAgentOrigin not found in deployments file");
      }
    } catch (error) {
      logger.error(`Failed to read Gateway address from deployments: ${error}`);
    }
  }

  const isDeployed = options.injectContracts || contractsDeployed;

  await performValidatorOperations(options, launchedNetwork.elRpcUrl, isDeployed);

  await setParametersFromCollection({
    launchedNetwork,
    collection: parameterCollection,
    setParameters: options.setParameters
  });

  await launchRelayers(options, launchedNetwork);

  await launchStorageHubComponents(options, launchedNetwork);

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
  const {
    all,
    blockscout,
    verified,
    fundValidators,
    setupValidators,
    deployContracts,
    datahaven,
    buildDatahaven,
    launchKurtosis,
    relayer,
    setParameters,
    injectContracts,
    storagehub
  } = thisCmd.opts();

  // Check for conflicts with --all flag
  if (
    all &&
    (datahaven === false ||
      buildDatahaven === false ||
      launchKurtosis === false ||
      deployContracts === false ||
      fundValidators === false ||
      setupValidators === false ||
      setParameters === false ||
      relayer === false ||
      storagehub === false)
  ) {
    thisCmd.error(
      "--all cannot be used with --no-datahaven, --no-build-datahaven, --no-launch-kurtosis, --no-deploy-contracts, --no-fund-validators, --no-setup-validators, --no-update-validator-set, --no-set-parameters, --no-relayer, or --no-storagehub"
    );
  }

  // If --all is set, enable all components
  if (all) {
    thisCmd.setOptionValue("datahaven", true);
    thisCmd.setOptionValue("buildDatahaven", true);
    thisCmd.setOptionValue("launchKurtosis", true);
    thisCmd.setOptionValue("deployContracts", true);
    thisCmd.setOptionValue("fundValidators", true);
    thisCmd.setOptionValue("setupValidators", true);
    thisCmd.setOptionValue("setParameters", true);
    thisCmd.setOptionValue("relayer", true);
    thisCmd.setOptionValue("storagehub", true);
    thisCmd.setOptionValue("cleanNetwork", true);
  }

  if (verified && !blockscout) {
    thisCmd.error("--verified requires --blockscout to be set");
  }
  if (deployContracts === false && setupValidators) {
    thisCmd.error("--setupValidators requires --deployContracts to be set");
  }
  if (deployContracts === false && fundValidators) {
    thisCmd.error("--fundValidators requires --deployContracts to be set");
  }
  if (injectContracts && !deployContracts && !all) {
    // If we have `--all` argument then `deployContracts` is technically true
    thisCmd.error("--inject-contracts requires --deploy-contracts to be set");
  }


};
