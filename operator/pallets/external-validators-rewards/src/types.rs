use snowbridge_outbound_queue_primitives::SendError;
use sp_core::H256;
use sp_std::vec::Vec;

/// Utils needed to generate/verify merkle roots/proofs inside this pallet.
#[derive(Debug, PartialEq, Eq, Clone)]
pub struct EraRewardsUtils {
    pub rewards_merkle_root: H256,
    pub leaves: Vec<H256>,
    pub leaf_index: Option<u64>,
    pub total_points: u128,
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
