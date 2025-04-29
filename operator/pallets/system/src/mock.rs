// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use crate as snowbridge_system;
use frame_support::{
	derive_impl, parameter_types,
	traits::{tokens::fungible::Mutate, ConstU128, ConstU8},
	weights::IdentityFee,
	PalletId,
};
use sp_core::H256;
use xcm_executor::traits::ConvertLocation;

use snowbridge_core::{
	gwei, meth, sibling_sovereign_account, AgentId, AllowSiblingsOnly, ParaId, PricingParameters,
	Rewards,
};
use snowbridge_outbound_queue_primitives::v1::ConstantGasMeter;
use sp_runtime::{
	traits::{AccountIdConversion, BlakeTwo256, IdentityLookup, Keccak256},
	AccountId32, BuildStorage, FixedU128,
};
use xcm::prelude::*;

#[cfg(feature = "runtime-benchmarks")]
use crate::BenchmarkHelper;

type Block = frame_system::mocking::MockBlock<Test>;
type Balance = u128;

pub type AccountId = AccountId32;

// A stripped-down version of pallet-xcm that only inserts an XCM origin into the runtime
#[allow(dead_code)]
#[frame_support::pallet]
mod pallet_xcm_origin {
	use frame_support::{
		pallet_prelude::*,
		traits::{Contains, OriginTrait},
	};
	use xcm::latest::prelude::*;

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	#[pallet::config]
	pub trait Config: frame_system::Config {
		type RuntimeOrigin: From<Origin> + From<<Self as frame_system::Config>::RuntimeOrigin>;
	}

	// Insert this custom Origin into the aggregate RuntimeOrigin
	#[pallet::origin]
	#[derive(
		PartialEq,
		Eq,
		Clone,
		Encode,
		Decode,
		RuntimeDebug,
		TypeInfo,
		MaxEncodedLen,
	)]
	pub struct Origin(pub Location);

	impl From<Location> for Origin {
		fn from(location: Location) -> Origin {
			Origin(location)
		}
	}

	/// `EnsureOrigin` implementation succeeding with a `Location` value to recognize and
	/// filter the contained location
	pub struct EnsureXcm<F>(PhantomData<F>);
	impl<O: OriginTrait + From<Origin>, F: Contains<Location>> EnsureOrigin<O> for EnsureXcm<F>
	where
		for<'a> &'a O::PalletsOrigin: TryInto<&'a Origin>,
	{
		type Success = Location;

		fn try_origin(outer: O) -> Result<Self::Success, O> {
			match outer.caller().try_into() {
				Ok(Origin(ref location)) if F::contains(location) => return Ok(location.clone()),
				_ => (),
			}

			Err(outer)
		}

		#[cfg(feature = "runtime-benchmarks")]
		fn try_successful_origin() -> Result<O, ()> {
			Ok(O::from(Origin(Location::new(1, [Parachain(2000)]))))
		}
	}
}

// Configure a mock runtime to test the pallet.
frame_support::construct_runtime!(
	pub enum Test
	{
		System: frame_system,
		Balances: pallet_balances::{Pallet, Call, Storage, Config<T>, Event<T>},
		XcmOrigin: pallet_xcm_origin::{Pallet, Origin},
		OutboundQueue: snowbridge_pallet_outbound_queue::{Pallet, Call, Storage, Event<T>},
		EthereumSystem: snowbridge_system,
		MessageQueue: pallet_message_queue::{Pallet, Call, Storage, Event<T>}
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
	pub const HeapSize: u32 = 32 * 1024;
	pub const MaxStale: u32 = 32;
	pub static ServiceWeight: Option<Weight> = Some(Weight::from_parts(100, 100));
}

impl pallet_message_queue::Config for Test {
	type RuntimeEvent = RuntimeEvent;
	type WeightInfo = ();
	type MessageProcessor = OutboundQueue;
	type Size = u32;
	type QueueChangeHandler = ();
	type HeapSize = HeapSize;
	type MaxStale = MaxStale;
	type ServiceWeight = ServiceWeight;
	type IdleMaxServiceWeight = ();
	type QueuePausedQuery = ();
}

parameter_types! {
	pub const MaxMessagePayloadSize: u32 = 1024;
	pub const MaxMessagesPerBlock: u32 = 20;
	pub const OwnParaId: ParaId = ParaId::new(1013);
}

impl snowbridge_pallet_outbound_queue::Config for Test {
	type RuntimeEvent = RuntimeEvent;
	type Hashing = Keccak256;
	type MessageQueue = MessageQueue;
	type Decimals = ConstU8<10>;
	type MaxMessagePayloadSize = MaxMessagePayloadSize;
	type MaxMessagesPerBlock = MaxMessagesPerBlock;
	type GasMeter = ConstantGasMeter;
	type Balance = u128;
	type PricingParameters = EthereumSystem;
	type Channels = EthereumSystem;
	type WeightToFee = IdentityFee<u128>;
	type WeightInfo = ();
}

parameter_types! {
	pub const SS58Prefix: u8 = 42;
	pub const AnyNetwork: Option<NetworkId> = None;
	pub const RelayNetwork: Option<NetworkId> = Some(NetworkId::Polkadot);
	pub const RelayLocation: Location = Location::parent();
	pub UniversalLocation: InteriorLocation =
		[GlobalConsensus(RelayNetwork::get().unwrap()), Parachain(1013)].into();
	pub EthereumNetwork: NetworkId = NetworkId::Ethereum { chain_id: 11155111 };
	pub EthereumDestination: Location = Location::new(2,[GlobalConsensus(EthereumNetwork::get())]);
}

pub const DOT: u128 = 10_000_000_000;

parameter_types! {
	pub TreasuryAccount: AccountId = PalletId(*b"py/trsry").into_account_truncating();
	pub Fee: u64 = 1000;
	pub const InitialFunding: u128 = 1_000_000_000_000;
	pub BridgeHubParaId: ParaId = ParaId::new(1002);
	pub AssetHubParaId: ParaId = ParaId::new(1000);
	pub TestParaId: u32 = 2000;
	pub Parameters: PricingParameters<u128> = PricingParameters {
		exchange_rate: FixedU128::from_rational(1, 400),
		fee_per_gas: gwei(20),
		rewards: Rewards { local: DOT, remote: meth(1) },
		multiplier: FixedU128::from_rational(4, 3)
	};
	pub const InboundDeliveryCost: u128 = 1_000_000_000;
}

#[cfg(feature = "runtime-benchmarks")]
impl BenchmarkHelper<RuntimeOrigin> for () {
	fn make_xcm_origin(location: Location) -> RuntimeOrigin {
		RuntimeOrigin::from(pallet_xcm_origin::Origin(location))
	}
}

impl crate::Config for Test {
	type RuntimeEvent = RuntimeEvent;
	type OutboundQueue = OutboundQueue;
	type SiblingOrigin = pallet_xcm_origin::EnsureXcm<AllowSiblingsOnly>;
	type AgentIdOf = snowbridge_core::AgentIdOf;
	type TreasuryAccount = TreasuryAccount;
	type Token = Balances;
	type DefaultPricingParameters = Parameters;
	type WeightInfo = ();
	type InboundDeliveryCost = InboundDeliveryCost;
	type UniversalLocation = UniversalLocation;
	type EthereumLocation = EthereumDestination;
	#[cfg(feature = "runtime-benchmarks")]
	type Helper = ();
}

// Build genesis storage according to the mock runtime.
pub fn new_test_ext(genesis_build: bool) -> sp_io::TestExternalities {
	let mut storage = frame_system::GenesisConfig::<Test>::default().build_storage().unwrap();

	if genesis_build {
		crate::GenesisConfig::<Test> {
			para_id: OwnParaId::get(),
			asset_hub_para_id: AssetHubParaId::get(),
			_config: Default::default(),
		}
		.assimilate_storage(&mut storage)
		.unwrap();
	}

	let mut ext: sp_io::TestExternalities = storage.into();
	let initial_amount = InitialFunding::get();
	let test_para_id = TestParaId::get();
	let sovereign_account = sibling_sovereign_account::<Test>(test_para_id.into());
	let treasury_account = TreasuryAccount::get();
	ext.execute_with(|| {
		System::set_block_number(1);
		Balances::mint_into(&AccountId32::from([0; 32]), initial_amount).unwrap();
		Balances::mint_into(&sovereign_account, initial_amount).unwrap();
		Balances::mint_into(&treasury_account, initial_amount).unwrap();
	});
	ext
}

// Test helpers

pub fn make_agent_id(location: Location) -> AgentId {
	<Test as snowbridge_system::Config>::AgentIdOf::convert_location(&location)
		.expect("convert location")
}
