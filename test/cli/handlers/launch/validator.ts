import { fundValidators } from "scripts/fund-validators";
import { setupValidators } from "scripts/setup-validators";
import { confirmWithTimeout, logger, printDivider } from "utils";
import type { LaunchOptions } from "..";

export const performValidatorOperations = async (
  options: LaunchOptions,
  networkRpcUrl: string,
  contractsDeployed: boolean
) => {
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

    await fundValidators({
      rpcUrl: networkRpcUrl
    });
  } else {
    logger.debug("Skipping validator funding");
    printDivider();
  }

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

    await setupValidators({
      rpcUrl: networkRpcUrl
    });
  } else {
    logger.debug("Skipping validator setup");
    printDivider();
  }
};
