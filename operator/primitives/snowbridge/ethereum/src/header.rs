// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use codec::{Decode, Encode};
use ethbloom::Bloom as EthBloom;
use hex_literal::hex;
use parity_bytes::Bytes;
use rlp::RlpStream;
use scale_info::TypeInfo;
use sp_io::hashing::keccak_256;
use sp_runtime::RuntimeDebug;
use sp_std::prelude::*;

#[cfg(feature = "std")]
use serde::{Deserialize, Serialize};

#[cfg(feature = "std")]
use serde_big_array::BigArray;

use ethereum_types::{Address, H256, H64, U256};

use crate::{mpt, receipt};

/// Complete block header id.
#[derive(Clone, Copy, Default, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo)]
pub struct HeaderId {
	/// Header number.
	pub number: u64,
	/// Header hash.
	pub hash: H256,
}

const EMPTY_OMMERS_HASH: [u8; 32] =
	hex!("1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347");

/// An Ethereum block header.
#[derive(Clone, Default, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct Header {
	/// Parent block hash.
	pub parent_hash: H256,
	/// Block timestamp.
	pub timestamp: u64,
	/// Block number.
	pub number: u64,
	/// Block author.
	pub author: Address,

	/// Transactions root.
	pub transactions_root: H256,
	/// Block ommers hash.
	pub ommers_hash: H256,
	/// Block extra data.
	pub extra_data: Bytes,

	/// State root.
	pub state_root: H256,
	/// Block receipts root.
	pub receipts_root: H256,
	/// Block bloom.
	pub logs_bloom: Bloom,
	/// Gas used for contracts execution.
	pub gas_used: U256,
	/// Block gas limit.
	pub gas_limit: U256,

	/// Block difficulty.
	pub difficulty: U256,
	/// Vector of post-RLP-encoded fields.
	pub seal: Vec<Bytes>,

	// Base fee per gas (EIP-1559), only in headers from the London hardfork onwards.
	pub base_fee: Option<U256>,
}

impl Header {
	/// Compute hash of this header (keccak of the RLP with seal).
	pub fn compute_hash(&self) -> H256 {
		keccak_256(&self.rlp(true)).into()
	}

	/// Compute hash of the truncated header i.e. excluding seal.
	pub fn compute_partial_hash(&self) -> H256 {
		keccak_256(&self.rlp(false)).into()
	}

	pub fn check_receipt_proof(
		&self,
		proof: &[Vec<u8>],
	) -> Option<Result<receipt::Receipt, rlp::DecoderError>> {
		match self.apply_merkle_proof(proof) {
			Some((root, data)) if root == self.receipts_root => Some(rlp::decode(&data)),
			Some((_, _)) => None,
			None => None,
		}
	}

	pub fn apply_merkle_proof(&self, proof: &[Vec<u8>]) -> Option<(H256, Vec<u8>)> {
		let mut iter = proof.iter().rev();
		let first_bytes = match iter.next() {
			Some(b) => b,
			None => return None,
		};
		let item_to_prove: mpt::ShortNode = rlp::decode(first_bytes).ok()?;

		let final_hash: Option<[u8; 32]> = iter.try_fold(keccak_256(first_bytes), |acc, x| {
			let node: Box<dyn mpt::Node> = x.as_slice().try_into().ok()?;
			if (*node).contains_hash(acc.into()) {
				return Some(keccak_256(x))
			}
			None
		});

		final_hash.map(|hash| (hash.into(), item_to_prove.value))
	}

	pub fn mix_hash(&self) -> Option<H256> {
		let bytes: Bytes = self.decoded_seal_field(0, 32)?;
		let size = bytes.len();
		let mut mix_hash = [0u8; 32];
		for i in 0..size {
			mix_hash[31 - i] = bytes[size - 1 - i];
		}
		Some(mix_hash.into())
	}

	pub fn nonce(&self) -> Option<H64> {
		let bytes: Bytes = self.decoded_seal_field(1, 8)?;
		let size = bytes.len();
		let mut nonce = [0u8; 8];
		for i in 0..size {
			nonce[7 - i] = bytes[size - 1 - i];
		}
		Some(nonce.into())
	}

	pub fn has_ommers(&self) -> bool {
		self.ommers_hash != EMPTY_OMMERS_HASH.into()
	}

	fn decoded_seal_field(&self, index: usize, max_len: usize) -> Option<Bytes> {
		let bytes: Bytes = rlp::decode(self.seal.get(index)?).ok()?;
		if bytes.len() > max_len {
			return None
		}
		Some(bytes)
	}

	/// Returns header RLP with or without seals.
	/// For EIP-1559 baseFee addition refer to:
	/// <https://github.com/openethereum/openethereum/blob/193b25a22d5ff07759c6431129e95235510516f9/crates/ethcore/types/src/header.rs#L341>
	fn rlp(&self, with_seal: bool) -> Bytes {
		let mut s = RlpStream::new();

		let stream_length_without_seal = if self.base_fee.is_some() { 14 } else { 13 };

		if with_seal {
			s.begin_list(stream_length_without_seal + self.seal.len());
		} else {
			s.begin_list(stream_length_without_seal);
		}

		s.append(&self.parent_hash);
		s.append(&self.ommers_hash);
		s.append(&self.author);
		s.append(&self.state_root);
		s.append(&self.transactions_root);
		s.append(&self.receipts_root);
		s.append(&EthBloom::from(self.logs_bloom.0));
		s.append(&self.difficulty);
		s.append(&self.number);
		s.append(&self.gas_limit);
		s.append(&self.gas_used);
		s.append(&self.timestamp);
		s.append(&self.extra_data);

		if with_seal {
			for b in &self.seal {
				s.append_raw(b, 1);
			}
		}

		if let Some(base_fee) = self.base_fee {
			s.append(&base_fee);
		}

		s.out().to_vec()
	}
}

/// Logs bloom.
#[derive(Clone, Debug, Encode, Decode, TypeInfo)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct Bloom(#[cfg_attr(feature = "std", serde(with = "BigArray"))] [u8; 256]);

impl<'a> From<&'a [u8; 256]> for Bloom {
	fn from(buffer: &'a [u8; 256]) -> Bloom {
		Bloom(*buffer)
	}
}

impl PartialEq<Bloom> for Bloom {
	fn eq(&self, other: &Bloom) -> bool {
		self.0.iter().zip(other.0.iter()).all(|(l, r)| l == r)
	}
}

impl Default for Bloom {
	fn default() -> Self {
		Bloom([0; 256])
	}
}

impl rlp::Decodable for Bloom {
	fn decode(rlp: &rlp::Rlp) -> Result<Self, rlp::DecoderError> {
		let v: Vec<u8> = rlp.as_val()?;
		match v.len() {
			256 => {
				let mut bytes = [0u8; 256];
				bytes.copy_from_slice(&v);
				Ok(Self(bytes))
			},
			_ => Err(rlp::DecoderError::Custom("Expected 256 bytes")),
		}
	}
}

#[cfg(test)]
mod tests {

	use super::*;

	#[test]
	fn bloom_decode_rlp() {
		let raw_bloom = hex!(
			"
			b901000420000000000000000000008002000000000001000000000001000000000000000000
			0000000000000000000000000002000000080000000000000000200000000000000000000000
			0000080000002200000000004000100000000000000000000000000000000000000000000000
			0000000000000004000000001000010000000000080000000000400000000000000000000000
			0000080000004000000000020000000000020000000000000000000000000000000000000000
			0000040000000000020000000001000000000000000000000000000010000000020000200000
			10200000000000010000000000000000000000000000000000000010000000
		"
		);
		let expected_bytes = &raw_bloom[3..];
		let bloom: Bloom = rlp::decode(&raw_bloom).unwrap();
		assert_eq!(bloom.0, expected_bytes);
	}

	#[test]
	fn header_compute_hash_poa() {
		// PoA header
		let header = Header {
			parent_hash: Default::default(),
			timestamp: 0,
			number: 0,
			author: Default::default(),
			transactions_root: hex!(
				"56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
			)
			.into(),
			ommers_hash: hex!("1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347")
				.into(),
			extra_data: vec![],
			state_root: hex!("eccf6b74c2bcbe115c71116a23fe963c54406010c244d9650526028ad3e32cce")
				.into(),
			receipts_root: hex!("56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421")
				.into(),
			logs_bloom: Default::default(),
			gas_used: Default::default(),
			gas_limit: 0x222222.into(),
			difficulty: 0x20000.into(),
			seal: vec![vec![0x80], {
				let mut vec = vec![0xb8, 0x41];
				vec.resize(67, 0);
				vec
			}],
			base_fee: None,
		};
		assert_eq!(
			header.compute_hash().as_bytes(),
			hex!("9ff57c7fa155853586382022f0982b71c51fa313a0942f8c456300896643e890"),
		);
	}

	#[test]
	fn header_compute_hash_pow() {
		// <https://etherscan.io/block/11090290>
		let nonce = hex!("6935bbe7b63c4f8e").to_vec();
		let mix_hash =
			hex!("be3adfb0087be62b28b716e2cdf3c79329df5caa04c9eee035d35b5d52102815").to_vec();
		let header = Header {
			parent_hash: hex!("bede0bddd6f32c895fc505ffe0c39d9bde58e9a5272f31a3dee448b796edcbe3")
				.into(),
			timestamp: 1603160977,
			number: 11090290,
			author: hex!("ea674fdde714fd979de3edf0f56aa9716b898ec8").into(),
			transactions_root: hex!(
				"56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
			)
			.into(),
			ommers_hash: hex!("1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347")
				.into(),
			extra_data: hex!("65746865726d696e652d61736961312d33").to_vec(),
			state_root: hex!("7dcb8aca872b712bad81df34a89d4efedc293566ffc3eeeb5cbcafcc703e42c9")
				.into(),
			receipts_root: hex!("56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421")
				.into(),
			logs_bloom: Default::default(),
			gas_used: 0.into(),
			gas_limit: 0xbe8c19.into(),
			difficulty: 0xbc140caa61087i64.into(),
			seal: vec![rlp::encode(&mix_hash).to_vec(), rlp::encode(&nonce).to_vec()],
			base_fee: None,
		};
		assert_eq!(
			header.compute_hash().as_bytes(),
			hex!("0f9bdc91c2e0140acb873330742bda8c8181fa3add91fe7ae046251679cedef7"),
		);
	}

	#[test]
	fn header_pow_seal_fields_extracted_correctly() {
		let nonce: H64 = hex!("6935bbe7b63c4f8e").into();
		let mix_hash: H256 =
			hex!("be3adfb0087be62b28b716e2cdf3c79329df5caa04c9eee035d35b5d52102815").into();
		let header = Header {
			seal: vec![
				rlp::encode(&mix_hash.0.to_vec()).to_vec(),
				rlp::encode(&nonce.0.to_vec()).to_vec(),
			],
			..Default::default()
		};

		assert_eq!(header.nonce().unwrap(), nonce);
		assert_eq!(header.mix_hash().unwrap(), mix_hash);
	}

	#[test]
	fn header_pow_seal_fields_return_none_for_invalid_values() {
		let nonce = hex!("696935bbe7b63c4f8e").to_vec();
		let mix_hash =
			hex!("bebe3adfb0087be62b28b716e2cdf3c79329df5caa04c9eee035d35b5d52102815").to_vec();
		let mut header = Header {
			seal: vec![rlp::encode(&mix_hash).to_vec(), rlp::encode(&nonce).to_vec()],
			..Default::default()
		};
		assert_eq!(header.nonce(), None);
		assert_eq!(header.mix_hash(), None);

		header.seal = Vec::new();
		assert_eq!(header.nonce(), None);
		assert_eq!(header.mix_hash(), None);
	}

	#[test]
	fn header_check_receipt_proof() {
		let header = Header {
			receipts_root: hex!("fd5e397a84884641f53c496804f24b5276cbb8c5c9cfc2342246be8e3ce5ad02")
				.into(),
			..Default::default()
		};

		// Valid proof
		let proof_receipt5 = vec!(
			hex!("f90131a0b5ba404eb5a6a88e56579f4d37ef9813b5ad7f86f0823ff3b407ac5a6bb465eca0398ead2655e78e03c127ce22c5830e90f18b1601ec055f938336c084feb915a9a026d322c26e46c50942c1aabde50e36df5cde572aed650ce73ea3182c6e90a02ca00600a356135f4db1db0d9842264cdff2652676f881669e91e316c0b6dd783011a0837f1deb4075336da320388c1edfffc56c448a43f4a5ba031300d32a7b509fc5a01c3ac82fd65b4aba7f9afaf604d9c82ec7e2deb573a091ae235751bc5c0c288da05d454159d9071b0f68b6e0503d290f23ac7602c1db0c569dee4605d8f5298f09a00bbed10350ec954448df795f6fd46e3faefc800ede061b3840eedc6e2b07a74da0acb02d26a3650f2064c14a435fdf1f668d8655daf455ebdf671713a7c089b3898080808080808080").to_vec(),
			hex!("f901f180a00046a08d4f0bdbdc6b31903086ce323182bce6725e7d9415f7ff91ee8f4820bda0e7cd26ad5f3d2771e4b5ab788e268a14a10209f94ee918eb6c829d21d3d11c1da00d4a56d9e9a6751874fd86c7e3cb1c6ad5a848da62751325f478978a00ea966ea064b81920c8f04a8a1e21f53a8280e739fbb7b00b2ab92493ca3f610b70e8ac85a0b1040ed4c55a73178b76abb16f946ce5bebd6b93ab873c83327df54047d12c27a0de6485e9ac58dc6e2b04b4bb38f562684f0b1a2ee586cc11079e7d9a9dc40b32a0d394f4d3532c3124a65fa36e69147e04fd20453a72ee9c50660f17e13ce9df48a066501003fc3e3478efd2803cd0eded6bbe9243ca01ba754d6327071ddbcbc649a0b2684e518f325fee39fc8ea81b68f3f5c785be00d087f3bed8857ae2ee8da26ea071060a5c52042e8d7ce21092f8ecf06053beb9a0b773a6f91a30c4220aa276b2a0fc22436632574ccf6043d0986dede27ea94c9ca9a3bb5ec03ce776a4ddef24a9a05a8a1d6698c4e7d8cc3a2506cb9b12ea9a079c9c7099bc919dc804033cc556e4a0170c468b0716fd36d161f0bf05875f15756a2976de92f9efe7716320509d79c9a0182f909a90cab169f3efb62387f9cccdd61440acc4deec42f68a4f7ca58075c7a055cf0e9202ac75689b76318f1171f3a44465eddc06aae0713bfb6b34fdd27b7980").to_vec(),
			hex!("f904de20b904daf904d701830652f0b9010004200000000000000000000080020000000000010000000000010000000000000000000000000000000000000000000002000000080000000000000000200000000000000000000000000008000000220000000000400010000000000000000000000000000000000000000000000000000000000000040000000010000100000000000800000000004000000000000000000000000000080000004000000000020000000000020000000000000000000000000000000000000000000004000000000002000000000100000000000000000000000000001000000002000020000010200000000000010000000000000000000000000000000000000010000000f903ccf89b9421130f34829b4c343142047a28ce96ec07814b15f863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa00000000000000000000000007d843005c7433c16b27ff939cb37471541561ebda0000000000000000000000000e9c1281aae66801fa35ec404d5f2aea393ff6988a000000000000000000000000000000000000000000000000000000005d09b7380f89b9421130f34829b4c343142047a28ce96ec07814b15f863a08c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925a00000000000000000000000007d843005c7433c16b27ff939cb37471541561ebda00000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488da0ffffffffffffffffffffffffffffffffffffffffffffffffffffffcc840c6920f89b94c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2f863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa0000000000000000000000000e9c1281aae66801fa35ec404d5f2aea393ff6988a00000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488da000000000000000000000000000000000000000000000000003e973b5a5d1078ef87994e9c1281aae66801fa35ec404d5f2aea393ff6988e1a01c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1b840000000000000000000000000000000000000000000000000000001f1420ad1d40000000000000000000000000000000000000000000000014ad400879d159a38f8fc94e9c1281aae66801fa35ec404d5f2aea393ff6988f863a0d78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822a00000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488da00000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488db88000000000000000000000000000000000000000000000000000000005d415f3320000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003e973b5a5d1078ef87a94c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2f842a07fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65a00000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488da000000000000000000000000000000000000000000000000003e973b5a5d1078e").to_vec(),
		);
		assert!(header.check_receipt_proof(&proof_receipt5).is_some());

		// Various invalid proofs
		let proof_empty: Vec<Vec<u8>> = vec![];
		let proof_missing_full_node = vec![proof_receipt5[0].clone(), proof_receipt5[2].clone()];
		let proof_missing_short_node1 = vec![proof_receipt5[0].clone(), proof_receipt5[1].clone()];
		let proof_missing_short_node2 = vec![proof_receipt5[0].clone()];
		let proof_invalid_encoding = vec![proof_receipt5[2][2..].to_vec()];
		let proof_no_full_node = vec![proof_receipt5[2].clone(), proof_receipt5[2].clone()];
		assert!(header.check_receipt_proof(&proof_empty).is_none());
		assert!(header.check_receipt_proof(&proof_missing_full_node).is_none());

		assert_eq!(
			header.check_receipt_proof(&proof_missing_short_node1),
			Some(Err(rlp::DecoderError::Custom("Unsupported receipt type")))
		);

		assert_eq!(
			header.check_receipt_proof(&proof_missing_short_node2),
			Some(Err(rlp::DecoderError::Custom("Unsupported receipt type")))
		);

		assert!(header.check_receipt_proof(&proof_invalid_encoding).is_none());
		assert!(header.check_receipt_proof(&proof_no_full_node).is_none());
	}

	#[test]
	fn header_check_receipt_proof_with_intermediate_short_node() {
		let header = Header {
			receipts_root: hex!("d128e3a57142d2bf15bc0cbcac7ad54f40750d571b5c3097e425882c10c9ba66")
				.into(),
			..Default::default()
		};

		let proof_receipt263 = vec![
			hex!("f90131a00d3cb8d3f57ac1c0e12918a2ebe0cafed8c273577b9dd73e7ed1079b403ef494a0678b9835b834f8a287c0dd33a8fca9146e456ca688555ed4ec1361a2180b778da0fe42da181a46677a043b3d9d4b8bb05a6a17b7b5c010c17e7c1d31cfb7c4f911a0c89f0e2c53241cdb578e1f2b4caf6ba36e00500bdc57fecd66b84a6a58394c19a086c3c1fae5a0575940b5d38e111c469d07883106c26856f3ef608469a2081f13a06c5992ff00aab6226a70a032fd2f571ba22f797321f45e2daa73020d638d21b0a050861e9503ef68728f6c90a44f7fe1bceb2a9bdab6957bbe7136166bd849561ea006aa6eaca8a07e57176e9aa41e6a09edfb7678d1a112404e0ec779d7e567e82ea0bb0b430d303ba21b0af11c487b8a218bd75db54c98940b3f11bad8ff47cad3ef8080808080808080").to_vec(),
			hex!("f871a0246de222036ee6a03329b0105da0a6b3f916fc95a9ed5a403a581a0c4d74242ca0ac108a49a88b57a05ac34a108b39f1e45f6f167f2b9fbc8d52fb58e2e5a6af1ea0fcfe07ac2ccd3c28b6eab68d1bce112f6f6dbd9023e4ec3c05b96615aa803d798080808080808080808080808080").to_vec(),
			hex!("e4820001a04fff54398cad4d05ea6abfd8b0f3b4fe14c04d7ff5f5211c5b927d9cf72ac1d8").to_vec(),
			hex!("f851a096d010643ca2d47412ca66898286b5f2412963b9ec051b33e570d575914c9c5ca028cd24c652989542fe89479ec6388eac4592432242af5ba97563b3ac7c71c019808080808080808080808080808080").to_vec(),
			hex!("f90211a0bb35a84c5b1dcb78ec9d32614912c696e62df77bebf9ab326ee55b5d3acdde46a01084b30dac8df0accfcd0fd6330b7f6fc72a4651246d0694be9162151686a620a03eed50afdce7909d784c6157c445a444c806b5f23d31f3b63786f600c84a95b2a0af5232f1df6c6d41879804d081abe867002abe26ba3e5f8e0254a83a54769831a0607915fb13dd5da594256389a45007a67a7f7a86e95d38d8462792b6c98a722ea00e1260fda1730f2738c650ce2bfba83857bc10f8fb119ebc4fb39acba24e6fbaa0d11de17e417327457812675ca3b84ae8e1b64827abfe01420953697c8313d5b1a05fcaf2f7a88f76336a0c32ffc78acb87ae2005454bd25d658035331be3173b46a03f94f4952ab9e650f83cfd0e7f367b1bcc493aacf39a06f16c4a2e1b5605da48a0bdb4ec79785ca8ae22d60f1bbd42d707b4d7ec4aff231a3ebab755e315b35053a043a67c3f2bcef37c8f47a673adcb7061007a553696d1092408601c11b2e6846aa0c519d5af48cae87c7f4538845417c9735813bee892a6fe2dda79f5c414e8576aa0f7058256e09589501d7c231d739e61c84a850e139690989d24fda6058b432e98a081a52faab520978cb19ce14400dba0cd5bcdc4e5a3c0740678aa8f97ee0e5c56a0bcecc61cadeae52518e3b68a48af4b11603dfd9d99d99d7985efa6d2de44f904a02cba4accfc6f39bc5adb6d4440eb6358b4a5103ef93298e4e694f1f940f8b48280").to_vec(),
			hex!("f901ae20b901aaf901a70183bb444eb9010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000001000000000000000000000000000100000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000010000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000080000000000000000000000000000000000000000000000002000000000000000000081000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000f89df89b94dac17f958d2ee523a2206206994597c13d831ec7f863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa00000000000000000000000002e514404ff6823f1b46a8318a709251db414e5e1a000000000000000000000000055021c55847c00d764357a352e5803237d328954a0000000000000000000000000000000000000000000000000000000000201c370").to_vec(),
		];
		assert!(header.check_receipt_proof(&proof_receipt263).is_some());
	}
}
