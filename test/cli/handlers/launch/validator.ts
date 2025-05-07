import { fundValidators } from "scripts/fund-validators";
import { setupValidators } from "scripts/setup-validators";
import { updateValidatorSet } from "scripts/update-validator-set";
import { confirmWithTimeout, logger, printDivider, printHeader } from "utils";
import type { LaunchOptions } from "..";

export const performValidatorOperations = async (options: LaunchOptions, networkRpcUrl: string) => {
  let shouldFundValidators = options.fundValidators;
  let shouldSetupValidators = options.setupValidators;
  let shouldUpdateValidatorSet = options.updateValidatorSet;

  // If not specified, prompt for funding
  if (shouldFundValidators === undefined) {
    shouldFundValidators = await confirmWithTimeout(
      "Do you want to fund validators with tokens and ETH?",
      true,
      10
    );
  } else {
    logger.info(
      `Using flag option: ${shouldFundValidators ? "will fund" : "will not fund"} validators`
    );
  }

  // If not specified, prompt for setup
  if (shouldSetupValidators === undefined) {
    shouldSetupValidators = await confirmWithTimeout(
      "Do you want to register validators in EigenLayer?",
      true,
      10
    );
  } else {
    logger.info(
      `Using flag option: ${shouldSetupValidators ? "will register" : "will not register"} validators`
    );
  }

  // If not specified, prompt for update
  if (shouldUpdateValidatorSet === undefined) {
    shouldUpdateValidatorSet = await confirmWithTimeout(
      "Do you want to update the validator set on the substrate chain?",
      true,
      10
    );
  } else {
    logger.info(
      `Using flag option: ${shouldUpdateValidatorSet ? "will update" : "will not update"} validator set`
    );
  }

  if (shouldFundValidators) {
    await fundValidators({
      rpcUrl: networkRpcUrl
    });
  } else {
    logger.debug("Skipping validator funding");
  }

  if (shouldSetupValidators) {
    await setupValidators({
      rpcUrl: networkRpcUrl
    });

    if (shouldUpdateValidatorSet) {
      await updateValidatorSet({
        rpcUrl: networkRpcUrl
      });
    } else {
      logger.debug("Skipping validator set update");
    }
  } else {
    logger.debug("Skipping validator setup");
  }
};
