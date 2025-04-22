// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
// SPDX-FileCopyrightText: 2021-2022 Parity Technologies (UK) Ltd.
#![cfg_attr(not(feature = "std"), no_std)]
#![warn(missing_docs)]

//! This crate implements a simple binary Merkle Tree utilities required for inter-op with Ethereum
//! bridge & Solidity contract.
//!
//! The implementation is optimised for usage within Substrate Runtime and supports no-std
//! compilation targets.
//!
//! Merkle Tree is constructed from arbitrary-length leaves, that are initially hashed using the
//! same `\[`Hasher`\]` as the inner nodes.
//! Inner nodes are created by concatenating child hashes and hashing again. The implementation
//! does not perform any sorting of the input data (leaves) nor when inner nodes are created.
//!
//! If the number of leaves is not even, last leaf (hash of) is promoted to the upper layer.

#[cfg(not(feature = "std"))]
extern crate alloc;
#[cfg(not(feature = "std"))]
use alloc::vec;
#[cfg(not(feature = "std"))]
use alloc::vec::Vec;

use codec::{Decode, Encode};
use scale_info::TypeInfo;
use sp_core::{RuntimeDebug, H256};
use sp_runtime::traits::Hash;

/// Construct a root hash of a Binary Merkle Tree created from given leaves.
///
/// See crate-level docs for details about Merkle Tree construction.
///
/// In case an empty list of leaves is passed the function returns a 0-filled hash.
pub fn merkle_root<H, I>(leaves: I) -> H256
where
	H: Hash<Output = H256>,
	I: Iterator<Item = H256>,
{
	merkelize::<H, _, _>(leaves, &mut ())
}

fn merkelize<H, V, I>(leaves: I, visitor: &mut V) -> H256
where
	H: Hash<Output = H256>,
	V: Visitor,
	I: Iterator<Item = H256>,
{
	let upper = Vec::with_capacity(leaves.size_hint().0);
	let mut next = match merkelize_row::<H, _, _>(leaves, upper, visitor) {
		Ok(root) => return root,
		Err(next) if next.is_empty() => return H256::default(),
		Err(next) => next,
	};

	let mut upper = Vec::with_capacity((next.len() + 1) / 2);
	loop {
		visitor.move_up();

		match merkelize_row::<H, _, _>(next.drain(..), upper, visitor) {
			Ok(root) => return root,
			Err(t) => {
				// swap collections to avoid allocations
				upper = next;
				next = t;
			},
		};
	}
}

/// A generated merkle proof.
///
/// The structure contains all necessary data to later on verify the proof and the leaf itself.
#[derive(Encode, Decode, RuntimeDebug, PartialEq, Eq, TypeInfo)]
pub struct MerkleProof {
	/// Root hash of generated merkle tree.
	pub root: H256,
	/// Proof items (does not contain the leaf hash, nor the root obviously).
	///
	/// This vec contains all inner node hashes necessary to reconstruct the root hash given the
	/// leaf hash.
	pub proof: Vec<H256>,
	/// Number of leaves in the original tree.
	///
	/// This is needed to detect a case where we have an odd number of leaves that "get promoted"
	/// to upper layers.
	pub number_of_leaves: u64,
	/// Index of the leaf the proof is for (0-based).
	pub leaf_index: u64,
	/// Leaf content (hashed).
	pub leaf: H256,
}

/// A trait of object inspecting merkle root creation.
///
/// It can be passed to [`merkelize_row`] or [`merkelize`] functions and will be notified
/// about tree traversal.
trait Visitor {
	/// We are moving one level up in the tree.
	fn move_up(&mut self);

	/// We are creating an inner node from given `left` and `right` nodes.
	///
	/// Note that in case of last odd node in the row `right` might be empty.
	/// The method will also visit the `root` hash (level 0).
	///
	/// The `index` is an index of `left` item.
	fn visit(&mut self, index: u64, left: &Option<H256>, right: &Option<H256>);
}

/// No-op implementation of the visitor.
impl Visitor for () {
	fn move_up(&mut self) {}
	fn visit(&mut self, _index: u64, _left: &Option<H256>, _right: &Option<H256>) {}
}

/// Construct a Merkle Proof for leaves given by indices.
///
/// The function constructs a (partial) Merkle Tree first and stores all elements required
/// to prove the requested item (leaf) given the root hash.
///
/// Both the Proof and the Root Hash are returned.
///
/// # Panic
///
/// The function will panic if given `leaf_index` is greater than the number of leaves.
pub fn merkle_proof<H, I>(leaves: I, leaf_index: u64) -> MerkleProof
where
	H: Hash<Output = H256>,
	I: Iterator<Item = H256>,
{
	let mut leaf = None;
	let mut hashes = vec![];
	let mut number_of_leaves = 0;
	for (idx, l) in (0u64..).zip(leaves) {
		// count the leaves
		number_of_leaves = idx + 1;
		hashes.push(l);
		// find the leaf for the proof
		if idx == leaf_index {
			leaf = Some(l);
		}
	}

	/// The struct collects a proof for single leaf.
	struct ProofCollection {
		proof: Vec<H256>,
		position: u64,
	}

	impl ProofCollection {
		fn new(position: u64) -> Self {
			ProofCollection { proof: Default::default(), position }
		}
	}

	impl Visitor for ProofCollection {
		fn move_up(&mut self) {
			self.position /= 2;
		}

		fn visit(&mut self, index: u64, left: &Option<H256>, right: &Option<H256>) {
			// we are at left branch - right goes to the proof.
			if self.position == index {
				if let Some(right) = right {
					self.proof.push(*right);
				}
			}
			// we are at right branch - left goes to the proof.
			if self.position == index + 1 {
				if let Some(left) = left {
					self.proof.push(*left);
				}
			}
		}
	}

	let mut collect_proof = ProofCollection::new(leaf_index);

	let root = merkelize::<H, _, _>(hashes.into_iter(), &mut collect_proof);
	let leaf = leaf.expect("Requested `leaf_index` is greater than number of leaves.");

	MerkleProof { root, proof: collect_proof.proof, number_of_leaves, leaf_index, leaf }
}

/// Leaf node for proof verification.
///
/// Can be either a value that needs to be hashed first,
/// or the hash itself.
#[derive(Debug, PartialEq, Eq)]
pub enum Leaf<'a> {
	/// Leaf content.
	Value(&'a [u8]),
	/// Hash of the leaf content.
	Hash(H256),
}

impl<'a, T: AsRef<[u8]>> From<&'a T> for Leaf<'a> {
	fn from(v: &'a T) -> Self {
		Leaf::Value(v.as_ref())
	}
}

impl<'a> From<H256> for Leaf<'a> {
	fn from(v: H256) -> Self {
		Leaf::Hash(v)
	}
}

/// Verify Merkle Proof correctness versus given root hash.
///
/// The proof is NOT expected to contain leaf hash as the first
/// element, but only all adjacent nodes required to eventually by process of
/// concatenating and hashing end up with given root hash.
///
/// The proof must not contain the root hash.
pub fn verify_proof<'a, H, P, L>(
	root: &'a H256,
	proof: P,
	number_of_leaves: u64,
	leaf_index: u64,
	leaf: L,
) -> bool
where
	H: Hash<Output = H256>,
	P: IntoIterator<Item = H256>,
	L: Into<Leaf<'a>>,
{
	if leaf_index >= number_of_leaves {
		return false
	}

	let leaf_hash = match leaf.into() {
		Leaf::Value(content) => <H as Hash>::hash(content),
		Leaf::Hash(hash) => hash,
	};

	let hash_len = <H as sp_core::Hasher>::LENGTH;
	let mut combined = [0_u8; 64];
	let computed = proof.into_iter().fold(leaf_hash, |a, b| {
		if a < b {
			combined[..hash_len].copy_from_slice(a.as_ref());
			combined[hash_len..].copy_from_slice(b.as_ref());
		} else {
			combined[..hash_len].copy_from_slice(b.as_ref());
			combined[hash_len..].copy_from_slice(a.as_ref());
		}
		<H as Hash>::hash(&combined)
	});

	root == &computed
}

/// Processes a single row (layer) of a tree by taking pairs of elements,
/// concatenating them, hashing and placing into resulting vector.
///
/// In case only one element is provided it is returned via `Ok` result, in any other case (also an
/// empty iterator) an `Err` with the inner nodes of upper layer is returned.
fn merkelize_row<H, V, I>(
	mut iter: I,
	mut next: Vec<H256>,
	visitor: &mut V,
) -> Result<H256, Vec<H256>>
where
	H: Hash<Output = H256>,
	V: Visitor,
	I: Iterator<Item = H256>,
{
	next.clear();

	let hash_len = <H as sp_core::Hasher>::LENGTH;
	let mut index = 0;
	let mut combined = vec![0_u8; hash_len * 2];
	loop {
		let a = iter.next();
		let b = iter.next();
		visitor.visit(index, &a, &b);

		index += 2;
		match (a, b) {
			(Some(a), Some(b)) => {
				if a < b {
					combined[..hash_len].copy_from_slice(a.as_ref());
					combined[hash_len..].copy_from_slice(b.as_ref());
				} else {
					combined[..hash_len].copy_from_slice(b.as_ref());
					combined[hash_len..].copy_from_slice(a.as_ref());
				}

				next.push(<H as Hash>::hash(&combined));
			},
			// Odd number of items. Promote the item to the upper layer.
			(Some(a), None) if !next.is_empty() => {
				next.push(a);
			},
			// Last item = root.
			(Some(a), None) => return Ok(a),
			// Finish up, no more items.
			_ => return Err(next),
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use hex_literal::hex;
	use sp_crypto_hashing::keccak_256;
	use sp_runtime::traits::Keccak256;

	fn make_leaves(count: u64) -> Vec<H256> {
		(0..count).map(|i| keccak_256(&i.to_le_bytes()).into()).collect()
	}

	#[test]
	fn should_generate_empty_root() {
		// given
		sp_tracing::init_for_tests();
		let data = vec![];

		// when
		let out = merkle_root::<Keccak256, _>(data.into_iter());

		// then
		assert_eq!(
			hex::encode(out),
			"0000000000000000000000000000000000000000000000000000000000000000"
		);
	}

	#[test]
	fn should_generate_single_root() {
		// given
		sp_tracing::init_for_tests();
		let data = make_leaves(1);

		// when
		let out = merkle_root::<Keccak256, _>(data.into_iter());

		// then
		assert_eq!(
			hex::encode(out),
			"011b4d03dd8c01f1049143cf9c4c817e4b167f1d1b83e5c6f0f10d89ba1e7bce"
		);
	}

	#[test]
	fn should_generate_root_pow_2() {
		// given
		sp_tracing::init_for_tests();
		let data = make_leaves(2);

		// when
		let out = merkle_root::<Keccak256, _>(data.into_iter());

		// then
		assert_eq!(
			hex::encode(out),
			"e497bd1c13b13a60af56fa0d2703517c232fde213ad20d2c3dd60735c6604512"
		);
	}

	#[test]
	fn should_generate_root_complex() {
		sp_tracing::init_for_tests();
		let test = |root, data: Vec<H256>| {
			assert_eq!(
				array_bytes::bytes2hex("", merkle_root::<Keccak256, _>(data.into_iter()).as_ref()),
				root
			);
		};

		test("816cc37bd8d39f7b0851838ebc875faf2afe58a03e95aca3b1333b3693f39dd3", make_leaves(3));

		test("7501ea976cb92f305cca65ab11254589ea28bb8b59d3161506350adaa237d22f", make_leaves(4));

		test("d26ba4eb398747bdd39255b1fadb99b803ce39696021b3b0bff7301ac146ee4e", make_leaves(10));
	}

	#[test]
	#[ignore]
	fn should_generate_and_verify_proof() {
		// given
		sp_tracing::init_for_tests();
		let data: Vec<H256> = make_leaves(3);

		// when
		let proof0 = merkle_proof::<Keccak256, _>(data.clone().into_iter(), 0);
		assert!(verify_proof::<Keccak256, _, _>(
			&proof0.root,
			proof0.proof.clone(),
			data.len() as u64,
			proof0.leaf_index,
			&data[0],
		));

		let proof1 = merkle_proof::<Keccak256, _>(data.clone().into_iter(), 1);
		assert!(verify_proof::<Keccak256, _, _>(
			&proof1.root,
			proof1.proof,
			data.len() as u64,
			proof1.leaf_index,
			&proof1.leaf,
		));

		let proof2 = merkle_proof::<Keccak256, _>(data.clone().into_iter(), 2);
		assert!(verify_proof::<Keccak256, _, _>(
			&proof2.root,
			proof2.proof,
			data.len() as u64,
			proof2.leaf_index,
			&proof2.leaf
		));

		// then
		assert_eq!(hex::encode(proof0.root), hex::encode(proof1.root));
		assert_eq!(hex::encode(proof2.root), hex::encode(proof1.root));

		assert!(!verify_proof::<Keccak256, _, _>(
			&H256::from_slice(&hex!(
				"fb3b3be94be9e983ba5e094c9c51a7d96a4fa2e5d8e891df00ca89ba05bb1239"
			)),
			proof0.proof,
			data.len() as u64,
			proof0.leaf_index,
			&proof0.leaf
		));

		assert!(!verify_proof::<Keccak256, _, _>(
			&proof0.root,
			vec![],
			data.len() as u64,
			proof0.leaf_index,
			&proof0.leaf
		));
	}

	#[test]
	#[should_panic]
	fn should_panic_on_invalid_leaf_index() {
		sp_tracing::init_for_tests();
		merkle_proof::<Keccak256, _>(make_leaves(1).into_iter(), 5);
	}
}
