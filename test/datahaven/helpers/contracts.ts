/**
 * Contract-related helper utilities for DataHaven tests
 * Adapted from Moonbeam test helpers
 */

import type { DevModeContext } from "@moonwall/cli";

/**
 * Extract deployed contract addresses from the latest block's events
 * 
 * Searches for Ethereum.Executed events with "Returned" exit reason,
 * indicating successful contract deployment.
 * 
 * @param context - Moonwall dev context
 * @returns Array of deployed contract addresses
 * 
 * @example
 * ```ts
 * const deployed = await deployedContractsInLatestBlock(context);
 * expect(deployed).toContain(myContract.contractAddress);
 * ```
 */
export async function deployedContractsInLatestBlock(context: DevModeContext): Promise<string[]> {
  return (await context.polkadotJs().query.system.events())
    .filter(({ event }) => context.polkadotJs().events.ethereum.Executed.is(event))
    .filter(({ event }) => (event.toHuman() as any)["data"]["exitReason"]["Succeed"] === "Returned")
    .map(({ event }) => (event.toHuman() as any)["data"]["to"]);
}
