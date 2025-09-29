import { confirmWithTimeout, logger, printDivider, printHeader } from "utils";
import { fundValidators, setupValidators, updateValidatorSet } from "../../../launcher/validators";
import type { LaunchOptions } from "..";

export const performValidatorOperations = async (
  options: LaunchOptions,
  networkRpcUrl: string,
  contractsDeployed: boolean
) => {
  printHeader("Funding DataHaven Validators");

  // If not specified, prompt for funding
  let shouldFundValidators = options.fundValidators;
  if (shouldFundValidators === undefined) {
    shouldFundValidators = await confirmWithTimeout(
      "Do you want to fund validators with tokens and ETH?",
      true,
      10
    );
  } else {
    logger.info(
      `🏳️ Using flag option: ${shouldFundValidators ? "will fund" : "will not fund"} validators`
    );
  }

  if (shouldFundValidators) {
    if (!contractsDeployed) {
      logger.warn(
        "⚠️ Funding validators but contracts were not deployed in this CLI run. Could have unexpected results."
      );
    }

    await fundValidators({ rpcUrl: networkRpcUrl });
    printDivider();
  } else {
    logger.info("👍 Skipping validator funding");
    printDivider();
  }

  printHeader("Setting Up DataHaven Validators");

  // If not specified, prompt for setup
  let shouldSetupValidators = options.setupValidators;
  if (shouldSetupValidators === undefined) {
    shouldSetupValidators = await confirmWithTimeout(
      "Do you want to register validators in EigenLayer?",
      true,
      10
    );
  } else {
    logger.info(
      `🏳️ Using flag option: ${shouldSetupValidators ? "will register" : "will not register"} validators`
    );
  }

  if (shouldSetupValidators) {
    if (!contractsDeployed) {
      logger.warn(
        "⚠️ Setting up validators but contracts were not deployed in this CLI run. Could have unexpected results."
      );
    }

    await setupValidators({ rpcUrl: networkRpcUrl });
    printDivider();
  }
};

/**
 * Performs the validator set update operation based on user options
 * This function is now separate so it can be called after relayers are set up
 *
 * @param options - CLI options for the validator set update
 * @param networkRpcUrl - RPC URL for the Ethereum network
 * @param contractsDeployed - Flag indicating if contracts were deployed in this CLI run
 * @returns Promise resolving when the operation is complete
 */
export const performValidatorSetUpdate = async (
  networkRpcUrl: string,
  contractsDeployed: boolean
) => {
  printHeader("Updating DataHaven Validator Set");

    if (!contractsDeployed) {
      logger.warn(
        "⚠️ Updating validator set but contracts were not deployed in this CLI run. Could have unexpected results."
      );
    }

    await updateValidatorSet({ rpcUrl: networkRpcUrl });
    printDivider();
};
