use alloy_core::{
    primitives::{Address, U256},
    sol,
    sol_types::SolCall,
};
use pallet_external_validator_slashes::SlashData;
use snowbridge_outbound_queue_primitives::v2::SendMessage;
use snowbridge_outbound_queue_primitives::v2::{Command, Message as OutboundMessage};
use snowbridge_outbound_queue_primitives::SendError;
use sp_core::{H160, H256};
use sp_std::vec;
use sp_std::vec::Vec;

use crate::AccountId;

sol! {
    // Slashing request to be send to the DatahavenServiceManager
    struct SlashingRequest {
        address operator;
        address[] strategies;
        uint256[] wadsToSlash;
        string description;
    }

    // function to call in the DatahavenServiceManager to process all the slashing requests (batching)
    function slashValidatorsOperator(SlashingRequest[] calldata slashings) external;
}

/// Gas limit for the submitRewards call on Ethereum.
pub const SLASH_VALIDATORS_GAS_LIMIT: u64 = 1_000_000;

/// Configuration for slashes submission.
///
/// Runtimes implement this trait to provide environment-specific values
/// such as contract address and the slash agent origin.
pub trait SlashesSubmissionConfig {
    type OutboundQueue: snowbridge_outbound_queue_primitives::v2::SendMessage<
        Ticket = OutboundMessage,
    >;

    /// Get the DataHaven ServiceManager contract address on Ethereum.
    fn service_manager_address() -> H160;

    /// Get the agent origin for outbound messages.
    fn slashes_agent_origin() -> H256;

    /// Get the strategies to slash.
    fn strategies() -> Vec<H160>;
}

/// Generic slashes submission adapter.
///
/// This adapter implements [`SendMessage`] and uses the configuration provided
/// by [`SlashesSubmissionConfig`] to build, validate, and deliver slashes
/// messages to EigenLayer via Snowbridge.
pub struct SlashesSubmissionAdapter<C>(core::marker::PhantomData<C>);

impl<C: SlashesSubmissionConfig> pallet_external_validator_slashes::SendMessage<AccountId>
    for SlashesSubmissionAdapter<C>
{
    type Message = OutboundMessage;
    type Ticket = OutboundMessage;
    fn build(slashes_utils: &Vec<SlashData<AccountId>>, era: u32) -> Option<Self::Message> {
        let strategies = C::strategies();
        let calldata = encode_slashing_request(slashes_utils, strategies);

        let command = Command::CallContract {
            target: C::service_manager_address(),
            calldata,
            gas: SLASH_VALIDATORS_GAS_LIMIT,
            value: 0,
        };
        let message = OutboundMessage {
            origin: C::slashes_agent_origin(),
            id: H256::from_low_u64_be(era as u64).into(),
            fee: 0,
            commands: match vec![command].try_into() {
                Ok(cmds) => cmds,
                Err(_) => {
                    log::error!(
                        target: "slashes_send_adapter",
                        "Failed to convert commands: too many commands"
                    );
                    return None;
                }
            },
        };
        Some(message)
    }

    fn validate(message: Self::Message) -> Result<Self::Ticket, SendError> {
        C::OutboundQueue::validate(&message)
    }
    fn deliver(message: Self::Ticket) -> Result<H256, SendError> {
        C::OutboundQueue::deliver(message)
    }
}

fn encode_slashing_request(
    slashes_utils: &Vec<SlashData<AccountId>>,
    strategies: Vec<H160>,
) -> Vec<u8> {
    let mut slashings: Vec<SlashingRequest> = vec![];

    // Extend with operator address to slash
    for slash_operator in slashes_utils {
        // slashing all the strategies
        let wads_to_slash = strategies
            .iter()
            .map(|_| U256::from(slash_operator.wad_to_slash))
            .collect();

        let slashing_request = SlashingRequest {
            operator: Address::from(slash_operator.validator.0),
            strategies: strategies
                .iter()
                .map(|s| Address::from(s.as_fixed_bytes()))
                .collect(),
            wadsToSlash: wads_to_slash, // We only have one strategy deployed
            description: "Slashing validator".into(),
        };

        slashings.push(slashing_request);
    }

    // Use the `slashValidatorsOperator` function defined in the sol! macro to build the Ethereum call and encoded it correctly
    let calldata = slashValidatorsOperatorCall { slashings }.abi_encode();

    return calldata;
}
