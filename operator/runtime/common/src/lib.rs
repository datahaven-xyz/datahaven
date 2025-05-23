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

#![cfg_attr(not(feature = "std"), no_std)]

pub mod constants;
pub use constants::*;
pub mod impl_on_charge_evm_transaction;

/// DataHaven network types for XCM universal location identification
pub mod datahaven_networks {
    use codec::{Decode, Encode};
    use scale_info::TypeInfo;
    use xcm::prelude::NetworkId;

    /// DataHaven network variants for different deployment environments
    #[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo)]
    pub enum DataHavenNetwork {
        /// Testnet environment for development and testing
        Testnet,
        /// Stagenet environment for pre-production testing  
        Stagenet,
        /// Mainnet environment for production use
        Mainnet,
    }

    impl From<DataHavenNetwork> for NetworkId {
        fn from(network: DataHavenNetwork) -> Self {
            match network {
                DataHavenNetwork::Testnet => NetworkId::ByGenesis([
                    0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
                    0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10,
                    0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,
                    0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00,
                ]),
                DataHavenNetwork::Stagenet => NetworkId::ByGenesis([
                    0x02, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0,
                    0xef, 0xcd, 0xab, 0x89, 0x67, 0x45, 0x23, 0x01,
                    0x12, 0x23, 0x34, 0x45, 0x56, 0x67, 0x78, 0x89,
                    0x9a, 0xab, 0xbc, 0xcd, 0xde, 0xef, 0xf0, 0x01,
                ]),
                DataHavenNetwork::Mainnet => NetworkId::ByGenesis([
                    0x03, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01,
                    0xde, 0xbc, 0x9a, 0x78, 0x56, 0x34, 0x12, 0x00,
                    0x13, 0x24, 0x35, 0x46, 0x57, 0x68, 0x79, 0x8a,
                    0x9b, 0xac, 0xbd, 0xce, 0xdf, 0xe0, 0xf1, 0x02,
                ]),
            }
        }
    }
}
use fp_account::EthereumSignature;
pub use sp_runtime::OpaqueExtrinsic as UncheckedExtrinsic;
use sp_runtime::{
    generic,
    traits::{BlakeTwo256, IdentifyAccount, Verify},
};

/// Alias to 512-bit hash when used in the context of a transaction signature on the chain.
pub type Signature = EthereumSignature;

/// Some way of identifying an account on the chain. We intentionally make it equivalent
/// to the public key of our transaction signing scheme.
pub type AccountId = <<Signature as Verify>::Signer as IdentifyAccount>::AccountId;

/// Balance of an account.
pub type Balance = u128;

/// Index of a transaction in the chain.
pub type Nonce = u32;

/// A hash of some data used by the chain.
pub type Hash = sp_core::H256;

/// An index to a block.
pub type BlockNumber = u32;

/// The address format for describing accounts.
pub type Address = AccountId;

/// Block header type as expected by this runtime.
pub type Header = generic::Header<BlockNumber, BlakeTwo256>;

/// Block type as expected by this runtime.
pub type Block = generic::Block<Header, UncheckedExtrinsic>;

/// A Block signed with a Justification
pub type SignedBlock = generic::SignedBlock<Block>;

/// BlockId type as expected by this runtime.
pub type BlockId = generic::BlockId<Block>;
