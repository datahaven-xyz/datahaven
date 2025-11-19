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

//! Test utilities and mock runtime for DataHaven Native Transfer precompile tests

use super::*;

use frame_support::traits::Everything;
use frame_support::{construct_runtime, parameter_types, weights::Weight};
use pallet_evm::{EnsureAddressNever, EnsureAddressRoot, FrameSystemAccountProvider};
use parity_scale_codec::{Decode, Encode};
use precompile_utils::{mock_account, precompile_set::*, testing::MockAccount};
use snowbridge_core::TokenId;
use snowbridge_outbound_queue_primitives::v1::Ticket;
use snowbridge_outbound_queue_primitives::v2::{Message, SendMessage};
use snowbridge_outbound_queue_primitives::SendError;
use sp_core::H256;
use sp_runtime::BuildStorage;
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup},
    Perbill,
};

pub type AccountId = MockAccount;
pub type Balance = u128;

type Block = frame_system::mocking::MockBlockU32<Runtime>;

construct_runtime!(
    pub enum Runtime
    {
        System: frame_system,
        Balances: pallet_balances,
        EVM: pallet_evm,
        Timestamp: pallet_timestamp,
        NativeTransfer: pallet_datahaven_native_transfer,
    }
);

parameter_types! {
    pub const BlockHashCount: u32 = 250;
    pub const MaximumBlockWeight: Weight = Weight::from_parts(1024, 1);
    pub const MaximumBlockLength: u32 = 2 * 1024;
    pub const AvailableBlockRatio: Perbill = Perbill::one();
    pub const SS58Prefix: u8 = 42;
}

impl frame_system::Config for Runtime {
    type BaseCallFilter = Everything;
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeTask = RuntimeTask;
    type Nonce = u64;
    type Block = Block;
    type RuntimeCall = RuntimeCall;
    type Hash = H256;
    type Hashing = BlakeTwo256;
    type AccountId = AccountId;
    type Lookup = IdentityLookup<Self::AccountId>;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = BlockHashCount;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = pallet_balances::AccountData<Balance>;
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type BlockWeights = ();
    type BlockLength = ();
    type SS58Prefix = SS58Prefix;
    type OnSetCode = ();
    type MaxConsumers = frame_support::traits::ConstU32<16>;
    type SingleBlockMigrations = ();
    type MultiBlockMigrator = ();
    type PreInherents = ();
    type PostInherents = ();
    type PostTransactions = ();
    type ExtensionsWeightInfo = ();
}

parameter_types! {
    pub const ExistentialDeposit: u128 = 1;
}

impl pallet_balances::Config for Runtime {
    type MaxReserves = ();
    type ReserveIdentifier = [u8; 4];
    type MaxLocks = ();
    type Balance = Balance;
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = System;
    type WeightInfo = ();
    type RuntimeHoldReason = ();
    type FreezeIdentifier = ();
    type MaxFreezes = ();
    type RuntimeFreezeReason = ();
    type DoneSlashHandler = ();
}

pub type Precompiles<R> =
    PrecompileSetBuilder<R, (PrecompileAt<AddressU64<1>, DataHavenNativeTransferPrecompile<R>>,)>;

pub type PCall = DataHavenNativeTransferPrecompileCall<Runtime>;

mock_account!(NativeTransferPrecompile, |_| MockAccount::from_u64(1));
mock_account!(Alice, |_| MockAccount::from_u64(2));
mock_account!(Bob, |_| MockAccount::from_u64(3));
mock_account!(Root, |_| MockAccount::zero()); // Root account for sudo operations
mock_account!(EthereumSovereign, |_| MockAccount::from_u64(100));
mock_account!(FeeRecipient, |_| MockAccount::from_u64(101));

const MAX_POV_SIZE: u64 = 5 * 1024 * 1024;
const BLOCK_STORAGE_LIMIT: u64 = 40 * 1024;

parameter_types! {
    pub BlockGasLimit: U256 = U256::from(u64::MAX);
    pub PrecompilesValue: Precompiles<Runtime> = Precompiles::new();
    pub const WeightPerGas: Weight = Weight::from_parts(1, 0);
    pub GasLimitPovSizeRatio: u64 = {
        let block_gas_limit = BlockGasLimit::get().min(u64::MAX.into()).low_u64();
        block_gas_limit.saturating_div(MAX_POV_SIZE)
    };
    pub GasLimitStorageGrowthRatio: u64 = {
        let block_gas_limit = BlockGasLimit::get().min(u64::MAX.into()).low_u64();
        block_gas_limit.saturating_div(BLOCK_STORAGE_LIMIT)
    };
}

impl pallet_evm::Config for Runtime {
    type FeeCalculator = ();
    type GasWeightMapping = pallet_evm::FixedGasWeightMapping<Self>;
    type WeightPerGas = WeightPerGas;
    type CallOrigin = EnsureAddressRoot<AccountId>;
    type WithdrawOrigin = EnsureAddressNever<AccountId>;
    type AddressMapping = AccountId;
    type Currency = Balances;
    type RuntimeEvent = RuntimeEvent;
    type Runner = pallet_evm::runner::stack::Runner<Self>;
    type PrecompilesType = Precompiles<Runtime>;
    type PrecompilesValue = PrecompilesValue;
    type ChainId = ();
    type OnChargeTransaction = ();
    type BlockGasLimit = BlockGasLimit;
    type BlockHashMapping = pallet_evm::SubstrateBlockHashMapping<Self>;
    type FindAuthor = ();
    type OnCreate = ();
    type GasLimitPovSizeRatio = GasLimitPovSizeRatio;
    type GasLimitStorageGrowthRatio = GasLimitStorageGrowthRatio;
    type Timestamp = Timestamp;
    type WeightInfo = pallet_evm::weights::SubstrateWeight<Runtime>;
    type AccountProvider = FrameSystemAccountProvider<Runtime>;
}

parameter_types! {
    pub const MinimumPeriod: u64 = 5;
}

impl pallet_timestamp::Config for Runtime {
    type Moment = u64;
    type OnTimestampSet = ();
    type MinimumPeriod = MinimumPeriod;
    type WeightInfo = ();
}

// Mock OutboundQueue
pub struct MockOutboundQueue;

impl SendMessage for MockOutboundQueue {
    type Ticket = MockTicket;

    fn validate(_message: &Message) -> Result<Self::Ticket, SendError> {
        // For testing, always succeed validation
        Ok(MockTicket)
    }

    fn deliver(_ticket: Self::Ticket) -> Result<H256, SendError> {
        // For testing, always succeed delivery
        Ok(H256::zero())
    }
}

#[derive(Clone, Encode, Decode)]
pub struct MockTicket;

impl Ticket for MockTicket {
    fn message_id(&self) -> H256 {
        H256::zero()
    }
}

parameter_types! {
    pub EthereumSovereignAccountParam: AccountId = EthereumSovereign.into();
    pub FeeRecipientParam: AccountId = FeeRecipient.into();
    // Mock token ID - Some(TokenId) for testing
    // TokenId is H256, so we create it directly
    pub NativeTokenIdParam: Option<TokenId> = Some(H256([1u8; 32]));
}

// Mock origin that allows account 0 to pause/unpause (for testing)
pub struct EnsureAccountZero;
impl frame_support::traits::EnsureOrigin<RuntimeOrigin> for EnsureAccountZero {
    type Success = AccountId;

    fn try_origin(o: RuntimeOrigin) -> Result<Self::Success, RuntimeOrigin> {
        match o.clone().into() {
            Ok(frame_system::RawOrigin::Signed(account))
                if account == MockAccount::zero().into() =>
            {
                Ok(account)
            }
            _ => Err(o),
        }
    }
}

impl pallet_datahaven_native_transfer::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type EthereumSovereignAccount = EthereumSovereignAccountParam;
    type OutboundQueue = MockOutboundQueue;
    type FeeRecipient = FeeRecipientParam;
    type WeightInfo = ();
    type PauseOrigin = EnsureAccountZero;
    type NativeTokenId = NativeTokenIdParam;
}

pub(crate) struct ExtBuilder {
    balances: Vec<(AccountId, Balance)>,
    native_token_registered: bool,
}

impl Default for ExtBuilder {
    fn default() -> ExtBuilder {
        ExtBuilder {
            balances: vec![],
            native_token_registered: true,
        }
    }
}

impl ExtBuilder {
    pub(crate) fn with_balances(mut self, balances: Vec<(AccountId, Balance)>) -> Self {
        self.balances = balances;
        self
    }

    #[allow(dead_code)]
    pub(crate) fn without_native_token(mut self) -> Self {
        self.native_token_registered = false;
        self
    }

    pub(crate) fn build(self) -> sp_io::TestExternalities {
        let mut t = frame_system::GenesisConfig::<Runtime>::default()
            .build_storage()
            .expect("Frame system builds valid default genesis config");

        pallet_balances::GenesisConfig::<Runtime> {
            balances: self.balances,
        }
        .assimilate_storage(&mut t)
        .expect("Pallet balances storage can be assimilated");

        let mut ext = sp_io::TestExternalities::new(t);
        ext.execute_with(|| {
            System::set_block_number(1);

            // If native token not registered, update the parameter
            if !self.native_token_registered {
                // This would require a runtime upgrade in real scenario
                // For testing, we'll handle it differently in tests
            }
        });
        ext
    }
}

pub(crate) fn precompiles() -> Precompiles<Runtime> {
    PrecompilesValue::get()
}

pub(crate) fn balance(account: impl Into<AccountId>) -> Balance {
    Balances::free_balance(account.into())
}
