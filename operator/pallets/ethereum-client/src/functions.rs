// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use crate::config::{
	EPOCHS_PER_SYNC_COMMITTEE_PERIOD, SLOTS_PER_EPOCH, SYNC_COMMITTEE_BITS_SIZE,
	SYNC_COMMITTEE_SIZE,
};

/// Decompress packed bitvector into byte vector according to SSZ deserialization rules. Each byte
/// in the decompressed vector is either 0 or 1.
pub fn decompress_sync_committee_bits(
	input: [u8; SYNC_COMMITTEE_BITS_SIZE],
) -> [u8; SYNC_COMMITTEE_SIZE] {
	snowbridge_beacon_primitives::decompress_sync_committee_bits::<
		SYNC_COMMITTEE_SIZE,
		SYNC_COMMITTEE_BITS_SIZE,
	>(input)
}

/// Compute the sync committee period in which a slot is contained.
pub fn compute_period(slot: u64) -> u64 {
	slot / SLOTS_PER_EPOCH as u64 / EPOCHS_PER_SYNC_COMMITTEE_PERIOD as u64
}

/// Compute epoch in which a slot is contained.
pub fn compute_epoch(slot: u64, slots_per_epoch: u64) -> u64 {
	slot / slots_per_epoch
}

/// Sums the bit vector of sync committee participation.
pub fn sync_committee_sum(sync_committee_bits: &[u8]) -> u32 {
	sync_committee_bits.iter().fold(0, |acc: u32, x| acc + *x as u32)
}
