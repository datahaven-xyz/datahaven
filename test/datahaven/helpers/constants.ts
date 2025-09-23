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
export const RUNTIME_CONSTANTS = {
  "DATAHAVEN-STAGENET": {
    GAS_LIMIT: new RuntimeConstant(60_000_000n)
  },
  "DATAHAVEN-MAINNET": {
    GAS_LIMIT: new RuntimeConstant(60_000_000n)
  },
  "DATAHAVEN-TESTNET": {
    GAS_LIMIT: new RuntimeConstant(60_000_000n)
  }
};

type ConstantStoreType = (typeof RUNTIME_CONSTANTS)["DATAHAVEN-STAGENET"];

export function ConstantStore(context: GenericContext): ConstantStoreType {
  const runtime = context.polkadotJs().consts.system.version.specName.toUpperCase();
  console.log("runtime", runtime);
  return RUNTIME_CONSTANTS[runtime];
}
