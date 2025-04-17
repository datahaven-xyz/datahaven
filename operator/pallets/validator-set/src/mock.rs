// Copyright (C) Gautam Dhameja.
// Copyright (C) Parity Technologies (UK) Ltd.
// SPDX-License-Identifier: Apache-2.0

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//! Mock helpers for Validator Set pallet.

#![cfg(test)]

use crate as pallet_validator_set;
use frame_support::{
    parameter_types,
    traits::{ConstU32, ConstU64, OnFinalize, OnInitialize, OneSessionHandler},
};
use frame_system::{pallet_prelude::BlockNumberFor, EnsureRoot};
use pallet_session::ShouldEndSession;
use sp_core::H256;
use sp_runtime::{
    impl_opaque_keys,
    testing::UintAuthorityId,
    traits::{BlakeTwo256, ConvertInto, IdentityLookup},
    BuildStorage,
};
use std::cell::Cell;

pub type AccountId = u64;
type Block = frame_system::mocking::MockBlock<Test>;

frame_support::construct_runtime!(
    pub struct Test {
        System: frame_system,
        ValidatorSet: pallet_validator_set,
        Session: pallet_session,
    }
);

pub struct MockSessionHandler;

impl OneSessionHandler<AccountId> for MockSessionHandler {
    type Key = UintAuthorityId;

    fn on_genesis_session<'a, I: 'a>(_validators: I)
    where
        I: Iterator<Item = (&'a AccountId, Self::Key)>,
    {
    }

    fn on_new_session<'a, I: 'a>(_changed: bool, _validators: I, _queued_validators: I)
    where
        I: Iterator<Item = (&'a AccountId, Self::Key)>,
    {
    }

    fn on_disabled(_i: u32) {}
}

impl sp_runtime::BoundToRuntimeAppPublic for MockSessionHandler {
    type Public = UintAuthorityId;
}

impl_opaque_keys! {
    pub struct MockSessionKeys {
        pub mock: MockSessionHandler,
    }
}

impl From<AccountId> for MockSessionKeys {
    fn from(who: AccountId) -> Self {
        Self {
            mock: UintAuthorityId(who),
        }
    }
}

thread_local! {
    static END_SESSION: Cell<bool> = Cell::new(false);
}

pub struct MockShouldEndSession;

impl<T> ShouldEndSession<T> for MockShouldEndSession {
    fn should_end_session(_now: T) -> bool {
        END_SESSION.replace(false)
    }
}

pub fn next_block() {
    System::on_finalize(System::block_number());
    System::set_block_number(System::block_number() + 1);
    System::on_initialize(System::block_number());
    Session::on_initialize(System::block_number());
}

pub fn next_session() {
    END_SESSION.set(true);
    next_block();
    assert!(!END_SESSION.get());
}

pub fn new_test_ext() -> sp_io::TestExternalities {
    let validators = vec![1, 2, 3];
    let keys = validators
        .iter()
        .map(|who| (*who, *who, (*who).into()))
        .collect();
    let t = RuntimeGenesisConfig {
        system: Default::default(),
        session: SessionConfig {
            keys,
            non_authority_keys: Default::default(),
        },
        validator_set: ValidatorSetConfig {
            initial_validators: validators.try_into().unwrap(),
        },
    }
    .build_storage()
    .unwrap();
    t.into()
}

impl frame_system::Config for Test {
    type BaseCallFilter = frame_support::traits::Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type Nonce = u64;
    type RuntimeCall = RuntimeCall;
    type Hash = H256;
    type Hashing = BlakeTwo256;
    type AccountId = AccountId;
    type Lookup = IdentityLookup<AccountId>;
    type Block = Block;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = ConstU64<250>;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = ();
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = ();
    type OnSetCode = ();
    type MaxConsumers = ConstU32<16>;
    type RuntimeTask = ();
    type SingleBlockMigrations = ();
    type MultiBlockMigrator = ();
    type PreInherents = ();
    type PostInherents = ();
    type PostTransactions = ();
    type ExtensionsWeightInfo = ();
}

parameter_types! {
    pub const SetKeysCooldownBlocks: BlockNumberFor<Test> = 2;
}

impl pallet_validator_set::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = ();
    type AddRemoveOrigin = EnsureRoot<AccountId>;
    type MaxAuthorities = ConstU32<6>;
    type SetKeysCooldownBlocks = SetKeysCooldownBlocks;
}

impl pallet_session::Config for Test {
    type ValidatorId = AccountId;
    type ValidatorIdOf = ConvertInto;
    type ShouldEndSession = MockShouldEndSession;
    type NextSessionRotation = ();
    type SessionManager = ValidatorSet;
    type SessionHandler = (MockSessionHandler,);
    type Keys = MockSessionKeys;
    type WeightInfo = ();
    type RuntimeEvent = RuntimeEvent;
}

impl pallet_session::historical::Config for Test {
    type FullIdentification = Self::ValidatorId;
    type FullIdentificationOf = Self::ValidatorIdOf;
}
