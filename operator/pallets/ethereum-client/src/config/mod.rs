// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use static_assertions::const_assert;

pub mod altair;
pub mod electra;

/// Sizes related to SSZ encoding
pub const MAX_EXTRA_DATA_BYTES: usize = 32;
pub const MAX_LOGS_BLOOM_SIZE: usize = 256;
pub const MAX_FEE_RECIPIENT_SIZE: usize = 20;

/// Sanity value to constrain the max size of a merkle branch proof.
pub const MAX_BRANCH_PROOF_SIZE: usize = 20;

/// DomainType('0x07000000')
/// <https://github.com/ethereum/consensus-specs/blob/dev/specs/altair/beacon-chain.md#domain-types>
pub const DOMAIN_SYNC_COMMITTEE: [u8; 4] = [7, 0, 0, 0];
/// Validators public keys are 48 bytes.
pub const PUBKEY_SIZE: usize = 48;
/// Signatures produced by validators are 96 bytes.
pub const SIGNATURE_SIZE: usize = 96;

// Sanity check for the sync committee bits (see SYNC_COMMITTEE_BITS_SIZE).
const_assert!(SYNC_COMMITTEE_BITS_SIZE == SYNC_COMMITTEE_SIZE / 8);

/// Defined in <https://github.com/ethereum/consensus-specs/tree/f1dff5f6768608d890fc0b347e548297fc3e1f1c/presets/mainnet>
/// There are 32 slots in an epoch. An epoch is 6.4 minutes long.
pub const SLOTS_PER_EPOCH: usize = 32;
/// 256 epochs in a sync committee period. Frequency of sync committee (subset of Ethereum
/// validators) change is every ~27 hours.
pub const EPOCHS_PER_SYNC_COMMITTEE_PERIOD: usize = 256;
/// A sync committee contains 512 randomly selected validators.
pub const SYNC_COMMITTEE_SIZE: usize = 512;
/// An array of sync committee block votes, one bit representing the vote of one validator.
pub const SYNC_COMMITTEE_BITS_SIZE: usize = SYNC_COMMITTEE_SIZE / 8;
/// The size of the block root array in the beacon state, used for ancestry proofs.
pub const SLOTS_PER_HISTORICAL_ROOT: usize = 8192;
/// The index of the block_roots field in the beacon state tree.
pub const BLOCK_ROOT_AT_INDEX_DEPTH: usize = 13;
