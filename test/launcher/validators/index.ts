import { fundValidators } from "scripts/fund-validators";
import { setupValidators } from "scripts/setup-validators";
import { updateValidatorSet } from "scripts/update-validator-set";
import { logger } from "utils";
import type { LaunchResult, NetworkLaunchOptions } from "../types";

export class ValidatorsLauncher {
  private options: NetworkLaunchOptions;

  constructor(options: NetworkLaunchOptions) {
    this.options = options;
  }

  async fundValidators(rpcUrl: string): Promise<LaunchResult> {
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

  async setupValidators(rpcUrl: string): Promise<LaunchResult> {
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

  async updateValidatorSet(rpcUrl: string): Promise<LaunchResult> {
    try {
      logger.info("🔄 Updating validator set...");
      
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
}