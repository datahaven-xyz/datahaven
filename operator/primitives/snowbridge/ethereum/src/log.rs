// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use codec::{Decode, Encode};
use ethereum_types::{H160, H256};
use sp_std::prelude::*;

#[derive(Clone, Debug, Encode, Decode, PartialEq, Eq)]
pub struct Log {
	pub address: H160,
	pub topics: Vec<H256>,
	pub data: Vec<u8>,
}

impl rlp::Decodable for Log {
	/// We need to implement rlp::Decodable manually as the derive macro RlpDecodable
	/// didn't seem to generate the correct code for parsing our logs.
	fn decode(rlp: &rlp::Rlp) -> Result<Self, rlp::DecoderError> {
		let mut iter = rlp.iter();

		let address: H160 = match iter.next() {
			Some(data) => data.as_val()?,
			None => return Err(rlp::DecoderError::Custom("Expected log address")),
		};

		let topics: Vec<H256> = match iter.next() {
			Some(data) => data.as_list()?,
			None => return Err(rlp::DecoderError::Custom("Expected log topics")),
		};

		let data: Vec<u8> = match iter.next() {
			Some(data) => data.data()?.to_vec(),
			None => return Err(rlp::DecoderError::Custom("Expected log data")),
		};

		Ok(Self { address, topics, data })
	}
}

#[cfg(test)]
mod tests {

	use super::Log;
	use hex_literal::hex;

	const RAW_LOG: [u8; 605] = hex!(
		"
		f9025a941cfd66659d44cfe2e627c5742ba7477a3284cffae1a0266413be5700ce8dd5ac6b9a7dfb
		abe99b3e45cae9a68ac2757858710b401a38b9022000000000000000000000000000000000000000
		00000000000000000000000060000000000000000000000000000000000000000000000000000000
		00000000c00000000000000000000000000000000000000000000000000000000000000100000000
		00000000000000000000000000000000000000000000000000000000283163466436363635394434
		34636665324536323763353734324261373437376133323834634666410000000000000000000000
		00000000000000000000000000000000000000000000000000000000000000000000000000000000
		000000000773656e6445544800000000000000000000000000000000000000000000000000000000
		00000000000000000000000000000000000000000000000000000001000000000000000000000000
		00cffeaaf7681c89285d65cfbe808b80e50269657300000000000000000000000000000000000000
		000000000000000000000000a0000000000000000000000000000000000000000000000000000000
		0000000000000000000000000000000000000000000000000000000000000000000000000a000000
		00000000000000000000000000000000000000000000000000000000020000000000000000000000
		00000000000000000000000000000000000000002f3146524d4d3850456957585961783772705336
		5834585a5831614141785357783143724b5479725659685632346667000000000000000000000000
		0000000000
	"
	);

	#[test]
	fn decode_log() {
		let log: Log = rlp::decode(&RAW_LOG).unwrap();
		assert_eq!(log.address.as_bytes(), hex!["1cfd66659d44cfe2e627c5742ba7477a3284cffa"]);
		assert_eq!(
			log.topics[0].as_bytes(),
			hex!["266413be5700ce8dd5ac6b9a7dfbabe99b3e45cae9a68ac2757858710b401a38"]
		);
	}
}
