import { updateValidatorSet } from "scripts/update-validator-set";
import { confirmWithTimeout, logger, printDivider } from "utils";
import type { LaunchOptions } from "..";

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
  options: LaunchOptions,
  networkRpcUrl: string,
  contractsDeployed: boolean
) => {
  // If not specified, prompt for update
  let shouldUpdateValidatorSet = options.updateValidatorSet;
  if (shouldUpdateValidatorSet === undefined) {
    shouldUpdateValidatorSet = await confirmWithTimeout(
      "Do you want to update the validator set on the substrate chain?",
      true,
      10
    );
  } else {
    logger.info(
      `🏳️ Using flag option: ${shouldUpdateValidatorSet ? "will update" : "will not update"} validator set`
    );
  }

  if (shouldUpdateValidatorSet) {
    if (!contractsDeployed) {
      logger.warn(
        "⚠️ Updating validator set but contracts were not deployed in this CLI run. Could have unexpected results."
      );
    }

    await updateValidatorSet({
      rpcUrl: networkRpcUrl
    });
  } else {
    logger.debug("Skipping validator set update");
    printDivider();
  }
};
