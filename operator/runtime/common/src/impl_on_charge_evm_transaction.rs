// Copyright 2019-2025 Moonbeam Foundation.
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

#[macro_export]
macro_rules! impl_on_charge_evm_transaction {
	{} => {
		pub struct OnChargeEVMTransaction<BaseFeesOU, PriorityFeesOU>(
			sp_std::marker::PhantomData<(BaseFeesOU, PriorityFeesOU)>
		);

		impl<T, BaseFeesOU, PriorityFeesOU> OnChargeEVMTransactionT<T>
			for OnChargeEVMTransaction<BaseFeesOU, PriorityFeesOU>
		where
			T: pallet_evm::Config,
			T::Currency: Balanced<pallet_evm::AccountIdOf<T>>,
			BaseFeesOU: OnUnbalanced<Credit<pallet_evm::AccountIdOf<T>, T::Currency>>,
			PriorityFeesOU: OnUnbalanced<Credit<pallet_evm::AccountIdOf<T>, T::Currency>>,
			U256: UniqueSaturatedInto<<T::Currency as Inspect<pallet_evm::AccountIdOf<T>>>::Balance>,
			T::AddressMapping: pallet_evm::AddressMapping<T::AccountId>,
		{
			type LiquidityInfo = Option<Credit<pallet_evm::AccountIdOf<T>, T::Currency>>;

			fn withdraw_fee(who: &H160, fee: U256) -> Result<Self::LiquidityInfo, pallet_evm::Error<T>> {
				EVMFungibleAdapter::<<T as pallet_evm::Config>::Currency, ()>::withdraw_fee(who, fee)
			}

			fn correct_and_deposit_fee(
				who: &H160,
				corrected_fee: U256,
				base_fee: U256,
				already_withdrawn: Self::LiquidityInfo,
			) -> Self::LiquidityInfo {
				<EVMFungibleAdapter<<T as pallet_evm::Config>::Currency, BaseFeesOU> as OnChargeEVMTransactionT<
					T,
				>>::correct_and_deposit_fee(who, corrected_fee, base_fee, already_withdrawn)
			}

			fn pay_priority_fee(tip: Self::LiquidityInfo) {
				if let Some(tip) = tip {
					PriorityFeesOU::on_unbalanced(tip);
				}
			}
		}
	}
}
