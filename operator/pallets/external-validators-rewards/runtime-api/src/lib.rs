// Copyright (C) Moondance Labs Ltd.
// This file is part of Tanssi.

// Tanssi is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Tanssi is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Tanssi.  If not, see <http://www.gnu.org/licenses/>

//! Runtime API for External Validators Rewards pallet

#![cfg_attr(not(feature = "std"), no_std)]

use snowbridge_merkle_tree::MerkleProof;

sp_api::decl_runtime_apis! {
    pub trait ExternalValidatorsRewardsApi<AccountId, EraIndex>
    where
        AccountId: parity_scale_codec::Codec,
        EraIndex: parity_scale_codec::Codec,
    {
        fn generate_rewards_merkle_proof(account_id: AccountId, era_index: EraIndex) -> Option<MerkleProof>;
        fn verify_rewards_merkle_proof(merkle_proof: MerkleProof) -> bool;
    }
}
