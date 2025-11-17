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

pub mod mainnet;
pub mod stagenet;
pub mod testnet;

/// Specialized `ChainSpec`. This is a specialization of the general Substrate ChainSpec type.
pub type ChainSpec = sc_service::GenericChainSpec;

/// Can be called for a chain spec `Configuration` to determine the network type.
#[allow(unused)]
pub trait NetworkType {
    /// Returns `true` if this is a configuration for the `Stagenet` network.
    fn is_stagenet(&self) -> bool;

    /// Returns `true` if this is a configuration for the `Testnet` network.
    fn is_testnet(&self) -> bool;

    /// Returns `true` if this is a configuration for the `Mainnet` network.
    fn is_mainnet(&self) -> bool;

    /// Returns `true` if this is a configuration for a dev network.
    fn is_dev(&self) -> bool;
}

impl NetworkType for Box<dyn sc_service::ChainSpec> {
    fn is_dev(&self) -> bool {
        self.chain_type() == sc_service::ChainType::Development
    }

    fn is_stagenet(&self) -> bool {
        self.id().starts_with("datahaven_stagenet")
    }

    fn is_testnet(&self) -> bool {
        self.id().starts_with("datahaven_testnet")
    }

    fn is_mainnet(&self) -> bool {
        self.id().starts_with("datahaven_mainnet")
    }
}
