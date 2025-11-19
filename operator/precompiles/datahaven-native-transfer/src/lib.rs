// Copyright 2025 DataHaven
// This file is part of DataHaven.

// DataHaven is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// DataHaven is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with DataHaven.  If not, see <http://www.gnu.org/licenses/>.

//! Precompile to expose DataHaven Native Transfer pallet to the EVM layer.
//!
//! This precompile allows EVM smart contracts to transfer DataHaven native tokens
//! to Ethereum via Snowbridge, and to manage the pallet's operational state.

#![cfg_attr(not(feature = "std"), no_std)]

use fp_evm::PrecompileHandle;
use frame_support::dispatch::{GetDispatchInfo, PostDispatchInfo};
use frame_support::traits::fungible::Inspect;
use pallet_datahaven_native_transfer::{
    Call as NativeTransferCall, Pallet as NativeTransferPallet,
};
use pallet_evm::AddressMapping;
use precompile_utils::prelude::*;
use sp_core::{H160, U256};
use sp_runtime::traits::Dispatchable;
use sp_std::marker::PhantomData;

#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;

type BalanceOf<Runtime> =
    <<Runtime as pallet_datahaven_native_transfer::Config>::Currency as Inspect<
        <Runtime as frame_system::Config>::AccountId,
    >>::Balance;

/// Storage read size for Paused storage value (bool = 1 byte + overhead)
pub const PAUSED_STORAGE_SIZE: usize = 32;

/// Precompile for DataHaven Native Transfer pallet
pub struct DataHavenNativeTransferPrecompile<Runtime>(PhantomData<Runtime>);

#[precompile_utils::precompile]
impl<Runtime> DataHavenNativeTransferPrecompile<Runtime>
where
    Runtime: pallet_datahaven_native_transfer::Config + pallet_evm::Config + frame_system::Config,
    <Runtime as frame_system::Config>::RuntimeCall:
        Dispatchable<PostInfo = PostDispatchInfo> + GetDispatchInfo,
    <<Runtime as frame_system::Config>::RuntimeCall as Dispatchable>::RuntimeOrigin:
        From<Option<Runtime::AccountId>>,
    <Runtime as frame_system::Config>::RuntimeCall: From<NativeTransferCall<Runtime>>,
    BalanceOf<Runtime>: TryFrom<U256> + Into<U256>,
    <Runtime as pallet_evm::Config>::AddressMapping: AddressMapping<Runtime::AccountId>,
    Runtime::AccountId: Into<H160>,
{
    /// Transfer DataHaven native tokens to Ethereum
    ///
    /// Locks tokens in the sovereign account and sends a message through Snowbridge
    /// to mint the equivalent tokens on Ethereum.
    ///
    /// Parameters:
    /// - `recipient`: Ethereum address to receive the tokens
    /// - `amount`: Amount of tokens to transfer (in smallest unit)
    /// - `fee`: Fee to incentivize relayers (in smallest unit)
    #[precompile::public("transferToEthereum(address,uint256,uint256)")]
    fn transfer_to_ethereum(
        handle: &mut impl PrecompileHandle,
        recipient: Address,
        amount: U256,
        fee: U256,
    ) -> EvmResult {
        // Ensure we're not in a static context
        handle.record_cost(RuntimeHelper::<Runtime>::db_read_gas_cost())?;

        // Convert caller address to substrate account
        let caller = Runtime::AddressMapping::into_account_id(handle.context().caller);

        // Validate recipient is not zero address
        let recipient_h160: H160 = recipient.into();
        if recipient_h160 == H160::zero() {
            return Err(revert("Recipient cannot be zero address"));
        }

        // Convert U256 amounts to Balance type
        let amount_balance: BalanceOf<Runtime> = amount
            .try_into()
            .map_err(|_| RevertReason::custom("Amount overflow").in_field("amount"))?;

        let fee_balance: BalanceOf<Runtime> = fee
            .try_into()
            .map_err(|_| RevertReason::custom("Fee overflow").in_field("fee"))?;

        // Validate amounts are non-zero
        if amount_balance.into() == U256::zero() {
            return Err(revert("Amount must be greater than zero"));
        }

        if fee_balance.into() == U256::zero() {
            return Err(revert("Fee must be greater than zero"));
        }

        // Build the call
        let call = NativeTransferCall::<Runtime>::transfer_to_ethereum {
            recipient: recipient_h160,
            amount: amount_balance,
            fee: fee_balance,
        }
        .into();

        // Dispatch the call - this will handle gas costs and error reporting
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(caller).into(), call, 0)?;

        Ok(())
    }

    /// Pause the pallet
    ///
    /// Prevents all token transfers until the pallet is unpaused.
    /// Only callable by accounts with the PauseOrigin permission.
    #[precompile::public("pause()")]
    fn pause(handle: &mut impl PrecompileHandle) -> EvmResult {
        // Record db write cost
        handle.record_cost(RuntimeHelper::<Runtime>::db_write_gas_cost())?;

        // Convert caller address to substrate account
        let caller = Runtime::AddressMapping::into_account_id(handle.context().caller);

        // Build the call
        let call = NativeTransferCall::<Runtime>::pause {}.into();

        // Dispatch the call - this will fail if caller doesn't have permission
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(caller).into(), call, 0)?;

        Ok(())
    }

    /// Unpause the pallet
    ///
    /// Allows token transfers again after being paused.
    /// Only callable by accounts with the PauseOrigin permission.
    #[precompile::public("unpause()")]
    fn unpause(handle: &mut impl PrecompileHandle) -> EvmResult {
        // Record db write cost
        handle.record_cost(RuntimeHelper::<Runtime>::db_write_gas_cost())?;

        // Convert caller address to substrate account
        let caller = Runtime::AddressMapping::into_account_id(handle.context().caller);

        // Build the call
        let call = NativeTransferCall::<Runtime>::unpause {}.into();

        // Dispatch the call - this will fail if caller doesn't have permission
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(caller).into(), call, 0)?;

        Ok(())
    }

    /// Check if the pallet is currently paused
    ///
    /// Returns:
    /// - `true` if the pallet is paused (transfers disabled)
    /// - `false` if the pallet is operational (transfers enabled)
    #[precompile::public("isPaused()")]
    #[precompile::view]
    fn is_paused(handle: &mut impl PrecompileHandle) -> EvmResult<bool> {
        // Record storage read cost
        handle.record_db_read::<Runtime>(PAUSED_STORAGE_SIZE)?;

        // Read the paused state from storage
        let is_paused = NativeTransferPallet::<Runtime>::is_paused();

        Ok(is_paused)
    }

    /// Get total amount of tokens locked in the Ethereum sovereign account
    ///
    /// This represents the total amount of DataHaven native tokens that are currently
    /// locked for transfers to Ethereum.
    ///
    /// Returns:
    /// - The total locked balance in smallest unit
    #[precompile::public("totalLockedBalance()")]
    #[precompile::view]
    fn total_locked_balance(handle: &mut impl PrecompileHandle) -> EvmResult<U256> {
        // Record storage read cost (account balance read)
        handle.record_cost(RuntimeHelper::<Runtime>::db_read_gas_cost())?;

        // Get the total locked balance from the pallet
        let balance = NativeTransferPallet::<Runtime>::total_locked_balance();

        // Convert Balance to U256
        let balance_u256: U256 = balance.into();

        Ok(balance_u256)
    }

    /// Get the Ethereum sovereign account address
    ///
    /// Returns the address of the account that holds locked tokens during transfers.
    /// This is useful for monitoring and debugging purposes.
    ///
    /// Returns:
    /// - The sovereign account address as an Ethereum-compatible H160 address
    #[precompile::public("ethereumSovereignAccount()")]
    #[precompile::view]
    fn ethereum_sovereign_account(handle: &mut impl PrecompileHandle) -> EvmResult<Address> {
        // Minimal cost for reading config value
        handle.record_cost(RuntimeHelper::<Runtime>::db_read_gas_cost())?;

        // Get the sovereign account from the pallet
        let account = NativeTransferPallet::<Runtime>::ethereum_sovereign_account();

        // Convert AccountId to H160
        let account_h160: H160 = account.into();

        // Convert to Address for the return
        Ok(Address(account_h160))
    }
}
