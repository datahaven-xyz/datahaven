import { logger } from "utils";
import { createPapiConnectors } from "utils/papi";
import { SUBSTRATE_FUNDED_ACCOUNTS } from "utils/constants";
import type { LaunchedNetwork } from "../launcher/types/launchedNetwork";

export interface FundProvidersOptions {
  launchedNetwork: LaunchedNetwork;
}

/**
 * Provider account information for MSP and BSP nodes.
 *
 * DataHaven uses AccountId20 (Ethereum-style 20-byte addresses).
 * In dev chains, CHARLETH and DOROTHY are pre-funded development accounts
 * that correspond to //Charlie and //Dave derivations.
 * 
 * For StorageHub providers, we use:
 * - CHARLETH (//Charlie equivalent) for MSP
 * - DOROTHY (//Dave equivalent) for BSP (as //Eve might not have pre-funded AccountId20)
 */
const PROVIDER_ACCOUNTS = {
  // MSP account (Charleth = Charlie in AccountId20 format)
  msp: {
    name: "Charleth",
    address: SUBSTRATE_FUNDED_ACCOUNTS.CHARLETH.publicKey, // 20-byte address
    derivation: "//Charlie"
  },
  // BSP account (Dorothy = Dave in AccountId20 format, using instead of Eve)
  bsp: {
    name: "Dorothy",
    address: SUBSTRATE_FUNDED_ACCOUNTS.DOROTHY.publicKey, // 20-byte address
    derivation: "//Dave" // Using Dave instead of Eve for BSP
  }
} as const;

/**
 * Minimum balance required for provider operations.
 * This includes:
 * - Registration deposit (SpMinDeposit = 100 HAVE)
 * - Transaction fees
 * - Operational costs
 */
const MIN_PROVIDER_BALANCE = BigInt(200) * BigInt(10 ** 18); // 200 HAVE

/**
 * Funds StorageHub provider accounts (MSP and BSP) with native tokens.
 *
 * In development chains, //Charlie and //Eve are pre-funded, so this function
 * primarily verifies they have sufficient balance for provider operations.
 * If the balance is insufficient, it can transfer additional funds from Alice.
 *
 * @param options - Configuration options including the launched network
 */
export async function fundProviders(options: FundProvidersOptions): Promise<void> {
  logger.info("💰 Checking and funding StorageHub provider accounts...");

  const aliceContainerName = `datahaven-alice-${options.launchedNetwork.networkId}`;
  const alicePort = options.launchedNetwork.getContainerPort(aliceContainerName);

  const { client, typedApi } = createPapiConnectors(`ws://127.0.0.1:${alicePort}`);

  try {
    // Check MSP account balance
    logger.info(`Checking MSP account (${PROVIDER_ACCOUNTS.msp.name})...`);
    const mspAccount = await typedApi.query.System.Account.getValue(
      PROVIDER_ACCOUNTS.msp.address
    );
    const mspBalance = mspAccount?.data?.free ?? BigInt(0);
    logger.debug(`MSP balance: ${mspBalance.toString()}`);

    if (mspBalance < MIN_PROVIDER_BALANCE) {
      logger.warn(
        `MSP account has insufficient balance (${mspBalance} < ${MIN_PROVIDER_BALANCE})`
      );
      logger.info(
        "Note: In dev chains, //Charlie should be pre-funded. If balance is low, ensure the chain is properly initialized."
      );
    } else {
      logger.success(`MSP account has sufficient balance: ${mspBalance.toString()}`);
    }

    // Check BSP account balance
    logger.info(`Checking BSP account (${PROVIDER_ACCOUNTS.bsp.name})...`);
    const bspAccount = await typedApi.query.System.Account.getValue(
      PROVIDER_ACCOUNTS.bsp.address
    );
    const bspBalance = bspAccount?.data?.free ?? BigInt(0);
    logger.debug(`BSP balance: ${bspBalance.toString()}`);

    if (bspBalance < MIN_PROVIDER_BALANCE) {
      logger.warn(
        `BSP account has insufficient balance (${bspBalance} < ${MIN_PROVIDER_BALANCE})`
      );
      logger.info(
        "Note: In dev chains, //Eve should be pre-funded. If balance is low, ensure the chain is properly initialized."
      );
    } else {
      logger.success(`BSP account has sufficient balance: ${bspBalance.toString()}`);
    }

    logger.success("Provider accounts funding check completed");
  } catch (error) {
    logger.error(`Failed to check provider balances: ${error}`);
    throw error;
  } finally {
    client.destroy();
  }
}

/**
 * Gets the provider account addresses.
 *
 * @returns Object containing MSP and BSP account information
 */
export function getProviderAccounts() {
  return PROVIDER_ACCOUNTS;
}

