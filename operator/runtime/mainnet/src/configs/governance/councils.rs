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

//! Council and Collective configurations for DataHaven Mainnet Runtime
//!
//! This module configures the collective pallets that form the governance councils,
//! similar to Moonbeam's Technical Committee and Treasury Council.

use super::*;
use crate::governance::referenda::{FastGeneralAdminOrRoot, GeneralAdminOrRoot};
use frame_support::parameter_types;

parameter_types! {
    pub MaxProposalWeight: Weight = Perbill::from_percent(50) * RuntimeBlockWeights::get().max_block;
    pub TechnicalMotionDuration: BlockNumber = 14 * DAYS;
}

// Technical Committee Implementation
pub type TechnicalCommitteeInstance = pallet_collective::Instance1;
impl pallet_collective::Config<TechnicalCommitteeInstance> for Runtime {
    type RuntimeOrigin = RuntimeOrigin;
    type Proposal = RuntimeCall;
    type RuntimeEvent = RuntimeEvent;
    /// The maximum amount of time (in blocks) for technical committee members to vote on motions.
    /// Motions may end in fewer blocks if enough votes are cast to determine the result.
    type MotionDuration = TechnicalMotionDuration;
    /// The maximum number of proposals that can be open in the technical committee at once.
    type MaxProposals = ConstU32<100>;
    /// The maximum number of technical committee members.
    type MaxMembers = ConstU32<100>;
    type DefaultVote = pallet_collective::MoreThanMajorityThenPrimeDefaultVote;
    type SetMembersOrigin = GeneralAdminOrRoot;
    type WeightInfo = mainnet_weights::pallet_collective_technical_committee::WeightInfo<Runtime>;
    type MaxProposalWeight = MaxProposalWeight;
    type DisapproveOrigin = FastGeneralAdminOrRoot;
    type KillOrigin = FastGeneralAdminOrRoot;
    type Consideration = ();
}

// Treasury Council Implementation
pub type TreasuryCouncilInstance = pallet_collective::Instance2;
impl pallet_collective::Config<TreasuryCouncilInstance> for Runtime {
    type RuntimeOrigin = RuntimeOrigin;
    type Proposal = RuntimeCall;
    type RuntimeEvent = RuntimeEvent;
    /// The maximum amount of time (in blocks) for treasury council members to vote on motions.
    /// Motions may end in fewer blocks if enough votes are cast to determine the result.
    type MotionDuration = ConstU32<{ 3 * DAYS }>;
    /// The maximum number of proposals that can be open in the treasury council at once.
    type MaxProposals = ConstU32<20>;
    /// The maximum number of treasury council members.
    type MaxMembers = ConstU32<9>;
    type DefaultVote = pallet_collective::MoreThanMajorityThenPrimeDefaultVote;
    type SetMembersOrigin = GeneralAdminOrRoot;
    type WeightInfo = mainnet_weights::pallet_collective_treasury_council::WeightInfo<Runtime>;
    type MaxProposalWeight = MaxProposalWeight;
    type DisapproveOrigin = FastGeneralAdminOrRoot;
    type KillOrigin = FastGeneralAdminOrRoot;
    type Consideration = ();
}
