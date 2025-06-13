// Copyright 2025 Moonbeam Foundation.
// This file is part of DataHaven.

//! Common test utilities for DataHaven mainnet runtime tests

use datahaven_mainnet_runtime::{
    AccountId, Balance, Runtime, RuntimeOrigin, System, UNIT,
};
use sp_core::H160;
use sp_runtime::BuildStorage;

/// Test account constants
pub const ALICE: [u8; 20] = [1u8; 20];
pub const BOB: [u8; 20] = [2u8; 20];

/// Helper function to convert account constants to AccountId
pub fn account_id(account: [u8; 20]) -> AccountId {
    H160(account).into()
}

/// Default balance for test accounts (1M DH tokens)
pub const DEFAULT_BALANCE: Balance = 1_000_000 * UNIT;

/// Test runtime builder following Moonbeam pattern
#[derive(Default)]
pub struct ExtBuilder {
    balances: Vec<(AccountId, Balance)>,
    with_default_balances: bool,
}

impl ExtBuilder {
    pub fn default() -> Self {
        Self {
            balances: vec![],
            with_default_balances: true,
        }
    }

    #[allow(dead_code)]
    pub fn with_balances(mut self, balances: Vec<(AccountId, Balance)>) -> Self {
        self.balances = balances;
        self.with_default_balances = false;
        self
    }

    pub fn build(self) -> sp_io::TestExternalities {
        let mut balances = self.balances;

        if self.with_default_balances {
            balances.extend_from_slice(&[
                (account_id(ALICE), DEFAULT_BALANCE),
                (account_id(BOB), DEFAULT_BALANCE),
                // Fund the treasury account (fee recipient) with initial balance
                (
                    datahaven_mainnet_runtime::configs::TreasuryAccountId::get(),
                    DEFAULT_BALANCE,
                ),
            ]);
        }

        let mut t = frame_system::GenesisConfig::<Runtime>::default()
            .build_storage()
            .expect("System pallet builds valid default genesis config");

        pallet_balances::GenesisConfig::<Runtime> { balances }
            .assimilate_storage(&mut t)
            .expect("Pallet balances storage can be assimilated");

        let mut ext = sp_io::TestExternalities::new(t);
        ext.execute_with(|| {
            System::set_block_number(1);
        });
        ext
    }
}

pub fn root_origin() -> RuntimeOrigin {
    RuntimeOrigin::root()
}

pub fn datahaven_token_metadata() -> snowbridge_core::AssetMetadata {
    snowbridge_core::AssetMetadata {
        name: b"HAVE".to_vec().try_into().unwrap(),
        symbol: b"wHAVE".to_vec().try_into().unwrap(),
        decimals: 18,
    }
}