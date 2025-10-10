//! Shared helpers for configuring `pallet-migrations` across DataHaven runtimes.
//!
//! The types and constants defined here keep the pallet configuration consistent between
//! networks while leaving each runtime free to decide which migrations should actually run.

use core::marker::PhantomData;
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
pub type MultiBlockMigrationList<T> = (evm_alias::EvmAliasMigration<T>,);

/// During benchmarking we switch to the pallet-provided mocked migrations to guarantee success.
///
/// Note: The type parameter `T` is unused in benchmarking mode but kept for API consistency.
#[cfg(feature = "runtime-benchmarks")]
pub type MultiBlockMigrationList<T = ()> = pallet_migrations::mock_helpers::MockedMigrations;

/// Placeholder handler for migration status notifications. We do not emit any extra signals yet.
pub type MigrationStatusHandler = ();

/// Default handler triggered on migration failures.
pub type FailedMigrationHandler = frame_support::migrations::FreezeChainOnFailedMigration;

/// Multi-block migration for renaming the EVM pallet alias.
pub mod evm_alias {
    use core::marker::PhantomData;
    use frame_support::{
        migrations::{MigrationId, SteppedMigration, SteppedMigrationError},
        pallet_prelude::*,
        weights::WeightMeter,
        BoundedVec, StorageHasher,
    };
    use sp_io::storage;
    use sp_std::{convert::TryFrom, vec::Vec};

    #[cfg(feature = "try-runtime")]
    use sp_std::collections::btree_map::BTreeMap;

    /// Multi-block migration that renames the Frontier EVM pallet alias from `Evm` to `EVM`.
    pub struct EvmAliasMigration<T>(PhantomData<T>);

    impl<T> SteppedMigration for EvmAliasMigration<T>
    where
        T: pallet_evm::Config,
    {
        type Cursor = BoundedVec<u8, ConstU32<128>>;
        type Identifier = MigrationId<17>;

        fn id() -> Self::Identifier {
            MigrationId {
                pallet_id: *b"datahaven-evm-mbm",
                version_from: 0,
                version_to: 1,
            }
        }

        fn step(
            cursor: Option<Self::Cursor>,
            meter: &mut WeightMeter,
        ) -> Result<Option<Self::Cursor>, SteppedMigrationError> {
            if cursor.is_none() {
                log::info!(
                    "🚀 [EVM Migration] Starting pallet alias migration from 'Evm' to 'EVM'"
                );
            }

            let old_prefix = Twox128::hash(b"Evm");
            let new_prefix = Twox128::hash(b"EVM");
            let mut current_key: Vec<u8> = cursor
                .map(Into::into)
                .unwrap_or_else(|| old_prefix.to_vec());
            let mut processed = 0u32;
            let required = T::DbWeight::get().reads_writes(1, 2);

            loop {
                let next_key = match storage::next_key(&current_key) {
                    Some(next) if next.starts_with(&old_prefix) => next,
                    _ => {
                        log::info!(
                            "✅ [EVM Migration] Completed! Processed {} keys in this step",
                            processed
                        );
                        return Ok(None);
                    }
                };

                if meter.try_consume(required).is_err() {
                    if processed == 0 {
                        log::warn!(
                            "⚠️ [EVM Migration] Insufficient weight for even one key migration"
                        );
                        return Err(SteppedMigrationError::InsufficientWeight { required });
                    }
                    log::info!(
                        "⏸️ [EVM Migration] Pausing after migrating {} keys (weight limit reached)",
                        processed
                    );
                    return BoundedVec::try_from(current_key)
                        .map(Some)
                        .map_err(|_| SteppedMigrationError::Failed);
                }

                if let Some(value) = storage::get(&next_key) {
                    let mut new_key = Vec::with_capacity(next_key.len());
                    new_key.extend_from_slice(&new_prefix);
                    new_key.extend_from_slice(&next_key[16..]);
                    storage::set(&new_key, &value);
                }
                storage::clear(&next_key);

                processed = processed.saturating_add(1);
                current_key = next_key;
            }
        }

        #[cfg(feature = "try-runtime")]
        fn pre_upgrade() -> Result<Vec<u8>, sp_runtime::TryRuntimeError> {
            use codec::Encode;

            let storage_prefix = |item: &[u8]| {
                let mut key = [0u8; 32];
                key[0..16].copy_from_slice(&Twox128::hash(b"Evm"));
                key[16..32].copy_from_slice(&Twox128::hash(item));
                key
            };

            let mut counts = BTreeMap::new();

            for name in [
                b"AccountCodes" as &[u8],
                b"AccountCodesMetadata",
                b"AccountStorages",
            ] {
                let count = count_keys(&storage_prefix(name));
                counts.insert(name.to_vec(), count.encode());
            }

            Ok(counts.encode())
        }

        #[cfg(feature = "try-runtime")]
        fn post_upgrade(state: Vec<u8>) -> Result<(), sp_runtime::TryRuntimeError> {
            use codec::Decode;

            let snapshot: BTreeMap<Vec<u8>, Vec<u8>> =
                Decode::decode(&mut &state[..]).expect("Failed to decode snapshot");

            let old_storage = |item: &[u8]| {
                let mut key = [0u8; 32];
                key[0..16].copy_from_slice(&Twox128::hash(b"Evm"));
                key[16..32].copy_from_slice(&Twox128::hash(item));
                key
            };

            let new_storage = |item: &[u8]| {
                let mut key = [0u8; 32];
                key[0..16].copy_from_slice(&Twox128::hash(b"EVM"));
                key[16..32].copy_from_slice(&Twox128::hash(item));
                key
            };

            for name in [
                b"AccountCodes" as &[u8],
                b"AccountCodesMetadata",
                b"AccountStorages",
            ] {
                let old_count = count_keys(&old_storage(name));
                assert_eq!(old_count, 0, "Old Evm prefix still present after migration");

                let expected = snapshot
                    .get(name)
                    .and_then(|v| u32::decode(&mut &v[..]).ok())
                    .unwrap_or(0);
                let actual = count_keys(&new_storage(name));

                assert_eq!(expected, actual, "Migrated entry count mismatch");
            }

            Ok(())
        }
    }

    /// Helper function to count storage keys with a given prefix.
    #[cfg(any(feature = "try-runtime", test))]
    pub(crate) fn count_keys(prefix: &[u8]) -> u32 {
        let mut count = 0u32;
        let mut cursor = prefix.to_vec();
        loop {
            match storage::next_key(&cursor) {
                Some(next) if next.starts_with(prefix) => {
                    count = count.saturating_add(1);
                    cursor = next;
                }
                _ => break,
            }
        }
        count
    }
}

#[cfg(test)]
mod tests {
    use super::evm_alias::{count_keys, EvmAliasMigration};
    use codec::Encode;
    use frame_support::{
        derive_impl,
        migrations::SteppedMigration,
        parameter_types,
        weights::{constants::RocksDbWeight, Weight, WeightMeter},
        StorageHasher, Twox128,
    };
    use pallet_evm::AccountCodes;
    use sp_core::{H160, H256, U256};
    use sp_io::storage;
    use sp_runtime::BuildStorage;
    use sp_std::vec;

    frame_support::construct_runtime!(
        pub enum TestRuntime {
            System: frame_system::{Pallet, Call, Config<T>, Storage, Event<T>},
            Balances: pallet_balances::{Pallet, Call, Storage, Config<T>, Event<T>},
            Timestamp: pallet_timestamp::{Pallet, Call, Storage},
            EVM: pallet_evm::{Pallet, Call, Storage, Config<T>, Event<T>},
        }
    );

    parameter_types! {
        pub const BlockHashCount: u64 = 250;
        pub BlockWeights: frame_system::limits::BlockWeights =
            frame_system::limits::BlockWeights::simple_max(Weight::from_parts(1024, 0));
    }

    #[derive_impl(frame_system::config_preludes::SolochainDefaultConfig as frame_system::DefaultConfig)]
    impl frame_system::Config for TestRuntime {
        type Nonce = u64;
        type Block = frame_system::mocking::MockBlock<Self>;
        type BlockHashCount = BlockHashCount;
        type AccountData = pallet_balances::AccountData<u64>;
    }

    parameter_types! {
        pub const ExistentialDeposit: u64 = 0;
    }

    #[derive_impl(pallet_balances::config_preludes::TestDefaultConfig)]
    impl pallet_balances::Config for TestRuntime {
        type RuntimeHoldReason = ();
        type Balance = u64;
        type ExistentialDeposit = ExistentialDeposit;
        type AccountStore = System;
    }

    #[derive_impl(pallet_timestamp::config_preludes::TestDefaultConfig)]
    impl pallet_timestamp::Config for TestRuntime {}

    parameter_types! {
        pub MockPrecompiles: MockPrecompileSet = MockPrecompileSet;
    }

    #[derive_impl(pallet_evm::config_preludes::TestDefaultConfig)]
    impl pallet_evm::Config for TestRuntime {
        type AccountProvider = pallet_evm::FrameSystemAccountProvider<Self>;
        type FeeCalculator = FixedGasPrice;
        type BlockHashMapping = pallet_evm::SubstrateBlockHashMapping<Self>;
        type Currency = Balances;
        type Runner = pallet_evm::runner::stack::Runner<Self>;
        type Timestamp = Timestamp;
        type PrecompilesType = MockPrecompileSet;
        type PrecompilesValue = MockPrecompiles;
    }

    pub struct FixedGasPrice;
    impl pallet_evm::FeeCalculator for FixedGasPrice {
        fn min_gas_price() -> (U256, Weight) {
            (1_000_000_000u128.into(), Weight::from_parts(1_000, 0))
        }
    }

    pub struct MockPrecompileSet;
    impl pallet_evm::PrecompileSet for MockPrecompileSet {
        fn execute(
            &self,
            _handle: &mut impl pallet_evm::PrecompileHandle,
        ) -> Option<pallet_evm::PrecompileResult> {
            None
        }

        fn is_precompile(&self, _address: H160, _gas: u64) -> pallet_evm::IsPrecompileResult {
            pallet_evm::IsPrecompileResult::Answer {
                is_precompile: false,
                extra_cost: 0,
            }
        }
    }

    fn old_storage_prefix(item: &[u8]) -> [u8; 32] {
        let mut key = [0u8; 32];
        key[0..16].copy_from_slice(&Twox128::hash(b"Evm"));
        key[16..32].copy_from_slice(&Twox128::hash(item));
        key
    }

    fn raw_key(storage_name: &[u8], address: H160, index: Option<H256>) -> Vec<u8> {
        let mut key = old_storage_prefix(storage_name).to_vec();
        key.extend_from_slice(&sp_io::hashing::blake2_128(&address.encode()));
        key.extend_from_slice(address.as_bytes());
        if let Some(idx) = index {
            key.extend_from_slice(&sp_io::hashing::blake2_128(&idx.encode()));
            key.extend_from_slice(idx.as_bytes());
        }
        key
    }

    #[test]
    fn multi_block_evm_alias_migration_moves_all_entries() {
        let mut storage = frame_system::GenesisConfig::<TestRuntime>::default()
            .build_storage()
            .unwrap();
        pallet_balances::GenesisConfig::<TestRuntime>::default()
            .assimilate_storage(&mut storage)
            .unwrap();
        let mut ext = sp_io::TestExternalities::new(storage);
        ext.execute_with(|| {
            let addresses: Vec<H160> = (1u64..=3).map(H160::from_low_u64_be).collect();

            for (idx, &address) in addresses.iter().enumerate() {
                storage::set(
                    &raw_key(b"AccountCodes", address, None),
                    &vec![idx as u8; 3].encode(),
                );
                storage::set(
                    &raw_key(b"AccountCodesMetadata", address, None),
                    &(42u64 + idx as u64, H256::repeat_byte(idx as u8)).encode(),
                );
                storage::set(
                    &raw_key(
                        b"AccountStorages",
                        address,
                        Some(H256::repeat_byte(0xAA + idx as u8)),
                    ),
                    &H256::repeat_byte(idx as u8).encode(),
                );
            }

            let mut cursor = None;
            loop {
                let mut meter = WeightMeter::with_limit(RocksDbWeight::get().reads_writes(1, 2));
                match EvmAliasMigration::<TestRuntime>::step(cursor, &mut meter) {
                    Ok(None) => break,
                    Ok(Some(next)) => cursor = Some(next),
                    Err(err) => panic!("migration failed: {:?}", err),
                }
            }

            for address in addresses {
                assert!(!AccountCodes::<TestRuntime>::get(address).is_empty());
            }

            assert_eq!(count_keys(&old_storage_prefix(b"AccountCodes")[..]), 0);
            assert_eq!(
                count_keys(&old_storage_prefix(b"AccountCodesMetadata")[..]),
                0
            );
            assert_eq!(count_keys(&old_storage_prefix(b"AccountStorages")[..]), 0);
        });
    }
}
