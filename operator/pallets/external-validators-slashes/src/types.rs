use snowbridge_outbound_queue_primitives::SendError;
use sp_core::H256;
use sp_runtime::Vec;

pub trait DeliverMessage {
    type Ticket;

    fn deliver(ticket: Self::Ticket) -> Result<H256, SendError>;
}

// TMP
#[derive(Debug, PartialEq, Eq, Clone)]
pub struct SlashData<AccountId> {
    pub validator: AccountId,
    pub amount_to_slash: u128,
}

/// TODO: populate this with what we need
#[derive(Debug, PartialEq, Eq, Clone)]
pub struct SlashDataUtils<AccountId>(pub Vec<SlashData<AccountId>>);

pub trait SendMessage<AccountId> {
    type Message;
    type Ticket;

    fn build(utils: &SlashDataUtils<AccountId>) -> Option<Self::Message>;

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
