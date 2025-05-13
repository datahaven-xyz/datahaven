import { type FixedSizeArray, FixedSizeBinary } from "polkadot-api";
import { hexToUint8Array } from "./hex";
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
}

// Represents the structure of the BeaconCheckpoint as it might be after JSON.parse
// before specific type coercions (e.g., to BigInt).
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

  return {
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
