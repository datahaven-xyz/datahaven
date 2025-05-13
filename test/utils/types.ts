import { type FixedSizeArray, FixedSizeBinary } from "polkadot-api";

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
 * Represents the structure of the BeaconCheckpoint as it might be after JSON.parse
 * before specific type coercions (e.g., to BigInt).
 */
interface RawBeaconCheckpoint {
  header: {
    slot: number | string | bigint; // JSON.parse will yield number or string for big numbers
    proposer_index: number | string | bigint; // Same as above
    parent_root: string; // Assuming hex string
    state_root: string; // Assuming hex string
    body_root: string; // Assuming hex string
  };
  current_sync_committee: {
    pubkeys: string[]; // Assuming array of hex strings
    aggregate_pubkey: string; // Assuming hex string
  };
  current_sync_committee_branch: string[]; // Assuming array of hex strings
  validators_root: string; // Assuming hex string
  block_roots_root: string; // Assuming hex string
  block_roots_branch: string[]; // Assuming array of hex strings
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

/**
 * Parses a JSON object into a BeaconCheckpoint.
 *
 * @param jsonInput - The JSON object to parse.
 * @returns The parsed BeaconCheckpoint.
 */
export const parseJsonToBeaconCheckpoint = (jsonInput: any): BeaconCheckpoint => {
  const raw = jsonInput as RawBeaconCheckpoint;

  // Basic validation
  if (!raw || typeof raw.header !== "object" || raw.header === null) {
    throw new Error("Invalid JSON structure for BeaconCheckpoint: missing or invalid header");
  }
  if (typeof raw.header.slot === "undefined" || typeof raw.header.proposer_index === "undefined") {
    throw new Error(
      "Invalid JSON structure for BeaconCheckpoint: header missing slot or proposer_index"
    );
  }

  // Map pubkeys to FixedSizeBinary<48>
  const pubkeys = new Array<FixedSizeBinary<48>>(512);
  for (let i = 0; i < raw.current_sync_committee.pubkeys.length; i++) {
    pubkeys[i] = new FixedSizeBinary<48>(hexToUint8Array(raw.current_sync_committee.pubkeys[i]));
  }

  const checkpointData: Omit<BeaconCheckpoint, "toJSON"> = {
    header: {
      slot: BigInt(raw.header.slot),
      proposer_index: BigInt(raw.header.proposer_index),
      parent_root: new FixedSizeBinary<32>(hexToUint8Array(raw.header.parent_root)),
      state_root: new FixedSizeBinary<32>(hexToUint8Array(raw.header.state_root)),
      body_root: new FixedSizeBinary<32>(hexToUint8Array(raw.header.body_root))
    },
    current_sync_committee: {
      pubkeys: asFixedSizeArray(pubkeys, 512),
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
  return Buffer.from(hexString, "hex");
};
