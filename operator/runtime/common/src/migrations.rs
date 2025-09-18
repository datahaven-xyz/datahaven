//! Shared helpers for configuring `pallet-migrations` across DataHaven runtimes.
//!
//! The types and constants defined here keep the pallet configuration consistent between
//! networks while leaving each runtime free to decide which migrations should actually run.

use frame_support::pallet_prelude::ConstU32;

/// Maximum encoded length permitted for a migration cursor.
pub const MIGRATION_CURSOR_MAX_LEN: u32 = 65_536;
/// Maximum encoded length permitted for a migration identifier.
pub const MIGRATION_IDENTIFIER_MAX_LEN: u32 = 256;

/// Wrapper type exposing the cursor limit as a `Get<u32>` implementation.
pub type MigrationCursorMaxLen = ConstU32<MIGRATION_CURSOR_MAX_LEN>;
/// Wrapper type exposing the identifier limit as a `Get<u32>` implementation.
pub type MigrationIdentifierMaxLen = ConstU32<MIGRATION_IDENTIFIER_MAX_LEN>;

/// List of multi-block migrations shared across DataHaven runtimes.
///
/// The tuple starts empty and can be extended with concrete migrations over time. Keeping it in a
/// shared module reduces duplication once we coordinate migrations across networks.
#[cfg(not(feature = "runtime-benchmarks"))]
pub type MultiBlockMigrationList = ();

/// During benchmarking we switch to the pallet-provided mocked migrations to guarantee success.
#[cfg(feature = "runtime-benchmarks")]
pub type MultiBlockMigrationList = pallet_migrations::mock_helpers::MockedMigrations;

/// Placeholder handler for migration status notifications. We do not emit any extra signals yet.
pub type MigrationStatusHandler = ();

/// Default handler triggered on migration failures. Freezing the chain mirrors Moonbeam’s
/// maintenance-mode behaviour by preventing further transactions until governance intervenes.
pub type FailedMigrationHandler = frame_support::migrations::FreezeChainOnFailedMigration;
