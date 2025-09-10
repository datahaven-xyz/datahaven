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

#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;

use core::marker::PhantomData;
use fp_evm::{ExitError, IsPrecompileResult, PrecompileFailure};
use precompile_utils::{
    precompile_set::{is_precompile_or_fail, IsActivePrecompile},
    prelude::*,
};
use sp_core::Get;

const DUMMY_CODE: [u8; 5] = [0x60, 0x00, 0x60, 0x00, 0xfd];

pub struct PrecompileRegistry<Runtime>(PhantomData<Runtime>);

#[precompile_utils::precompile]
impl<Runtime> PrecompileRegistry<Runtime>
where
    Runtime: pallet_evm::Config,
    Runtime::PrecompilesType: IsActivePrecompile,
{
    #[precompile::public("isPrecompile(address)")]
    #[precompile::view]
    fn is_precompile(handle: &mut impl PrecompileHandle, address: Address) -> EvmResult<bool> {
        // We consider the precompile set is optimized to do at most one storage read.
        // In the case of moonbeam, the storage item that can be read is pallet_asset::Asset
        // (TODO make it more generic, maybe add a const generic on PrecompileRegistry type)
        // Storage item: Asset:
        // Blake2_128(16) + AssetId(16) + AssetDetails((4 * AccountId(20)) + (3 * Balance(16)) + 15)
        handle.record_db_read::<Runtime>(175)?;
        is_precompile_or_fail::<Runtime>(address.0, handle.remaining_gas())
    }

    #[precompile::public("isActivePrecompile(address)")]
    #[precompile::view]
    fn is_active_precompile(
        handle: &mut impl PrecompileHandle,
        address: Address,
    ) -> EvmResult<bool> {
        // We consider the precompile set is optimized to do at most one storage read.
        // In the case of moonbeam, the storage item that can be read is pallet_asset::Asset
        // (TODO make it more generic, maybe add a const generic on PrecompileRegistry type)
        // Storage item: Asset:
        // Blake2_128(16) + AssetId(16) + AssetDetails((4 * AccountId(20)) + (3 * Balance(16)) + 15)
        handle.record_db_read::<Runtime>(175)?;
        match <Runtime::PrecompilesValue>::get()
            .is_active_precompile(address.0, handle.remaining_gas())
        {
            IsPrecompileResult::Answer { is_precompile, .. } => Ok(is_precompile),
            IsPrecompileResult::OutOfGas => Err(PrecompileFailure::Error {
                exit_status: ExitError::OutOfGas,
            }),
        }
    }

    #[precompile::public("updateAccountCode(address)")]
    fn update_account_code(handle: &mut impl PrecompileHandle, address: Address) -> EvmResult<()> {
        // Prevent touching addresses that are not precompiles.
        //
        // We consider the precompile set is optimized to do at most one storage read.
        // In the case of moonbeam, the storage item that can be read is pallet_asset::Asset
        // (TODO make it more generic, maybe add a const generic on PrecompileRegistry type)
        // Storage item: Asset:
        // Blake2_128(16) + AssetId(16) + AssetDetails((4 * AccountId(20)) + (3 * Balance(16)) + 15)
        handle.record_db_read::<Runtime>(175)?;
        if !is_precompile_or_fail::<Runtime>(address.0, handle.remaining_gas())? {
            return Err(revert("provided address is not a precompile"));
        }

        // pallet_evm::create_account read storage item pallet_evm::AccountCodes
        //
        // AccountCodes: Blake2128(16) + H160(20) + Vec(5)
        // We asume an existing precompile can hold at most 5 bytes worth of dummy code.
        handle.record_db_read::<Runtime>(41)?;
        pallet_evm::Pallet::<Runtime>::create_account(address.0, DUMMY_CODE.to_vec());

        Ok(())
    }
}
