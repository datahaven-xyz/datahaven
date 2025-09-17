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

use crate::mock::{
    ExtBuilder, PCall, Precompiles, PrecompilesValue, Registry, Removed, Runtime, SmartContract,
};
use precompile_utils::{prelude::*, testing::*};
use sp_core::H160;

fn precompiles() -> Precompiles<Runtime> {
    PrecompilesValue::get()
}

mod selectors {
    use super::*;

    #[test]
    fn selectors() {
        assert!(PCall::is_precompile_selectors().contains(&0x446b450e));
        assert!(PCall::is_active_precompile_selectors().contains(&0x6f5e23cf));
        assert!(PCall::update_account_code_selectors().contains(&0x48ceb1b4));
    }

    #[test]
    fn modifiers() {
        ExtBuilder::default()
            .with_balances(vec![(CryptoAlith.into(), 1000)])
            .build()
            .execute_with(|| {
                let mut tester =
                    PrecompilesModifierTester::new(precompiles(), CryptoAlith, Registry);

                tester.test_view_modifier(PCall::is_precompile_selectors());
                tester.test_view_modifier(PCall::is_active_precompile_selectors());
                tester.test_default_modifier(PCall::update_account_code_selectors());
            });
    }
}

mod is_precompile {

    use super::*;

    fn call(target_address: impl Into<H160>, output: bool) {
        ExtBuilder::default()
            .with_balances(vec![(CryptoAlith.into(), 1000)])
            .build()
            .execute_with(|| {
                precompiles()
                    .prepare_test(
                        Alice, // can be anyone
                        Registry,
                        PCall::is_precompile {
                            address: Address(target_address.into()),
                        },
                    )
                    .expect_no_logs()
                    .execute_returns(output);
            });
    }

    #[test]
    fn works_on_precompile() {
        call(Registry, true);
    }

    #[test]
    fn works_on_removed_precompile() {
        call(Removed, true);
    }

    #[test]
    fn works_on_eoa() {
        call(CryptoAlith, false);
    }

    #[test]
    fn works_on_smart_contract() {
        call(SmartContract, false);
    }
}

mod is_active_precompile {

    use super::*;

    fn call(target_address: impl Into<H160>, output: bool) {
        ExtBuilder::default()
            .with_balances(vec![(CryptoAlith.into(), 1000)])
            .build()
            .execute_with(|| {
                precompiles()
                    .prepare_test(
                        Alice, // can be anyone
                        Registry,
                        PCall::is_active_precompile {
                            address: Address(target_address.into()),
                        },
                    )
                    .expect_no_logs()
                    .execute_returns(output);
            });
    }

    #[test]
    fn works_on_precompile() {
        call(Registry, true);
    }

    #[test]
    fn works_on_removed_precompile() {
        call(Removed, false);
    }

    #[test]
    fn works_on_eoa() {
        call(CryptoAlith, false);
    }

    #[test]
    fn works_on_smart_contract() {
        call(SmartContract, false);
    }
}

mod update_account_code {
    use super::*;

    fn call(target_address: impl Into<H160>, expect_changes: bool) {
        ExtBuilder::default()
            .with_balances(vec![(CryptoAlith.into(), 1000)])
            .build()
            .execute_with(|| {
                let target_address = target_address.into();

                let precompiles = precompiles();
                let tester = precompiles.prepare_test(
                    Alice, // can be anyone
                    Registry,
                    PCall::update_account_code {
                        address: Address(target_address),
                    },
                );

                if expect_changes {
                    tester.execute_returns(());
                    let new_code = pallet_evm::AccountCodes::<Runtime>::get(target_address);
                    assert_eq!(&new_code, &[0x60, 0x00, 0x60, 0x00, 0xfd]);
                } else {
                    let current_code = pallet_evm::AccountCodes::<Runtime>::get(target_address);

                    tester.execute_reverts(|revert| {
                        revert == b"provided address is not a precompile"
                    });

                    let new_code = pallet_evm::AccountCodes::<Runtime>::get(target_address);
                    assert_eq!(current_code, new_code);
                }
            });
    }

    #[test]
    fn works_on_precompile() {
        call(Registry, true);
    }

    #[test]
    fn works_on_removed_precompile() {
        call(Removed, true);
    }

    #[test]
    fn works_on_eoa() {
        call(CryptoAlith, false);
    }

    #[test]
    fn works_on_smart_contract() {
        call(SmartContract, false);
    }
}

#[test]
fn test_solidity_interface() {
    check_precompile_implements_solidity_interfaces(
        &["PrecompileRegistry.sol"],
        PCall::supports_selector,
    )
}
