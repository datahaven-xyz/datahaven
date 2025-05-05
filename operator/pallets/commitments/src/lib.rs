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
    pub fn store_commitment(commitment: H256) -> DispatchResult {
        LatestCommitment::<T>::put(commitment);

        Self::deposit_event(Event::CommitmentStored { hash: commitment });

        Ok(())
    }

    pub fn get_latest_commitment() -> Option<H256> {
        LatestCommitment::<T>::get()
    }
}
