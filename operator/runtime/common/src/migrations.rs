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

//! Shared helpers for configuring `pallet-migrations` across DataHaven runtimes.
//!
//! The types and constants defined here keep the pallet configuration consistent between
//! networks while leaving each runtime free to decide which migrations should actually run.
//!
//! ## Migration History
//!
//! This section documents migrations that have been executed and subsequently removed from the
//! codebase. The migration framework tracks completed migrations on-chain, preventing re-execution.
//!
//! ### Executed Migrations (Code Removed)
//!
//! #### 1. EVM Pallet Alias Migration
//! - **Migration ID**: `datahaven-evm-mbm` (version 0 → 1)
//! - **Type**: Multi-block stepped migration
//! - **Original PR**: [#213](https://github.com/datahaven-xyz/datahaven/pull/213)
//! - **Intent**: Fixed `eth_getCode` and other Ethereum RPC calls by renaming the pallet_evm
//!   FRAME alias from `Evm` to `EVM`. Frontier's `StorageOverrideHandler` hardcodes the storage
//!   prefix as `twox_128("EVM")`, but our runtimes used `Evm`, causing all contract bytecode
//!   lookups to fail. This migration realigned the storage prefix with Frontier's expectations.
//! - **Storage Migrated**:
//!   - `Evm::AccountCodes` → `EVM::AccountCodes`
//!   - `Evm::AccountCodesMetadata` → `EVM::AccountCodesMetadata`
//!   - `Evm::AccountStorages` → `EVM::AccountStorages`
//! - **Execution**: Successfully executed on Testnet and Stagenet (39 keys migrated, <0.1% block weight)
//! - **Removed**: 2025-01 ([PR #318](https://github.com/datahaven-xyz/datahaven/pull/318))
//!
//! #### 2. EVM Chain ID Migration
//! - **Migration ID**: `dh-evm-chain-id-v1` (version 0 → 1)
//! - **Type**: Single-step migration
//! - **Original PR**: [#280](https://github.com/datahaven-xyz/datahaven/pull/280)
//! - **Intent**: Updated chain IDs for all three DataHaven environments to their final assigned
//!   values. The stored EVM chain ID in `pallet_evm_chain_id::ChainId` was migrated to match
//!   the configured constants after chain ID assignments were finalized.
//! - **Networks**:
//!   - Mainnet: Chain ID 55930 (no migration needed, set at genesis)
//!   - Testnet: Migrated to chain ID 55931
//!   - Stagenet: Migrated to chain ID 55932
//! - **Execution**: Successfully executed on Testnet and Stagenet
//! - **Removed**: 2025-01 ([PR #318](https://github.com/datahaven-xyz/datahaven/pull/318))

use frame_support::pallet_prelude::*;

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

/// Handler triggered on migration failures.
///
/// This handler attempts to enter SafeMode when a migration fails, allowing governance to
/// intervene and fix the issue while preventing regular user transactions from interacting
/// with potentially inconsistent storage state.
///
/// The handler is parameterized by the SafeMode pallet type from each runtime, with a fallback
/// to freezing the chain if SafeMode cannot be entered.
pub type FailedMigrationHandler<SafeMode> =
    frame_support::migrations::EnterSafeModeOnFailedMigration<
        SafeMode,
        frame_support::migrations::FreezeChainOnFailedMigration,
    >;
