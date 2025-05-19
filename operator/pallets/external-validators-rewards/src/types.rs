use ethabi::{Token, U256};
use parity_scale_codec::{Decode, Encode};
use scale_info::TypeInfo;
use snowbridge_core::ChannelId;
use snowbridge_outbound_queue_primitives::{v1::Fee, SendError};
use sp_core::H256;
use sp_runtime::RuntimeDebug;
use sp_std::vec::Vec;

/// A command which is executable by the Gateway contract on Ethereum
#[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo, PartialEq)]
pub enum Command {
    // TODO: add real commands here
    Test(Vec<u8>),
    ReportRewards {
        // external identifier for validators
        external_idx: u64,
        // index of the era we are sending info of
        era_index: u32,
        // total_points for the era
        total_points: u128,
        // new tokens inflated during the era
        tokens_inflated: u128,
        // merkle root of vec![(validatorId, rewardPoints)]
        rewards_merkle_root: H256,
        // the token id in which we need to mint
        token_id: H256,
    },
}

impl Command {
    /// Compute the enum variant index
    pub fn index(&self) -> u8 {
        match self {
            // Starting from 32 to keep compatibility with Snowbridge Command enum
            Command::Test { .. } => 32,
            Command::ReportRewards { .. } => 33,
        }
    }

    /// ABI-encode the Command.
    pub fn abi_encode(&self) -> Vec<u8> {
        match self {
            Command::Test(payload) => {
                ethabi::encode(&[Token::Tuple(vec![Token::Bytes(payload.clone())])])
            }
            Command::ReportRewards {
                external_idx,
                era_index,
                total_points,
                tokens_inflated,
                rewards_merkle_root,
                token_id,
            } => {
                let external_idx_token = Token::Uint(U256::from(*external_idx));
                let era_index_token = Token::Uint(U256::from(*era_index));
                let total_points_token = Token::Uint(U256::from(*total_points));
                let tokens_inflated_token = Token::Uint(U256::from(*tokens_inflated));
                let rewards_mr_token = Token::FixedBytes(rewards_merkle_root.0.to_vec());
                let token_id_token = Token::FixedBytes(token_id.0.to_vec());

                ethabi::encode(&[Token::Tuple(vec![
                    external_idx_token,
                    era_index_token,
                    total_points_token,
                    tokens_inflated_token,
                    rewards_mr_token,
                    token_id_token,
                ])])
            }
        }
    }
}

// A message which can be accepted by implementations of `/[`SendMessage`\]`
#[derive(Encode, Decode, TypeInfo, Clone, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(PartialEq))]
pub struct Message {
    /// ID for this message. One will be automatically generated if not provided.
    ///
    /// When this message is created from an XCM message, the ID should be extracted
    /// from the `SetTopic` instruction.
    ///
    /// The ID plays no role in bridge consensus, and is purely meant for message tracing.
    pub id: Option<H256>,
    /// The message channel ID
    pub channel_id: ChannelId,
    /// The stable ID for a receiving gateway contract
    pub command: Command,
}

pub trait TicketInfo {
    fn message_id(&self) -> H256;
}

impl TicketInfo for () {
    fn message_id(&self) -> H256 {
        H256::zero()
    }
}

pub trait ValidateMessage {
    type Ticket: TicketInfo;

    fn validate(message: &Message) -> Result<(Self::Ticket, Fee<u64>), SendError>;
}

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
