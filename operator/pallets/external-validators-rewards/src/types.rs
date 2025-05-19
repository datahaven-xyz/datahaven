use snowbridge_outbound_queue_primitives::SendError;
use sp_core::H256;
use sp_std::vec::Vec;

// A trait to retrieve the external index provider identifying some set of data
// In starlight, used to retrieve the external index associated to validators
#[allow(dead_code)]
pub trait ExternalIndexProvider {
    fn get_external_index() -> u64;
}

pub trait DeliverMessage {
    type Ticket;

    fn deliver(ticket: Self::Ticket) -> Result<H256, SendError>;
}

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
