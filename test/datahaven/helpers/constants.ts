import type { GenericContext } from "@moonwall/cli";

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
    let value: T | undefined;
    for (let i = 0; i < versions.length; i++) {
      if (versions[i] > runtimeVersion) {
        break;
      }
      value = this.values[versions[i]];
    }
    return value as T;
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

// Fees and gas limits
// Values derived from Rust runtime configuration in operator/runtime/*/src/lib.rs
export const RUNTIME_CONSTANTS = {
  "DATAHAVEN-STAGENET": {
    GAS_LIMIT: new RuntimeConstant(60_000_000n),
    EXTRINSIC_GAS_LIMIT: new RuntimeConstant(52_000_000n),
    BLOCK_WEIGHT_LIMIT: new RuntimeConstant(2_000_000_000_000n),
    MAX_POV_SIZE: new RuntimeConstant(10_485_760n), // 10MB in bytes (matching Moonbeam)
  },
  "DATAHAVEN-MAINNET": {
    GAS_LIMIT: new RuntimeConstant(60_000_000n),
    EXTRINSIC_GAS_LIMIT: new RuntimeConstant(52_000_000n),
    BLOCK_WEIGHT_LIMIT: new RuntimeConstant(2_000_000_000_000n),
    MAX_POV_SIZE: new RuntimeConstant(10_485_760n), // 10MB in bytes (matching Moonbeam)
  },
  "DATAHAVEN-TESTNET": {
    GAS_LIMIT: new RuntimeConstant(60_000_000n),
    EXTRINSIC_GAS_LIMIT: new RuntimeConstant(52_000_000n),
    BLOCK_WEIGHT_LIMIT: new RuntimeConstant(2_000_000_000_000n),
    MAX_POV_SIZE: new RuntimeConstant(10_485_760n), // 10MB in bytes (matching Moonbeam)
  }
};

type ConstantStoreType = (typeof RUNTIME_CONSTANTS)["DATAHAVEN-STAGENET"];

export function ConstantStore(context: GenericContext): ConstantStoreType {
  const runtime = context.polkadotJs().consts.system.version.specName.toUpperCase();
  console.log("runtime", runtime);
  return RUNTIME_CONSTANTS[runtime];
}
