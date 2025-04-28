// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use frame_support::{
	derive_impl, parameter_types,
	traits::{tokens::fungible::Mutate, ConstU128, Contains},
	PalletId,
};
use sp_core::H256;

use crate as snowbridge_system_v2;
use frame_system::EnsureRootWithSuccess;
use snowbridge_core::{
	gwei, meth, sibling_sovereign_account, AllowSiblingsOnly, ParaId, PricingParameters, Rewards,
};

pub use snowbridge_test_utils::{mock_origin::pallet_xcm_origin, mock_outbound_queue::*};
use sp_runtime::{
	traits::{AccountIdConversion, BlakeTwo256, IdentityLookup},
	AccountId32, BuildStorage, FixedU128,
};
use xcm::{opaque::latest::WESTEND_GENESIS_HASH, prelude::*};

#[cfg(feature = "runtime-benchmarks")]
use crate::BenchmarkHelper;

type Block = frame_system::mocking::MockBlock<Test>;
type Balance = u128;

pub type AccountId = AccountId32;

// Configure a mock runtime to test the pallet.
frame_support::construct_runtime!(
	pub enum Test
	{
		System: frame_system,
		Balances: pallet_balances::{Pallet, Call, Storage, Config<T>, Event<T>},
		XcmOrigin: pallet_xcm_origin::{Pallet, Origin},
		EthereumSystem: snowbridge_pallet_system,
		EthereumSystemV2: snowbridge_system_v2,
	}
);

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type RuntimeTask = RuntimeTask;
	type Hash = H256;
	type Hashing = BlakeTwo256;
	type AccountId = AccountId;
	type Lookup = IdentityLookup<Self::AccountId>;
	type RuntimeEvent = RuntimeEvent;
	type PalletInfo = PalletInfo;
	type AccountData = pallet_balances::AccountData<u128>;
	type Nonce = u64;
	type Block = Block;
}

#[derive_impl(pallet_balances::config_preludes::TestDefaultConfig)]
impl pallet_balances::Config for Test {
	type Balance = Balance;
	type ExistentialDeposit = ConstU128<1>;
	type AccountStore = System;
}

impl pallet_xcm_origin::Config for Test {
	type RuntimeOrigin = RuntimeOrigin;
}

parameter_types! {
	pub const AnyNetwork: Option<NetworkId> = None;
	pub const RelayNetwork: Option<NetworkId> = Some(NetworkId::ByGenesis(WESTEND_GENESIS_HASH));
	pub const RelayLocation: Location = Location::parent();
	pub UniversalLocation: InteriorLocation =
		[GlobalConsensus(RelayNetwork::get().unwrap()), Parachain(1013)].into();
	pub EthereumNetwork: NetworkId = Ethereum { chain_id: 11155111 };
	pub EthereumDestination: Location = Location::new(2,[GlobalConsensus(EthereumNetwork::get())]);
}

parameter_types! {
	pub const InitialFunding: u128 = 1_000_000_000_000;
	pub BridgeHubParaId: ParaId = ParaId::new(1002);
	pub AssetHubParaId: ParaId = ParaId::new(1000);
	pub TestParaId: u32 = 2000;
	pub RootLocation: Location = Location::parent();
	pub FrontendLocation: Location = Location::new(1, [Parachain(1000), PalletInstance(36)]);
}

#[cfg(feature = "runtime-benchmarks")]
impl BenchmarkHelper<RuntimeOrigin> for () {
	fn make_xcm_origin(location: Location) -> RuntimeOrigin {
		RuntimeOrigin::from(pallet_xcm_origin::Origin(location))
	}
}

pub struct AllowFromAssetHub;
impl Contains<Location> for AllowFromAssetHub {
	fn contains(location: &Location) -> bool {
		FrontendLocation::get() == *location
	}
}

impl crate::Config for Test {
	type RuntimeEvent = RuntimeEvent;
	type OutboundQueue = MockOkOutboundQueue;
	type FrontendOrigin = pallet_xcm_origin::EnsureXcm<AllowFromAssetHub>;
	type GovernanceOrigin = EnsureRootWithSuccess<AccountId, RootLocation>;
	type WeightInfo = ();
	#[cfg(feature = "runtime-benchmarks")]
	type Helper = ();
}

parameter_types! {
	pub TreasuryAccount: AccountId = PalletId(*b"py/trsry").into_account_truncating();
	pub Parameters: PricingParameters<u128> = PricingParameters {
		exchange_rate: FixedU128::from_rational(1, 400),
		fee_per_gas: gwei(20),
		rewards: Rewards { local: 10_000_000_000, remote: meth(1) },
		multiplier: FixedU128::from_rational(4, 3)
	};
	pub const InboundDeliveryCost: u128 = 1_000_000_000;
}

#[cfg(feature = "runtime-benchmarks")]
impl snowbridge_pallet_system::BenchmarkHelper<RuntimeOrigin> for () {
	fn make_xcm_origin(location: Location) -> RuntimeOrigin {
		RuntimeOrigin::from(pallet_xcm_origin::Origin(location))
	}
}

impl snowbridge_pallet_system::Config for Test {
	type RuntimeEvent = RuntimeEvent;
	type OutboundQueue = MockOkOutboundQueueV1;
	type SiblingOrigin = pallet_xcm_origin::EnsureXcm<AllowSiblingsOnly>;
	type AgentIdOf = snowbridge_core::AgentIdOf;
	type Token = Balances;
	type TreasuryAccount = TreasuryAccount;
	type DefaultPricingParameters = Parameters;
	type InboundDeliveryCost = InboundDeliveryCost;
	type WeightInfo = ();
	type UniversalLocation = UniversalLocation;
	type EthereumLocation = EthereumDestination;
	#[cfg(feature = "runtime-benchmarks")]
	type Helper = ();
}

// Build genesis storage according to the mock runtime.
pub fn new_test_ext(_genesis_build: bool) -> sp_io::TestExternalities {
	let storage = frame_system::GenesisConfig::<Test>::default().build_storage().unwrap();

	let mut ext: sp_io::TestExternalities = storage.into();
	let initial_amount = InitialFunding::get();
	let test_para_id = TestParaId::get();
	let sovereign_account = sibling_sovereign_account::<Test>(test_para_id.into());
	ext.execute_with(|| {
		System::set_block_number(1);
		Balances::mint_into(&AccountId32::from([0; 32]), initial_amount).unwrap();
		Balances::mint_into(&sovereign_account, initial_amount).unwrap();
	});
	ext
}

// Test helpers

pub fn make_xcm_origin(location: Location) -> RuntimeOrigin {
	pallet_xcm_origin::Origin(location).into()
}
