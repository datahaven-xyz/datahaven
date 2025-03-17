#![cfg_attr(not(feature = "std"), no_std)]

/// Time and blocks.
pub mod time {
    use polkadot_runtime_common::prod_or_fast;

    use polkadot_primitives::{BlockNumber, Moment};
    pub const MILLISECS_PER_BLOCK: Moment = 6000;
    pub const SLOT_DURATION: Moment = MILLISECS_PER_BLOCK;

    frame_support::parameter_types! {
        pub const EpochDurationInBlocks: BlockNumber = prod_or_fast!(1 * HOURS, 1 * MINUTES);
    }

    // These time units are defined in number of blocks.
    pub const MINUTES: BlockNumber = 60_000 / (MILLISECS_PER_BLOCK as BlockNumber);
    pub const HOURS: BlockNumber = MINUTES * 60;
    pub const DAYS: BlockNumber = HOURS * 24;
    pub const WEEKS: BlockNumber = DAYS * 7;
}
