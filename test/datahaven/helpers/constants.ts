/**
 * Runtime constants for DataHaven networks
 * Adapted from Moonbeam test helpers
 */

import type { GenericContext } from "@moonwall/cli";

/**
 * Class allowing to store multiple values for a runtime constant based on the runtime version
 */
class RuntimeConstant<T> {
  private values: { [version: number]: T };

  constructor(values: { [version: number]: T } | T) {
    if (values instanceof Object) {
      this.values = values;
    } else {
      this.values = { 0: values };
    }
  }

  get(runtimeVersion: number): T {
    const versions = Object.keys(this.values).map(Number);
    let value: T | undefined;
    for (let i = 0; i < versions.length; i++) {
      if (versions[i] > runtimeVersion) {
        break;
      }
      value = this.values[versions[i]];
    }
    return value as T;
  }
}

const DATAHAVEN_CONSTANTS = {
  GAS_LIMIT: new RuntimeConstant(60_000_000n),
  EXTRINSIC_GAS_LIMIT: new RuntimeConstant(52_000_000n),
  BLOCK_WEIGHT_LIMIT: new RuntimeConstant(2_000_000_000_000n),
  MAX_POV_SIZE: new RuntimeConstant(10_485_760n),
  STORAGE_READ_COST: 25_000_000n,
  WEIGHT_TO_GAS_RATIO: 25_000n,
} as const;

type ConstantStoreType = typeof DATAHAVEN_CONSTANTS;

export function ConstantStore(_context: GenericContext): ConstantStoreType {
  return DATAHAVEN_CONSTANTS;
}

export { RuntimeConstant };

