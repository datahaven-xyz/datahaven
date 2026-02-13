// Copyright (C) Moondance Labs Ltd.
// This file is part of Tanssi.

// Tanssi is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Tanssi is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Tanssi.  If not, see <http://www.gnu.org/licenses/>

use alloc::vec::Vec;
use snowbridge_outbound_queue_primitives::SendError;
use sp_core::{H160, H256};

/// Data needed for EigenLayer rewards submission via Snowbridge.
#[derive(Debug, PartialEq, Eq, Clone)]
pub struct EraRewardsUtils {
    pub era_index: u32,
    pub era_start_timestamp: u32,
    pub total_points: u128,
    pub individual_points: Vec<(H160, u32)>,
    pub inflation_amount: u128,
}

pub trait SendMessage {
    type Message;
    type Ticket;

    fn build(utils: &EraRewardsUtils) -> Option<Self::Message>;

    fn validate(message: Self::Message) -> Result<Self::Ticket, SendError>;

    fn deliver(ticket: Self::Ticket) -> Result<H256, SendError>;
}

// Trait for handling inflation
pub trait HandleInflation<AccountId> {
    fn mint_inflation(who: &AccountId, amount: u128) -> sp_runtime::DispatchResult;
}

impl<AccountId> HandleInflation<AccountId> for () {
    fn mint_inflation(_: &AccountId, _: u128) -> sp_runtime::DispatchResult {
        Ok(())
    }
}

#[cfg(feature = "runtime-benchmarks")]
pub trait BenchmarkHelper {
    fn setup();
}

#[cfg(feature = "runtime-benchmarks")]
impl BenchmarkHelper for () {
    fn setup() {
        ()
    }
}
