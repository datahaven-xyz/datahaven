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

/// Time and blocks.
pub mod time {
    use polkadot_primitives::{BlockNumber, Moment, SessionIndex};
    use polkadot_runtime_common::prod_or_fast;

    pub const MILLISECS_PER_BLOCK: Moment = 6000;
    pub const SLOT_DURATION: Moment = MILLISECS_PER_BLOCK;

    const ONE_HOUR: BlockNumber = HOURS;
    const ONE_MINUTE: BlockNumber = MINUTES;

    frame_support::parameter_types! {
        pub const EpochDurationInBlocks: BlockNumber = prod_or_fast!(ONE_HOUR, ONE_MINUTE);
        pub const SessionsPerEra: SessionIndex = prod_or_fast!(6, 3);
    }

    // These time units are defined in number of blocks.
    pub const MINUTES: BlockNumber = 60_000 / (MILLISECS_PER_BLOCK as BlockNumber);
    pub const HOURS: BlockNumber = MINUTES * 60;
    pub const DAYS: BlockNumber = HOURS * 24;
    pub const WEEKS: BlockNumber = DAYS * 7;
}

pub mod gas {
    use frame_support::weights::constants::WEIGHT_REF_TIME_PER_SECOND;

    /// Current approximation of the gas/s consumption considering
    /// EVM execution over compiled WASM (on 4.4Ghz CPU).
    /// Given the 1000ms Weight, from which 75% only are used for transactions,
    /// the total EVM execution gas limit is: GAS_PER_SECOND * 1 * 0.75 ~= 30_000_000.
    pub const GAS_PER_SECOND: u64 = 40_000_000;

    /// Approximate ratio of the amount of Weight per Gas.
    /// u64 works for approximations because Weight is a very small unit compared to gas.
    pub const WEIGHT_PER_GAS: u64 = WEIGHT_REF_TIME_PER_SECOND / GAS_PER_SECOND;

    /// The highest amount of new storage that can be created in a block (160KB).
    pub const BLOCK_STORAGE_LIMIT: u64 = 160 * 1024;
}
