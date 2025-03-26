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
// along with Tanssi.  If not, see <http://www.gnu.org/licenses/>.

#[macro_export]
macro_rules! impl_on_charge_evm_transaction {
	{} => {
		pub struct OnChargeEVMTransaction<OU>(sp_std::marker::PhantomData<OU>);
		impl<T, OU> OnChargeEVMTransactionT<T> for OnChargeEVMTransaction<OU>
		where
			T: pallet_evm::Config,
			T::Currency: Balanced<pallet_evm::AccountIdOf<T>>,
			OU: OnUnbalanced<Credit<pallet_evm::AccountIdOf<T>, T::Currency>>,
			U256: UniqueSaturatedInto<<T::Currency as Inspect<pallet_evm::AccountIdOf<T>>>::Balance>,
			T::AddressMapping: pallet_evm::AddressMapping<T::AccountId>,

		{
			type LiquidityInfo =  Option<Credit<pallet_evm::AccountIdOf<T>, T::Currency>>;

			fn withdraw_fee(who: &H160, fee: U256) -> Result<Self::LiquidityInfo, pallet_evm::Error<T>> {
				EVMFungibleAdapter::<<T as pallet_evm::Config>::Currency, ()>::withdraw_fee(who, fee)
			}

			fn correct_and_deposit_fee(
				who: &H160,
				corrected_fee: U256,
				base_fee: U256,
				already_withdrawn: Self::LiquidityInfo,
			) -> Self::LiquidityInfo {
				<EVMFungibleAdapter<<T as pallet_evm::Config>::Currency, OU> as OnChargeEVMTransactionT<
					T,
				>>::correct_and_deposit_fee(who, corrected_fee, base_fee, already_withdrawn)
			}

			fn pay_priority_fee(tip: Self::LiquidityInfo) {
				if let Some(tip) = tip {
					OU::on_unbalanced(tip);
				}
			}
		}
	}
}
