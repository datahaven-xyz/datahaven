import {
  allocationManagerAbi,
  dataHavenServiceManagerAbi,
  delegationManagerAbi
} from "contract-bindings";
import type { TestConnectors } from "framework";
import { fundValidators as fundValidatorsScript } from "scripts/fund-validators";
import { setupValidators as setupValidatorsScript } from "scripts/setup-validators";
import { updateValidatorSet as updateValidatorSetScript } from "scripts/update-validator-set";
import { ANVIL_FUNDED_ACCOUNTS, type Deployments, getValidatorInfoByName, logger } from "utils";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Configuration options for validator operations.
 */
export interface ValidatorOptions {
  rpcUrl: string;
}

export interface ValidatorOptionsExt extends ValidatorOptions {
  connectors: TestConnectors;
  deployments: Deployments;
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

/**
 * Registers a single operator in EigenLayer and for operator sets.
 *
 * @param validatorName - The name of the validator to register
 * @param options - Extended validator options including connectors and deployments
 * @throws {Error} If registration transactions fail
 */
export async function registerSingleOperator(
  validatorName: string,
  options: ValidatorOptionsExt
): Promise<void> {
  const { connectors, deployments } = options;
  const validator = getValidatorInfoByName(
    await Bun.file("./configs/validator-set.json").json(),
    validatorName
  );

  logger.info(`🔧 Registering ${validator.publicKey} as operator...`);

  try {
    const operatorHash = await connectors.walletClient.writeContract({
      address: deployments.DelegationManager as `0x${string}`,
      abi: delegationManagerAbi,
      functionName: "registerAsOperator",
      args: [
        "0x0000000000000000000000000000000000000000", // initDelegationApprover (no approver)
        0, // allocationDelay
        "" // metadataURI
      ],
      account: privateKeyToAccount(validator.privateKey as `0x${string}`),
      chain: null
    });

    const operatorReceipt = await connectors.publicClient.waitForTransactionReceipt({
      hash: operatorHash
    });
    if (operatorReceipt.status !== "success") {
      throw new Error(
        `EigenLayer operator registration failed with status: ${operatorReceipt.status}`
      );
    }
    logger.success(`Registered ${validator.publicKey} as EigenLayer operator`);

    logger.info(`🔧 Registering ${validator.publicKey} for operator sets...`);
    const hash = await connectors.walletClient.writeContract({
      address: deployments.AllocationManager as `0x${string}`,
      abi: allocationManagerAbi,
      functionName: "registerForOperatorSets",
      args: [
        validator.publicKey as `0x${string}`,
        {
          avs: deployments.ServiceManager as `0x${string}`,
          operatorSetIds: [0],
          data: validator.solochainAddress as `0x${string}`
        }
      ],
      account: privateKeyToAccount(validator.privateKey as `0x${string}`),
      chain: null
    });

    logger.info(`📝 Transaction hash for operator set registration: ${hash}`);

    const receipt = await connectors.publicClient.waitForTransactionReceipt({ hash });
    logger.info(
      `📋 Operator set registration receipt: status=${receipt.status}, gasUsed=${receipt.gasUsed}`
    );

    if (receipt.status === "success") {
      logger.success(`Registered ${validator.publicKey} for operator sets`);
    }
  } catch (error) {
    logger.warn(`Failed to register ${validator.publicKey} for operator sets: ${error}`);
    throw error;
  }
}

/**
 * Checks if the service manager has the specified operator.
 *
 * @param validatorName - The name of the validator to check
 * @param options - Extended validator options including connectors and deployments
 * @returns Promise resolving to true if the operator exists
 */
export async function serviceManagerHasOperator(
  validatorName: string,
  options: ValidatorOptionsExt
): Promise<boolean> {
  const { connectors, deployments } = options;
  const validator = getValidatorInfoByName(
    await Bun.file("./configs/validator-set.json").json(),
    validatorName
  );

  const validatorEthAddressToSolochainAddress = await connectors.publicClient.readContract({
    address: deployments.ServiceManager as `0x${string}`,
    abi: dataHavenServiceManagerAbi,
    functionName: "validatorEthAddressToSolochainAddress",
    args: [validator.publicKey as `0x${string}`]
  });

  return (
    validatorEthAddressToSolochainAddress.toLowerCase() === validator.solochainAddress.toLowerCase()
  );
}

/**
 * Adds a validator to the allowlist.
 *
 * @param validatorName - The name of the validator to add
 * @param options - Extended validator options including connectors and deployments
 * @throws {Error} If the allowlist transaction fails
 */
export async function addValidatorToAllowlist(
  validatorName: string,
  options: ValidatorOptionsExt
): Promise<void> {
  const { connectors, deployments } = options;
  const validator = getValidatorInfoByName(
    await Bun.file("./configs/validator-set.json").json(),
    validatorName
  );

  logger.info(`🔧 Adding ${validatorName} (${validator.publicKey}) to allowlist...`);

  try {
    const hash = await connectors.walletClient.writeContract({
      address: deployments.ServiceManager as `0x${string}`,
      abi: dataHavenServiceManagerAbi,
      functionName: "addValidatorToAllowlist",
      args: [validator.publicKey as `0x${string}`],
      account: getOwnerAccount(),
      chain: null
    });

    logger.info(`📝 Transaction hash for allowlist: ${hash}`);

    const receipt = await connectors.publicClient.waitForTransactionReceipt({ hash });
    logger.info(
      `📋 Allowlist transaction receipt: status=${receipt.status}, gasUsed=${receipt.gasUsed}`
    );

    if (receipt.status === "success") {
      logger.success(`Added ${validator.publicKey} to allowlist`);
    } else {
      logger.error(`Failed to add ${validator.publicKey} to allowlist`);
      throw new Error(`Transaction failed with status: ${receipt.status}`);
    }
  } catch (error) {
    logger.error(`Error adding ${validatorName} to allowlist: ${error}`);
    throw error;
  }
}

/**
 * Checks if a validator is in the allowlist.
 *
 * @param validatorName - The name of the validator to check
 * @param options - Extended validator options including connectors and deployments
 * @returns Promise resolving to true if the validator is allowlisted
 */
export async function isValidatorInAllowlist(
  validatorName: string,
  options: ValidatorOptionsExt
): Promise<boolean> {
  const { connectors, deployments } = options;
  const validator = getValidatorInfoByName(
    await Bun.file("./configs/validator-set.json").json(),
    validatorName
  );

  logger.info(`🔍 Checking allowlist status for ${validatorName} (${validator.publicKey})...`);

  const isAllowlisted = await connectors.publicClient.readContract({
    address: deployments.ServiceManager as `0x${string}`,
    abi: dataHavenServiceManagerAbi,
    functionName: "validatorsAllowlist",
    args: [validator.publicKey as `0x${string}`]
  });

  logger.info(`📋 Allowlist status for ${validatorName}: ${isAllowlisted}`);
  return isAllowlisted;
}
