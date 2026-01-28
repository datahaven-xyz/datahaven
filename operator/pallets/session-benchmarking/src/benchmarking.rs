//! Benchmarks for solochain session usage (no staking dependency).
//!
//! This mirrors the upstream session benchmarks but avoids `pallet_staking`
//! by directly calling `pallet_session::Pallet::set_keys`. The session keys
//! are decoded from zeros, which works as long as the runtime wires Babe and
//! Grandpa into `SessionKeys`.

use alloc::{vec, vec::Vec};

use codec::Decode;
use frame_benchmarking::{benchmarks, whitelisted_caller};
use frame_system::RawOrigin;

use crate::{Config, Pallet};
use pallet_session::Call;

benchmarks! {
    set_keys {
        let caller: T::AccountId = whitelisted_caller();
        frame_system::Pallet::<T>::inc_providers(&caller);
        let keys = T::Keys::decode(&mut sp_runtime::traits::TrailingZeroInput::zeroes()).unwrap();
        let proof: Vec<u8> = vec![0, 1, 2, 3];
    }: _(RawOrigin::Signed(caller), keys, proof)

    purge_keys {
        let caller: T::AccountId = whitelisted_caller();
        frame_system::Pallet::<T>::inc_providers(&caller);
        let keys = T::Keys::decode(&mut sp_runtime::traits::TrailingZeroInput::zeroes()).unwrap();
        let proof: Vec<u8> = vec![0, 1, 2, 3];
        let _ = pallet_session::Pallet::<T>::set_keys(RawOrigin::Signed(caller.clone()).into(), keys, proof);
    }: _(RawOrigin::Signed(caller))
}
