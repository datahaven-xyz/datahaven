/// Time and blocks.
pub mod time {
    use polkadot_primitives::{BlockNumber, Moment};
    use polkadot_runtime_common::prod_or_fast;

    pub const MILLISECS_PER_BLOCK: Moment = 6000;
    pub const SLOT_DURATION: Moment = MILLISECS_PER_BLOCK;

    const ONE_HOUR: BlockNumber = HOURS;
    const ONE_MINUTE: BlockNumber = MINUTES;

    frame_support::parameter_types! {
        pub const EpochDurationInBlocks: BlockNumber = prod_or_fast!(ONE_HOUR, ONE_MINUTE);
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
