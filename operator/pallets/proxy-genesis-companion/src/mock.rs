// Copyright 2019-2025 PureStake Inc.
// This file is part of Moonbeam.

// Moonbeam is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Moonbeam is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Moonbeam.  If not, see <http://www.gnu.org/licenses/>.

//! A minimal runtime including the proxy-genesis-companion pallet
use super::*;
use crate as proxy_companion;
use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use frame_support::{
    construct_runtime, derive_impl, parameter_types,
    traits::{ConstU32, InstanceFilter},
};
use sp_runtime::{traits::BlakeTwo256, BuildStorage};

pub type AccountId = u64;
pub type Balance = u128;

type Block = frame_system::mocking::MockBlock<Test>;

// Configure a mock runtime to test the pallet.
construct_runtime!(
    pub enum Test
    {
        System: frame_system,
        Balances: pallet_balances,
        Proxy: pallet_proxy,
        ProxyGenesisCompanion: proxy_companion,
    }
);

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
    type Block = Block;
    type AccountData = pallet_balances::AccountData<Balance>;
}

parameter_types! {
    pub const ExistentialDeposit: u128 = 0;
}

#[derive_impl(pallet_balances::config_preludes::TestDefaultConfig)]
impl pallet_balances::Config for Test {
    type Balance = Balance;
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = System;
}

parameter_types! {
    pub const ProxyDepositBase: Balance = 1;
    pub const ProxyDepositFactor: Balance = 1;
    pub const MaxProxies: u16 = 32;
    pub const AnnouncementDepositBase: Balance = 1;
    pub const AnnouncementDepositFactor: Balance = 1;
    pub const MaxPending: u16 = 32;
}

/// The type used to represent the kinds of proxying allowed.
#[derive(
    Copy,
    Clone,
    Eq,
    PartialEq,
    Ord,
    PartialOrd,
    Encode,
    Decode,
    Debug,
    MaxEncodedLen,
    scale_info::TypeInfo,
    DecodeWithMemTracking,
    serde::Serialize,
    serde::Deserialize,
    Default,
)]
pub struct ProxyType;

impl InstanceFilter<RuntimeCall> for ProxyType {
    fn filter(&self, _c: &RuntimeCall) -> bool {
        true
    }

    fn is_superset(&self, _o: &Self) -> bool {
        true
    }
}

impl pallet_proxy::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type Currency = Balances;
    type ProxyType = ProxyType;
    type ProxyDepositBase = ProxyDepositBase;
    type ProxyDepositFactor = ProxyDepositFactor;
    type MaxProxies = ConstU32<32>;
    type WeightInfo = ();
    type MaxPending = ConstU32<32>;
    type CallHasher = BlakeTwo256;
    type AnnouncementDepositBase = AnnouncementDepositBase;
    type AnnouncementDepositFactor = AnnouncementDepositFactor;
    type BlockNumberProvider = ();
}

impl Config for Test {
    type ProxyType = ProxyType;
}

/// Externality builder for pallet proxy genesis companion's mock runtime
pub(crate) struct ExtBuilder {
    proxies: Vec<(AccountId, AccountId)>,
    balances: Vec<(AccountId, Balance)>,
}

impl Default for ExtBuilder {
    fn default() -> ExtBuilder {
        ExtBuilder {
            proxies: Vec::new(),
            balances: Vec::new(),
        }
    }
}

impl ExtBuilder {
    pub(crate) fn with_balances(mut self, balances: Vec<(AccountId, Balance)>) -> Self {
        self.balances = balances;
        self
    }

    pub(crate) fn with_proxies(mut self, proxies: Vec<(AccountId, AccountId)>) -> Self {
        self.proxies = proxies;
        self
    }

    pub(crate) fn build(self) -> sp_io::TestExternalities {
        let mut t = frame_system::GenesisConfig::<Test>::default()
            .build_storage()
            .expect("Frame system builds valid default genesis config");

        pallet_balances::GenesisConfig::<Test> {
            balances: self.balances,
            dev_accounts: Default::default(),
        }
        .assimilate_storage(&mut t)
        .expect("Pallet balances storage can be assimilated");

        let genesis_config = proxy_companion::GenesisConfig::<Test> {
            // Here we add the trivial proxy type and default duration.
            // This saves the test writer from having to always specify this.
            proxies: self
                .proxies
                .into_iter()
                .map(|(a, b)| (a, b, ProxyType, 100))
                .collect(),
        };
        genesis_config
            .assimilate_storage(&mut t)
            .expect("Pallet proxy genesis companion storage can be assimilated");

        let mut ext = sp_io::TestExternalities::new(t);
        ext.execute_with(|| System::set_block_number(1));
        ext
    }
}
