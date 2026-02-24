#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub struct Pallet<T: Config>(pallet_session::Pallet<T>);

/// Benchmarking configuration for pallet-session in DataHaven.
pub trait Config: pallet_session::Config {}

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;
