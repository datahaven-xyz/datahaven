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

#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{pallet_prelude::*, traits::StorageVersion};
use sp_core::H256;

pub use pallet::*;

/// Current storage version.
const STORAGE_VERSION: StorageVersion = StorageVersion::new(1);

/// A pallet for storing the latest commitment hash from the outbound queue.
///
/// This pallet provides a simple way to track the most recent commitment hash,
/// which can be included in BEEFY MMR leaves for cross-chain verification.
#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    }

    #[pallet::storage]
    #[pallet::getter(fn latest_commitment)]
    pub type LatestCommitment<T> = StorageValue<_, H256, OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        CommitmentStored { hash: H256 },
    }
}

impl<T: Config> Pallet<T> {
    pub fn store_commitment(commitment: H256) {
        LatestCommitment::<T>::put(commitment);

        Self::deposit_event(Event::CommitmentStored { hash: commitment });
    }

    pub fn get_latest_commitment() -> Option<H256> {
        LatestCommitment::<T>::get()
    }
}
