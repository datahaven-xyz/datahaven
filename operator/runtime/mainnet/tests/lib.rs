// Copyright 2025 Moonbeam Foundation.
// This file is part of DataHaven.

//! Integration tests for DataHaven mainnet runtime

pub mod common;
mod native_token_transfer;

use common::*;
use datahaven_mainnet_runtime::{currency::UNIT, Balances, System, VERSION};

// Runtime Tests
#[test]
fn test_runtime_version_and_metadata() {
    ExtBuilder::default().build().execute_with(|| {
        assert!(!VERSION.spec_name.is_empty());
        assert!(VERSION.spec_version > 0);
        assert_eq!(System::block_number(), 1);
    });
}

#[test]
fn test_balances_functionality() {
    ExtBuilder::default()
        .with_balances(vec![(account_id(ALICE), 2_000_000 * UNIT)])
        .build()
        .execute_with(|| {
            assert_eq!(Balances::free_balance(&account_id(ALICE)), 2_000_000 * UNIT);
        });
}
