// Copyright 2019-2025 PureStake Inc.
// This file is part of Moonbeam.

// Moonbeam is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Moonbeam is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Moonbeam.  If not, see <http://www.gnu.org/licenses/>.

#![cfg_attr(not(feature = "std"), no_std)]

use fp_evm::PrecompileHandle;
use frame_support::dispatch::{GetDispatchInfo, PostDispatchInfo};
use frame_support::traits::ConstU32;
use pallet_evm::AddressMapping;
use pallet_preimage::Call as PreimageCall;
use precompile_utils::prelude::*;
use sp_core::{Hasher, H256};
use sp_runtime::traits::Dispatchable;
use sp_std::{marker::PhantomData, vec::Vec};

#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;

pub const ENCODED_PROPOSAL_SIZE_LIMIT: u32 = 2u32.pow(16);
type GetEncodedProposalSizeLimit = ConstU32<ENCODED_PROPOSAL_SIZE_LIMIT>;

/// Solidity selector of the PreimageNoted log, which is the Keccak of the Log signature.
pub(crate) const SELECTOR_LOG_PREIMAGE_NOTED: [u8; 32] = keccak256!("PreimageNoted(bytes32)");

/// Solidity selector of the PreimageUnnoted log, which is the Keccak of the Log signature.
pub(crate) const SELECTOR_LOG_PREIMAGE_UNNOTED: [u8; 32] = keccak256!("PreimageUnnoted(bytes32)");

/// A precompile to wrap the functionality from pallet-preimage.
pub struct PreimagePrecompile<Runtime>(PhantomData<Runtime>);

#[precompile_utils::precompile]
impl<Runtime> PreimagePrecompile<Runtime>
where
    Runtime: pallet_preimage::Config + pallet_evm::Config + frame_system::Config,
    <Runtime as frame_system::Config>::Hash: TryFrom<H256> + Into<H256>,
    <Runtime as frame_system::Config>::RuntimeCall:
        Dispatchable<PostInfo = PostDispatchInfo> + GetDispatchInfo,
    <<Runtime as frame_system::Config>::RuntimeCall as Dispatchable>::RuntimeOrigin:
        From<Option<Runtime::AccountId>>,
    <Runtime as frame_system::Config>::Hash: Into<H256>,
    <Runtime as frame_system::Config>::RuntimeCall: From<PreimageCall<Runtime>>,
    <Runtime as pallet_evm::Config>::AddressMapping: AddressMapping<Runtime::AccountId>,
{
    /// Register a preimage on-chain.
    ///
    /// Parameters:
    /// * encoded_proposal: The preimage registered on-chain
    #[precompile::public("notePreimage(bytes)")]
    fn note_preimage(
        handle: &mut impl PrecompileHandle,
        encoded_proposal: BoundedBytes<GetEncodedProposalSizeLimit>,
    ) -> EvmResult<H256> {
        let bytes: Vec<u8> = encoded_proposal.into();
        let hash: H256 = Runtime::Hashing::hash(&bytes).into();

        let event = log1(
            handle.context().address,
            SELECTOR_LOG_PREIMAGE_NOTED,
            solidity::encode_arguments(H256::from(hash)),
        );
        handle.record_log_costs(&[&event])?;
        let origin = Runtime::AddressMapping::into_account_id(handle.context().caller);

        let call = PreimageCall::<Runtime>::note_preimage { bytes }.into();

        <RuntimeHelper<Runtime>>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        event.record(handle)?;
        Ok(hash)
    }

    /// Clear an unrequested preimage from the runtime storage.
    ///
    /// Parameters:
    /// * hash: The preimage cleared from storage
    #[precompile::public("unnotePreimage(bytes32)")]
    fn unnote_preimage(handle: &mut impl PrecompileHandle, hash: H256) -> EvmResult {
        let event = log1(
            handle.context().address,
            SELECTOR_LOG_PREIMAGE_UNNOTED,
            solidity::encode_arguments(H256::from(hash)),
        );
        handle.record_log_costs(&[&event])?;

        let hash: Runtime::Hash = hash
            .try_into()
            .map_err(|_| RevertReason::custom("H256 is Runtime::Hash").in_field("hash"))?;
        let origin = Runtime::AddressMapping::into_account_id(handle.context().caller);

        let call = PreimageCall::<Runtime>::unnote_preimage { hash }.into();

        <RuntimeHelper<Runtime>>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        event.record(handle)?;

        Ok(())
    }
}
