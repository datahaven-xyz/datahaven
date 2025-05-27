import { type FixedSizeArray, FixedSizeBinary } from "polkadot-api";
import { z } from "zod";

/**
 * The type of the response from the `/eth/v1/beacon/states/head/finality_checkpoints`
 * RPC method from the Beacon Chain.
 */
export interface FinalityCheckpointsResponse {
  execution_optimistic: boolean;
  finalized: boolean;
  data: {
    previous_justified: {
      epoch: string;
      root: string;
    };
    current_justified: {
      epoch: string;
      root: string;
    };
    finalized: {
      epoch: string;
      root: string;
    };
  };
}

/**
 * The type of the argument of the `force_checkpoint` extrinsic from the Ethereum
 * Beacon Client pallet.
 *
 * Represents the structure of the BeaconCheckpoint as it should be after type
 * coercions (e.g., to BigInt).
 */
export interface BeaconCheckpoint {
  header: {
    slot: bigint;
    proposer_index: bigint;
    parent_root: FixedSizeBinary<32>;
    state_root: FixedSizeBinary<32>;
    body_root: FixedSizeBinary<32>;
  };
  current_sync_committee: {
    pubkeys: FixedSizeArray<512, FixedSizeBinary<48>>;
    aggregate_pubkey: FixedSizeBinary<48>;
  };
  current_sync_committee_branch: FixedSizeBinary<32>[];
  validators_root: FixedSizeBinary<32>;
  block_roots_root: FixedSizeBinary<32>;
  block_roots_branch: FixedSizeBinary<32>[];
  toJSON: () => JsonBeaconCheckpoint;
}

/**
 * Represents the structure of a BeaconCheckpoint when serialized to JSON.
 * BigInts are converted to strings, and FixedSizeBinary types are converted to hex strings.
 */
interface JsonBeaconCheckpoint {
  header: {
    slot: string;
    proposer_index: string;
    parent_root: string;
    state_root: string;
    body_root: string;
  };
  current_sync_committee: {
    pubkeys: string[];
    aggregate_pubkey: string;
  };
  current_sync_committee_branch: string[];
  validators_root: string;
  block_roots_root: string;
  block_roots_branch: string[];
}

// Zod schema for hex strings, ensuring they start with "0x" if not empty
const hexStringSchema = z.union([
  z.string().regex(/^0x[0-9a-fA-F]*$/, {
    message: "Invalid hex string"
  }),
  z.literal("")
]);

// Zod schema for the RawBeaconCheckpoint structure
const rawBeaconCheckpointSchema = z.object({
  header: z.object({
    slot: z.union([z.number(), z.string(), z.bigint()]),
    proposer_index: z.union([z.number(), z.string(), z.bigint()]),
    parent_root: hexStringSchema,
    state_root: hexStringSchema,
    body_root: hexStringSchema
  }),
  current_sync_committee: z.object({
    pubkeys: z.array(hexStringSchema).length(512),
    aggregate_pubkey: hexStringSchema
  }),
  current_sync_committee_branch: z.array(hexStringSchema),
  validators_root: hexStringSchema,
  block_roots_root: hexStringSchema,
  block_roots_branch: z.array(hexStringSchema)
});

// Zod schema for transforming RawBeaconCheckpoint to BeaconCheckpoint
const beaconCheckpointSchema = rawBeaconCheckpointSchema.transform((raw) => {
  const checkpointData: Omit<BeaconCheckpoint, "toJSON"> = {
    header: {
      slot: BigInt(raw.header.slot),
      proposer_index: BigInt(raw.header.proposer_index),
      parent_root: new FixedSizeBinary<32>(hexToUint8Array(raw.header.parent_root)),
      state_root: new FixedSizeBinary<32>(hexToUint8Array(raw.header.state_root)),
      body_root: new FixedSizeBinary<32>(hexToUint8Array(raw.header.body_root))
    },
    current_sync_committee: {
      pubkeys: asFixedSizeArray(
        raw.current_sync_committee.pubkeys.map(
          (pk) => new FixedSizeBinary<48>(hexToUint8Array(pk))
        ),
        512
      ),
      aggregate_pubkey: new FixedSizeBinary<48>(
        hexToUint8Array(raw.current_sync_committee.aggregate_pubkey)
      )
    },
    current_sync_committee_branch: raw.current_sync_committee_branch.map(
      (branch) => new FixedSizeBinary<32>(hexToUint8Array(branch))
    ),
    validators_root: new FixedSizeBinary<32>(hexToUint8Array(raw.validators_root)),
    block_roots_root: new FixedSizeBinary<32>(hexToUint8Array(raw.block_roots_root)),
    block_roots_branch: raw.block_roots_branch.map(
      (branch) => new FixedSizeBinary<32>(hexToUint8Array(branch))
    )
  };

  return {
    ...checkpointData,
    toJSON: function (this: BeaconCheckpoint): JsonBeaconCheckpoint {
      return {
        header: {
          slot: this.header.slot.toString(),
          proposer_index: this.header.proposer_index.toString(),
          parent_root: this.header.parent_root.asHex(),
          state_root: this.header.state_root.asHex(),
          body_root: this.header.body_root.asHex()
        },
        current_sync_committee: {
          pubkeys: this.current_sync_committee.pubkeys.map((pk) => pk.asHex()),
          aggregate_pubkey: this.current_sync_committee.aggregate_pubkey.asHex()
        },
        current_sync_committee_branch: this.current_sync_committee_branch.map((branch) =>
          branch.asHex()
        ),
        validators_root: this.validators_root.asHex(),
        block_roots_root: this.block_roots_root.asHex(),
        block_roots_branch: this.block_roots_branch.map((branch) => branch.asHex())
      };
    }
  };
});

/**
 * Parses a JSON object into a BeaconCheckpoint.
 *
 * @param jsonInput - The JSON object to parse.
 * @returns The parsed BeaconCheckpoint.
 */
export const parseJsonToBeaconCheckpoint = (jsonInput: any): BeaconCheckpoint => {
  try {
    return beaconCheckpointSchema.parse(jsonInput);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // You can customize error handling here, e.g., throw a more specific error
      // or log the validation issues.
      throw new Error(
        `Invalid JSON structure for BeaconCheckpoint: ${error.errors
          .map((e) => `${e.path.join(".")} - ${e.message}`)
          .join(", ")}`
      );
    }
    // Re-throw other errors
    throw error;
  }
};

/**
 * The key of the DataHaven runtime parameter.
 * This is an union type with all the possible parameter keys. For now, our only parameter is
 * the EthereumGatewayAddress.
 */
export type DataHavenRuntimeParameterKey = "EthereumGatewayAddress";

/**
 * Interface for raw JSON parameters before conversion
 */
export interface RawJsonParameter {
  name: DataHavenRuntimeParameterKey;
  value: string | null | undefined;
}

/**
 * Schema for raw EthereumGatewayAddress parameter
 */
const rawEthereumGatewayAddressSchema = z.object({
  name: z.literal("EthereumGatewayAddress"),
  value: hexStringSchema.nullable().optional()
});

/**
 * Union schema for raw DataHaven parameters (for parsing JSON)
 */
export const rawDataHavenParameterSchema = z.discriminatedUnion("name", [
  rawEthereumGatewayAddressSchema
]);

/**
 * Schema for an array of raw DataHaven parameters
 */
export const rawDataHavenParametersArraySchema = z.array(rawDataHavenParameterSchema);

/**
 * The parsed type of a DataHaven runtime parameter.
 */
export interface ParsedDataHavenParameter {
  name: DataHavenRuntimeParameterKey;
  value: any;
}

/**
 * Converts a parsed raw parameter to its typed version
 */
function convertParameter(rawParam: any): ParsedDataHavenParameter {
  if (rawParam.name === "EthereumGatewayAddress" && rawParam.value) {
    return {
      name: rawParam.name,
      value: new FixedSizeBinary<20>(hexToUint8Array(rawParam.value))
    };
  }

  // For other parameter types, add conversion logic here
  return rawParam;
}

/**
 * Parses and converts a JSON object into a typed DataHaven parameter.
 *
 * @param jsonInput - The JSON parameter object to parse.
 * @returns The parsed and converted parameter.
 */
export const parseJsonToParameter = (jsonInput: any): ParsedDataHavenParameter => {
  try {
    // First validate the raw structure
    const rawParam = rawDataHavenParameterSchema.parse(jsonInput);
    // Then convert to typed version
    return convertParameter(rawParam);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid JSON structure for DataHaven parameter: ${error.errors
          .map((e) => `${e.path.join(".")} - ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
};

/**
 * Parses and converts an array of JSON parameters into typed DataHaven parameters.
 *
 * @param jsonInput - Array of JSON parameter objects to parse.
 * @returns Array of parsed and converted parameters.
 */
export const parseJsonToParameters = (jsonInput: any[]): ParsedDataHavenParameter[] => {
  try {
    // First validate the raw structure of all parameters
    const rawParams = rawDataHavenParametersArraySchema.parse(jsonInput);
    // Then convert each parameter to its typed version
    return rawParams.map(convertParameter);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid JSON structure for DataHaven parameters array: ${error.errors
          .map((e) => `${e.path.join(".")} - ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
};

/**
 * Converts an array to a FixedSizeArray of the specified length.
 * Throws an error if the array length does not match the expected length.
 *
 * @param arr - The array to convert.
 * @param expectedLength - The expected length of the FixedSizeArray.
 * @returns The array as a FixedSizeArray of the specified length.
 */
export const asFixedSizeArray = <T, L extends number>(
  arr: T[],
  expectedLength: L
): FixedSizeArray<L, T> => {
  if (arr.length !== expectedLength) {
    throw new Error(`Array length mismatch. Expected ${expectedLength}, got ${arr.length}.`);
  }
  return arr as FixedSizeArray<L, T>;
};

/**
 * Converts a hex string to a Uint8Array.
 *
 * @param hex - The hex string to convert.
 * @returns The Uint8Array representation of the hex string.
 */
const hexToUint8Array = (hex: string): Uint8Array => {
  let hexString = hex;
  if (hexString.startsWith("0x")) {
    hexString = hexString.slice(2);
  }
  if (hexString.length % 2 !== 0) {
    throw new Error("Hex string must have an even number of characters");
  }
  return Buffer.from(hexString, "hex");
};

// This squashes together the properties of the input type T
// making it easier to view in an IDE
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
