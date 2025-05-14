use datahaven_runtime_common::constants::time::ONE_HOUR;
use frame_support::dynamic_params::{dynamic_pallet_params, dynamic_params};
use polkadot_primitives::BlockNumber;
use sp_core::H160;
use sp_runtime::traits::Get;
use sp_staking::{EraIndex, SessionIndex};

use crate::{configs::EquivocationReportPeriodInEpochs, Runtime};

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
        /// Set the epoch duration in blocks.
        /// This is a parameter since it allows us to set it to a lower value when testing, or the
        /// default value when on mainnet.
        pub static EpochDurationInBlocks: BlockNumber = ONE_HOUR;

        #[codec(index = 2)]
        #[allow(non_upper_case_globals)]
        /// Set the bonding duration in amount of eras.
        /// This is a parameter since it allows us to set it to a lower value when testing, or the
        /// default value when on mainnet.
        pub static BondingDuration: EraIndex = 28;

        #[codec(index = 3)]
        #[allow(non_upper_case_globals)]
        /// Set the number of sessions per era.
        /// This is a parameter since it allows us to set it to a lower value when testing, or the
        /// default value when on mainnet.
        pub static SessionsPerEra: SessionIndex = 6;

        #[codec(index = 4)]
        #[allow(non_upper_case_globals)]
        /// Set the longevity of BABE equivocation report system.
        pub static ReportLongevity: u64 = BondingDuration::get() as u64
            * SessionsPerEra::get() as u64
            * (<EpochDurationInBlocks as Get<BlockNumber>>::get() as u64);

        #[codec(index = 5)]
        #[allow(non_upper_case_globals)]
        /// Set the equivocation report period in blocks.
        pub static EquivocationReportPeriodInBlocks: u64 = EquivocationReportPeriodInEpochs::get()
            * (<EpochDurationInBlocks as Get<BlockNumber>>::get() as u64);

        #[codec(index = 6)]
        #[allow(non_upper_case_globals)]
        /// Set the maximum number of session entries for a set ID.
        pub static MaxSetIdSessionEntries: u32 = BondingDuration::get() * SessionsPerEra::get();

        #[codec(index = 7)]
        #[allow(non_upper_case_globals)]
        /// Set the maximum number of entries to keep in the set id to session index mapping for BEEFY.
        pub static BeefySetIdSessionEntries: u32 = BondingDuration::get() * SessionsPerEra::get();
    }
}

impl Get<u64> for dynamic_params::runtime_config::BeefySetIdSessionEntries {
    fn get() -> u64 {
        <dynamic_params::runtime_config::BeefySetIdSessionEntries as Get<u32>>::get() as u64
    }
}

impl Get<u64> for dynamic_params::runtime_config::MaxSetIdSessionEntries {
    fn get() -> u64 {
        <dynamic_params::runtime_config::MaxSetIdSessionEntries as Get<u32>>::get() as u64
    }
}

impl Get<u64> for dynamic_params::runtime_config::EpochDurationInBlocks {
    fn get() -> u64 {
        <dynamic_params::runtime_config::EpochDurationInBlocks as Get<BlockNumber>>::get() as u64
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
