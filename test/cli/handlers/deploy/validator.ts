import { fundValidators } from "scripts/fund-validators";
import { setupValidators } from "scripts/setup-validators";
import { updateValidatorSet } from "scripts/update-validator-set";
import { logger, printDivider } from "utils";
import type { DeployOptions } from "..";

export const performValidatorOperations = async (options: DeployOptions, networkRpcUrl: string) => {
  // If not specified, prompt for funding
  const shouldFundValidators = options.environment === "staging";

  if (shouldFundValidators) {
    await fundValidators({
      rpcUrl: networkRpcUrl
    });
  } else {
    logger.info("👍 Skipping validator funding");
    printDivider();
  }

  await setupValidators({
    rpcUrl: networkRpcUrl
  });

  await updateValidatorSet({
    rpcUrl: networkRpcUrl
  });
};
