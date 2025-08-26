//! Referenda and tracks configuration for DataHaven Testnet Runtime
//!
//! This module configures the referendum system with different tracks
//! for different types of governance decisions, inspired by Moonbeam's
//! OpenGov implementation.

use super::*;
use crate::governance::councils::TechnicalCommitteeInstance;
use frame_support::traits::{EitherOf, MapSuccess};
use frame_system::EnsureRootWithSuccess;
use sp_core::ConstU16;
use sp_runtime::traits::Replace;

// Referenda configuration parameters
parameter_types! {
    pub const AlarmInterval: BlockNumber = 1;
    pub const SubmissionDeposit: Balance = 10 * HAVE * SUPPLY_FACTOR;
    pub const UndecidingTimeout: BlockNumber = 21 * DAYS;
}

// Voting configuration parameters
parameter_types! {
    pub const VoteLockingPeriod: BlockNumber = 1 * DAYS;
}

pub type GeneralAdminOrRoot = EitherOf<EnsureRoot<AccountId>, origins::GeneralAdmin>;

/// The policy allows for Root, GeneralAdmin or FastGeneralAdmin.
pub type FastGeneralAdminOrRoot =
    EitherOf<EnsureRoot<AccountId>, EitherOf<origins::GeneralAdmin, origins::FastGeneralAdmin>>;

impl custom_origins::Config for Runtime {}

// Conviction Voting Implementation
impl pallet_conviction_voting::Config for Runtime {
    type WeightInfo = stagenet_weights::pallet_conviction_voting::WeightInfo<Runtime>;
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type VoteLockingPeriod = VoteLockingPeriod;
    // Maximum number of concurrent votes an account may have
    type MaxVotes = ConstU32<20>;
    type MaxTurnout = frame_support::traits::TotalIssuanceOf<Balances, AccountId>;
    type Polls = Referenda;
}

impl pallet_whitelist::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type WhitelistOrigin = EitherOf<
        EnsureRootWithSuccess<Self::AccountId, ConstU16<65535>>,
        MapSuccess<
            pallet_collective::EnsureProportionAtLeast<
                Self::AccountId,
                TechnicalCommitteeInstance,
                5,
                9,
            >,
            Replace<ConstU16<6>>,
        >,
    >;
    type DispatchWhitelistedOrigin = EitherOf<EnsureRoot<Self::AccountId>, WhitelistedCaller>;
    type Preimages = Preimage;
    type WeightInfo = stagenet_weights::pallet_whitelist::WeightInfo<Runtime>;
}

pallet_referenda::impl_tracksinfo_get!(TracksInfo, Balance, BlockNumber);

// Referenda Implementation
impl pallet_referenda::Config for Runtime {
    type WeightInfo = stagenet_weights::pallet_referenda::WeightInfo<Runtime>;
    type RuntimeCall = RuntimeCall;
    type RuntimeEvent = RuntimeEvent;
    type Scheduler = Scheduler;
    type Currency = Balances;
    type SubmitOrigin = frame_system::EnsureSigned<AccountId>;
    type CancelOrigin = EitherOf<EnsureRoot<Self::AccountId>, ReferendumCanceller>;
    type KillOrigin = EitherOf<EnsureRoot<Self::AccountId>, ReferendumKiller>;
    type Slash = Treasury;
    type Votes = pallet_conviction_voting::VotesOf<Runtime>;
    type Tally = pallet_conviction_voting::TallyOf<Runtime>;
    type SubmissionDeposit = SubmissionDeposit;
    type MaxQueued = ConstU32<100>;
    type UndecidingTimeout = UndecidingTimeout;
    type AlarmInterval = AlarmInterval;
    type Tracks = TracksInfo;
    type Preimages = Preimage;
}
