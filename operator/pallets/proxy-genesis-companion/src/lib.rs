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

//! A companion pallet to pallet-proxy
//!
//! This pallet allows you to specify proxy accounts that will exist from genesis. This
//! functionality could be moved upstream into pallet proxy eventually, but for now there are fewer
//! obstacles to including it here.

#![cfg_attr(not(feature = "std"), no_std)]

#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;

use frame_support::pallet;
pub use pallet::*;

#[pallet]
pub mod pallet {
	use frame_support::pallet_prelude::*;
	use frame_system::pallet_prelude::BlockNumberFor;
	use sp_std::vec::Vec;

	/// Pallet for configuring proxy at genesis
	#[pallet::pallet]
	#[pallet::without_storage_info]
	pub struct Pallet<T>(PhantomData<T>);

	/// This pallet requires pallet-proxy to be installed.
	#[pallet::config]
	pub trait Config:
		frame_system::Config + pallet_proxy::Config<ProxyType = <Self as Config>::ProxyType>
	{
		/// This MUST be the same as in pallet_proxy or it won't compile
		type ProxyType: MaybeSerializeDeserialize + Clone;
	}

	#[pallet::genesis_config]
	pub struct GenesisConfig<T: Config> {
		pub proxies: Vec<(
			T::AccountId,
			T::AccountId,
			<T as Config>::ProxyType,
			BlockNumberFor<T>,
		)>,
	}

	impl<T: Config> Default for GenesisConfig<T> {
		fn default() -> Self {
			Self {
				proxies: Vec::new(),
			}
		}
	}

	#[pallet::genesis_build]
	impl<T: Config> BuildGenesisConfig for GenesisConfig<T> {
		fn build(&self) {
			for (delegator, delegatee, proxy_type, delay) in &self.proxies {
				pallet_proxy::Pallet::<T>::add_proxy_delegate(
					delegator,
					delegatee.clone(),
					proxy_type.clone(),
					*delay,
				)
				.expect("Genesis proxy could not be added");
			}
		}
	}
}
