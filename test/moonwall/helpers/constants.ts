/**
 * Runtime constants for DataHaven networks
 * Adapted from Moonbeam test helpers
 */

import type { GenericContext } from "@moonwall/cli";

// DataHaven genesis balance constants
// From operator/runtime/stagenet/src/genesis_config_presets.rs:
// Each endowed account receives: 1u128 << 80
// No locks or reserves are set at genesis
export const ALITH_GENESIS_FREE_BALANCE = 1n << 80n; // 1208925819614629174706176n
export const ALITH_GENESIS_LOCK_BALANCE = 0n;
export const ALITH_GENESIS_RESERVE_BALANCE = 0n;

export const ALITH_GENESIS_TRANSFERABLE_COUNT =
  ALITH_GENESIS_FREE_BALANCE + ALITH_GENESIS_RESERVE_BALANCE - ALITH_GENESIS_LOCK_BALANCE;
export const ALITH_GENESIS_TRANSFERABLE_BALANCE =
  ALITH_GENESIS_FREE_BALANCE > ALITH_GENESIS_TRANSFERABLE_COUNT
    ? ALITH_GENESIS_TRANSFERABLE_COUNT
    : ALITH_GENESIS_FREE_BALANCE;

class RuntimeConstant<T> {
  private readonly values: Map<number, T>;

  constructor(valuesByVersion: Record<number, T>) {
    this.values = new Map(Object.entries(valuesByVersion).map(([k, v]) => [Number(k), v]));
  }

  get(version: number): T {
    const sortedVersions = Array.from(this.values.keys()).sort((a, b) => b - a);
    for (const v of sortedVersions) {
      if (version >= v) {
        return this.values.get(v)!;
      }
    }
    return this.values.get(0)!;
  }
}

// Currency units for DataHaven stagenet
// These match the runtime configuration in operator/runtime/stagenet/src/lib.rs
export const HAVE = 1_000_000_000_000_000_000n; // 10^18
export const MICROHAVE = 1_000_000_000_000n; // 10^12
export const SUPPLY_FACTOR = 1n;
export const STORAGE_BYTE_FEE = 100n * MICROHAVE * SUPPLY_FACTOR; // 100_000_000_000_000n

/**
 * Calculate deposit cost matching the runtime's deposit() function
 * deposit(items, bytes) = items * HAVE * SUPPLY_FACTOR + bytes * STORAGE_BYTE_FEE
 */
export function deposit(items: number, bytes: number): bigint {
  return BigInt(items) * HAVE * SUPPLY_FACTOR + BigInt(bytes) * STORAGE_BYTE_FEE;
}

// Identity pallet deposit constants (stagenet)
// Calculated from: operator/runtime/stagenet/src/configs/mod.rs
export const IDENTITY_BASIC_DEPOSIT = deposit(1, 258); // 1_025_800_000_000_000_000n
export const IDENTITY_BYTE_DEPOSIT = deposit(0, 1); // 100_000_000_000_000n
export const IDENTITY_SUB_ACCOUNT_DEPOSIT = deposit(1, 53); // 1_005_300_000_000_000_000n

const DATAHAVEN_CONSTANTS = {
  BLOCK_WEIGHT_LIMIT: new RuntimeConstant({
    0: 2_000_000_000_000n
  }),
  GAS_LIMIT: new RuntimeConstant({
    0: 60_000_000n
  }),
  EXTRINSIC_GAS_LIMIT: new RuntimeConstant({
    0: 52_000_000n
  }),
  GENESIS_BASE_FEE: new RuntimeConstant({
    0: 312_500_000n
  }),
  WEIGHT_TO_GAS_RATIO: 25_000n,
  STORAGE_READ_COST: 25_000_000n,
  STORAGE_WRITE_COST: 50_000_000n,
  SUPPLY_FACTOR: 1n,
  PRECOMPILE_ADDRESSES: {
    BATCH: "0x0000000000000000000000000000000000000808" as const,
    CALL_PERMIT: "0x000000000000000000000000000000000000080a" as const,
    PROXY: "0x000000000000000000000000000000000000080b" as const,
    ERC20_BALANCES: "0x0000000000000000000000000000000000000802" as const,
    PRECOMPILE_REGISTRY: "0x0000000000000000000000000000000000000815" as const,
    IDENTITY: "0x0000000000000000000000000000000000000818" as const
  }
} as const;

type ConstantStoreType = typeof DATAHAVEN_CONSTANTS;

export function ConstantStore(_context: GenericContext): ConstantStoreType {
  return DATAHAVEN_CONSTANTS;
}

export { RuntimeConstant };
