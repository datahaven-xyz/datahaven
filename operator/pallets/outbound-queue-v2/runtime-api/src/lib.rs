// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

//! Ethereum Outbound Queue V2 Runtime API
//!
//! * `prove_message`: Generate a merkle proof for a committed message

#![cfg_attr(not(feature = "std"), no_std)]
use frame_support::traits::tokens::Balance as BalanceT;
use snowbridge_merkle_tree::MerkleProof;

sp_api::decl_runtime_apis! {
    pub trait OutboundQueueV2Api<Balance> where Balance: BalanceT
    {
        /// Generate a merkle proof for a committed message identified by `leaf_index`.
        fn prove_message(leaf_index: u64) -> Option<MerkleProof>;
    }
}
