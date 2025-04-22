// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use super::*;

use crate::{self as inbound_queue_v2, message_processors::XcmMessageProcessor};
use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use frame_support::{derive_impl, parameter_types, traits::ConstU32};
use hex_literal::hex;
use scale_info::TypeInfo;
use snowbridge_beacon_primitives::{
    types::deneb, BeaconHeader, ExecutionProof, VersionedExecutionPayloadHeader,
};
use snowbridge_core::TokenId;
use snowbridge_inbound_queue_primitives::{v2::MessageToXcm, Log, Proof, VerificationError};
use sp_core::H160;
use sp_runtime::{
    traits::{IdentityLookup, MaybeEquivalence, TryConvert},
    BuildStorage, DispatchError,
};
use sp_std::{convert::From, default::Default, marker::PhantomData};
use xcm::{opaque::latest::WESTEND_GENESIS_HASH, prelude::*};
type Block = frame_system::mocking::MockBlock<Test>;
pub use snowbridge_test_utils::mock_xcm::{MockXcmExecutor, MockXcmSender};

frame_support::construct_runtime!(
    pub enum Test
    {
        System: frame_system::{Pallet, Call, Storage, Event<T>},
        Balances: pallet_balances::{Pallet, Call, Storage, Config<T>, Event<T>},
        InboundQueue: inbound_queue_v2::{Pallet, Call, Storage, Event<T>},
    }
);

pub(crate) const ERROR_ADDRESS: [u8; 20] = hex!("0000000000000000000000000000000000000911");

pub type AccountId = sp_runtime::AccountId32;
type Balance = u128;

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
    type AccountId = AccountId;
    type Lookup = IdentityLookup<Self::AccountId>;
    type AccountData = pallet_balances::AccountData<u128>;
    type Block = Block;
}

parameter_types! {
    pub const ExistentialDeposit: u128 = 1;
}

#[derive_impl(pallet_balances::config_preludes::TestDefaultConfig)]
impl pallet_balances::Config for Test {
    type Balance = Balance;
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = System;
}

// Mock verifier
pub struct MockVerifier;

impl Verifier for MockVerifier {
    fn verify(log: &Log, _: &Proof) -> Result<(), VerificationError> {
        if log.address == ERROR_ADDRESS.into() {
            return Err(VerificationError::InvalidProof);
        }
        Ok(())
    }
}

const GATEWAY_ADDRESS: [u8; 20] = hex!["b1185ede04202fe62d38f5db72f71e38ff3e8305"];

#[cfg(feature = "runtime-benchmarks")]
impl<T: Config> BenchmarkHelper<T> for Test {
    // not implemented since the MockVerifier is used for tests
    fn initialize_storage(_: BeaconHeader, _: H256) {}
}

pub struct MockTokenIdConvert;
impl MaybeEquivalence<TokenId, Location> for MockTokenIdConvert {
    fn convert(_id: &TokenId) -> Option<Location> {
        Some(Location::parent())
    }
    fn convert_back(_loc: &Location) -> Option<TokenId> {
        None
    }
}

pub struct MockAccountLocationConverter<AccountId>(PhantomData<AccountId>);
impl<'a, AccountId: Clone + Clone> TryConvert<&'a AccountId, Location>
    for MockAccountLocationConverter<AccountId>
{
    fn try_convert(_who: &AccountId) -> Result<Location, &AccountId> {
        Ok(Location::here())
    }
}

parameter_types! {
    pub const EthereumNetwork: xcm::v5::NetworkId = xcm::v5::NetworkId::Ethereum { chain_id: 11155111 };
    pub const GatewayAddress: H160 = H160(GATEWAY_ADDRESS);
    pub InboundQueueLocation: InteriorLocation = [PalletInstance(84)].into();
    pub UniversalLocation: InteriorLocation =
        [GlobalConsensus(ByGenesis(WESTEND_GENESIS_HASH)), Parachain(1002)].into();
    pub AssetHubFromEthereum: Location = Location::new(1,[GlobalConsensus(ByGenesis(WESTEND_GENESIS_HASH)),Parachain(1000)]);
    pub SnowbridgeReward: BridgeReward = BridgeReward::Snowbridge;
    pub const CreateAssetCall: [u8;2] = [53, 0];
    pub const CreateAssetDeposit: u128 = 10_000_000_000u128;
}

/// Showcasing that we can handle multiple different rewards with the same pallet.
#[derive(
    Clone,
    Copy,
    Debug,
    Decode,
    Encode,
    DecodeWithMemTracking,
    Eq,
    MaxEncodedLen,
    PartialEq,
    TypeInfo,
)]
pub enum BridgeReward {
    /// Rewards for Snowbridge.
    Snowbridge,
}

parameter_types! {
    pub static RegisteredRewardsCount: u128 = 0;
}

impl RewardLedger<<mock::Test as frame_system::Config>::AccountId, BridgeReward, u128> for () {
    fn register_reward(
        _relayer: &<mock::Test as frame_system::Config>::AccountId,
        _reward: BridgeReward,
        _reward_balance: u128,
    ) {
        RegisteredRewardsCount::set(RegisteredRewardsCount::get().saturating_add(1));
    }
}

pub struct DummyPrefix;

impl MessageProcessor<AccountId> for DummyPrefix {
    fn can_process_message(_who: &AccountId, _message: &Message) -> bool {
        false
    }

    fn process_message(_who: AccountId, _message: Message) -> Result<[u8; 32], DispatchError> {
        panic!("DummyPrefix::process_message shouldn't be called");
    }
}

pub struct DummySuffix;

impl MessageProcessor<AccountId> for DummySuffix {
    fn can_process_message(_who: &AccountId, _message: &Message) -> bool {
        true
    }

    fn process_message(_who: AccountId, _message: Message) -> Result<[u8; 32], DispatchError> {
        panic!("DummySuffix::process_message shouldn't be called");
    }
}

impl inbound_queue_v2::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Verifier = MockVerifier;
    type RewardPayment = ();
    type GatewayAddress = GatewayAddress;
    type MessageProcessor = (
        DummyPrefix,
        XcmMessageProcessor<
            Test,
            MockXcmSender,
            MockXcmExecutor,
            MessageToXcm<
                CreateAssetCall,
                CreateAssetDeposit,
                EthereumNetwork,
                InboundQueueLocation,
                MockTokenIdConvert,
                GatewayAddress,
                UniversalLocation,
                AssetHubFromEthereum,
            >,
            MockAccountLocationConverter<AccountId>,
            ConstU32<1000>,
        >,
        DummySuffix,
    );
    #[cfg(feature = "runtime-benchmarks")]
    type Helper = Test;
    type WeightInfo = ();
    type RewardKind = BridgeReward;
    type DefaultRewardKind = SnowbridgeReward;
}

pub fn setup() {
    System::set_block_number(1);
}

pub fn new_tester() -> sp_io::TestExternalities {
    let storage = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();
    let mut ext: sp_io::TestExternalities = storage.into();
    ext.execute_with(setup);
    ext
}

// Generated from smoketests:
//   cd smoketests
//   ./make-bindings
//   cargo test --test register_token -- --nocapture
pub fn mock_event_log() -> Log {
    Log {
        // gateway address
        address: hex!("b1185ede04202fe62d38f5db72f71e38ff3e8305").into(),
        topics: vec![
            hex!("550e2067494b1736ea5573f2d19cdc0ac95b410fff161bf16f11c6229655ec9c").into(),
        ],
        // Nonce + Payload
        data: hex!("00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b1185ede04202fe62d38f5db72f71e38ff3e830500000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000009184e72a0000000000000000000000000000000000000000000000000000000015d3ef798000000000000000000000000000000000000000000000000000000015d3ef798000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b8ea8cb425d85536b158d661da1ef0895bb92f1d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000").into(),
    }
}

pub fn mock_event_log_invalid_gateway() -> Log {
    Log {
        // gateway address
        address: H160::zero(),
        topics: vec![
            hex!("550e2067494b1736ea5573f2d19cdc0ac95b410fff161bf16f11c6229655ec9c").into(),
        ],
        // Nonce + Payload
        data: hex!("00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b1185ede04202fe62d38f5db72f71e38ff3e830500000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000009184e72a0000000000000000000000000000000000000000000000000000000015d3ef798000000000000000000000000000000000000000000000000000000015d3ef798000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b8ea8cb425d85536b158d661da1ef0895bb92f1d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000").into(),
    }
}

pub fn mock_event_log_invalid_message() -> Log {
    Log {
		// gateway address
		address: hex!("b8ea8cb425d85536b158d661da1ef0895bb92f1d").into(),
		topics: vec![
			hex!("b61699d45635baed7500944331ea827538a50dbfef79180f2079e9185da627aa").into(),
		],
		// Nonce + Payload
		data: hex!("000000000000000000000000000000000000000000000000000000b8ea8cb425d85536b158d661da1ef0895bb92f1d000000000000000000000000000000000000000000000000001dcd6500000000000000000000000000000000000000000000000000000000003b9aca000000000000000000000000000000000000000000000000000000000059682f000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002cdeadbeef774667629726ec1fabebcec0d9139bd1c8f72a23deadbeef0000000000000000000000001dcd650000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000").into(),
	}
}

pub fn mock_execution_proof() -> ExecutionProof {
    ExecutionProof {
        header: BeaconHeader::default(),
        ancestry_proof: None,
        execution_header: VersionedExecutionPayloadHeader::Deneb(deneb::ExecutionPayloadHeader {
            parent_hash: Default::default(),
            fee_recipient: Default::default(),
            state_root: Default::default(),
            receipts_root: Default::default(),
            logs_bloom: vec![],
            prev_randao: Default::default(),
            block_number: 0,
            gas_limit: 0,
            gas_used: 0,
            timestamp: 0,
            extra_data: vec![],
            base_fee_per_gas: Default::default(),
            block_hash: Default::default(),
            transactions_root: Default::default(),
            withdrawals_root: Default::default(),
            blob_gas_used: 0,
            excess_blob_gas: 0,
        }),
        execution_branch: vec![],
    }
}

// Generated from smoketests:
//   cd smoketests
//   ./make-bindings
//   cargo test --test register_token_v2 -- --nocapture
pub fn mock_event_log_v2() -> Log {
    Log {
        // gateway address
        address: hex!("b1185ede04202fe62d38f5db72f71e38ff3e8305").into(),
        topics: vec![
            hex!("550e2067494b1736ea5573f2d19cdc0ac95b410fff161bf16f11c6229655ec9c").into(),
        ],
        // Nonce + Payload
        data: hex!("00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b1185ede04202fe62d38f5db72f71e38ff3e830500000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000009184e72a0000000000000000000000000000000000000000000000000000000015d3ef798000000000000000000000000000000000000000000000000000000015d3ef798000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b8ea8cb425d85536b158d661da1ef0895bb92f1d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000").into(),
    }
}
