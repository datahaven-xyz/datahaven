// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use crate as ethereum_beacon_client;
use crate::config;
use alloc::default::Default;
use frame_support::{derive_impl, dispatch::DispatchResult, parameter_types};
use pallet_timestamp;
use snowbridge_beacon_primitives::{Fork, ForkVersions};
use snowbridge_inbound_queue_primitives::{Log, Proof};
use std::{fs::File, path::PathBuf};

type Block = frame_system::mocking::MockBlock<Test>;
use frame_support::traits::ConstU32;
use sp_runtime::BuildStorage;

fn load_fixture<T>(basename: String) -> Result<T, serde_json::Error>
where
    T: for<'de> serde::Deserialize<'de>,
{
    let filepath: PathBuf = [env!("CARGO_MANIFEST_DIR"), "tests", "fixtures", &basename]
        .iter()
        .collect();
    serde_json::from_reader(File::open(filepath).unwrap())
}

pub fn load_execution_proof_fixture() -> snowbridge_beacon_primitives::ExecutionProof {
    load_fixture("execution-proof.json".to_string()).unwrap()
}

pub fn load_checkpoint_update_fixture(
) -> snowbridge_beacon_primitives::CheckpointUpdate<{ config::SYNC_COMMITTEE_SIZE }> {
    load_fixture("initial-checkpoint.json".to_string()).unwrap()
}

pub fn load_sync_committee_update_fixture() -> snowbridge_beacon_primitives::Update<
    { config::SYNC_COMMITTEE_SIZE },
    { config::SYNC_COMMITTEE_BITS_SIZE },
> {
    load_fixture("sync-committee-update.json".to_string()).unwrap()
}

pub fn load_finalized_header_update_fixture() -> snowbridge_beacon_primitives::Update<
    { config::SYNC_COMMITTEE_SIZE },
    { config::SYNC_COMMITTEE_BITS_SIZE },
> {
    load_fixture("finalized-header-update.json".to_string()).unwrap()
}

pub fn load_next_sync_committee_update_fixture() -> snowbridge_beacon_primitives::Update<
    { config::SYNC_COMMITTEE_SIZE },
    { config::SYNC_COMMITTEE_BITS_SIZE },
> {
    load_fixture("next-sync-committee-update.json".to_string()).unwrap()
}

pub fn load_next_finalized_header_update_fixture() -> snowbridge_beacon_primitives::Update<
    { config::SYNC_COMMITTEE_SIZE },
    { config::SYNC_COMMITTEE_BITS_SIZE },
> {
    load_fixture("next-finalized-header-update.json".to_string()).unwrap()
}

pub fn load_sync_committee_update_period_0() -> Box<
    snowbridge_beacon_primitives::Update<
        { config::SYNC_COMMITTEE_SIZE },
        { config::SYNC_COMMITTEE_BITS_SIZE },
    >,
> {
    Box::new(load_fixture("sync-committee-update-period-0.json".to_string()).unwrap())
}

pub fn load_sync_committee_update_period_0_older_fixture() -> Box<
    snowbridge_beacon_primitives::Update<
        { config::SYNC_COMMITTEE_SIZE },
        { config::SYNC_COMMITTEE_BITS_SIZE },
    >,
> {
    Box::new(load_fixture("sync-committee-update-period-0-older.json".to_string()).unwrap())
}

pub fn load_sync_committee_update_period_0_newer_fixture() -> Box<
    snowbridge_beacon_primitives::Update<
        { config::SYNC_COMMITTEE_SIZE },
        { config::SYNC_COMMITTEE_BITS_SIZE },
    >,
> {
    Box::new(load_fixture("sync-committee-update-period-0-newer.json".to_string()).unwrap())
}

pub fn get_message_verification_payload() -> (Log, Proof) {
    let inbound_fixture = snowbridge_pallet_ethereum_client_fixtures::make_inbound_fixture();
    (inbound_fixture.event.event_log, inbound_fixture.event.proof)
}

frame_support::construct_runtime!(
    pub enum Test {
        System: frame_system::{Pallet, Call, Storage, Event<T>},
        Timestamp: pallet_timestamp::{Pallet, Call, Storage, Inherent},
        EthereumBeaconClient: ethereum_beacon_client::{Pallet, Call, Storage, Event<T>},
    }
);

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
    type Block = Block;
}

impl pallet_timestamp::Config for Test {
    type Moment = u64;
    type OnTimestampSet = ();
    type MinimumPeriod = ();
    type WeightInfo = ();
}

parameter_types! {
    pub const ChainForkVersions: ForkVersions = ForkVersions {
        genesis: Fork {
            version: [0, 0, 0, 0], // 0x00000000
            epoch: 0,
        },
        altair: Fork {
            version: [1, 0, 0, 0], // 0x01000000
            epoch: 0,
        },
        bellatrix: Fork {
            version: [2, 0, 0, 0], // 0x02000000
            epoch: 0,
        },
        capella: Fork {
            version: [3, 0, 0, 0], // 0x03000000
            epoch: 0,
        },
        deneb: Fork {
            version: [4, 0, 0, 0], // 0x04000000
            epoch: 0,
        },
        electra: Fork {
            version: [5, 0, 0, 0], // 0x05000000
            epoch: 0,
        },
        fulu: Fork {
            version: [6, 0, 0, 0], // 0x06000000
            epoch: 80000000000,
        }
    };
}

pub const FREE_SLOTS_INTERVAL: u32 = config::SLOTS_PER_EPOCH as u32;

impl ethereum_beacon_client::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type ForkVersions = ChainForkVersions;
    type FreeHeadersInterval = ConstU32<FREE_SLOTS_INTERVAL>;
    type WeightInfo = ();
}

// Build genesis storage according to the mock runtime.
pub fn new_tester() -> sp_io::TestExternalities {
    let t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();
    let ext = sp_io::TestExternalities::new(t);
    ext
}

pub fn initialize_storage() -> DispatchResult {
    let inbound_fixture = snowbridge_pallet_ethereum_client_fixtures::make_inbound_fixture();
    EthereumBeaconClient::store_finalized_header(
        inbound_fixture.finalized_header,
        inbound_fixture.block_roots_root,
    )
}
