// Copyright 2025 Moonbeam Foundation.
// This file is part of DataHaven.

//! Common test utilities for DataHaven testnet runtime tests

use datahaven_testnet_runtime::{
    currency::HAVE, AccountId, Balance, Runtime, RuntimeOrigin, Session, SessionKeys, System,
};
use frame_support::traits::Hooks;
use pallet_im_online::sr25519::AuthorityId as ImOnlineId;
use sp_consensus_babe::AuthorityId as BabeId;
use sp_consensus_beefy::ecdsa_crypto::AuthorityId as BeefyId;
use sp_consensus_grandpa::AuthorityId as GrandpaId;
use sp_core::{crypto::UncheckedFrom, H160};
use sp_runtime::BuildStorage;

/// Test account constants
pub const ALICE: [u8; 20] = [1u8; 20];
pub const BOB: [u8; 20] = [2u8; 20];
pub const CHARLIE: [u8; 20] = [3u8; 20];
pub const DAVE: [u8; 20] = [4u8; 20];

/// Helper function to convert account constants to AccountId
pub fn account_id(account: [u8; 20]) -> AccountId {
    H160(account).into()
}

/// Default balance for test accounts (1M DH tokens)
pub const DEFAULT_BALANCE: Balance = 1_000_000 * HAVE;

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
}

impl ExtBuilder {
    pub fn default() -> Self {
        Self {
            balances: vec![],
            with_default_balances: true,
            validators: vec![],
            with_default_validators: true,
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

    pub fn build(self) -> sp_io::TestExternalities {
        let mut balances = self.balances;
        let mut validators = self.validators;

        if self.with_default_balances {
            balances.extend_from_slice(&[
                (account_id(ALICE), DEFAULT_BALANCE),
                (account_id(BOB), DEFAULT_BALANCE),
                (account_id(CHARLIE), DEFAULT_BALANCE),
                (account_id(DAVE), DEFAULT_BALANCE),
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

        let mut ext = sp_io::TestExternalities::new(t);
        ext.execute_with(|| {
            System::set_block_number(1);
            // Initialize session
            Session::on_initialize(1);
        });
        ext
    }
}

pub fn root_origin() -> RuntimeOrigin {
    RuntimeOrigin::root()
}

#[allow(dead_code)]
pub fn datahaven_token_metadata() -> snowbridge_core::AssetMetadata {
    snowbridge_core::AssetMetadata {
        name: b"HAVE".to_vec().try_into().unwrap(),
        symbol: b"wHAVE".to_vec().try_into().unwrap(),
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
