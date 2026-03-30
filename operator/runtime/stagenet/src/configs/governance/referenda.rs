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
    type BlockNumberProvider = System;
    type VotingHooks = ();
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
    type BlockNumberProvider = System;
}
