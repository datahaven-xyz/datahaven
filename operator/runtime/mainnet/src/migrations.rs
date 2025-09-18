//! Mainnet-specific migration lists.
//!
//! These aliases mirror Moonbeam's layout so that adding future single- or multi-block migrations
//! stays ergonomic.

/// Single-block migrations executed via `frame_executive` (currently none).
#[cfg(not(feature = "runtime-benchmarks"))]
pub type SingleBlockMigrations = ();

/// Benchmark builds keep the tuple empty as well.
#[cfg(feature = "runtime-benchmarks")]
pub type SingleBlockMigrations = ();

/// Multi-block migrations orchestrated by `pallet-migrations` (shared across runtimes for now).
#[cfg(not(feature = "runtime-benchmarks"))]
pub type MultiBlockMigrationList = datahaven_runtime_common::migrations::MultiBlockMigrationList;

/// When benchmarking we rely on the mocked migrations provided by the pallet.
#[cfg(feature = "runtime-benchmarks")]
pub type MultiBlockMigrationList = pallet_migrations::mock_helpers::MockedMigrations;
