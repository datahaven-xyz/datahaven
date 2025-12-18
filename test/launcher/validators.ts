import { fundValidators as fundValidatorsScript } from "scripts/fund-validators";
import { setupValidators as setupValidatorsScript } from "scripts/setup-validators";
import { updateValidatorSet as updateValidatorSetScript } from "scripts/update-validator-set";
import { ANVIL_FUNDED_ACCOUNTS, logger } from "utils";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Configuration options for validator operations.
 */
export interface ValidatorOptions {
  rpcUrl: string;
}


/**
 * Funds validators with tokens and ETH.
 *
 * This function ensures validators have the necessary funds to operate by:
 * - Sending ETH for gas fees
 * - Sending required tokens for staking
 * - Verifying balances after funding
 *
 * @param options - Configuration options for funding
 * @param options.rpcUrl - The RPC URL of the Ethereum network
 *
 * @throws {Error} If funding transactions fail
 * @throws {Error} If the network is unreachable
 */
export const fundValidators = async (options: ValidatorOptions): Promise<void> => {
  logger.info("💰 Funding validators with tokens and ETH...");

  await fundValidatorsScript({
    rpcUrl: options.rpcUrl
  });
};

/**
 * Registers validators in the EigenLayer protocol.
 *
 * This function handles the validator registration process:
 * - Creates operator registrations in EigenLayer
 * - Registers operators with the AVS (Actively Validated Service)
 * - Sets up delegation relationships
 * - Configures operator metadata
 *
 * @param options - Configuration options for setup
 * @param options.rpcUrl - The RPC URL of the Ethereum network
 *
 * @throws {Error} If registration transactions fail
 * @throws {Error} If validators are already registered
 * @throws {Error} If required contracts are not deployed
 */
export const setupValidators = async (options: ValidatorOptions): Promise<void> => {
  logger.info("📝 Registering validators in EigenLayer...");

  await setupValidatorsScript({
    rpcUrl: options.rpcUrl
  });
};

/**
 * Updates the validator set on the Substrate chain.
 *
 * This function synchronizes the validator set between Ethereum and Substrate:
 * - Fetches the current validator set from EigenLayer
 * - Prepares validator set update transaction
 * - Submits the update through the bridge
 * - Waits for confirmation on the Substrate side
 *
 * @param options - Configuration options for the update
 * @param options.rpcUrl - The RPC URL of the Ethereum network
 *
 * @throws {Error} If the update transaction fails
 * @throws {Error} If the bridge is not initialized
 * @throws {Error} If validators are not properly registered
 */
export const updateValidatorSet = async (options: ValidatorOptions): Promise<void> => {
  logger.info("🔄 Updating validator set on Substrate chain...");

  await updateValidatorSetScript({
    rpcUrl: options.rpcUrl
  });
};

/**
 * Gets the owner account for validator operations.
 */
export function getOwnerAccount() {
  return privateKeyToAccount(ANVIL_FUNDED_ACCOUNTS[6].privateKey as `0x${string}`);
}

