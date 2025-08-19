use snowbridge_outbound_queue_primitives::SendError;
use sp_core::H256;

pub trait DeliverMessage {
    type Ticket;

    fn deliver(ticket: Self::Ticket) -> Result<H256, SendError>;
}

/// TODO: populate this with what we need
#[derive(Debug, PartialEq, Eq, Clone)]
pub struct SlashDataUtils();

pub trait SendMessage {
    type Message;
    type Ticket;

    fn build(utils: &SlashDataUtils) -> Option<Self::Message>;

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
