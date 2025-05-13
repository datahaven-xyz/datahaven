import type { FixedSizeArray, FixedSizeBinary } from "polkadot-api";

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
