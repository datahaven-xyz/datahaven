//! Integration tests for DataHaven testnet runtime

pub mod common;
mod fee_adjustment;
pub mod governance;
mod native_token_transfer;
mod proxy;
mod safe_mode_tx_pause;

use common::*;
use datahaven_testnet_runtime::{
    currency::HAVE, Balances, Runtime, System, UncheckedExtrinsic, VERSION,
};
use sp_core::H160;
use sp_runtime::transaction_validity::{
    InvalidTransaction, TransactionSource, TransactionValidityError,
};
use sp_transaction_pool::runtime_api::runtime_decl_for_tagged_transaction_queue::TaggedTransactionQueueV3;

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
        .with_balances(vec![(account_id(ALICE), 2_000_000 * HAVE)])
        .build()
        .execute_with(|| {
            assert_eq!(Balances::free_balance(&account_id(ALICE)), 2_000_000 * HAVE);
        });
}

#[test]
fn validate_transaction_fails_on_filtered_call() {
    ExtBuilder::default().build().execute_with(|| {
        let xt = UncheckedExtrinsic::new_bare(
            pallet_evm::Call::<Runtime>::call {
                source: H160::default(),
                target: H160::default(),
                input: Vec::new(),
                value: sp_core::U256::zero(),
                gas_limit: 21000,
                max_fee_per_gas: sp_core::U256::zero(),
                max_priority_fee_per_gas: Some(sp_core::U256::zero()),
                nonce: None,
                access_list: Vec::new(),
            }
            .into(),
        );

        assert_eq!(
            Runtime::validate_transaction(TransactionSource::External, xt, Default::default(),),
            Err(TransactionValidityError::Invalid(InvalidTransaction::Call)),
        );
    });
}
