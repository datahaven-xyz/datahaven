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
        self.id().starts_with("datahaven-stagenet")
    }

    fn is_testnet(&self) -> bool {
        self.id().starts_with("datahaven-testnet")
    }

    fn is_mainnet(&self) -> bool {
        self.id().starts_with("datahaven-mainnet")
    }
}
