// constants.ts -  Any common values here should be moved to moonwall if suitable

import type { GenericContext } from "@moonwall/cli";
import {
  ALITH_GENESIS_FREE_BALANCE,
  ALITH_GENESIS_LOCK_BALANCE,
  ALITH_GENESIS_RESERVE_BALANCE,
} from "@moonwall/util";

const KILOWEI = 1_000n;

/**
 * Class allowing to store multiple value for a runtime constant based on the runtime version
 */
class RuntimeConstant<T> {
  private values: { [version: number]: T };

  /*
   * Get the expected value for a given runtime version. Lookup for the closest smaller runtime
   */
  get(runtimeVersion: number): T {
    const versions = Object.keys(this.values).map(Number); // slow but easier to maintain
    let value;
    for (let i = 0; i < versions.length; i++) {
      if (versions[i] > runtimeVersion) {
        break;
      }
      value = this.values[versions[i]];
    }
    return value;
  }

  // Builds RuntimeConstant with single or multiple values
  constructor(values: { [version: number]: T } | T) {
    if (values instanceof Object) {
      this.values = values;
    } else {
      this.values = { 0: values };
    }
  }
}

export const ALITH_GENESIS_TRANSFERABLE_COUNT =
  ALITH_GENESIS_FREE_BALANCE + ALITH_GENESIS_RESERVE_BALANCE - ALITH_GENESIS_LOCK_BALANCE;
export const ALITH_GENESIS_TRANSFERABLE_BALANCE =
  ALITH_GENESIS_FREE_BALANCE > ALITH_GENESIS_TRANSFERABLE_COUNT
    ? ALITH_GENESIS_TRANSFERABLE_COUNT
    : ALITH_GENESIS_FREE_BALANCE;

const DATAHAVEN_CONSTANTS = {
  SUPPLY_FACTOR: 1n,
};

type DatahavenRuntimeKey = "DATAHAVEN-TESTNET" | "DATAHAVEN-STAGENET" | "DATAHAVEN-MAINNET";

// Fees and gas limits — align with runtime configuration in `operator/runtime/*/src/configs`.
export const RUNTIME_CONSTANTS: Record<DatahavenRuntimeKey, Record<string, RuntimeConstant<bigint> | bigint>> = {
  "DATAHAVEN-TESTNET": {
    ...DATAHAVEN_CONSTANTS,
    GENESIS_FEE_MULTIPLIER: 8_000_000_000_000_000_000n,
    MIN_FEE_MULTIPLIER: 100_000_000_000_000_000n,
    MAX_FEE_MULTIPLIER: 100_000_000_000_000_000_000_000n,
    WEIGHT_FEE: new RuntimeConstant({
      0: 50n * KILOWEI * DATAHAVEN_CONSTANTS.SUPPLY_FACTOR,
    }),

    GENESIS_BASE_FEE: new RuntimeConstant(10_000_000_000n),
    // (MinimumMultiplier = 0.1) * WEIGHT_FEE * WEIGHT_PER_GAS
    MIN_BASE_FEE: new RuntimeConstant(125_000_000n),
    // (MaximumMultiplier = 100_000) * WEIGHT_FEE * WEIGHT_PER_GAS
    MAX_BASE_FEE: new RuntimeConstant(12_500_000_000_000n),

    TARGET_FILL_PERMILL: new RuntimeConstant(250_000n),
    DEADLINE_MILISECONDS: new RuntimeConstant(500n),
    // 2 seconds of weight
    BLOCK_WEIGHT_LIMIT: new RuntimeConstant(2_000_000_000_000n),
    // Gas limit considering the block utilization threshold (75%)
    GAS_LIMIT: new RuntimeConstant(60_000_000n),
    // Maximum extrinsic weight is taken from the max allowed transaction weight per block (75%),
    // minus the block initialization (10%) and minus the extrinsic base cost.
    EXTRINSIC_GAS_LIMIT: new RuntimeConstant(52_000_000n),
    GAS_PER_POV_BYTES: new RuntimeConstant(16n),
    MAX_ETH_POV_PER_TX: new RuntimeConstant(3_250_000n),
    STORAGE_READ_COST: 59_217_000n,
    WEIGHT_TO_GAS_RATIO: 25_000n,
    SUPPLY_FACTOR: DATAHAVEN_CONSTANTS.SUPPLY_FACTOR,
  },
  "DATAHAVEN-STAGENET": {
    ...DATAHAVEN_CONSTANTS,
    GENESIS_FEE_MULTIPLIER: 8_000_000_000_000_000_000n,
    MIN_FEE_MULTIPLIER: 100_000_000_000_000_000n,
    MAX_FEE_MULTIPLIER: 100_000_000_000_000_000_000_000n,
    WEIGHT_FEE: new RuntimeConstant(50n * KILOWEI * DATAHAVEN_CONSTANTS.SUPPLY_FACTOR),
    GENESIS_BASE_FEE: new RuntimeConstant(10_000_000_000n),
    MIN_BASE_FEE: new RuntimeConstant(125_000_000n),
    MAX_BASE_FEE: new RuntimeConstant(12_500_000_000_000n),
    TARGET_FILL_PERMILL: new RuntimeConstant(250_000n),
    DEADLINE_MILISECONDS: new RuntimeConstant(500n),
    BLOCK_WEIGHT_LIMIT: new RuntimeConstant(2_000_000_000_000n),
    GAS_LIMIT: new RuntimeConstant(60_000_000n),
    EXTRINSIC_GAS_LIMIT: new RuntimeConstant(52_000_000n),
    GAS_PER_POV_BYTES: new RuntimeConstant(16n),
    MAX_ETH_POV_PER_TX: new RuntimeConstant(3_250_000n),
    STORAGE_READ_COST: 59_217_000n,
    WEIGHT_TO_GAS_RATIO: 25_000n,
    SUPPLY_FACTOR: DATAHAVEN_CONSTANTS.SUPPLY_FACTOR,
  },
  "DATAHAVEN-MAINNET": {
    ...DATAHAVEN_CONSTANTS,
    GENESIS_FEE_MULTIPLIER: 8_000_000_000_000_000_000n,
    MIN_FEE_MULTIPLIER: 100_000_000_000_000_000n,
    MAX_FEE_MULTIPLIER: 100_000_000_000_000_000_000_000n,
    WEIGHT_FEE: new RuntimeConstant(50n * KILOWEI * DATAHAVEN_CONSTANTS.SUPPLY_FACTOR),
    GENESIS_BASE_FEE: new RuntimeConstant(10_000_000_000n),
    MIN_BASE_FEE: new RuntimeConstant(125_000_000n),
    MAX_BASE_FEE: new RuntimeConstant(12_500_000_000_000n),
    TARGET_FILL_PERMILL: new RuntimeConstant(250_000n),
    DEADLINE_MILISECONDS: new RuntimeConstant(500n),
    BLOCK_WEIGHT_LIMIT: new RuntimeConstant(2_000_000_000_000n),
    GAS_LIMIT: new RuntimeConstant(60_000_000n),
    EXTRINSIC_GAS_LIMIT: new RuntimeConstant(52_000_000n),
    GAS_PER_POV_BYTES: new RuntimeConstant(16n),
    MAX_ETH_POV_PER_TX: new RuntimeConstant(3_250_000n),
    STORAGE_READ_COST: 59_217_000n,
    WEIGHT_TO_GAS_RATIO: 25_000n,
    SUPPLY_FACTOR: DATAHAVEN_CONSTANTS.SUPPLY_FACTOR,
  },
} as const;

type ConstantStoreType = (typeof RUNTIME_CONSTANTS)[DatahavenRuntimeKey];

export function ConstantStore(context: GenericContext): ConstantStoreType {
  const runtime = context.polkadotJs().consts.system.version.specName.toUpperCase();
  const key = runtime as DatahavenRuntimeKey;
  if (!(key in RUNTIME_CONSTANTS)) {
    throw new Error(`Unsupported runtime spec name for ConstantStore: ${runtime}`);
  }
  return RUNTIME_CONSTANTS[key];
}
