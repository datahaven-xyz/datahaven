// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024 DataHaven <hello@datahaven.io>

use {
    crate::{self as pallet_datahaven_native_transfer},
    frame_support::{
        parameter_types,
        traits::{ConstU32, Everything},
    },
    frame_system::EnsureRoot,
    snowbridge_outbound_queue_primitives::v2::{Message as OutboundMessage, SendMessage},
    sp_core::H256,
    sp_runtime::{
        traits::{BlakeTwo256, IdentityLookup},
        BuildStorage,
    },
};

type Block = frame_system::mocking::MockBlock<Test>;

// Configure a mock runtime to test the pallet.
frame_support::construct_runtime!(
    pub enum Test
    {
        System: frame_system,
        Balances: pallet_balances,
        DataHavenNativeTransfer: pallet_datahaven_native_transfer,
    }
);

impl frame_system::Config for Test {
    type BaseCallFilter = Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type Nonce = u64;
    type Hash = H256;
    type Hashing = BlakeTwo256;
    type AccountId = u64;
    type Lookup = IdentityLookup<Self::AccountId>;
    type Block = Block;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = BlockHashCount;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = pallet_balances::AccountData<u128>;
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = SS58Prefix;
    type OnSetCode = ();
    type MaxConsumers = ConstU32<16>;
    type RuntimeTask = ();
    type ExtensionsWeightInfo = ();
    type SingleBlockMigrations = ();
    type MultiBlockMigrator = ();
    type PreInherents = ();
    type PostInherents = ();
    type PostTransactions = ();
}

impl pallet_balances::Config for Test {
    type Balance = u128;
    type DustRemoval = ();
    type RuntimeEvent = RuntimeEvent;
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = System;
    type WeightInfo = ();
    type MaxLocks = ();
    type MaxReserves = MaxReserves;
    type ReserveIdentifier = [u8; 8];
    type RuntimeHoldReason = ();
    type FreezeIdentifier = ();
    type MaxFreezes = ConstU32<0>;
    type RuntimeFreezeReason = ();
    type DoneSlashHandler = ();
}

// Simple mock that always succeeds
pub struct MockOkOutboundQueue;

impl SendMessage for MockOkOutboundQueue {
    type Ticket = OutboundMessage;

    fn validate(
        message: &OutboundMessage,
    ) -> Result<Self::Ticket, snowbridge_outbound_queue_primitives::SendError> {
        Ok(message.clone())
    }

    fn deliver(
        _ticket: Self::Ticket,
    ) -> Result<H256, snowbridge_outbound_queue_primitives::SendError> {
        Ok(H256::zero())
    }
}

parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub const SS58Prefix: u8 = 42;
}

parameter_types! {
    pub const ExistentialDeposit: u128 = 1;
    pub const MaxReserves: u32 = 50;
}

parameter_types! {
    pub const EthereumSovereignAccount: u64 = 999;
    pub const DataHavenTokenId: H256 = H256::repeat_byte(0x01);
    pub const FeeRecipientAccount: u64 = 1000;
}

parameter_types! {
    pub const MockNativeTokenId: Option<H256> = Some(H256::repeat_byte(0x01));
}

impl crate::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type EthereumSovereignAccount = EthereumSovereignAccount;
    type OutboundQueue = MockOkOutboundQueue;
    type NativeTokenId = MockNativeTokenId;
    type FeeRecipient = FeeRecipientAccount;
    type WeightInfo = ();
    type PauseOrigin = EnsureRoot<u64>;
}

pub const ALICE: u64 = 1;
pub const BOB: u64 = 2;
pub const CHARLIE: u64 = 3;
pub const ETHEREUM_SOVEREIGN: u64 = 999;
pub const FEE_RECIPIENT: u64 = 1000;
pub const INITIAL_BALANCE: u128 = 10_000;

pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();

    let balances = vec![
        (ALICE, INITIAL_BALANCE),
        (BOB, INITIAL_BALANCE),
        (CHARLIE, INITIAL_BALANCE),
    ];
    pallet_balances::GenesisConfig::<Test> { balances }
        .assimilate_storage(&mut t)
        .unwrap();

    let mut ext: sp_io::TestExternalities = t.into();
    ext.execute_with(|| {
        System::set_block_number(1);
    });
    ext
}

pub fn last_event() -> RuntimeEvent {
    System::events().pop().expect("Event expected").event
}
