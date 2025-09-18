//! Testnet-specific migration lists.

#[cfg(not(feature = "runtime-benchmarks"))]
pub type SingleBlockMigrations = ();

#[cfg(feature = "runtime-benchmarks")]
pub type SingleBlockMigrations = ();

#[cfg(not(feature = "runtime-benchmarks"))]
pub type MultiBlockMigrationList = datahaven_runtime_common::migrations::MultiBlockMigrationList;

#[cfg(feature = "runtime-benchmarks")]
pub type MultiBlockMigrationList = pallet_migrations::mock_helpers::MockedMigrations;
