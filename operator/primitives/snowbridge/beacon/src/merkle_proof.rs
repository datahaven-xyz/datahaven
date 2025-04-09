// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use sp_core::H256;
use sp_io::hashing::sha2_256;

/// Specified by <https://github.com/ethereum/consensus-specs/blob/fe9c1a8cbf0c2da8a4f349efdcd77dd7ac8445c4/specs/phase0/beacon-chain.md?plain=1#L742>
/// with improvements from <https://github.com/ethereum/consensus-specs/blob/dev/ssz/merkle-proofs.md>
pub fn verify_merkle_branch(
	leaf: H256,
	branch: &[H256],
	index: usize,
	depth: usize,
	root: H256,
) -> bool {
	// verify the proof length
	if branch.len() != depth {
		return false
	}
	// verify the computed merkle root
	root == compute_merkle_root(leaf, branch, index)
}

fn compute_merkle_root(leaf: H256, proof: &[H256], index: usize) -> H256 {
	let mut value: [u8; 32] = leaf.into();
	for (i, node) in proof.iter().enumerate() {
		let mut data = [0u8; 64];
		if generalized_index_bit(index, i) {
			// right node
			data[0..32].copy_from_slice(node.as_bytes());
			data[32..64].copy_from_slice(&value);
			value = sha2_256(&data);
		} else {
			// left node
			data[0..32].copy_from_slice(&value);
			data[32..64].copy_from_slice(node.as_bytes());
			value = sha2_256(&data);
		}
	}
	value.into()
}

/// Spec: <https://github.com/ethereum/consensus-specs/blob/fe9c1a8cbf0c2da8a4f349efdcd77dd7ac8445c4/ssz/merkle-proofs.md#get_generalized_index_bit>
fn generalized_index_bit(index: usize, position: usize) -> bool {
	index & (1 << position) > 0
}

/// Spec: <https://github.com/ethereum/consensus-specs/blob/fe9c1a8cbf0c2da8a4f349efdcd77dd7ac8445c4/specs/altair/light-client/sync-protocol.md#get_subtree_index>
pub const fn subtree_index(generalized_index: usize) -> usize {
	generalized_index % (1 << generalized_index_length(generalized_index))
}

/// Spec: <https://github.com/ethereum/consensus-specs/blob/fe9c1a8cbf0c2da8a4f349efdcd77dd7ac8445c4/ssz/merkle-proofs.md#get_generalized_index_length>
pub const fn generalized_index_length(generalized_index: usize) -> usize {
	match generalized_index.checked_ilog2() {
		Some(v) => v as usize,
		None => panic!("checked statically; qed"),
	}
}
