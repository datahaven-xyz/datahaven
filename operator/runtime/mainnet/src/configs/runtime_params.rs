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

use crate::Runtime;
use frame_support::dynamic_params::{dynamic_pallet_params, dynamic_params};
use hex_literal::hex;
use sp_core::{ConstU32, H160, H256};
use sp_runtime::{BoundedVec, Perbill};
use sp_std::vec;

use crate::configs::storagehub::{ChallengeTicksTolerance, ReplicationTargetType, SpMinDeposit};
use crate::currency::{GIGAWEI, HAVE};
use datahaven_runtime_common::{Balance, BlockNumber};

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
        /// The RewardsAgentOrigin is the hash of the string "external_validators_rewards"
        /// TODO: Decide which agent origin we want to use. Currently for testing it's the zero hash
        pub static RewardsAgentOrigin: H256 = H256::from_slice(&hex!(
            "c505dfb2df107d106d08bd0f1a0acd10052ca9aa078629a4ccfd0c90c6e69b65"
        ));

        // Proportion of fees allocated to the Treasury (remainder are burned).
        // e.g. 20% to the treasury, 80% burned.
        #[codec(index = 4)]
        #[allow(non_upper_case_globals)]
        pub static FeesTreasuryProportion: Perbill = Perbill::from_percent(20);

        // ╔══════════════════════ StorageHub Pallets ═══════════════════════╗

        #[codec(index = 5)]
        #[allow(non_upper_case_globals)]
        /// 20 HAVEs
        pub static SlashAmountPerMaxFileSize: Balance = 20 * HAVE;

        #[codec(index = 6)]
        #[allow(non_upper_case_globals)]
        /// 10k HAVEs * [`MinChallengePeriod`] = 10k HAVEs * 30 = 300k HAVEs
        ///
        ///  This can be interpreted as "a Provider with 10k HAVEs of stake would get the minimum challenge period".
        pub static StakeToChallengePeriod: Balance =
            10_000 * HAVE * Into::<u128>::into(MinChallengePeriod::get());

        #[codec(index = 7)]
        #[allow(non_upper_case_globals)]
        /// The [`CheckpointChallengePeriod`] is set to be equal to the longest possible challenge period
        /// (i.e. the [`StakeToChallengePeriod`] divided by the [`SpMinDeposit`]).
        ///
        // 300k HAVEs / 100 HAVEs + 50 + 1 = ~3k ticks (i.e. ~5 hours with 6 seconds per tick)
        pub static CheckpointChallengePeriod: BlockNumber = (StakeToChallengePeriod::get()
            / SpMinDeposit::get()).saturating_add(ChallengeTicksTolerance::get() as u128).saturating_add(1)
        .try_into()
        .expect(
            "StakeToChallengePeriod / SpMinDeposit should be a number of ticks that can fit in BlockNumber numerical type",
        );

        #[codec(index = 8)]
        #[allow(non_upper_case_globals)]
        /// 30 ticks, or 3 minutes with 6 seconds per tick.
        pub static MinChallengePeriod: BlockNumber = 30;

        #[codec(index = 9)]
        #[allow(non_upper_case_globals)]
        /// Price decreases when system utilisation is below 30%.
        pub static SystemUtilisationLowerThresholdPercentage: Perbill = Perbill::from_percent(30);

        #[codec(index = 10)]
        #[allow(non_upper_case_globals)]
        /// Price increases when system utilisation is above 95%.
        pub static SystemUtilisationUpperThresholdPercentage: Perbill = Perbill::from_percent(95);

        #[codec(index = 11)]
        #[allow(non_upper_case_globals)]
        /// 50 [`GIGAWEI`]s is the price per GB of data, per tick.
        ///
        /// With 6 seconds per tick, this means that over a month, the price of 1 GB is:
        /// 50e-9 [`HAVE`]s * 10 ticks/min * 60 min/h * 24 h/day * 30 days/month = 21.6e-3 [`HAVE`]s
        pub static MostlyStablePrice: Balance = 50 * GIGAWEI;

        #[codec(index = 12)]
        #[allow(non_upper_case_globals)]
        /// [`MostlyStablePrice`] * 10 = 500 [`GIGAWEI`]s
        pub static MaxPrice: Balance = MostlyStablePrice::get() * 10;

        #[codec(index = 13)]
        #[allow(non_upper_case_globals)]
        /// [`MostlyStablePrice`] / 5 = 10 [`GIGAWEI`]s
        pub static MinPrice: Balance = MostlyStablePrice::get() / 5;

        #[codec(index = 14)]
        #[allow(non_upper_case_globals)]
        /// u = [`UpperExponentFactor`]
        /// system_utilisation = 1
        ///
        /// [`MaxPrice`] = [`MostlyStablePrice`] + u * e ^ ( 1 - [`SystemUtilisationUpperThresholdPercentage`] )
        ///
        /// 500 = 50 + u * (e ^ (1 - 0.95) - 1)
        /// u = (500 - 50) / (e ^ (1 - 0.95) - 1) ≈ 8777
        pub static UpperExponentFactor: u32 = 8777;

        #[codec(index = 15)]
        #[allow(non_upper_case_globals)]
        /// l = [`LowerExponentFactor`]
        /// system_utilisation = 0
        ///
        /// [`MinPrice`] = [`MostlyStablePrice`] - u * e ^ ( [`SystemUtilisationLowerThresholdPercentage`] - 0 )
        ///
        /// 10 = 50 - l * (e ^ (0.3 - 0) - 1)
        /// l = (50 - 10) / (e ^ (0.3 - 0) - 1) ≈ 114
        pub static LowerExponentFactor: u32 = 114;

        #[codec(index = 16)]
        #[allow(non_upper_case_globals)]
        /// 0-size bucket fixed rate payment stream representing the price for 1 GB of data.
        ///
        /// Base rate for a new fixed payment stream established between an MSP and a user.
        pub static ZeroSizeBucketFixedRate: Balance = 50 * GIGAWEI;

        #[codec(index = 17)]
        #[allow(non_upper_case_globals)]
        /// Ideal utilisation rate of the system
        pub static IdealUtilisationRate: Perbill = Perbill::from_percent(85);

        #[codec(index = 18)]
        #[allow(non_upper_case_globals)]
        /// Decay rate of the power of two function that determines the percentage of funds that go to
        /// the treasury for utilisation rates greater than the ideal.
        pub static DecayRate: Perbill = Perbill::from_percent(5);

        #[codec(index = 19)]
        #[allow(non_upper_case_globals)]
        /// The minimum treasury cut that can be taken from the amount charged from a payment stream.
        pub static MinimumTreasuryCut: Perbill = Perbill::from_percent(1);

        #[codec(index = 20)]
        #[allow(non_upper_case_globals)]
        /// The maximum treasury cut that can be taken from the amount charged from a payment stream.
        pub static MaximumTreasuryCut: Perbill = Perbill::from_percent(5);

        #[codec(index = 21)]
        #[allow(non_upper_case_globals)]
        /// The penalty a BSP must pay when they forcefully stop storing a file.
        /// We set this to be half of the `SlashAmountPerMaxFileSize` with the rationale that
        /// for a BSP that has lost this file, it should be more convenient to voluntarily
        /// show up and pay this penalty in good faith, rather than risking being slashed for
        /// being unable to submit a proof that should include this file.
        pub static BspStopStoringFilePenalty: Balance = SlashAmountPerMaxFileSize::get() / 2;

        /// Time-to-live for a provider to top up their deposit to cover a capacity deficit.
        /// Set to 14_400 relay blocks = 1 day with 6 second timeslots.
        #[codec(index = 22)]
        #[allow(non_upper_case_globals)]
        pub static ProviderTopUpTtl: BlockNumber = 14_400;

        /// The following parameters are the replication targets for the different security levels
        /// that a storage request (and thus the file it represents) can have.
        ///
        /// These are associated with the probability that a malicious actor could hold the file hostage by controlling
        /// all BSPs that volunteered and confirmed storing it.
        /// The values were calculated from the probabilities derived using binomial distribution calculations,
        /// where the total number of BSPs is set to 1000, the fraction of malicious BSPs is 1/3, and the target number of BSPs
        /// is incremented until the probability of all selected BSPs being malicious falls below the required percentage.
        ///
        /// The formula used is:
        ///     num_bsps = 1000
        ///     fraction_evil = 1/3
        ///     n_evil = int(num_bsps * fraction_evil)  // = 333
        ///     target = range(1, num_bsps)
        ///     p_init = target / num_bsps
        ///     prob = binomial_cdf_at_least(n_evil, target, p_init)
        ///
        /// This ensures that the replication targets were selected optimally to balance security and storage efficiency.
        /// --------------------------------------------------------------------------------------------------------------------
        /// The amount of BSPs that a basic security storage request should use as the replication target.
        ///
        /// This must be the lowest amount of BSPs that guarantee that the probability that a malicious
        /// actor controlling 1/3 of the BSPs can hold the file hostage by controlling all its
        /// volunteered BSPs is ~1%.
        #[codec(index = 23)]
        #[allow(non_upper_case_globals)]
        pub static BasicReplicationTarget: ReplicationTargetType = 7;

        /// The amount of BSPs that a standard security storage request should use as the replication target.
        ///
        /// This must be the lowest amount of BSPs that guarantee that the probability that a malicious
        /// actor controlling 1/3 of the BSPs can hold the file hostage by controlling all its
        /// volunteered BSPs is ~0.1%.
        #[codec(index = 24)]
        #[allow(non_upper_case_globals)]
        pub static StandardReplicationTarget: ReplicationTargetType = 12;

        /// The amount of BSPs that a high security storage request should use as the replication target.
        ///
        /// This must be the lowest amount of BSPs that guarantee that the probability that a malicious
        /// actor controlling 1/3 of the BSPs can hold the file hostage by controlling all its
        /// volunteered BSPs is ~0.01%.
        #[codec(index = 25)]
        #[allow(non_upper_case_globals)]
        pub static HighSecurityReplicationTarget: ReplicationTargetType = 17;

        /// The amount of BSPs that a super high security storage request should use as the replication target.
        ///
        /// This must be the lowest amount of BSPs that guarantee that the probability that a malicious
        /// actor controlling 1/3 of the BSPs can hold the file hostage by controlling all its
        /// volunteered BSPs is ~0.001%.
        #[codec(index = 26)]
        #[allow(non_upper_case_globals)]
        pub static SuperHighSecurityReplicationTarget: ReplicationTargetType = 22;

        /// The amount of BSPs that an ultra high security storage request should use as the replication target.
        ///
        /// This must be the lowest amount of BSPs that guarantee that the probability that a malicious
        /// actor controlling 1/3 of the BSPs can hold the file hostage by controlling all its
        /// volunteered BSPs is ~0.0001%.
        #[codec(index = 27)]
        #[allow(non_upper_case_globals)]
        pub static UltraHighSecurityReplicationTarget: ReplicationTargetType = 26;

        /// The maximum amount of BSPs that a user can require a storage request to use as the replication target.
        ///
        /// This is a safety measure to prevent users from issuing storage requests that are too large and would
        /// require a large number of BSPs to store the file.
        #[codec(index = 28)]
        #[allow(non_upper_case_globals)]
        pub static MaxReplicationTarget: ReplicationTargetType =
            UltraHighSecurityReplicationTarget::get()
                .saturating_mul(150)
                .saturating_div(100);

        /// The amount of ticks that have to pass for the threshold to volunteer for a specific storage request
        /// to arrive at its maximum value.
        ///
        /// This is big enough so volunteering for a storage request is not open to everyone inmediatly, preventing
        /// a select few BSPs from taking all the requests, while small enough so that storage requests don't take
        /// too long to be filled.
        #[codec(index = 29)]
        #[allow(non_upper_case_globals)]
        pub static TickRangeToMaximumThreshold: BlockNumber = 3600; // 6 hours with a 6 second block time

        /// The amount of ticks after which a storage request is considered expired and can be removed from storage.
        ///
        /// It's a function of the TickRangeToMaximumThreshold since it does not make sense for a storage request to
        /// expire before arriving at its maximum threshold for volunteering.
        #[codec(index = 30)]
        #[allow(non_upper_case_globals)]
        pub static StorageRequestTtl: BlockNumber = TickRangeToMaximumThreshold::get()
            .saturating_mul(110)
            .saturating_div(100);

        /// The minimum amount of ticks between a stop storing request from a BSP and that BSP being able to
        /// confirm to stop storing that file key.
        ///
        /// It's a function of the checkpoint challenge period since this makes it so BSPs can't avoid checkpoint
        /// challenges by stopping storing a file key right before the challenge period ends in case they lost it.
        #[codec(index = 31)]
        #[allow(non_upper_case_globals)]
        pub static MinWaitForStopStoring: BlockNumber = CheckpointChallengePeriod::get()
            .saturating_mul(110)
            .saturating_div(100);

        #[codec(index = 32)]
        #[allow(non_upper_case_globals)]
        /// 20 ticks, or 2 minutes with 6 seconds per tick.
        pub static MinSeedPeriod: BlockNumber = 20;

        #[codec(index = 33)]
        #[allow(non_upper_case_globals)]
        /// 10k HAVEs * [`MinSeedPeriod`] = 10k HAVEs * 20 = 200k HAVEs
        ///
        ///  This can be interpreted as "a Provider with 10k HAVEs of stake would get the minimum seed period".
        pub static StakeToSeedPeriod: Balance =
            10_000 * HAVE * Into::<u128>::into(MinSeedPeriod::get());

        #[codec(index = 34)]
        #[allow(non_upper_case_globals)]
        /// The amount of ticks to charge a user upfront when it tries to issue a new storage request.
        /// This is done as a deterrent to avoid users spamming the network with huge files but never
        /// actually planning to store them longterm.
        ///
        /// 72k ticks = 5 days with 6 seconds per tick.
        /// This means that a user must pay for 5 days of storage upfront, which gets transferred to the
        /// treasury. Governance can then decide what to do with the accumulated funds.
        ///
        /// With a stable price (defined as `MostlyStablePrice` in this file) of 50 GIGAWEIs per gigabyte
        /// per tick and a standard replication target (`StandardReplicationTarget`) of 12 BSPs, the upfront
        /// cost for the user to issue a storage request for a 1 GB file would be:
        /// 50 GIGAWEIs per gigabyte per tick * 12 BSPs * 72k ticks * 1 GB = 0.0432 HAVEs
        pub static UpfrontTicksToPay: BlockNumber = 72_000;
        // ╚══════════════════════ StorageHub Pallets ═══════════════════════╝

        #[codec(index = 35)]
        #[allow(non_upper_case_globals)]
        /// The Selector is the first 4 bytes of the keccak256 hash of the function signature("slashValidatorsOperator(address[])")
        pub static SlashOperatorSelector: BoundedVec<u8, ConstU32<4>> =
            BoundedVec::truncate_from(vec![0xca, 0x48, 0x11, 0x9f]);

        #[codec(index = 36)]
        #[allow(non_upper_case_globals)]
        /// The Ethereum address of the DataHavenServiceManager contract.
        /// This address is used both for authorized slashing requests and validator-set update messages.
        pub static DatahavenServiceManagerAddress: H160 = H160::repeat_byte(0x0);

        // ╔══════════════════════ Validator Rewards Inflation ═══════════════════════╗

        #[codec(index = 37)]
        #[allow(non_upper_case_globals)]
        /// Targeted annual inflation rate.
        /// Default: 5% per annum
        /// This rate is divided across all eras in a year to calculate per-era inflation.
        pub static InflationTargetedAnnualRate: Perbill = Perbill::from_percent(5);

        #[codec(index = 38)]
        #[allow(non_upper_case_globals)]
        /// Proportion of inflation rewards allocated to the treasury.
        /// Default: 20% of minted rewards go to treasury, 80% to validator rewards
        /// The treasury portion is minted separately and sent to the treasury account.
        pub static InflationTreasuryProportion: Perbill = Perbill::from_percent(20);

        // ╚══════════════════════ Validator Rewards Inflation ═══════════════════════╝
    }
}

#[cfg(feature = "runtime-benchmarks")]
impl Default for RuntimeParameters {
    fn default() -> Self {
        RuntimeParameters::RuntimeConfig(
            dynamic_params::runtime_config::Parameters::FeesTreasuryProportion(
                dynamic_params::runtime_config::FeesTreasuryProportion,
                Some(Perbill::from_percent(20)),
            ),
        )
    }
}
