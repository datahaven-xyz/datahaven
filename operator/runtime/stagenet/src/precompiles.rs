// Copyright 2019-2025 The DataHaven Team
// This file is part of DataHaven.

// DataHaven is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// DataHaven is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with DataHaven. If not, see <http://www.gnu.org/licenses/>.

use pallet_evm_precompile_balances_erc20::{Erc20BalancesPrecompile, Erc20Metadata};
use pallet_evm_precompile_batch::BatchPrecompile;
use pallet_evm_precompile_blake2::Blake2F;
use pallet_evm_precompile_bn128::{Bn128Add, Bn128Mul, Bn128Pairing};
use pallet_evm_precompile_call_permit::CallPermitPrecompile;
use pallet_evm_precompile_modexp::Modexp;
use pallet_evm_precompile_registry::PrecompileRegistry;
use pallet_evm_precompile_sha3fips::Sha3FIPS256;
use pallet_evm_precompile_simple::{ECRecover, ECRecoverPublicKey, Identity, Ripemd160, Sha256};
use precompile_utils::precompile_set::*;

type EthereumPrecompilesChecks = (AcceptDelegateCall, CallableByContract, CallableByPrecompile);

pub struct NativeErc20Metadata;

impl Erc20Metadata for NativeErc20Metadata {
    fn name() -> &'static str {
        "HAVE"
    }

    fn symbol() -> &'static str {
        "HAVE"
    }

    fn decimals() -> u8 {
        18
    }

    fn is_native_currency() -> bool {
        true
    }
}

/// EVM precompiles available in the DataHaven Stagenet runtime.
#[precompile_utils::precompile_name_from_address]
type DataHavenPrecompilesAt<R> = (
    // Ethereum precompiles:
    // We allow DELEGATECALL to stay compliant with Ethereum behavior.
    PrecompileAt<AddressU64<1>, ECRecover, EthereumPrecompilesChecks>,
    PrecompileAt<AddressU64<2>, Sha256, EthereumPrecompilesChecks>,
    PrecompileAt<AddressU64<3>, Ripemd160, EthereumPrecompilesChecks>,
    PrecompileAt<AddressU64<4>, Identity, EthereumPrecompilesChecks>,
    PrecompileAt<AddressU64<5>, Modexp, EthereumPrecompilesChecks>,
    PrecompileAt<AddressU64<6>, Bn128Add, EthereumPrecompilesChecks>,
    PrecompileAt<AddressU64<7>, Bn128Mul, EthereumPrecompilesChecks>,
    PrecompileAt<AddressU64<8>, Bn128Pairing, EthereumPrecompilesChecks>,
    PrecompileAt<AddressU64<9>, Blake2F, EthereumPrecompilesChecks>,
    // Non-DataHaven specific nor Ethereum precompiles :
    PrecompileAt<AddressU64<1024>, Sha3FIPS256, (CallableByContract, CallableByPrecompile)>,
    RemovedPrecompileAt<AddressU64<1025>>,
    PrecompileAt<AddressU64<1026>, ECRecoverPublicKey, (CallableByContract, CallableByPrecompile)>,
    RemovedPrecompileAt<AddressU64<1027>>,
    // DataHaven specific precompiles:
    PrecompileAt<
        AddressU64<2050>,
        Erc20BalancesPrecompile<R, NativeErc20Metadata>,
        (CallableByContract, CallableByPrecompile),
    >,
    PrecompileAt<
        AddressU64<2056>,
        BatchPrecompile<R>,
        (
            SubcallWithMaxNesting<2>,
            // Batch is the only precompile allowed to call Batch.
            CallableByPrecompile<OnlyFrom<AddressU64<2056>>>,
        ),
    >,
    PrecompileAt<
        AddressU64<2058>,
        CallPermitPrecompile<R>,
        (SubcallWithMaxNesting<0>, CallableByContract),
    >,
    PrecompileAt<
        AddressU64<2069>,
        PrecompileRegistry<R>,
        (CallableByContract, CallableByPrecompile),
    >,
);

/// The PrecompileSet installed in the DataHaven runtime.
/// We include the nine Istanbul precompiles
/// (https://github.com/ethereum/go-ethereum/blob/3c46f557/core/vm/contracts.go#L69)
/// The following distribution has been decided for the precompiles
/// 0-1023: Ethereum Mainnet Precompiles
/// 1024-2047 Precompiles that are not in Ethereum Mainnet but are neither DataHaven specific
/// 2048-4095 DataHaven specific precompiles
pub type DataHavenPrecompiles<R> = PrecompileSetBuilder<
    R,
    (
        // Skip precompiles if out of range.
        PrecompilesInRangeInclusive<(AddressU64<1>, AddressU64<4095>), DataHavenPrecompilesAt<R>>,
    ),
>;
