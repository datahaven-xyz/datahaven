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

//! Common test utilities for DataHaven testnet runtime tests

use datahaven_testnet_runtime::{
    currency::{HAVE, SUPPLY_FACTOR},
    AccountId,
    Balance,
    Runtime,
    RuntimeCall,
    RuntimeEvent,
    RuntimeOrigin,
    Session,
    SessionKeys,
    System,
    // Import governance pallets for common helpers
    TechnicalCommittee,
    TreasuryCouncil,
};
use frame_support::{
    assert_ok,
    traits::{OnFinalize, OnInitialize},
};
use frame_system::pallet_prelude::BlockNumberFor;
use pallet_im_online::sr25519::AuthorityId as ImOnlineId;
use sp_consensus_babe::AuthorityId as BabeId;
use sp_consensus_beefy::ecdsa_crypto::AuthorityId as BeefyId;
use sp_consensus_grandpa::AuthorityId as GrandpaId;
use sp_core::{crypto::UncheckedFrom, H160, H256};
use sp_runtime::{
    traits::{BlakeTwo256, Hash},
    BuildStorage,
};

/// Test account constants
pub const ALICE: [u8; 20] = [1u8; 20];
pub const BOB: [u8; 20] = [2u8; 20];
pub const CHARLIE: [u8; 20] = [3u8; 20];
pub const DAVE: [u8; 20] = [4u8; 20];
pub const EVE: [u8; 20] = [5u8; 20];

/// Helper function to convert account constants to AccountId
pub fn account_id(account: [u8; 20]) -> AccountId {
    H160(account).into()
}

/// Default balance for test accounts (1M DH tokens)
pub const DEFAULT_BALANCE: Balance = 1_000_000 * HAVE * SUPPLY_FACTOR;

/// Governance test specific balances
#[allow(dead_code)]
pub const INITIAL_BALANCE: Balance = 1_000_000 * HAVE * SUPPLY_FACTOR; // 1M DH tokens for governance tests
#[allow(dead_code)]
pub const PROPOSAL_BOND: Balance = 100 * HAVE * SUPPLY_FACTOR;
#[allow(dead_code)]
pub const VOTING_BALANCE: Balance = 10 * HAVE * SUPPLY_FACTOR;

/// Generate test session keys for a given account
pub fn generate_session_keys(account: AccountId) -> SessionKeys {
    let account_bytes: &[u8; 20] = account.as_ref();
    let first_byte = account_bytes[0];

    SessionKeys {
        babe: BabeId::unchecked_from([first_byte; 32]),
        grandpa: GrandpaId::unchecked_from([first_byte; 32]),
        im_online: ImOnlineId::unchecked_from([first_byte; 32]),
        beefy: BeefyId::unchecked_from([first_byte; 33]),
    }
}

/// Test runtime builder following Moonbeam pattern
#[derive(Default)]
pub struct ExtBuilder {
    balances: Vec<(AccountId, Balance)>,
    with_default_balances: bool,
    validators: Vec<AccountId>,
    with_default_validators: bool,
    sudo_key: Option<AccountId>,
}

impl ExtBuilder {
    pub fn default() -> Self {
        Self {
            balances: vec![],
            with_default_balances: true,
            validators: vec![],
            with_default_validators: true,
            sudo_key: None,
        }
    }

    /// Alternative constructor for governance tests with smaller balances
    #[allow(dead_code)]
    pub fn governance() -> Self {
        Self {
            balances: vec![
                (alice(), INITIAL_BALANCE),
                (bob(), INITIAL_BALANCE),
                (charlie(), INITIAL_BALANCE),
                (dave(), INITIAL_BALANCE),
                (eve(), INITIAL_BALANCE),
            ],
            with_default_balances: false,
            validators: vec![],
            with_default_validators: true,
            sudo_key: None,
        }
    }

    #[allow(dead_code)]
    pub fn with_balances(mut self, balances: Vec<(AccountId, Balance)>) -> Self {
        self.balances = balances;
        self.with_default_balances = false;
        self
    }

    #[allow(dead_code)]
    pub fn with_validators(mut self, validators: Vec<AccountId>) -> Self {
        self.validators = validators;
        self.with_default_validators = false;
        self
    }

    #[allow(dead_code)]
    pub fn with_sudo(mut self, sudo_key: AccountId) -> Self {
        self.sudo_key = Some(sudo_key);
        self
    }

    pub fn build(self) -> sp_io::TestExternalities {
        let mut balances = self.balances;
        let mut validators = self.validators;

        if self.with_default_balances {
            balances.extend_from_slice(&[
                (account_id(ALICE), DEFAULT_BALANCE),
                (account_id(BOB), DEFAULT_BALANCE),
                (account_id(CHARLIE), DEFAULT_BALANCE),
                (account_id(DAVE), DEFAULT_BALANCE),
                (account_id(EVE), DEFAULT_BALANCE),
                // Fund the treasury account (fee recipient) with initial balance
                (
                    datahaven_testnet_runtime::configs::TreasuryAccount::get(),
                    DEFAULT_BALANCE,
                ),
            ]);
        }

        if self.with_default_validators {
            validators.extend_from_slice(&[account_id(CHARLIE), account_id(DAVE)]);
        }

        let mut t = frame_system::GenesisConfig::<Runtime>::default()
            .build_storage()
            .expect("System pallet builds valid default genesis config");

        pallet_balances::GenesisConfig::<Runtime> { balances }
            .assimilate_storage(&mut t)
            .expect("Pallet balances storage can be assimilated");

        // Set up session keys for validators
        let session_keys: Vec<_> = validators
            .iter()
            .map(|validator| {
                (
                    validator.clone(),
                    validator.clone(),
                    generate_session_keys(validator.clone()),
                )
            })
            .collect();

        pallet_session::GenesisConfig::<Runtime> {
            keys: session_keys,
            non_authority_keys: vec![],
        }
        .assimilate_storage(&mut t)
        .expect("Session genesis config can be assimilated");

        // Configure Sudo if specified
        if let Some(sudo_key) = self.sudo_key {
            pallet_sudo::GenesisConfig::<Runtime> {
                key: Some(sudo_key),
            }
            .assimilate_storage(&mut t)
            .expect("Sudo genesis config can be assimilated");
        }

        let mut ext = sp_io::TestExternalities::new(t);
        ext.execute_with(|| {
            System::set_block_number(1);
            // Initialize session
            <Session as OnInitialize<BlockNumberFor<Runtime>>>::on_initialize(1);
        });
        ext
    }
}

#[allow(dead_code)]
pub fn root_origin() -> RuntimeOrigin {
    RuntimeOrigin::root()
}

#[allow(dead_code)]
pub fn datahaven_token_metadata() -> snowbridge_core::AssetMetadata {
    snowbridge_core::AssetMetadata {
        name: b"MOCK".to_vec().try_into().unwrap(),
        symbol: b"wMOCK".to_vec().try_into().unwrap(),
        decimals: 18,
    }
}

/// Get validator AccountId by index (for testing)
/// Index 0: Charlie, Index 1: Dave
#[allow(dead_code)]
pub fn get_validator_by_index(index: u32) -> AccountId {
    match index {
        0 => account_id(CHARLIE),
        1 => account_id(DAVE),
        _ => panic!("Only validators 0 (Charlie) and 1 (Dave) are configured for tests"),
    }
}

/// Set block author directly in authorship pallet storage (for testing)
#[allow(dead_code)]
pub fn set_block_author(author: AccountId) {
    // Use direct storage access since the Author storage is private
    frame_support::storage::unhashed::put(
        &frame_support::storage::storage_prefix(b"Authorship", b"Author"),
        &author,
    );
}

/// Set block author by validator index (for testing)
#[allow(dead_code)]
pub fn set_block_author_by_index(validator_index: u32) {
    let author = get_validator_by_index(validator_index);
    set_block_author(author);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// Governance-specific helper functions
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

/// Helper function to get accounts as AccountId (governance naming convention)
#[allow(dead_code)]
pub fn alice() -> AccountId {
    account_id(ALICE)
}

#[allow(dead_code)]
pub fn bob() -> AccountId {
    account_id(BOB)
}

#[allow(dead_code)]
pub fn charlie() -> AccountId {
    account_id(CHARLIE)
}

#[allow(dead_code)]
pub fn dave() -> AccountId {
    account_id(DAVE)
}

#[allow(dead_code)]
pub fn eve() -> AccountId {
    account_id(EVE)
}

/// Helper function to run to block
pub fn run_to_block(n: BlockNumberFor<Runtime>) {
    while System::block_number() < n {
        if System::block_number() > 1 {
            <System as OnFinalize<BlockNumberFor<Runtime>>>::on_finalize(System::block_number());
        }
        System::set_block_number(System::block_number() + 1);
        <System as OnInitialize<BlockNumberFor<Runtime>>>::on_initialize(System::block_number());
    }
}

/// Helper function to make a proposal hash
#[allow(dead_code)]
pub fn make_proposal_hash(proposal: &RuntimeCall) -> H256 {
    BlakeTwo256::hash_of(proposal)
}

/// Helper to get last event
#[allow(dead_code)]
pub fn last_event() -> RuntimeEvent {
    System::events().pop().expect("Event expected").event
}

/// Helper to check if event exists
#[allow(dead_code)]
pub fn has_event(event: RuntimeEvent) -> bool {
    System::events().iter().any(|record| record.event == event)
}

/// Helper to setup technical committee members
#[allow(dead_code)]
pub fn setup_technical_committee(members: Vec<AccountId>) {
    assert_ok!(TechnicalCommittee::set_members(
        RuntimeOrigin::root(),
        members,
        None,
        3
    ));
}

/// Helper to setup treasury council members
#[allow(dead_code)]
pub fn setup_treasury_council(members: Vec<AccountId>) {
    assert_ok!(TreasuryCouncil::set_members(
        RuntimeOrigin::root(),
        members,
        None,
        3
    ));
}

/// Helper to create a simple proposal
#[allow(dead_code)]
pub fn make_simple_proposal() -> RuntimeCall {
    RuntimeCall::System(frame_system::Call::set_storage {
        items: vec![(b":test".to_vec(), b"value".to_vec())],
    })
}

#[allow(dead_code)]
/// Helper to advance time for voting
pub fn advance_referendum_time(blocks: BlockNumberFor<Runtime>) {
    let current_block = System::block_number();
    run_to_block(current_block + blocks);
}
