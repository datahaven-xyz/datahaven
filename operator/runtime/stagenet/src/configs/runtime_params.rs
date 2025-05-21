use frame_support::dynamic_params::{dynamic_pallet_params, dynamic_params};
use hex_literal::hex;
use sp_core::{ConstU32, H160, H256};
use sp_runtime::BoundedVec;

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
        #[allow(non_upper_case_globals)]
        /// Set the initial address of the Rewards Registry contract on Ethereum.
        /// The fact that this is a parameter means that we can set it initially to the zero address,
        /// and then change it later via governance, to the actual address of the deployed contract.
        pub static RewardsRegistryAddress: H160 = H160::repeat_byte(0x0);

        #[codec(index = 2)]
        #[allow(non_upper_case_globals)]
        /// The Selector is the first 4 bytes of the keccak256 hash of the function signature("updateRewardsMerkleRoot(bytes32)")
        pub static RewardsUpdateSelector: BoundedVec<u8, ConstU32<4>> =
            BoundedVec::truncate_from(vec![0xdc, 0x3d, 0x04, 0xec]);

        #[codec(index = 3)]
        #[allow(non_upper_case_globals)]
        /// The Origin is the hash of the string "external_validators_rewards"
        pub static RewardsOrigin: H256 = H256::from_slice(&hex!(
            "c505dfb2df107d106d08bd0f1a0acd10052ca9aa078629a4ccfd0c90c6e69b65"
        ));
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
        )
    }
}
