/**
 * Runtime constants for DataHaven networks
 * Adapted from Moonbeam test helpers
 */

import type { GenericContext } from "@moonwall/cli";

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
  WEIGHT_TO_GAS_RATIO: 25_000n,
  STORAGE_READ_COST: 25_000_000n,
  STORAGE_WRITE_COST: 50_000_000n,
  SUPPLY_FACTOR: 1n,
  PRECOMPILE_ADDRESSES: {
    BATCH: "0x0000000000000000000000000000000000000808" as const,
    CALL_PERMIT: "0x000000000000000000000000000000000000080a" as const,
    PROXY: "0x000000000000000000000000000000000000080b" as const,
    ERC20_BALANCES: "0x0000000000000000000000000000000000000802" as const,
    PRECOMPILE_REGISTRY: "0x0000000000000000000000000000000000000815" as const
  }
} as const;

type ConstantStoreType = typeof DATAHAVEN_CONSTANTS;

export function ConstantStore(_context: GenericContext): ConstantStoreType {
  return DATAHAVEN_CONSTANTS;
}

export { RuntimeConstant };
