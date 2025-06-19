import { logger } from "utils";
import { fundValidators } from "./fund";
import { setupValidators } from "./setup";
import type { ValidatorsLaunchOptions, ValidatorsLaunchResult } from "./types";
import { updateValidatorSet } from "./update-set";

export const launchValidators = async (
  options: ValidatorsLaunchOptions
): Promise<ValidatorsLaunchResult> => {
  try {
    // Fund validators
    const fundResult = await fundValidatorsStep(options.rpcUrl);
    if (!fundResult.success) {
      return fundResult;
    }

    // Setup validators in EigenLayer
    const setupResult = await setupValidatorsStep(options.rpcUrl);
    if (!setupResult.success) {
      return setupResult;
    }

    // Update validator set
    const updateResult = await updateValidatorSetStep(options.rpcUrl);
    return updateResult;
  } catch (error) {
    logger.error("Failed in validator operations", error);
    return {
      success: false,
      error: error as Error
    };
  }
}

export const fundValidatorsStep = async (rpcUrl: string): Promise<ValidatorsLaunchResult> => {
  try {
    logger.info("💰 Funding validators with tokens and ETH...");
    await fundValidators({ rpcUrl });
    logger.success("Validators funded successfully");
    return { success: true };
  } catch (error) {
    logger.error("Failed to fund validators", error);
    return {
      success: false,
      error: error as Error
    };
  }
}

export const setupValidatorsStep = async (rpcUrl: string): Promise<ValidatorsLaunchResult> => {
  try {
    logger.info("📝 Registering validators in EigenLayer...");
    await setupValidators({ rpcUrl });
    logger.success("Validators registered successfully");
    return { success: true };
  } catch (error) {
    logger.error("Failed to setup validators", error);
    return {
      success: false,
      error: error as Error
    };
  }
}

export const updateValidatorSetStep = async (rpcUrl: string): Promise<ValidatorsLaunchResult> => {
  try {
    logger.info("🔄 Updating validator set on DataHaven...");
    await updateValidatorSet({ rpcUrl });
    logger.success("Validator set updated successfully");
    return { success: true };
  } catch (error) {
    logger.error("Failed to update validator set", error);
    return {
      success: false,
      error: error as Error
    };
  }
}
