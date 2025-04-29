// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Helpers for implementing runtime api

use crate::{Config, MessageLeaves};
use frame_support::storage::StorageStreamIter;
use snowbridge_merkle_tree::{merkle_proof, MerkleProof};

pub fn prove_message<T>(leaf_index: u64) -> Option<MerkleProof>
where
    T: Config,
{
    if !MessageLeaves::<T>::exists() {
        return None;
    }
    let proof =
        merkle_proof::<<T as Config>::Hashing, _>(MessageLeaves::<T>::stream_iter(), leaf_index);
    Some(proof)
}
