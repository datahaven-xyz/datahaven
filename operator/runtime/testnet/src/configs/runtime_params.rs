use frame_support::dynamic_params::{dynamic_pallet_params, dynamic_params};
use sp_core::H160;

use crate::Runtime;

#[dynamic_params(RuntimeParameters, pallet_parameters::Parameters::<Runtime>)]
pub mod dynamic_params {
    use super::*;
    #[dynamic_pallet_params]
    #[codec(index = 0)]
    pub mod runtime_config {

        use super::*;

        #[codec(index = 0)]
        #[allow(non_upper_case_globals)]
        /// Set the initial address of the Snowbridge Gateway contract on Ethereum.
        /// The fact that this is a parameter means that we can set it initially to the zero address,
        /// and then change it later via governance, to the actual address of the deployed contract.
        pub static EthereumGatewayAddress: H160 = H160::repeat_byte(0x0);

        #[codec(index = 1)]
        pub static RewardsRegistryAddress: H160 = H160::repeat_byte(0x0);
    }
}

#[cfg(feature = "runtime-benchmarks")]
impl Default for RuntimeParameters {
    fn default() -> Self {
        RuntimeParameters::RuntimeConfig(
            dynamic_params::runtime_config::Parameters::EthereumGatewayAddress(
                dynamic_params::runtime_config::EthereumGatewayAddress,
                Some(H160::repeat_byte(0x0)),
            ),
            dynamic_params::runtime_config::RewardsRegistryAddress(
                dynamic_params::runtime_config::RewardsRegistryAddress,
                Some(H160::repeat_byte(0x0)),
            ),
        )
    }
}
