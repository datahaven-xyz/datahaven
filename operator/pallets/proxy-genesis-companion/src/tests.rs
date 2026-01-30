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

//! Unit testing
use crate::mock::{ExtBuilder, Proxy, ProxyType, Test};
use pallet_proxy::ProxyDefinition;

#[test]
fn empty_genesis_works() {
    ExtBuilder::default()
        .build()
        .execute_with(|| assert_eq!(pallet_proxy::Proxies::<Test>::iter().count(), 0))
}

#[test]
fn non_empty_genesis_works() {
    ExtBuilder::default()
        // Account 1 delegates to account 2
        .with_proxies(vec![(1, 2)])
        // Account 1 is funded to pay the proxy deposit
        .with_balances(vec![(1, 10)])
        .build()
        .execute_with(|| {
            // Lookup info that we expect to be stored from genesis
            let (proxy_defs, deposit) = Proxy::proxies(1);

            // Make sure that Account 1 delegates to Account 2 and nobody else
            assert_eq!(proxy_defs.len(), 1);
            assert_eq!(
                proxy_defs[0],
                ProxyDefinition {
                    delegate: 2,
                    proxy_type: ProxyType,
                    delay: 100
                }
            );

            // Make sure that Account 1 has the proper deposit amount reserved
            assert_eq!(deposit, 2);
        })
}

#[test]
#[should_panic(expected = "Genesis proxy could not be added")]
fn genesis_fails_if_balance_insufficient() {
    ExtBuilder::default()
        .with_proxies(vec![(1, 2)])
        .build()
        .execute_with(|| ())
}
