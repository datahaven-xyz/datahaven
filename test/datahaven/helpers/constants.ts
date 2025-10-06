/**
 * Runtime constants for DataHaven networks
 * Adapted from Moonbeam test helpers
 */

import type { GenericContext } from "@moonwall/cli";

/**
 * Helper class for runtime constants that may vary by runtime version
 */
class RuntimeConstant<T> {
  private values: Map<number, T>;
  
  constructor(valuesByVersion: Record<number, T>) {
    this.values = new Map(Object.entries(valuesByVersion).map(([k, v]) => [Number(k), v]));
  }
  
  get(version: number): T {
    // Find the highest version <= the requested version
    const sortedVersions = Array.from(this.values.keys()).sort((a, b) => b - a);
    for (const v of sortedVersions) {
      if (version >= v) {
        return this.values.get(v)!;
      }
    }
    // Fallback to version 0
    return this.values.get(0)!;
  }
}

/**
 * DataHaven runtime constants
 * 
 * These values are based on DataHaven's runtime configuration.
 * Update these values if runtime parameters change.
 */
const DATAHAVEN_CONSTANTS = {
  // Network identifiers
  CHAIN_ID: 3151908n,
  
  // Block production
  BLOCK_TIME: 12_000n, // 12 seconds in milliseconds
  SLOT_DURATION: 12_000n, // 12 seconds
  
  // Weight and gas limits
  // DataHaven uses similar values to Substrate defaults
  BLOCK_WEIGHT_LIMIT: new RuntimeConstant({
    0: 2_000_000_000_000n, // 2 * 10^12 weight units
  }),
  
  // Gas limit considering block utilization
  // Based on weight-to-gas conversion and block limits
  GAS_LIMIT: new RuntimeConstant({
    0: 30_000_000n, // Conservative estimate
  }),
  
  // Maximum extrinsic gas limit
  EXTRINSIC_GAS_LIMIT: new RuntimeConstant({
    0: 26_000_000n,
  }),
  
  // Gas per PoV (Proof of Validity) byte ratio
  GAS_PER_POV_BYTES: new RuntimeConstant({
    0: 16n,
  }),
  
  // Maximum PoV size for one ethereum transaction
  MAX_ETH_POV_PER_TX: new RuntimeConstant({
    0: 1_625_000n, // EXTRINSIC_GAS_LIMIT / GAS_PER_POV_BYTES
  }),
  
  // Storage costs (in weight units)
  STORAGE_READ_COST: 25_000_000n, // Approximate substrate storage read weight
  STORAGE_WRITE_COST: 100_000_000n, // Approximate substrate storage write weight
  
  // Weight to gas conversion ratio
  // This is the critical factor for converting substrate weights to EVM gas
  WEIGHT_TO_GAS_RATIO: 25_000n, // 1 gas = 25,000 weight units
  
  // Supply factors (for financial calculations)
  SUPPLY_FACTOR: 1n,
  
  // Precompile addresses
  PRECOMPILE_ADDRESSES: {
    BATCH: "0x0000000000000000000000000000000000000808" as const,
    CALL_PERMIT: "0x000000000000000000000000000000000000080a" as const,
    PROXY: "0x000000000000000000000000000000000000080b" as const,
    ERC20_BALANCES: "0x0000000000000000000000000000000000000802" as const,
    PRECOMPILE_REGISTRY: "0x0000000000000000000000000000000000000815" as const,
  },
} as const;

type ConstantStoreType = typeof DATAHAVEN_CONSTANTS;

/**
 * Get runtime constants for the current DataHaven context
 * 
 * This function returns appropriate constants based on the runtime version.
 * Currently, DataHaven has a single runtime configuration, but this structure
 * allows for version-specific constants in the future.
 * 
 * @param context - Moonwall context
 * @returns Runtime constants object
 * 
 * @example
 * ```ts
 * const constants = ConstantStore(context);
 * const gasLimit = constants.GAS_LIMIT.get(specVersion);
 * const storageReadCost = constants.STORAGE_READ_COST;
 * ```
 */
export function ConstantStore(context: GenericContext): ConstantStoreType {
  // For now, DataHaven has a unified runtime
  // In the future, this could check context.polkadotJs().consts.system.version.specName
  // and return different constant sets
  return DATAHAVEN_CONSTANTS;
}

/**
 * Helper to get storage read cost in gas units
 * 
 * @param context - Moonwall context
 * @returns Storage read cost in gas
 */
export function getStorageReadGasCost(context: GenericContext): bigint {
  const constants = ConstantStore(context);
  return constants.STORAGE_READ_COST / constants.WEIGHT_TO_GAS_RATIO;
}

/**
 * Helper to get storage write cost in gas units
 * 
 * @param context - Moonwall context
 * @returns Storage write cost in gas
 */
export function getStorageWriteGasCost(context: GenericContext): bigint {
  const constants = ConstantStore(context);
  return constants.STORAGE_WRITE_COST / constants.WEIGHT_TO_GAS_RATIO;
}

export { RuntimeConstant };
