// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use sp_std::prelude::*;
use ssz_rs::{Bitvector, Deserialize};

pub fn decompress_sync_committee_bits<
	const SYNC_COMMITTEE_SIZE: usize,
	const SYNC_COMMITTEE_BITS_SIZE: usize,
>(
	input: [u8; SYNC_COMMITTEE_BITS_SIZE],
) -> [u8; SYNC_COMMITTEE_SIZE] {
	Bitvector::<{ SYNC_COMMITTEE_SIZE }>::deserialize(&input)
		.expect("checked statically; qed")
		.iter()
		.map(|bit| u8::from(bit == true))
		.collect::<Vec<u8>>()
		.try_into()
		.expect("checked statically; qed")
}
